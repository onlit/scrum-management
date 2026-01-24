const path = require('path');
const {
  addCreatorMeta,
  createFileFromTemplate,
  copyFile,
  modifyFile,
  formatFile,
} = require('#utils/shared/fileUtils.js');
const {
  toCamelCase,
  toSnakeCase,
  toCapitalize,
  toPlural,
  modifyStringWithItems,
  extractTemplateFields,
} = require('#utils/shared/stringUtils.js');
const {
  getFormattedFieldName,
  resolveModelSlug,
  getDisplayValueField,
} = require('#utils/api/commonUtils.js');
const { COMPUTE_API_MIDDLEWARES } = require('#configs/constants.js');
const { filterDeleted } = require('#utils/shared/generalUtils.js');
const {
  isInternalForeignKey,
  isExternalForeignKey,
} = require('#utils/api/fieldTypeValidationUtils.js');
const {
  createStandardError,
  withErrorHandling,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  logWithTrace,
  logOperationStart,
  logOperationSuccess,
} = require('#utils/shared/traceUtils.js');

/**
 * Returns a string representing a UUID_KEY_VALUE_PAIRS entry in the new format.
 * Structure: [process.env.HOST]: { route, models: { ModelName: { fieldName: true, ... } } }
 *
 * @param {Object} params
 * @param {string} params.envHost - The environment variable name for the service host (e.g., ACCOUNTS_HOST).
 * @param {('NODE_DETAILS_ROUTE'|'DJANGO_DETAILS_ROUTE')} params.route - The route constant symbol to use.
 * @param {Object<string, Object<string, true>>} params.models - Map of ModelName -> { fieldName: true }
 * @returns {string} A string of the object literal for insertion under UUID_KEY_VALUE_PAIRS.
 *
 * @example
 * createDetailResolverConfig({
 *   envHost: 'BPA_HOST',
 *   route: 'DJANGO_DETAILS_ROUTE',
 *   models: { WorkflowDefn: { workflowId: true } }
 * });
 */
function createDetailResolverConfig({ envHost, route, models } = {}) {
  const modelsEntries = Object.entries(models || {});
  const modelBlocks = modelsEntries
    .map(([modelName, fields]) => {
      const fieldEntries = Object.keys(fields || {});
      const fieldsBlock = fieldEntries.map((f) => `${f}: true`).join(', ');
      return `${modelName}: { ${fieldsBlock} }`;
    })
    .join(',\n');

  return `[process.env.${envHost}]: {\n    route: ${route},\n    models: {\n      ${modelBlocks}\n    },\n  }`;
}

// Validate the setup of repositories
function validateRepositorySetup({ restAPIRepo, devOpsRepo }) {
  return devOpsRepo?.id && devOpsRepo?.triggerToken && restAPIRepo?.clonePath;
}

// Function to filter child models based on onDelete behavior
function filterChildModelsByDeleteBehavior(models, modelId, deleteBehavior) {
  const result = [];

  for (const model of models) {
    const matchingFields = [];

    for (const field of filterDeleted(model?.fieldDefns)) {
      if (
        field?.foreignKeyModelId === modelId &&
        field?.onDelete === deleteBehavior
      ) {
        matchingFields.push(field);
      }
    }

    if (matchingFields.length > 0) {
      // Create a shallow copy of the model without the fieldDefns property
      const { fieldDefns, ...modelWithoutFieldDefns } = model;
      result.push({ model: modelWithoutFieldDefns, fields: matchingFields });
    }
  }

  return result;
}

function generateCascadeDeleteQueries(models, modelId) {
  const cascadeChildModels = filterChildModelsByDeleteBehavior(
    models,
    modelId,
    'Cascade'
  );
  const queries = [];

  for (const childModel of cascadeChildModels) {
    const { model, fields } = childModel;
    const modelNameCamelCased = toCamelCase(model?.name);

    fields.forEach((field) => {
      queries.push(`await prisma.${modelNameCamelCased}.updateMany({
        where: { ${toCamelCase(field?.name)}Id: params?.id, client: user?.client?.id, deleted: null }, data: {
          deleted: new Date().toISOString(),
          updatedBy: user?.id,
        },
      });`);
    });
  }

  return queries;
}

function generateRestrictDeleteQueries(models, modelId) {
  const restrictChildModels = filterChildModelsByDeleteBehavior(
    models,
    modelId,
    'Restrict'
  );
  const queries = [];

  for (const childModel of restrictChildModels) {
    const { model, fields } = childModel;
    const modelNameCamelCased = toCamelCase(model?.name);

    fields.forEach((field) => {
      const fieldNameCamelCased = toCamelCase(field?.name);
      const varName = `${fieldNameCamelCased}ExistsIn${modelNameCamelCased}`;

      queries.push(`
        const ${varName} = await prisma.${modelNameCamelCased}.findFirst({
          where: { ${fieldNameCamelCased}Id: params?.id, client: user?.client?.id, deleted: null },
        });
        
        if (${varName}) {
          throw createError({
            status: 400,
            message: 'Deleting this record is not allowed because there are related ${modelNameCamelCased} records with a restrict delete rule.',
          });
        }
      `);
    });
  }

  return queries;
}

/**
 * Processes models to generate service files from templates with model-specific customizations.
 *
 * Key improvements:
 * - Modularized complex logic into helper functions
 * - Improved error handling for required parameters
 * - Better variable naming and reduced scope pollution
 * - Optimized template replacement handling
 * - Added JSDoc comments for all helper functions
 * - Streamlined data processing pipelines
 */
const processModels = withErrorHandling(
  async ({
    models = [],
    folder,
    templateFolder, // Folder where templates are located (defaults to folder if not specified)
    getNewFileName = () => null,
    srcPath,
    templatesPath,
    templatesName,
    user,
    currentMicroserviceId,
    externalFks,
    req,
    getAdditionalTemplateReplacements,
  } = {}) => {
    // Use templateFolder if provided, otherwise fall back to folder for backwards compatibility
    const resolvedTemplateFolder = templateFolder ?? folder;
    // Validate critical input parameters
    if (!srcPath || !templatesPath || !templatesName) {
      throw createStandardError(
        ERROR_TYPES.VALIDATION,
        'Missing required path parameters for file processing',
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'model_processing_validation',
          details: {
            missingParams: {
              srcPath: !srcPath,
              templatesPath: !templatesPath,
              templatesName: !templatesName,
            },
          },
        }
      );
    }

    logOperationStart('processModels', req, {
      modelCount: models.length,
      folder,
      microserviceId: currentMicroserviceId,
    });

    // Process each model sequentially to maintain file creation order
    for (const model of models) {
      const { name: modelName, id: modelId, fieldDefns = [] } = model;

      // Validate model structure
      if (!modelName || !modelId) {
        logWithTrace('Skipping invalid model', req, { model });
        continue;
      }

      // Generate naming conventions once per model
      const naming = {
        camelCase: toCamelCase(modelName),
        pascalCase: toCapitalize(modelName),
        snakeCase: toSnakeCase(modelName),
      };

      // Process foreign key relationships
      const { internalFkFields, includeClauses, nestedFields } =
        modelGenerationProcessForeignKeyRelations(
          fieldDefns,
          currentMicroserviceId
        );

      // logWithTrace('Processed nested fields', req, {
      //   modelName,
      //   nestedFieldCount: nestedFields?.length || 0,
      // });

      // Generate database operation queries
      const dbQueries = {
        restrict: generateRestrictDeleteQueries(models, modelId),
        cascade: generateCascadeDeleteQueries(models, modelId),
      };

      // Process field classifications
      const fieldClassification = modelGenerationClassifyModelFields(
        fieldDefns,
        internalFkFields
      );

      // Generate dashboard endpoint logic if configured
      const metricEndpointLogic = modelGenerationCreateDashboardLogic(
        model,
        naming,
        externalFks,
        models
      );

      // Configure template replacements
      const templateData = {
        model: naming,
        modelMeta: model,
        dbQueries,
        fieldClassification,
        internalFkFields,
        includeClauses,
        metricEndpointLogic,
        nestedFields,
        fieldDefns, // Include field definitions for test generation
        models, // Include all models for relationship mock generation
      };

      // Generate file path components
      const filePaths = {
        destination: [srcPath, folder, getNewFileName(naming.camelCase)],
        template: [templatesPath, resolvedTemplateFolder, templatesName],
      };

      // Create file from template with replacements
      await createFileFromTemplate({
        destinationPathSegments: filePaths.destination,
        templatePathSegments: filePaths.template,
        templateReplacements: {
          ...modelGenerationCreateTemplateReplacements(templateData),
          ...(typeof getAdditionalTemplateReplacements === 'function'
            ? getAdditionalTemplateReplacements({
                model,
                naming,
                fieldDefns,
                templateData,
              })
            : {}),
        },
        user,
      });

      // Post-processing
      await formatFile(path.join(...filePaths.destination), 'babel');
      // addCreatorMeta({ path: path.join(...filePaths.destination), user });
    }

    logOperationSuccess('processModels', req, {
      processedModels: models.length,
    });
  },
  'model_processing'
);

