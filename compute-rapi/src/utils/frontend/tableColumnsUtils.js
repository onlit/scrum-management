const path = require('path');
const {
  toStartCaseNoSpaces,
  toCamelCase,
  convertToSlug,
} = require('#utils/shared/stringUtils.js');
const {
  getDisplayValueField,
  getFormattedFieldName,
  DISPLAY_VALUE_PROP,
} = require('#utils/api/commonUtils.js');
const {
  createFileFromTemplate,
  formatFile,
} = require('#utils/shared/fileUtils.js');
const {
  getModelName,
  getModelFields,
  consolidateImports,
  addForeignKeyToMicroserviceMap,
  sortModelFields,
  resolveDependencyFilterKey,
} = require('#utils/frontend/commonUtils.js');
const { FE_DATA_TYPE_MAP } = require('#configs/constants.js');
const {
  isExternalForeignKey,
  isInternalForeignKey,
} = require('#utils/api/fieldTypeValidationUtils.js');
const { createStandardError } = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES } = require('#configs/constants.js');

function createFieldColumn({ modelField, detailPageLink, type, appendix }) {
  const { name, label, isForeignKey, isClickableLink, dataType } = modelField;
  const fieldName = toCamelCase(name) + (isForeignKey ? 'Id' : '');

  // const shouldRenderCellAsLink = () => {
  //   const isURLType = dataType === 'URL';
  //   const isInteractive = isClickableLink || isURLType;
  //   const shouldRenderCellAsLink = isInteractive && detailPageLink;
  //   return isForeignKey || shouldRenderCellAsLink;
  // };

  const linkHref = `${detailPageLink}/\${row?.id}`;

  // --- Sanitize and Escape Label ---
  // 1. Replace any newline or carriage return sequences with a single space.
  // 2. Trim leading/trailing whitespace that might result.
  // 3. Escape single quotes (') because the output string uses single quotes.
  // 4. Escape backslashes (\) to prevent them from interfering with other escapes.
  const sanitizedHeaderName = label
    .replace(/[\r\n]+/g, ' ') // Replace newlines/CR with a space
    .trim() // Remove leading/trailing whitespace
    .replace(/\\/g, '\\\\') // Escape backslashes FIRST
    .replace(/'/g, "\\'"); // Escape single quotes

  const shouldInjectDetailLink =
    isClickableLink &&
    detailPageLink &&
    dataType !== 'URL' &&
    !(typeof appendix === 'string' && appendix.includes('getURL:'));

  return `{
      isEditable: true,
      accessorKey: '${fieldName}',
      header: \`${sanitizedHeaderName}\`,
      size: 236,
      type: '${type}',
      ${shouldInjectDetailLink ? `getURL: (row) => \`${linkHref}\`,\nopenLinkIn: 'sameTab',` : ''}
      ${appendix}
  }`;
}

/**
 * Asynchronously creates a table columns file for a given frontend model.
 *
 * This function generates a TypeScript file for table columns, utilizing template replacements
 * and auto-imports for any foreign key dependencies based on the provided microservice configuration.
 *
 * @async
 * @function createTableColumnsFile
 * @param {Object} params - Parameters for creating the file.
 * @param {Object} params.frontend - The frontend configuration object containing paths.
 * @param {string} params.frontend.path - The destination path where the file will be created.
 * @param {string} params.frontend.constructorPath - The source path for the template file.
 * @param {Array} params.fieldColumns - Array of field columns to be used in the table columns file.
 * @param {string} params.modelName - The name of the model, which will be used to generate file and variable names.
 * @param {Object} params.user - The user object used for file creation tracking or customization.
 * @param {Object} params.foreignKeysByMicroservice - An object mapping microservice names to arrays of foreign key entities that require importing.
 * @returns {Promise<void>} - A Promise that resolves when the table columns file is successfully created.
 *
 * The function performs the following:
 * - Generates import statements for foreign key URLs if foreign keys exist.
 * - Utilizes a template file to create the new table columns file, replacing placeholders with actual data.
 * - Saves the file to the specified destination.
 */
async function createTableColumnsFile({
  frontend,
  fieldColumns,
  modelName,
  user,
  foreignKeysByMicroservice,
}) {
  // Initialize import statements
  const imports = [];
  const camelCasedModel = toCamelCase(modelName);

  // Import validation schema from app-colocated location
  imports.push(
    `import ${camelCasedModel}Schema from '../validationSchemas/${camelCasedModel}Schema';`
  );

  // Import getRoute from route-registry (routes are registered at app startup)
  if (Object.keys(foreignKeysByMicroservice).length > 0) {
    imports.push(`import { getRoute } from '@ps/entity-core/routes';`);
  }

  // Create the table columns file using the provided template
  await createFileFromTemplate({
    destinationPathSegments: [
      frontend?.path, // Destination folder
      'src',
      'core',
      'configs',
      'tableColumns',
      `${camelCasedModel}Columns.tsx`, // File name generated from the model name
    ],
    templatePathSegments: [
      frontend?.constructorPath, // Source template path
      'entity-core',
      'core',
      'configs',
      'tableColumns.template.tsx',
    ],
    templateReplacements: {
      '// @gen:COLUMNS': `${fieldColumns.join(', ')},`, // Insert the field columns
      '// @gen:IMPORTS': consolidateImports(imports).join('\n'), // Insert dynamically generated import statements
    },
    user, // User information for tracking or personalization purposes
  });
}

async function formatTableColumnsFile({ frontend, modelName }) {
  const camelCased = toCamelCase(modelName);
  await formatFile(
    path.join(
      frontend?.path,
      'src',
      'core',
      'configs',
      'tableColumns',
      `${camelCased}Columns.tsx`
    )
  );
}

/**
 * Generates column definitions for a data table and organizes foreign key relationships by microservice.
 *
 * @function generateFieldColumns
 * @param {Object} config - Configuration object containing input parameters
 * @param {Array<Object>} config.modelFields - Array of model field definitions
 * @param {string} config.detailPageLink - Base URL for detail page links
 * @param {string} config.microserviceSlug - Current microservice identifier in kebab-case
 * @param {Array<Object>} config.externalFks - External foreign key relationships
 * @param {String} config.modelName - Field's model name
 * @returns {Object} Contains column definitions and grouped foreign keys
 *
 * @example
 * const result = generateFieldColumns({
 *   modelFields: [...],
 *   detailPageLink: '/products',
 *   microserviceSlug: 'product-service',
 *   externalFks: [...]
 * });
 */
function generateFieldColumns({
  modelFields,
  detailPageLink,
  microserviceSlug,
  externalFks,
  modelName,
  context,
  models,
  model = null,
}) {
  // Filter out deleted fields, hidden fields, and Vector fields
  // Vector fields are auto-generated via embedding APIs and shouldn't appear in tables
  const fields = modelFields.filter(
    ({ showInTable, deleted, dataType }) =>
      showInTable && !deleted && dataType !== 'Vector'
  );

  // Build a map of parent field IDs to their dependent field names
  // Per DEPENDENT_FIELDS_STANDARD: Parent fields need onChange to clear dependents
  const parentToDependentsMap = {};
  modelFields.forEach((field) => {
    if (field?.dependsOnFieldId) {
      const parentId = field.dependsOnFieldId;
      if (!parentToDependentsMap[parentId]) {
        parentToDependentsMap[parentId] = [];
      }
      // Dependent FK fields use the 'Id' suffix pattern
      const dependentFieldName = field?.isForeignKey
        ? `${toCamelCase(field.name)}Id`
        : toCamelCase(field.name);
      parentToDependentsMap[parentId].push(dependentFieldName);
    }
  });

  // Validate we have at least one visible column
  if (!fields.length) {
    throw createStandardError(
      ERROR_TYPES.BAD_REQUEST,
      'Table should have at least one column',
      {
        context: 'generateFieldColumns',
        details: { modelName, traceId: context?.traceId || context },
      }
    );
  }

  // Initialize foreign key tracking structure
  const foreignKeysByMicroservice = {};
  const camelCasedModel = toCamelCase(modelName);

  // Process each field to create column definitions
  const columns = fields
    .sort(sortModelFields) // Apply custom field ordering
    .map((field) => {
      const {
        dataType,
        isForeignKey,
        enumDefn,
        foreignKeyModel,
        modelId,
        name,
      } = field;
      const fieldName = getFormattedFieldName(name, isForeignKey);

      // Resolve dependency keys for FK filtering in table context
      // - dependencyValueKey: row field name for accessing values (e.g., prospectPipelineId)
      // - dependencyFilterKey: URL param name for API filtering (e.g., pipelineId)
      const dependencyField = field?.dependsOnField || (field?.dependsOnFieldId
        ? modelFields.find((mf) => mf?.id === field.dependsOnFieldId)
        : null);
      const dependencyValueKey = dependencyField?.name
        ? `${toCamelCase(dependencyField.name)}Id`
        : null;
      // For external FKs, get the fieldDefns from the externalFks lookup
      const externalFkDetail = isExternalForeignKey(field)
        ? externalFks.find(({ fieldId }) => fieldId === field.id)
        : null;
      const externalFieldDefns = externalFkDetail?.fieldDefns || null;
      const dependencyFilterKey = resolveDependencyFilterKey(field, dependencyField, externalFieldDefns);

      // Determine base column type and formatting
      let type = FE_DATA_TYPE_MAP[dataType] || 'text';
      let appendix = `validation: ${camelCasedModel}Schema?.${fieldName}`;

      // Handle enumeration fields
      if (dataType === 'Enum' && enumDefn) {
        const enumOptions = enumDefn.enumValues.map(
          ({ label, value }) => `{ label: '${label}', value: '${value}' }`
        );
        appendix = `valueOptions: [${enumOptions.join(',')}],`; // Create select options with labels
      }

      // Handle URL fields as external links opened in a new tab
      if (dataType === 'URL') {
        const urlField = toCamelCase(name);
        appendix = `${appendix},\n      getURL: (row) => row.${urlField},\n      openLinkIn: 'newTab',\n      isExternalLink: true,`;
      }

      // Handle Upload fields similar to URL: open external link in new tab
      if (dataType === 'Upload') {
        type = 'upload';
        const urlField = toCamelCase(name);
        appendix = `${appendix},\n      getURL: (row) => row.${urlField},\n      openLinkIn: 'newTab',\n      isExternalLink: true,`;
      }

      // Process foreign key relationships
      if (isForeignKey) {
        type = 'autocomplete'; // Use autocomplete type for FKs

        // Internal FK (within current microservice)
        if (isInternalForeignKey(field)) {
          const fkModelStartCased = toStartCaseNoSpaces(foreignKeyModel?.name);
          const fkMicroserviceSlug = convertToSlug(
            foreignKeyModel?.microservice?.name ?? ''
          );
          const { displayValueField } = getDisplayValueField(
            foreignKeyModel,
            externalFks,
            null,
            models
          );
          const labelPath = `row?.${DISPLAY_VALUE_PROP} ?? row?.${displayValueField}`;

          // Track FK in microservice grouping
          addForeignKeyToMicroserviceMap(
            foreignKeyModel,
            foreignKeysByMicroservice,
            microserviceSlug
          );

          // Configure autocomplete for internal FK
          const requestKeyConfig = dependencyValueKey
            ? `requestKeyFn: (row) => ['${name}-${modelId}', String(row?.${dependencyValueKey}?.id || 'none')]`
            : `requestKey: ['${name}-${modelId}']`;

          // Per DEPENDENT_FIELDS_STANDARD: Parent fields need onChange to clear dependents
          const dependentFields = parentToDependentsMap[field.id] || [];
          const onChangeConfig =
            dependentFields.length > 0
              ? `onChange: ({ rowId, updateData }) => {
            ${dependentFields.map((depField) => `updateData(rowId, '${depField}', null);`).join('\n            ')}
          },`
              : '';

          appendix = `
            ${requestKeyConfig},
            fetchUrl: getRoute('${fkMicroserviceSlug}/get${fkModelStartCased}URL'),
            renderRow: (row) => ({
              id: row?.id,
              label: ${labelPath} ?? '...'
            })${
              dependencyValueKey && dependencyFilterKey
                ? `,
            urlParamsFn: (row) => row?.${dependencyValueKey}?.id ? \`&${dependencyFilterKey}=\${row.${dependencyValueKey}.id}\` : undefined,
            enabledFn: (row) => !!row?.${dependencyValueKey}?.id`
                : ''
            }${onChangeConfig ? `,\n            ${onChangeConfig}` : ''}
          `;

          // External FK (cross-microservice reference)
        } else if (isExternalForeignKey(field)) {
          const externalFkDetail = externalFks.find(
            ({ fieldId }) => fieldId === field.id
          );
          const fkModel = externalFkDetail?.details?.externalModelId;
          const fkModelStartCased = toStartCaseNoSpaces(fkModel?.name);
          const externalFkMicroserviceSlug = convertToSlug(
            externalFkDetail?.details?.externalMicroserviceId?.name ?? ''
          );
          const labelPath = `row?.${DISPLAY_VALUE_PROP}`;

          // Track external FK in grouping
          addForeignKeyToMicroserviceMap(
            { name: fkModel?.name },
            foreignKeysByMicroservice,
            microserviceSlug
          );

          // Configure autocomplete for external FK
          const requestKeyConfig = dependencyValueKey
            ? `requestKeyFn: (row) => ['${name}-${modelId}', String(row?.${dependencyValueKey}?.id || 'none')]`
            : `requestKey: ['${name}-${modelId}']`;

          // Per DEPENDENT_FIELDS_STANDARD: Parent fields need onChange to clear dependents
          const dependentFields = parentToDependentsMap[field.id] || [];
          const onChangeConfig =
            dependentFields.length > 0
              ? `onChange: ({ rowId, updateData }) => {
            ${dependentFields.map((depField) => `updateData(rowId, '${depField}', null);`).join('\n            ')}
          },`
              : '';

          appendix = `
            ${requestKeyConfig},
            fetchUrl: getRoute('${externalFkMicroserviceSlug}/get${fkModelStartCased}URL'),
            renderRow: (row) => ({
              id: row?.id,
              label: ${labelPath} ?? '...'
            })${
              dependencyValueKey && dependencyFilterKey
                ? `,
            urlParamsFn: (row) => row?.${dependencyValueKey}?.id ? \`&${dependencyFilterKey}=\${row.${dependencyValueKey}.id}\` : undefined,
            enabledFn: (row) => !!row?.${dependencyValueKey}?.id`
                : ''
            }${onChangeConfig ? `,\n            ${onChangeConfig}` : ''}
          `;
        }
      }

      // Generate final column definition
      return createFieldColumn({
        modelField: field,
        type,
        appendix,
        detailPageLink,
      });
    });

  // Add workflowId column if showAutomataSelector is enabled
  if (model?.showAutomataSelector) {
    columns.push(`{
      isEditable: true,
      accessorKey: 'workflowId',
      header: 'Automata Workflow',
      size: 236,
      type: 'autocomplete',
      requestKey: ['${modelName}-workflowId', 'WorkflowDefn-dropdown'],
      fetchUrl: getRoute('automata/getWorkflowsURL'),
      renderRow: (row) => ({
        id: row?.id,
        label: row?.${DISPLAY_VALUE_PROP} ?? row?.name ?? '...'
      })
    }`);
    // Add automata to foreignKeysByMicroservice for getRoute import
    if (!foreignKeysByMicroservice.automata) {
      foreignKeysByMicroservice.automata = [];
    }
  }

  // Add tags column for all models (reserved field)
  columns.push(`{
    isEditable: true,
    accessorKey: 'tags',
    header: 'Tags',
    size: 236,
    type: 'text'
  }`);

  return {
    columns,
    foreignKeysByMicroservice, // Grouped FK references for batch processing
  };
}

async function createTableColumns({
  frontend,
  microserviceSlug,
  detailPageLink,
  user,
  model,
  externalFks,
  models,
} = {}) {
  // Get model name and fields
  const modelName = getModelName({ model });

  const modelFields = getModelFields({ model });

  // Create table columns based on model fields
  const {
    columns: fieldColumns,
    foreignKeysByMicroservice,
    // prettier :D
  } = generateFieldColumns({
    modelFields,
    microserviceSlug,
    detailPageLink,
    externalFks,
    modelName,
    models,
    model,
  });

  await createTableColumnsFile({
    frontend,
    fieldColumns,
    modelName,
    user,
    foreignKeysByMicroservice,
    microserviceSlug,
  });

  await formatTableColumnsFile({ frontend, modelName });
}

module.exports = {
  generateFieldColumns,
  createTableColumnsFile,
  formatTableColumnsFile,
  createTableColumns,
};
