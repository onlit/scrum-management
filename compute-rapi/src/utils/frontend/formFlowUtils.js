const path = require('path');
const { toWords: numberToWords } = require('number-to-words');
const { resolveModelSlug } = require('#utils/api/commonUtils.js');
const {
  createFileFromTemplate,
  formatFile,
  ensureDirExists,
} = require('#utils/shared/fileUtils.js');
const {
  toStartCaseNoSpaces,
  toCamelCase,
  toKebabCase,
} = require('#utils/shared/stringUtils.js');
const {
  renderInternalForeignKeyField,
  generateFieldImportsAndRoutes,
  generateFormFields,
  transformDependencyRulesForFrontend,
} = require('#utils/frontend/createFormUtils.js');
const { consolidateImports } = require('#utils/frontend/commonUtils.js');
const {
  isInternalForeignKey,
} = require('#utils/api/fieldTypeValidationUtils.js');
const {
  formatFieldsForAPIPayload,
} = require('#utils/frontend/validationSchemaUtils.js');
const {
  getDependencyRulesForModel,
} = require('#utils/shared/dependencyRulesUtils.js');
const {
  createForeignKeyScalarFieldName,
} = require('#utils/api/prismaUtils.js');

function getFormFlowSteps(rootModelId, models) {
  const modelMap = new Map();

  // Step 1: Create a map of all models using their IDs as keys for quick and easy lookup later.
  // Why use a map? Because it allows constant-time retrieval of models by ID, making the process much faster.
  // Imagine having hundreds of models — instead of searching through them every time, we can directly access what we need.
  for (const model of models) {
    modelMap.set(model.id, model); // Store each model in the map with its ID as the key.
  }

  // Step 2: Initialize a set to keep track of visited models to avoid processing the same model multiple times.
  // This prevents infinite loops in case models reference each other in a circular way.
  const visited = new Set();

  // Step 3: Initialize an empty array to store the steps for the form flow in the correct order.
  // This array will eventually contain the sequence of steps the user needs to follow to create all necessary models.
  const steps = [];

  // Step 4: Define a recursive function to explore and resolve dependencies for a given model.
  // A recursive function is one that calls itself. Here, it allows us to "dive" into dependencies and handle nested ones.
  function resolveDependencies(modelId, fieldObject) {
    // If the model has already been visited, return immediately to avoid processing it again.
    // This ensures we don't process the same model twice, which could lead to incorrect results or infinite loops.
    if (visited.has(modelId)) return;

    // Mark the current model as visited by adding its ID to the visited set.
    visited.add(modelId);

    // Retrieve the model from the map using its ID. If the model doesn't exist (perhaps due to a typo or data issue), return.
    const model = modelMap.get(modelId);

    if (!model) return; // Safeguard against missing models.

    // Loop through each field in the model's field definitions to find dependencies (foreign key fields).
    // Foreign keys indicate relationships with other models, so we need to handle those first.
    for (const field of model?.fieldDefns) {
      // Check if the field is a foreign key (it links to another model) and has a valid related model ID.
      if (isInternalForeignKey(field) && !field?.foreignKeyModel?.lookup) {
        // Recursively resolve dependencies for the related model.
        // This means we first handle the models this field depends on before processing the current model.
        resolveDependencies(field?.foreignKeyModelId, field);
      }
    }

    // Once all dependencies of the current model are resolved, add the model itself to the steps.
    // Why now? Because the current model depends on its related models, so they must be handled first.
    steps.push({
      id: model?.id,
      step: model.label ?? model.name,
      field: fieldObject,
    }); // Add the model's name and label to the steps array.
  }

  // Step 5: Start the process by resolving dependencies for the root model (the one where useFormFlow is true).
  // This is the "starting point" for our flow, and everything else will branch out from here.
  resolveDependencies(rootModelId);

  // Step 6: Return the final list of steps, ordered by dependencies.
  // The steps array now contains the correct order of models to create, starting with the most fundamental ones.
  return steps;
}

/**
 * Generates stepValidationFields mapping - maps step index to field names for per-step validation.
 * Each step contains the fields that should be validated before proceeding to the next step.
 *
 * @param {Array} steps - The form flow steps from getFormFlowSteps
 * @param {Array} fieldsToInsert - The remaining fields for the last step
 * @param {Object} model - The model definition
 * @returns {string} - Generated stepValidationFields object entries as string
 */