/**
 * Processes foreign key relationships and generates required clauses
 */
function modelGenerationProcessForeignKeyRelations(
  fieldDefns,
  currentMicroserviceId
) {
  const internalFkFields = fieldDefns.filter(
    (field) =>
      isInternalForeignKey(field) &&
      field.foreignKeyModel?.microserviceId === currentMicroserviceId
  );

  const { includeClauses, nestedFields } = internalFkFields.reduce(
    (acc, field) => {
      const displayValueField = field?.foreignKeyModel?.displayValue;
      const displayValueTemplate = field?.foreignKeyModel?.displayValueTemplate;
      const targetModelFieldDefns = filterDeleted(
        field?.foreignKeyModel?.fieldDefns || []
      );

      if (isExternalForeignKey(displayValueField)) {
        acc.nestedFields.push(field.name);
      }

      acc.includeClauses.push(
        modelGenerationCreateIncludeClause(
          field,
          displayValueField,
          displayValueTemplate,
          targetModelFieldDefns,
          currentMicroserviceId
        )
      );
      return acc;
    },
    { includeClauses: [], nestedFields: [] }
  );

  return {
    internalFkFields,
    includeClauses: includeClauses.join(',\n'),
    nestedFields,
  };
}

/**
 * Classifies model fields into searchable and filterable categories
 */
function modelGenerationClassifyModelFields(fieldDefns) {
  const stringTypes = new Set(['String', 'Email', 'URL', 'IPAddress']);

  return fieldDefns.reduce(
    (acc, { dataType, name, isForeignKey }) => {
      const formattedName = getFormattedFieldName(name, isForeignKey);
      const category = stringTypes.has(dataType) ? 'search' : 'filter';

      acc[`${category}Fields`].push(`'${formattedName}'`);
      return acc;
    },
    { searchFields: [], filterFields: [] }
  );
}

/**
 * Generates the list of filter field names for parseFilters middleware
 * Used in route templates to define which fields can be filtered via query params
 * @param {Array} fieldDefns - Field definitions for the model
 * @returns {string} Formatted list of filter field names for the route template
 */
function generateFilterFieldsList(fieldDefns) {
  // System/visibility fields that should not be exposed as filter fields
  const excludedFields = new Set([
    'id',
    'createdAt',
    'updatedAt',
    'createdBy',
    'updatedBy',
    'deleted',
    'client',
    'everyoneCanSeeIt',
    'anonymousCanSeeIt',
    'everyoneInObjectCompanyCanSeeIt',
    'onlyTheseRolesCanSeeIt',
    'onlyTheseUsersCanSeeIt',
    'isSystemTemplate',
    'workflowInstanceId',
    'workflowId',
    'tags',
    'details',
  ]);

  const filterableFields = (fieldDefns || []).filter((field) => {
    const fieldName = toCamelCase(field.name);
    return !excludedFields.has(fieldName);
  });

  if (filterableFields.length === 0) {
    return '// No filterable fields';
  }

  return filterableFields
    .map((f) => `'${getFormattedFieldName(f.name, f.isForeignKey)}'`)
    .join(',\n  ');
}

/**
 * Generates complete template replacement object
 */
function modelGenerationCreateTemplateReplacements({
  model,
  modelMeta,
  dbQueries,
  fieldClassification,
  internalFkFields,
  includeClauses,
  metricEndpointLogic,
  nestedFields,
  fieldDefns = [],
  models = [],
}) {
  // Build nested display computation calls (DRY via shared util) for list and single-record contexts
  const relationModelPairs = (internalFkFields || [])
    .map((f) => {
      const relName = toCamelCase(f?.name);
      const targetModelName = f?.foreignKeyModel?.name;
      if (!relName || !targetModelName) return null;
      return `{ relation: '${relName}', model: '${targetModelName}' }`;
    })
    .filter(Boolean)
    .join(', ');

  const nestedListCompute = relationModelPairs
    ? `attachNestedDisplayValues(r, [ ${relationModelPairs} ], displayOptions);`
    : '';

  const nestedCreateCompute = relationModelPairs
    ? `attachNestedDisplayValues(new${model.pascalCase}WithDetails, [ ${relationModelPairs} ], displayOptions);`
    : '';

  const nestedGetCompute = relationModelPairs
    ? `attachNestedDisplayValues(found${model.pascalCase}WithDetails, [ ${relationModelPairs} ], displayOptions);`
    : '';

  const attachNestedImport =
    nestedListCompute || nestedCreateCompute || nestedGetCompute
      ? 'attachNestedDisplayValues,'
      : '';

  // Generate the kebab-case pluralized route path (e.g., 'client-engagement-geographies')
  const routePath = resolveModelSlug(modelMeta);

  return {
    modelName: model.camelCase,
    ModelName: model.pascalCase,
    model_name: model.snakeCase,
    'model-names': routePath,
    '@gen{ROUTE_PATH}': routePath,
    '{{ROUTE_PATH}}': routePath,
    '@gen{MODEL_NAME_LITERAL}': modelMeta?.name || '',
    '@gen{DELETE_RESPONSE_KEY}': 'deleted',
    '@gen{RELATION_ARRAY}': (internalFkFields || [])
      .map((f) => toCamelCase(f?.name))
      .filter(Boolean)
      .map((n) => `'${n}'`)
      .join(', '),
    '@gen{VAR_CREATED_WITH_DISPLAY}': 'const',
    '@gen{VAR_FOUND_WITH_DISPLAY}': 'const',
    '// @gen:ATTACH_NESTED_DISPLAY_IMPORT': attachNestedImport,
    '// @gen:RESTRICT_CHECKS': dbQueries.restrict.join('\n\n'),
    '// @gen:CASCADE_DELETE': dbQueries.cascade.join('\n\n'),
    '// @gen:RELATION_FIELDS': internalFkFields
      .map((f) => `'${getFormattedFieldName(f.name, true)}'`)
      .join(', '),
    '// @gen:INCLUDE_FIELDS': includeClauses,
    '// @gen:SEARCH_FIELDS': fieldClassification.searchFields.join(', '),
    '@gen{FILTER_FIELDS}': fieldClassification.filterFields.join(', '),
    '// @gen:FILTER_FIELDS_LIST': generateFilterFieldsList(fieldDefns),
    '@gen{MODEL_NAME_UPPER}_FILTER_FIELDS': `${model.snakeCase.toUpperCase()}_FILTER_FIELDS`,
    '// @gen:DASHBOARD_BAR_CHART': metricEndpointLogic,
    ...modelGenerationBuildNestedAssignments(nestedFields, model.pascalCase),
    '// @gen:COMPUTE_NESTED_DISPLAY_VALUES_LIST': nestedListCompute,
    '// @gen:COMPUTE_NESTED_DISPLAY_VALUES_CREATE': nestedCreateCompute,
    '// @gen:COMPUTE_NESTED_DISPLAY_VALUES_GET': nestedGetCompute,

    // Test generation template replacements
    '// @gen:FACTORY_BUILD_FIELDS': generateFactoryBuildFields(fieldDefns),
    '// @gen:FACTORY_IMPORTS': generateFactoryImports(fieldDefns),
    '// @gen:FACTORY_FK_SETUP': generateFactoryFkSetup(fieldDefns),
    '// @gen:FACTORY_FK_DEFAULTS': generateFactoryFkDefaults(fieldDefns),
    '// @gen:FACTORY_FOR_API_FK_SETUP':
      generateFactoryForApiFkSetup(fieldDefns),
    '// @gen:FACTORY_FOR_API_FK_DEFAULTS':
      generateFactoryForApiFkDefaults(fieldDefns),
    '// @gen:TEST_CREATE_DATA': generateTestCreateData(fieldDefns),
    '// @gen:TEST_UPDATE_DATA': generateTestUpdateData(fieldDefns),
    '// @gen:MINIMAL_UPDATE_DATA': generateMinimalUpdateData(fieldDefns),
    '// @gen:RESPONSE_SCHEMA_FIELDS': generateSchemaFields(fieldDefns),
    '// @gen:VERIFY_CREATE_FIELDS': generateVerifyCreateFields(fieldDefns),
    '// @gen:VERIFY_UPDATE_FIELDS': generateVerifyUpdateFields(fieldDefns),
    '// @gen:VERIFY_DB_UPDATE_FIELDS': generateVerifyDbUpdateFields(fieldDefns),
    '// @gen:VERIFY_GET_RESPONSE_FIELDS':
      generateVerifyGetResponseFields(fieldDefns),
    '// @gen:FIELD_VALIDATION_TESTS': generateFieldValidationTests(
      fieldDefns,
      routePath
    ),
    '// @gen:INVALID_EMAIL_DATA': generateInvalidEmailData(fieldDefns),
    '// @gen:ADDITIONAL_VALIDATION_TESTS': generateAdditionalValidationTests(
      fieldDefns,
      routePath
    ),
    '// @gen:DUPLICATE_UNIQUE_DATA': generateDuplicateUniqueData(fieldDefns),
    '@gen{HAS_DUPLICATE_UNIQUE_DATA}':
      generateHasDuplicateUniqueData(fieldDefns),
    '// @gen:TRAIT_INCOMPLETE_FIELDS':
      generateTraitIncompleteFields(fieldDefns),
    '// @gen:TRAIT_WITH_RELATIONS': generateTraitWithRelations(fieldDefns),
    '// @gen:CREATE_REQUEST_SCHEMA_FIELDS': generateSchemaFields(fieldDefns),
    '// @gen:UPDATE_REQUEST_SCHEMA_FIELDS': generateSchemaFields(fieldDefns),

    // Unit test template replacements
    '// @gen:MOCK_CREATE_DATA': generateMockCreateData(fieldDefns),
    '// @gen:MOCK_UPDATE_DATA': generateMockUpdateData(fieldDefns),
    '// @gen:RELATED_TABLE_MOCKS': generateRelatedTableMocks(
      models,
      modelMeta.id
    ),
    '// @gen:DELETE_RELATED_TABLE_MOCKS': generateDeleteRelatedTableMocks(
      models,
      modelMeta.id
    ),
  };
}

/**
 * Generates nested field assignment templates for model-specific API integrations
 * @param {Array<string>} nestedFields - Fields requiring external API resolution
 * @param {string} pascalCaseName - Model name in PascalCase format
 * @returns {Object} Template replacement object for nested field assignments
 */
/**
 * Generates nested field assignments for all CRUD operations
 * Now handles get/new/list record scenarios
 */
function modelGenerationBuildNestedAssignments(nestedFields, pascalCaseName) {
  if (!nestedFields?.length) {
    return {
      '// @gen:GET_RECORD_CUSTOM_ASSIGNMENTS': '',
      '// @gen:NEW_RECORD_CUSTOM_ASSIGNMENTS': '',
      '// @gen:LIST_RECORD_CUSTOM_ASSIGNMENTS': '',
    };
  }

  // Single record assignments
  const createAssignmentBlock = (prefix) =>
    nestedFields
      .map(
        (field) =>
          `if (${prefix}${pascalCaseName}?.${field}) {
            [${prefix}${pascalCaseName}.${field}] = await getDetailsFromAPI({
              results: [${prefix}${pascalCaseName}.${field}],
              token: user?.accessToken,
            });
          }`
      )
      .join('\n');

  // Batch assignments for list operations
  const listAssignments = nestedFields
    .map((field) => {
      const plural = toPlural(field);
      return `
            // Process ${plural} for batch details
            const ${field}Records = response.results
              .filter(result => result?.${field})
              .map(result => result.${field});
              
            const ${plural}Details = await getDetailsFromAPI({
              results: ${field}Records,
              token: user?.accessToken,
            });

            // Merge details back into results
            response.results.forEach((result, index) => {
              if (result?.${field} && ${plural}Details?.[index]) {
                result.${field} = { 
                  ...result.${field}, 
                  ...${plural}Details[index] 
                };
              }
            });`;
    })
    .join('\n\n');

  return {
    '// @gen:GET_RECORD_CUSTOM_ASSIGNMENTS': createAssignmentBlock('found'),
    '// @gen:NEW_RECORD_CUSTOM_ASSIGNMENTS': createAssignmentBlock('new'),
    '// @gen:LIST_RECORD_CUSTOM_ASSIGNMENTS': listAssignments,
  };
}

/**
 * Generates complete dashboard endpoint implementation logic
 * @param {Object} model Current model configuration
 * @param {Object} naming Model naming conventions (camelCase/pascalCase)
 * @param {Array} externalFks External foreign key references
 * @param {Array} models Microservice model references
 * @returns {string} Complete endpoint implementation code
 */