function generateStepValidationFields(steps, fieldsToInsert, model) {
  const stepValidationEntries = [];

  steps.forEach((step, index) => {
    const isLastStep = index === steps.length - 1;

    if (isLastStep) {
      // Last step contains all remaining required fields from the model
      const requiredFieldNames = fieldsToInsert
        .filter((field) => field.required)
        .map((field) => toCamelCase(field.name));

      if (requiredFieldNames.length > 0) {
        stepValidationEntries.push(
          `${index}: [${requiredFieldNames.map((name) => `'${name}'`).join(', ')}]`
        );
      } else {
        stepValidationEntries.push(`${index}: []`);
      }
    } else {
      // Non-last steps contain the FK field for that step
      if (step.field) {
        // FK fields use the scalar field name (e.g., locationAddressId, not locationAddress)
        const fieldName = createForeignKeyScalarFieldName(toCamelCase(step.field.name));
        stepValidationEntries.push(`${index}: ['${fieldName}']`);
      } else {
        stepValidationEntries.push(`${index}: []`);
      }
    }
  });

  return stepValidationEntries.join(',\n  ');
}

/**
 * Generates form flow validation fields for FK fields from dependency steps.
 * These fields need to be added to the validation schema because they're
 * required in the form flow but might not be in the base model schema.
 * Only adds fields that are NOT on the main model (as those are already in the base schema).
 *
 * @param {Array} steps - The form flow steps from getFormFlowSteps
 * @param {Object} mainModel - The main model for the form flow
 * @returns {string} - Generated Yup validation entries as string
 */
function generateFormFlowValidationFields(steps, mainModel) {
  const validationFields = [];

  // Get the set of field IDs that are on the main model
  const mainModelFieldIds = new Set(mainModel?.fieldDefns?.map((f) => f.id) ?? []);

  // Add validation for FK fields from dependency steps that are NOT on the main model
  steps.forEach((step, index) => {
    const isLastStep = index === steps.length - 1;

    // Only add if: not last step, has a field, and field is NOT on the main model
    if (!isLastStep && step.field && !mainModelFieldIds.has(step.field.id)) {
      // FK fields use the scalar field name (e.g., locationAddressId, not locationAddress)
      const fieldName = createForeignKeyScalarFieldName(toCamelCase(step.field.name));
      const fieldLabel = step.field.label || step.step;
      validationFields.push(
        `// Add form flow specific required fields not in the base schema\n  ${fieldName}: Yup.mixed().label('${fieldLabel}').required()`
      );
    }
  });

  return validationFields.join(',\n  ');
}