function modelGenerationCreateDashboardLogic(
  model,
  naming,
  externalFks,
  models
) {
  const { camelCase } = naming;
  const stageField = model?.dashboardStageField;

  if (!stageField?.name) {
    return `
      // Dashboard metrics not configured
      res.status(400).json({
        message: 'Dashboard feature not configured for ${camelCase}',
        code: ERROR_TYPES.BAD_REQUEST,
      });`;
  }

  const stageFieldName = getFormattedFieldName(stageField.name, true);
  const stageModel = models.find((m) => m.id === stageField.foreignKeyModelId);
  const stageModelName = toCamelCase(stageModel?.name);
  const { displayValueField } = getDisplayValueField(stageModel, externalFks);

  const hasOrderField = (stageModel?.fieldDefns ?? []).some(
    (f) => f.name === 'order'
  );

  return `
    const { params, user } = req;

    // 1. Get aggregated counts per stage
    const stageCounts = await prisma.${camelCase}.groupBy({
      by: ['${stageFieldName}'],
      where: { ...getVisibilityFilters(user) },
      _count: { _all: true },
    });

    // 2. Filter records with count ≤ 10
    const filteredStageCounts = stageCounts.filter(s => s._count._all <= 10);

    // 3. Get stage details for filtered entries
    const stages = await prisma.${stageModelName}.findMany({
      where: { id: { in: filteredStageCounts.map(s => s.${stageFieldName}) } },
    });

    // 4. Combine and sort by stage order
    const result = filteredStageCounts
      .map(count => ({
        ...count,
        displayValueField: '${displayValueField}',
        stage: stages.find(s => s.id === count.${stageFieldName}),
      }))
      ${hasOrderField ? '.sort((a, b) => a?.stage?.order - b?.stage?.order);' : ''}
      

    // 5. Return structured response
    res.status(200).json({
      success: true,
      data: result,
      meta: {
        field: '${stageFieldName}',
        totalGroups: filteredStageCounts.length,
      },
    });
  `;
}

/**
 * Generates Prisma include clause for relation fields
 * @param {Object} field Current field definition
 * @param {Object} displayValueField Display field configuration (single field reference)
 * @param {string} displayValueTemplate Display value template string (e.g., "{fieldA} - {fieldB}")
 * @param {Array} targetModelFieldDefns Field definitions of the target model
 * @param {string} currentMicroserviceId Current microservice ID for internal FK check
 * @returns {string} Properly formatted include clause
 */
function modelGenerationCreateIncludeClause(
  field,
  displayValueField,
  displayValueTemplate,
  targetModelFieldDefns,
  currentMicroserviceId
) {
  const { name } = field;
  const relationFieldName = toCamelCase(name);

  // Recursively build nested include for deep internal FK chains
  const buildNestedInclude = (displayField) => {
    if (!displayField) {
      return 'true';
    }

    const isInternal = isInternalForeignKey(displayField);
    const nestedDisplay = displayField?.foreignKeyModel?.displayValue;
    const relationName = toCamelCase(displayField?.name);

    if (isInternal && relationName) {
      if (isInternalForeignKey(nestedDisplay) && nestedDisplay?.name) {
        return `{ ${relationName}: { include: ${buildNestedInclude(nestedDisplay)} } }`;
      }
      return `{ ${relationName}: true }`;
    }

    return 'true';
  };

  // Build nested includes for fields referenced in display value template
  const buildTemplateNestedIncludes = () => {
    const templateFieldNames = extractTemplateFields(displayValueTemplate);
    if (!templateFieldNames.length) return null;

    // Template uses {bankAccount} but FK field is named bankAccountId
    // So we need to match both with and without the Id suffix
    const nameSet = new Set(templateFieldNames.map((n) => toCamelCase(n)));

    // Helper to get the relation name (field name without Id suffix)
    const getRelationName = (fieldName) => {
      const camel = toCamelCase(fieldName);
      return camel.endsWith('Id') ? camel.slice(0, -2) : camel;
    };

    // Find internal FK fields where the relation name (without Id) matches template field names
    const internalFkFieldsFromTemplate = (targetModelFieldDefns || []).filter(
      (f) =>
        nameSet.has(getRelationName(f.name)) &&
        isInternalForeignKey(f) &&
        f.foreignKeyModel?.microserviceId === currentMicroserviceId
    );

    if (!internalFkFieldsFromTemplate.length) return null;

    // Generate includes using the relation name (without Id suffix)
    const nestedIncludes = internalFkFieldsFromTemplate
      .map((f) => `${getRelationName(f.name)}: true`)
      .join(', ');

    return `{ include: { ${nestedIncludes} } }`;
  };

  // Priority 1: Check for display value template (e.g., "{bankAccount} - {date}")
  if (displayValueTemplate && typeof displayValueTemplate === 'string') {
    const templateNestedIncludes = buildTemplateNestedIncludes();
    if (templateNestedIncludes) {
      return `${relationFieldName}: ${templateNestedIncludes}`;
    }
  }

  // Priority 2: Check for single display value field reference
  if (isInternalForeignKey(displayValueField)) {
    return `${relationFieldName}: { include: ${buildNestedInclude(displayValueField)} }`;
  }

  return `${relationFieldName}: true`;
}

// ============================================================================
// TEST GENERATION UTILITIES
// ============================================================================

/**
 * Reserved field names that should be excluded from test data generation
 */
const TEST_RESERVED_FIELDS = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'deletedAt',
  'deletedBy',
  'everyoneCanSeeIt',
  'anonymousCanSeeIt',
  'everyoneInObjectCompanyCanSeeIt',
  'onlyTheseRolesCanSeeIt',
  'onlyTheseUsersCanSeeIt',
]);

/**
 * Generates a test value for a field based on its data type
 * Values are prefixed with d_compute_ for test identification and cleanup
 * @param {Object} field - Field definition
 * @param {string} context - Context string for unique values ('create', 'update', 'factory')
 * @returns {string} JavaScript expression for the test value
 */
function generateTestValueForField(field, context = 'test') {
  const { name, dataType, isForeignKey, enumDefn } = field;
  const fieldName = toCamelCase(name);

  // Skip foreign key fields - they require related records
  if (isForeignKey) {
    return null;
  }

  const testPrefix = 'd_compute_';

  switch (dataType) {
    case 'String':
      return `'${testPrefix}${context}_${fieldName}'`;

    case 'Slug':
      // Slugs must match pattern: ^[a-z0-9]+(?:-[a-z0-9]+)*$
      // Use hyphens instead of underscores, lowercase only
      return `'d-compute-${context.toLowerCase()}-${fieldName.toLowerCase()}'`;

    case 'Email':
      return `'${testPrefix}${context}_${fieldName}@test.example.com'`;

    case 'URL':
      return `'https://example.com/${testPrefix}${context}'`;

    case 'Phone':
      return `'+1234567890'`;

    case 'IPAddress':
      return `'192.168.1.1'`;

    case 'Int':
      return '42';

    case 'Float':
    case 'Decimal':
      return '42.5';

    case 'Percentage':
      return '50';

    case 'Latitude':
      return '40.7128';

    case 'Longitude':
      return '-74.0060';

    case 'Boolean':
      return 'true';

    case 'DateTime':
      return 'new Date().toISOString()';

    case 'Date':
      return "new Date().toISOString().split('T')[0]";

    case 'UUID':
      // For required UUID fields that are NOT foreign keys (like 'cloneFrom'),
      // generate a test UUID value. FK UUIDs are handled separately.
      return "'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'";

    case 'Json':
      return '{ key: "value" }';

    case 'StringArray':
      return `['${testPrefix}item1', '${testPrefix}item2']`;

    case 'IntArray':
      return '[1, 2, 3]';

    case 'Enum':
      // If enum has values, use the first one
      if (enumDefn?.enumValues?.length > 0) {
        const firstValue =
          enumDefn.enumValues[0].value || enumDefn.enumValues[0].name;
        return `'${firstValue}'`;
      }
      return null;

    case 'Upload':
      return "'https://example.com/d_compute_test_upload'"; // URL format for file uploads

    default:
      return `'${testPrefix}${context}_${fieldName}'`;
  }
}

/**
 * Filters fields to only those suitable for test data generation
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {Array} Filtered field definitions
 */
function filterTestableFields(fieldDefns) {
  return (fieldDefns || []).filter((field) => {
    const fieldName = toCamelCase(field.name);
    // Exclude reserved fields and foreign keys
    return !TEST_RESERVED_FIELDS.has(fieldName) && !field.isForeignKey;
  });
}

/**
 * Generates factory build fields for test data factories
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {string} Factory field assignments
 */
function generateFactoryBuildFields(fieldDefns) {
  const testableFields = filterTestableFields(fieldDefns);

  if (testableFields.length === 0) {
    return '// No testable fields available';
  }

  const assignments = testableFields
    .map((field) => {
      const fieldName = toCamelCase(field.name);
      const testValue = generateTestValueForField(field, 'test');
      if (!testValue) return null;

      // For factory, use schema-aware value generators
      let dynamicValue = testValue;
      if (field.dataType === 'String') {
        // Use generateTestValue for schema-aware string generation
        dynamicValue = `generateTestValue(MODEL_NAME, '${fieldName}')`;
      } else if (field.dataType === 'Slug') {
        // Slugs must match pattern: ^[a-z0-9]+(?:-[a-z0-9]+)*$
        // Use generateTestValue and convert to slug format
        dynamicValue = `generateTestValue(MODEL_NAME, '${fieldName}').toLowerCase().replace(/_/g, '-')`;
      } else if (field.dataType === 'Email') {
        // Use generateTestEmail for email generation
        dynamicValue = 'generateTestEmail()';
      } else if (field.dataType === 'URL') {
        // Use generateTestUrl for schema-aware URL generation
        dynamicValue = `generateTestUrl(MODEL_NAME, '${fieldName}')`;
      }

      return `${fieldName}: ${dynamicValue},`;
    })
    .filter(Boolean)
    .join('\n    ');

  return assignments || '// No testable fields available';
}

/**
 * Generates import statements for related factories (internal FKs only)
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {string} Import statements for related factories
 */
function generateFactoryImports(fieldDefns) {
  const internalFks = (fieldDefns || []).filter(
    (field) =>
      isInternalForeignKey(field) &&
      !field.isOptional &&
      !TEST_RESERVED_FIELDS.has(toCamelCase(field.name)) &&
      toCamelCase(field.name) !== 'client'
  );

  if (internalFks.length === 0) {
    return '';
  }

  const imports = internalFks
    .map((field) => {
      const modelName = toCamelCase(field.foreignKeyModel.name);
      const capitalizedModelName = toCapitalize(field.foreignKeyModel.name);
      return `const { create${capitalizedModelName} } = require('#tests/factories/${modelName}.factory.js');`;
    })
    .filter((v, i, a) => a.indexOf(v) === i) // Deduplicate
    .join('\n');

  return imports;
}

/**
 * Generates FK setup code that creates required related records for internal FKs
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {string} FK setup code block
 */
function generateFactoryFkSetup(fieldDefns) {
  const internalFks = (fieldDefns || []).filter(
    (field) =>
      isInternalForeignKey(field) &&
      !field.isOptional &&
      !TEST_RESERVED_FIELDS.has(toCamelCase(field.name)) &&
      toCamelCase(field.name) !== 'client'
  );

  if (internalFks.length === 0) {
    return '// No internal FK setup needed';
  }

  const setupCode = internalFks
    .map((field) => {
      const fieldName = toCamelCase(field.name);
      const relatedModelName = toCamelCase(field.foreignKeyModel.name);
      const capitalizedModelName = toCapitalize(field.foreignKeyModel.name);
      // Use fieldNameId for the override check (Prisma uses Id suffix for FK fields)
      return `const ${relatedModelName} = overrides.${fieldName}Id ? null : await create${capitalizedModelName}();`;
    })
    .join('\n  ');

  return setupCode;
}

/**
 * Generates FK default values for factory data object
 * Internal FKs use created record IDs, external FKs use placeholder UUIDs
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {string} FK field assignments
 */
function generateFactoryFkDefaults(fieldDefns) {
  const requiredFks = (fieldDefns || []).filter(
    (field) =>
      field.isForeignKey &&
      !field.isOptional &&
      !TEST_RESERVED_FIELDS.has(toCamelCase(field.name))
  );

  if (requiredFks.length === 0) {
    return '';
  }

  const defaults = requiredFks
    .map((field) => {
      const fieldName = toCamelCase(field.name);

      // Special handling for 'client' field - fixed test client UUID
      if (fieldName === 'client') {
        return `client: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',`;
      }

      // For internal FKs - use created record's ID with Id suffix
      if (isInternalForeignKey(field)) {
        const relatedModelName = toCamelCase(field.foreignKeyModel.name);
        return `${fieldName}Id: ${relatedModelName}?.id,`;
      }

      // For external FKs - use placeholder UUID with Id suffix
      return `${fieldName}Id: 'aaaaaaaa-0000-0000-0000-000000000001',`;
    })
    .join('\n    ');

  return defaults;
}

/**
 * Generates FK setup code for buildModelNameForApi function.
 * Creates required related records for internal FKs only.
 * External FKs will use placeholder UUIDs.
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {string} FK setup code block
 */
function generateFactoryForApiFkSetup(fieldDefns) {
  const internalFks = (fieldDefns || []).filter(
    (field) =>
      isInternalForeignKey(field) &&
      !field.isOptional &&
      !TEST_RESERVED_FIELDS.has(toCamelCase(field.name)) &&
      toCamelCase(field.name) !== 'client'
  );

  if (internalFks.length === 0) {
    return '// No internal FK setup needed';
  }

  const setupCode = internalFks
    .map((field) => {
      const fieldName = toCamelCase(field.name);
      const relatedModelName = toCamelCase(field.foreignKeyModel.name);
      const capitalizedModelName = toCapitalize(field.foreignKeyModel.name);
      // Use fieldNameId for the override check (API uses Id suffix)
      return `const ${relatedModelName} = overrides.${fieldName}Id ? null : await create${capitalizedModelName}();`;
    })
    .join('\n  ');

  return setupCode;
}

/**
 * Generates FK default values for buildModelNameForApi data object.
 * Uses fieldNameId pattern for API submission.
 * Internal FKs use created record IDs, external FKs use placeholder UUIDs.
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {string} FK field assignments with Id suffix
 */
function generateFactoryForApiFkDefaults(fieldDefns) {
  const requiredFks = (fieldDefns || []).filter(
    (field) =>
      field.isForeignKey &&
      !field.isOptional &&
      !TEST_RESERVED_FIELDS.has(toCamelCase(field.name))
  );

  if (requiredFks.length === 0) {
    return '';
  }

  const defaults = requiredFks
    .map((field) => {
      const fieldName = toCamelCase(field.name);

      // Special handling for 'client' field - skip as it's handled by factory defaults
      if (fieldName === 'client') {
        return null;
      }

      // For internal FKs - use created record's ID with Id suffix
      if (isInternalForeignKey(field)) {
        const relatedModelName = toCamelCase(field.foreignKeyModel.name);
        return `${fieldName}Id: overrides.${fieldName}Id || ${relatedModelName}?.id,`;
      }

      // For external FKs - use placeholder UUID with Id suffix
      return `${fieldName}Id: overrides.${fieldName}Id || 'aaaaaaaa-0000-0000-0000-000000000001',`;
    })
    .filter(Boolean)
    .join('\n    ');

  return defaults;
}