async function addFormFlow({
  frontend,
  model,
  models,
  user,
  microserviceSlug,
  externalFks,
} = {}) {
  const slug = resolveModelSlug(model);
  const camelCased = toCamelCase(model?.name);
  const startCased = toStartCaseNoSpaces(model?.name);
  const modelLabel = model?.label ?? startCased;
  const steps = getFormFlowSteps(model?.id, models);

  const stepsJson = steps.map(
    ({ id, step }) => `{ id: '${id}', label: '${step}' }`
  );

  const formFolder = [frontend?.path, 'src', 'pages', 'ff', slug];

  await ensureDirExists(path.join(...formFolder));

  const destinationPathSegments = [...formFolder, 'index.tsx'];

  const formStepFields = steps
    .filter(({ field }) => !!field)
    .map((formStep, index) => {
      const stepNum = toStartCaseNoSpaces(numberToWords(index + 1));

      return `function Step${stepNum}Fields() {
                const { values, setFieldValue } = useFormikContext<Record<string, any>>();
                const fieldStates = useDependencyRules(values, dependencyRules);
                const disabledFields: string[] = [];

                return (<Grid container spacing={2}>
                  ${renderInternalForeignKeyField(formStep?.field, { name: formStep?.step }, { externalFks }, null, models)}
                </Grid>);
              }`;
    });

  const formSteps = steps.map((formStep, index) => {
    const stepNum = toStartCaseNoSpaces(numberToWords(index + 1));
    return `<Step${stepNum}Fields key='${stepNum}' />`;
  });

  const alreadyInsertedFieldIds = steps
    .filter(({ field }) => !!field)
    .map(({ field }) => field.id);

  const fieldsToInsert = model?.fieldDefns.filter(
    ({ id }) => !alreadyInsertedFieldIds.includes(id)
  );

  const lastStep = toStartCaseNoSpaces(numberToWords(steps.length));

  formStepFields.push(`function Step${lastStep}Fields() {
                const { values, setFieldValue } = useFormikContext<Record<string, any>>();
                const fieldStates = useDependencyRules(values, dependencyRules);
                const disabledFields: string[] = [];

                return (<Grid container spacing={2}>
                  ${generateFormFields(
                    model,
                    fieldsToInsert,
                    {
                      ForeignKey: { externalFks, microserviceSlug },
                      ExternalForeignKey: { externalFks, microserviceSlug },
                    },
                    models
                  )}
                </Grid>);
              }`);

  const fieldDefinitions = [
    ...steps
      .filter(({ field }) => {
        return field && field.dataType;
      })
      .map(({ field }) => field),
    ...fieldsToInsert,
  ];

  const { formFieldImports } = generateFieldImportsAndRoutes({
    fieldDefinitions,
    microserviceSlug,
    externalFks,
    // Include moment for DateTime field transformations in CUSTOM_ASSIGNMENTS
    includeMoment: true,
    // FormFlow imports types from Create form, so skip type-only imports
    includeInterfaceTypes: false,
  });

  const { customFieldNames, customAssignments } = formatFieldsForAPIPayload(
    model?.fieldDefns
  );

  // Generate stepValidationFields - maps step index to field names for validation
  const stepValidationFields = generateStepValidationFields(steps, fieldsToInsert, model);

  // Generate form flow validation fields for FK fields from dependency steps
  const formFlowValidationFields = generateFormFlowValidationFields(steps, model);

  // Fetch dependency rules for this model
  const dependencyRules = await getDependencyRulesForModel(model.id);
  const transformedRules = transformDependencyRulesForFrontend(dependencyRules);

  await createFileFromTemplate({
    destinationPathSegments,
    templatePathSegments: [
      frontend?.constructorPath,
      'entity-core',
      'core',
      'forms',
      'FormFlow.template.tsx',
    ],
    templateReplacements: {
      '@gen{MICROSERVICE_NAME|kebab}': toKebabCase(microserviceSlug),
      '@gen{MICROSERVICE_NAME|StartCase}':
        toStartCaseNoSpaces(microserviceSlug),
      '@gen{MICROSERVICE_SLUG}': microserviceSlug,
      '@gen{MODEL_NAME|StartCase}': startCased,
      '@gen{MODEL_NAME|Pascal}': startCased,
      '@gen{MODEL_NAME|camel}': camelCased,
      '@gen{MODEL_NAME_START_CASE}': startCased,
      '@gen{MODEL_LABEL}': modelLabel,
      '@gen{MODEL_NAME_START_CASE_CREATE_FORM_FLOW}': `${startCased}CreateFormFlow`,
      '@gen{MODEL_NAME_START_CASE_VAR}': `new${startCased}`,
      '@gen{MODEL_NAME_CAMEL_ITEMS}': `${camelCased}Items`,
      '@gen{GET_MODEL_URL_FUNCTION}': `get${startCased}URL`,
      '@gen{DEPENDENCY_RULES_JSON}': JSON.stringify(transformedRules),
      '// @gen:IMPORTS': consolidateImports(formFieldImports).join('\n'),
      '// @gen:NAVIGATION_ITEMS': stepsJson.join(',\n'),
      '// @gen:STEP_FIELD_COMPONENTS': formStepFields.join('\n\n'),
      '// @gen:STEP_FIELDS': formSteps.join(','),
      '// @gen:STEP_VALIDATION_FIELDS': stepValidationFields,
      '// @gen:FORM_FLOW_VALIDATION_FIELDS': formFlowValidationFields,
      '@gen{CUSTOM_FIELD_NAMES_DESTRUCTURE}': customFieldNames?.length
        ? `${customFieldNames.join(', ')}, `
        : '',
      '// @gen:CUSTOM_ASSIGNMENTS': customAssignments.join('\n'),
    },
    user,
  });

  await formatFile(path.join(...destinationPathSegments));
}

module.exports = { getFormFlowSteps, addFormFlow };