/**
 * Generates test create data for integration/contract tests
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {string} Test data object properties
 */
function generateTestCreateData(fieldDefns) {
  const testableFields = filterTestableFields(fieldDefns);

  // Filter to only required fields for create
  const requiredFields = testableFields.filter(
    (field) => !field.isOptional && field.isOptional !== true
  );

  const fieldsToUse =
    requiredFields.length > 0 ? requiredFields : testableFields.slice(0, 3);

  if (fieldsToUse.length === 0) {
    return '// No testable fields available';
  }

  const assignments = fieldsToUse
    .map((field) => {
      const fieldName = toCamelCase(field.name);
      const testValue = generateTestValueForField(field, 'create');
      if (!testValue) return null;
      return `${fieldName}: ${testValue},`;
    })
    .filter(Boolean)
    .join('\n        ');

  return assignments || '// No testable fields available';
}

/**
 * Generates test update data for integration/contract tests
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {string} Test data object properties
 */
function generateTestUpdateData(fieldDefns) {
  const testableFields = filterTestableFields(fieldDefns);

  if (testableFields.length === 0) {
    return '// No testable fields available';
  }

  // Use first testable field for update
  const field = testableFields[0];
  const fieldName = toCamelCase(field.name);
  const testValue = generateTestValueForField(field, 'updated');

  if (!testValue) {
    return '// No testable fields available';
  }

  return `${fieldName}: ${testValue},`;
}

/**
 * Generates minimal update data (single field) for timestamp verification tests
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {string} Minimal test data object properties
 */
function generateMinimalUpdateData(fieldDefns) {
  return generateTestUpdateData(fieldDefns);
}

/**
 * Generates Joi schema field definitions for contract tests
 * Handles relation fields that can return either UUID strings or full objects
 * when Prisma includes are used in the API.
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {string} Joi schema field definitions
 */
function generateSchemaFields(fieldDefns) {
  const testableFields = (fieldDefns || []).filter((field) => {
    const fieldName = toCamelCase(field.name);
    return !TEST_RESERVED_FIELDS.has(fieldName);
  });

  if (testableFields.length === 0) {
    return '// Schema fields will be validated by BaseEntitySchema';
  }

  const schemaFields = testableFields
    .map((field) => {
      const fieldName = toCamelCase(field.name);
      const isOptional = field.isOptional || field.isForeignKey;
      const optionalChain = isOptional ? '.optional()' : '.required()';
      const allowNull = '.allow(null)';

      // For foreign key fields, use alternatives to accept both UUID string and relation object
      // This handles cases where Prisma include: { relation: true } returns a full object
      if (field.isForeignKey) {
        return `// ${fieldName} can be a UUID string OR a relation object (when included)
  ${fieldName}: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)${allowNull}${optionalChain},`;
      }

      switch (field.dataType) {
        case 'String':
        case 'Slug':
        case 'Phone':
        case 'IPAddress':
          return `${fieldName}: Joi.string()${allowNull}${optionalChain},`;

        case 'Email':
          return `${fieldName}: Joi.string().email()${allowNull}${optionalChain},`;

        case 'URL':
          return `${fieldName}: Joi.string().uri()${allowNull}${optionalChain},`;

        case 'Int':
        case 'Percentage':
          return `${fieldName}: Joi.number().integer()${allowNull}${optionalChain},`;

        case 'Float':
        case 'Decimal':
        case 'Latitude':
        case 'Longitude':
          return `${fieldName}: Joi.number()${allowNull}${optionalChain},`;

        case 'Boolean':
          return `${fieldName}: Joi.boolean()${allowNull}${optionalChain},`;

        case 'DateTime':
        case 'Date':
          return `${fieldName}: Joi.alternatives().try(Joi.string().isoDate(), Joi.date())${allowNull}${optionalChain},`;

        case 'UUID':
          return `${fieldName}: Joi.string().uuid()${allowNull}${optionalChain},`;

        case 'Json':
          // JSON fields can be objects or arrays per input validation schema
          return `${fieldName}: Joi.alternatives().try(Joi.object(), Joi.array())${allowNull}${optionalChain},`;

        case 'StringArray':
          return `${fieldName}: Joi.array().items(Joi.string())${allowNull}${optionalChain},`;

        case 'IntArray':
          return `${fieldName}: Joi.array().items(Joi.number().integer())${allowNull}${optionalChain},`;

        case 'Enum':
          if (field.enumDefn?.enumValues?.length > 0) {
            const values = field.enumDefn.enumValues
              .map((v) => `'${v.value || v.name}'`)
              .join(', ');
            return `${fieldName}: Joi.string().valid(${values})${allowNull}${optionalChain},`;
          }
          return `${fieldName}: Joi.string()${allowNull}${optionalChain},`;

        default:
          return `${fieldName}: Joi.any()${allowNull}${optionalChain},`;
      }
    })
    .filter(Boolean)
    .join('\n  ');

  return (
    schemaFields || '// Schema fields will be validated by BaseEntitySchema'
  );
}

/**
 * Generates verification assertions for create operations
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {string} expect() assertions
 */
function generateVerifyCreateFields(fieldDefns) {
  const testableFields = filterTestableFields(fieldDefns);

  // Filter to only required fields
  const requiredFields = testableFields.filter(
    (field) => !field.isOptional && field.isOptional !== true
  );

  const fieldsToVerify =
    requiredFields.length > 0 ? requiredFields : testableFields.slice(0, 3);

  if (fieldsToVerify.length === 0) {
    return '// Verify record was created';
  }

  const assertions = fieldsToVerify
    .map((field) => {
      const fieldName = toCamelCase(field.name);
      return `expect(dbRecord.${fieldName}).toBeDefined();`;
    })
    .filter(Boolean)
    .join('\n      ');

  return assertions || '// Verify record was created';
}

/**
 * Generates verification assertions for update operations
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {string} expect() assertions
 */
function generateVerifyUpdateFields(fieldDefns) {
  const testableFields = filterTestableFields(fieldDefns);

  if (testableFields.length === 0) {
    return '// Verify record was updated';
  }

  const field = testableFields[0];
  const fieldName = toCamelCase(field.name);

  return `expect(response.body.${fieldName}).toBeDefined();`;
}

/**
 * Generates verification assertions for database update
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {string} expect() assertions
 */
function generateVerifyDbUpdateFields(fieldDefns) {
  return generateVerifyUpdateFields(fieldDefns);
}

/**
 * Generates verification assertions for GET response fields
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {string} expect() assertions
 */
function generateVerifyGetResponseFields(fieldDefns) {
  const testableFields = filterTestableFields(fieldDefns);

  if (testableFields.length === 0) {
    return '// Verify response fields';
  }

  const assertions = testableFields
    .slice(0, 5) // Limit to first 5 fields
    .map((field) => {
      const fieldName = toCamelCase(field.name);
      if (field.isOptional) {
        return `// ${fieldName} is optional`;
      }
      return `expect(response.body.${fieldName}).toBeDefined();`;
    })
    .filter(Boolean)
    .join('\n      ');

  return assertions || '// Verify response fields';
}

/**
 * Generates field validation tests for error handling
 * @param {Array} fieldDefns - Array of field definitions
 * @param {string} routePath - The kebab-case pluralized route path (e.g., 'addresses')
 * @returns {string} Field validation test cases
 */
function generateFieldValidationTests(fieldDefns, routePath) {
  const requiredFields = filterTestableFields(fieldDefns).filter(
    (field) => !field.isOptional && field.isOptional !== true
  );

  if (requiredFields.length === 0) {
    return '// No required fields to validate';
  }

  const field = requiredFields[0];
  const fieldName = toCamelCase(field.name);

  return `it('POST /api/v1/${routePath} returns 400 when ${fieldName} is missing', async () => {
      const invalidData = {
        // Missing required field: ${fieldName}
      };

      const response = await request(server)
        .post('/api/v1/${routePath}')
        .set(authHeaders)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });`;
}

/**
 * Generates invalid email data for validation tests
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {string} Test data with invalid email
 */
function generateInvalidEmailData(fieldDefns) {
  const emailField = (fieldDefns || []).find((f) => f.dataType === 'Email');

  if (!emailField) {
    return '// No email field in this model';
  }

  const fieldName = toCamelCase(emailField.name);
  return `${fieldName}: 'invalid-email-format',`;
}

/**
 * Generates additional validation tests based on field types
 * @param {Array} fieldDefns - Array of field definitions
 * @param {string} routePath - The kebab-case pluralized route path (e.g., 'addresses')
 * @returns {string} Additional validation test cases
 */
function generateAdditionalValidationTests(fieldDefns, routePath) {
  const tests = [];

  // Check for URL fields
  const urlField = (fieldDefns || []).find((f) => f.dataType === 'URL');
  if (urlField) {
    const fieldName = toCamelCase(urlField.name);
    tests.push(`it('POST /api/v1/${routePath} returns error for invalid URL format', async () => {
      const invalidData = {
        ${fieldName}: 'not-a-valid-url',
      };

      const response = await request(server)
        .post('/api/v1/${routePath}')
        .set(authHeaders)
        .send(invalidData);

      expect([400, 422]).toContain(response.status);
    });`);
  }

  return tests.join('\n\n    ') || '// No additional validation tests';
}

/**
 * Generates duplicate unique constraint test data
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {string} Test data for unique constraint testing
 */
function generateDuplicateUniqueData(fieldDefns) {
  const uniqueField = (fieldDefns || []).find(
    (f) => f.isUnique && !f.isForeignKey
  );

  if (!uniqueField) {
    return '// No unique constraints to test';
  }

  const fieldName = toCamelCase(uniqueField.name);
  const testValue = generateTestValueForField(uniqueField, 'duplicate');

  if (!testValue) {
    return '// No unique constraints to test';
  }

  return `${fieldName}: firstRecord.${fieldName}, // Copy unique field from first record`;
}

/**
 * Determines whether duplicate unique constraint data can be generated
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {string} "true" or "false" for template injection
 */
function generateHasDuplicateUniqueData(fieldDefns) {
  const uniqueField = (fieldDefns || []).find(
    (f) => f.isUnique && !f.isForeignKey
  );

  if (!uniqueField) {
    return 'false';
  }

  const testValue = generateTestValueForField(uniqueField, 'duplicate');
  if (!testValue) {
    return 'false';
  }

  return 'true';
}

/**
 * Generates incomplete trait fields for factory
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {string} Incomplete trait field assignments
 */
function generateTraitIncompleteFields(fieldDefns) {
  const optionalFields = filterTestableFields(fieldDefns).filter(
    (f) => f.isOptional
  );

  if (optionalFields.length === 0) {
    return '// No optional fields to set as null';
  }

  const assignments = optionalFields
    .slice(0, 3)
    .map((field) => {
      const fieldName = toCamelCase(field.name);
      return `${fieldName}: null,`;
    })
    .join('\n    ');

  return assignments;
}

/**
 * Generates relation trait setup for factory
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {string} Relation trait implementation
 */
function generateTraitWithRelations(fieldDefns) {
  const fkFields = (fieldDefns || []).filter((f) => f.isForeignKey);

  if (fkFields.length === 0) {
    return '// No relations to set up';
  }

  return '// TODO: Set up related records for testing\n    return modelNameData;';
}

/**
 * Generates mock data for create operation tests in unit tests
 * Uses required fields to create valid mock data
 * @param {Array} fieldDefns - Array of field definitions
 * @returns {string} Mock data object properties
 */
function generateMockCreateData(fieldDefns) {
  // Get required foreign key fields first - these are essential for valid data
  const requiredFkFields = (fieldDefns || []).filter(
    (field) => field.isForeignKey && !field.isOptional
  );

  // Get other required non-FK fields
  const requiredNonFkFields = filterTestableFields(fieldDefns).filter(
    (field) => !field.isOptional && field.isOptional !== true
  );

  const assignments = [];

  // Add foreign key fields with UUID mock values
  for (const field of requiredFkFields) {
    const fieldName = toCamelCase(field.name);
    // Generate a consistent UUID pattern for FK fields
    assignments.push(`${fieldName}Id: 'd8d47913-1b54-4f21-87bc-1f72d1d89f89',`);
  }

  // Add other required fields
  for (const field of requiredNonFkFields) {
    const fieldName = toCamelCase(field.name);
    const testValue = generateTestValueForField(field, 'test');
    if (testValue) {
      assignments.push(`${fieldName}: ${testValue},`);
    }
  }

  // If no assignments, add a generic name field
  if (assignments.length === 0) {
    assignments.push(`name: 'Test ModelName',`);
  }

  return assignments.join('\n      ');
}

/**
 * Generates mock update data for unit tests.
 * Uses the same schema-aware test value generation as create tests.
 * @param {Array} fieldDefns - Field definitions for the model
 * @returns {string} Mock update data assignments
 */
function generateMockUpdateData(fieldDefns) {
  // Get updatable fields (exclude foreign keys and optional fields for simplicity)
  const updatableFields = filterTestableFields(fieldDefns).filter(
    (field) => !field.isOptional || field.isOptional !== true
  );

  const assignments = [];

  // Add updatable fields with appropriate test values
  for (const field of updatableFields) {
    const fieldName = toCamelCase(field.name);
    const testValue = generateTestValueForField(field, 'update');
    if (testValue) {
      assignments.push(`${fieldName}: ${testValue},`);
      // Only include one field for update tests to keep them focused
      break;
    }
  }

  // If no assignments, add a generic name field (will be replaced by actual field if available)
  if (assignments.length === 0) {
    assignments.push(`name: 'd_compute_update_name',`);
  }

  return assignments.join('\n        ');
}

/**
 * Generates Prisma mock entries for related tables in unit tests
 * These are needed for cascade soft delete operations
 * @param {Array} models - All models in the microservice
 * @param {string} modelId - Current model's ID
 * @returns {string} Prisma mock entries for related tables
 */
function generateRelatedTableMocks(models, modelId) {
  if (!models || !modelId) return '';

  const relatedMocks = [];
  const seenModels = new Set();

  // Find models that have foreign keys pointing to this model
  for (const model of models) {
    if (model?.id === modelId) {
      continue;
    }

    const relatedFks = filterDeleted(model?.fieldDefns || []).filter(
      (field) => field?.foreignKeyModelId === modelId
    );

    if (relatedFks.length > 0) {
      const relatedModelName = toCamelCase(model?.name);
      if (!relatedModelName || seenModels.has(relatedModelName)) {
        continue;
      }

      seenModels.add(relatedModelName);
      relatedMocks.push(`${relatedModelName}: {
    updateMany: jest.fn(), // Mock for related table updates during delete
  },`);
    }
  }

  return relatedMocks.join('\n  ');
}

/**
 * Generates mock setup for soft delete cascade in unit tests
 * Sets up resolved promises for related table updateMany calls
 * @param {Array} models - All models in the microservice
 * @param {string} modelId - Current model's ID
 * @returns {string} Mock setup code for soft delete cascade
 */
function generateDeleteRelatedTableMocks(models, modelId) {
  if (!models || !modelId) return '';

  const mockSetups = [];

  // Find models that have foreign keys pointing to this model with cascade delete
  for (const model of models) {
    const cascadeFks = filterDeleted(model?.fieldDefns || []).filter(
      (field) =>
        field?.foreignKeyModelId === modelId && field?.onDelete === 'Cascade'
    );

    if (cascadeFks.length > 0) {
      const relatedModelName = toCamelCase(model?.name);
      mockSetups.push(
        `prisma.${relatedModelName}.updateMany.mockResolvedValue({ count: 0 });`
      );
    }
  }

  return mockSetups.join('\n    ');
}

// ============================================================================
// END TEST GENERATION UTILITIES
// ============================================================================

const createMiddlewareFiles = withErrorHandling(
  async ({ restAPI, COMPUTE_SRC_PATH, user, req } = {}) => {
    logOperationStart('createMiddlewareFiles', req, {
      middlewareCount: COMPUTE_API_MIDDLEWARES.length,
    });

    for (const middleware of COMPUTE_API_MIDDLEWARES) {
      const originPath = path.join(
        restAPI?.constructorPath,
        'middlewares',
        `${middleware}.template.js`
      );
      const newPath = path.join(
        COMPUTE_SRC_PATH,
        'core',
        'middlewares',
        `${middleware}.js`
      );

      await copyFile(originPath, newPath);
      addCreatorMeta({ path: newPath, user });
    }

    logOperationSuccess('createMiddlewareFiles', req, {
      createdFiles: COMPUTE_API_MIDDLEWARES.length,
    });
  },
  'middleware_file_creation'
);

// Function to add imports to app.js
const addImportsInAppJs = withErrorHandling(
  async ({ COMPUTE_SRC_PATH, models, req } = {}) => {
    const appFilePath = path.join(COMPUTE_SRC_PATH, 'app.js');

    // Utility routes go to core/routes/v1/ with .routes.js suffix
    const utilityRoutes = [
      { name: 'Import', isUtility: true },
      { name: 'Export', isUtility: true },
      { name: 'Undelete', isUtility: true },
      { name: 'GetBulkDetail', isUtility: true },
      { name: 'GetInternalBulkDetail', isUtility: true },
    ];

    // All routes go to core/routes/v1/ (model routes use .routes.core.js suffix)
    const modelsModified = [
      ...models.map((m) => ({ ...m, isUtility: false })),
      ...utilityRoutes,
    ];

    logOperationStart('addImportsInAppJs', req, {
      modelCount: modelsModified.length,
    });

    modifyFile(appFilePath, (fileContent) =>
      modifyStringWithItems(
        fileContent,
        modelsModified,
        '// {{ROUTE_IMPORTS}}',
        (model) => {
          const camelCased = toCamelCase(model.name);
          if (model.isUtility) {
            // Utility routes: core/routes/v1/${name}.routes.js
            return `const ${camelCased}Routes = require('#core/routes/v1/${camelCased}.routes.js');`;
          }
          // Model routes: core/routes/v1/${name}.routes.core.js
          return `const ${camelCased}Routes = require('#core/routes/v1/${camelCased}.routes.core.js');`;
        }
      )
    );

    logOperationSuccess('addImportsInAppJs', req, {
      processedModels: modelsModified.length,
    });
  },
  'app_js_import_addition'
);

// Function to add routes to app.js
const addRoutesInAppJs = withErrorHandling(
  async ({ COMPUTE_SRC_PATH, models, req } = {}) => {
    const appFilePath = path.join(COMPUTE_SRC_PATH, 'app.js');

    logOperationStart('addRoutesInAppJs', req, {
      modelCount: models.length,
    });

    modifyFile(appFilePath, (fileContent) => {
      const modelsModified = [
        ...models,
        { name: 'Import' },
        { name: 'Export' },
        { name: 'Undelete' },
        { name: 'GetBulkDetail' },
        { name: 'GetInternalBulkDetail' },
      ];

      return modifyStringWithItems(
        fileContent,
        modelsModified,
        '// {{ROUTE_USES}}',
        (model) => {
          const slug = resolveModelSlug(model);
          const camelCased = toCamelCase(model?.name);
          return `app.use('/api/v1/${slug}', ${camelCased}Routes({ auth: app.locals.authMiddleware }));`;
        }
      );
    });

    logOperationSuccess('addRoutesInAppJs', req, {
      processedModels: models.length,
    });
  },
  'app_js_route_addition'
);

const createUndeleteController = withErrorHandling(
  async ({ models, restAPI, COMPUTE_SRC_PATH, user, req } = {}) => {
    const modelNames = models
      .map(({ name }) => `'${toCamelCase(name)}'`)
      .join(', ');

    logOperationStart('createUndeleteController', req, {
      modelCount: models.length,
    });

    await createFileFromTemplate({
      destinationPathSegments: [
        COMPUTE_SRC_PATH,
        'core',
        'controllers',
        'undelete.controller.js',
      ],
      templatePathSegments: [
        restAPI?.constructorPath,
        'controllers',
        'undelete.controller.template.js',
      ],
      templateReplacements: { '// JS Models': modelNames },
      user,
    });

    logOperationSuccess('createUndeleteController', req, {
      processedModels: models.length,
    });
  },
  'undelete_controller_creation'
);

/**
 * Output path mapping for generated files.
 * All generated files go to src/core/ subdirectories.
 */
const OUTPUT_PATHS = {
  controller: 'core/controllers',
  schema: 'core/schemas',
  routes: 'core/routes/v1',
};

/**
 * File suffix mapping for generated files.
 */
const OUTPUT_SUFFIXES = {
  controller: 'controller.core.js',
  schema: 'schema.core.js',
  routes: 'routes.core.js',
};

/**
 * Get the output path for a generated file type.
 *
 * @param {'controller'|'schema'|'routes'} type - Type of file
 * @param {string} modelName - Model name in camelCase
 * @returns {string} Output path including filename
 */
function getOutputPath(type, modelName) {
  const basePath = OUTPUT_PATHS[type];
  if (!basePath) {
    throw new Error(`Unknown output type: ${type}`);
  }

  const suffix = OUTPUT_SUFFIXES[type];
  return `${basePath}/${modelName}.${suffix}`;
}

module.exports = {
  validateRepositorySetup,
  filterChildModelsByDeleteBehavior,
  processModels,
  createMiddlewareFiles,
  addImportsInAppJs,
  addRoutesInAppJs,
  createUndeleteController,
  createDetailResolverConfig,
  OUTPUT_PATHS,
  getOutputPath,
};
