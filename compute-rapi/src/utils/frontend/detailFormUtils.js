const path = require('path');
const {
  ensureDirExists,
  createFileFromTemplate,
  formatFile,
} = require('#utils/shared/fileUtils.js');
const {
  toStartCaseNoSpaces,
  toKebabCase,
  toCamelCase,
} = require('#utils/shared/stringUtils.js');
const {
  generateFormFields,
  generateFieldImportsAndRoutes,
  generateFormikInitialValues,
} = require('./createFormUtils.js');
const {
  getFormattedFieldName,
  DISPLAY_VALUE_PROP,
} = require('#utils/api/commonUtils.js');
const {
  processDateAndDateTimeImports,
  consolidateImports,
} = require('#utils/frontend/commonUtils.js');
const {
  formatFieldsForAPIPayload,
} = require('#utils/frontend/validationSchemaUtils.js');
const {
  isExternalForeignKey,
  isInternalForeignKey,
} = require('#utils/api/fieldTypeValidationUtils.js');
const {
  getDependencyRulesForModel,
} = require('#utils/shared/dependencyRulesUtils.js');
const { transformDependencyRulesForFrontend } = require('./createFormUtils.js');

async function addDetailForms({
  frontend,
  models,
  user,
  microserviceSlug,
  externalFks,
} = {}) {
  const formsDirectoryPath = path.join(frontend?.path, 'src', 'core', 'forms');

  await ensureDirExists(formsDirectoryPath);

  for (const model of models) {
    const modelNameInStartCase = toStartCaseNoSpaces(model?.name);
    const modelNameInCamelCase = toCamelCase(model?.name);
    const modelSlug = toKebabCase(model?.name);
    const modelFields = model?.fieldDefns;
    const dependencyRules = await getDependencyRulesForModel(model.id);
    const transformedDependencyRules =
      transformDependencyRulesForFrontend(dependencyRules);

    const fieldOptionMixins = { gridCol: 12 };

    const fieldOptions = {
      ForeignKey: {
        ...fieldOptionMixins,
        externalFks,
        microserviceSlug,
        skipRefetchAfterCreate: true,
      },
      Text: { ...fieldOptionMixins },
      Boolean: { ...fieldOptionMixins },
      Enum: { ...fieldOptionMixins },
      Date: { ...fieldOptionMixins },
      DateTime: { ...fieldOptionMixins },
      ExternalForeignKey: {
        externalFks,
        microserviceSlug,
        ...fieldOptionMixins,
      },
      Upload: { ...fieldOptionMixins, isDetailForm: true },
    };

    const formFields = generateFormFields(
      model,
      modelFields,
      fieldOptions,
      models
    );

    const { formFieldImports } = generateFieldImportsAndRoutes({
      fieldDefinitions: modelFields,
      microserviceSlug,
      externalFks,
      model,
    });

    formFieldImports.push(
      `import FormikDateTimePickerField from '@ps/shared-core/ui/Inputs/DateTimePickerField/FormikDateTimePickerField';`
    );

    // Ensure Upload utilities/components are present if any Upload fields exist
    const hasUploadField = modelFields.some((f) => f.dataType === 'Upload');
    if (hasUploadField) {
      formFieldImports.push(
        `import CurrentUploadValueLink from '@ps/shared-core/ui/Inputs/UploadField/CurrentUploadValueLink';`
      );
      formFieldImports.push(
        `import FormikUploadField from '@ps/shared-core/ui/Inputs/UploadField/FormikUploadField';`
      );
      formFieldImports.push(
        `import { resolveFileOrUrl } from '@ps/shared-core/ui/shared/FormUpload';`
      );
    }

    const initialFieldValues = {};

    for (const field of modelFields) {
      const fieldName = getFormattedFieldName(field?.name, field.isForeignKey);

      if (isInternalForeignKey(field)) {
        const nameWithoutIdPostfix = fieldName.replace('Id', '');
        const labelPath = `recordData?.${nameWithoutIdPostfix}?.${DISPLAY_VALUE_PROP}`;
        initialFieldValues[field?.name] = `{
            id: recordData?.${fieldName},
            label: \`\${${labelPath} ?? '...'}\`
          }`;
        continue;
      }

      if (isExternalForeignKey(field)) {
        const labelPath = `recordData?.details?.${fieldName}?.${DISPLAY_VALUE_PROP}`;

        initialFieldValues[field?.name] = `{
            id: recordData?.${fieldName},
            label: \`\${${labelPath} ?? '...'}\`
          }`;

        continue;
      }

      if (field?.dataType === 'Date') {
        const datePath = `recordData?.${field.name}`;
        initialFieldValues[field?.name] =
          `${datePath} ? moment(${datePath}) : null`;
        continue;
      }

      if (field?.dataType === 'DateTime') {
        const datePath = `recordData?.${field.name}`;
        initialFieldValues[field?.name] = `parseBackendDateTime(${datePath})`;
        continue;
      }

      if (field?.dataType === 'Upload') {
        const urlPath = `recordData?.${field.name}`;
        initialFieldValues[field?.name] = `${urlPath}`;
        continue;
      }

      initialFieldValues[fieldName] = `recordData?.${fieldName}`;
    }

    // Add workflowId initial value if showAutomataSelector is enabled
    if (model?.showAutomataSelector) {
      const labelPath = `recordData?.details?.workflowId?.${DISPLAY_VALUE_PROP}`;
      initialFieldValues.workflowId = `recordData?.workflowId ? {
            id: recordData?.workflowId,
            label: \`\${${labelPath} ?? recordData?.details?.workflowId?.name ?? '...'}\`
          } : undefined`;
    }

    // Add tags initial value (reserved field - always included)
    initialFieldValues.tags = `recordData?.tags ?? ''`;

    let resolvedInitialValues = generateFormikInitialValues(
      modelFields,
      initialFieldValues,
      model
    );
    // Conditionally add comma separator only when there are existing field values
    resolvedInitialValues += resolvedInitialValues
      ? `,\n  createdAt: parseBackendDateTime(recordData?.createdAt)`
      : `createdAt: parseBackendDateTime(recordData?.createdAt)`;

    const dateImports = processDateAndDateTimeImports(modelFields, false);

    const createFormFolderPath = path.join(
      formsDirectoryPath,
      `${modelNameInStartCase}Detail`
    );
    const formPath = [
      createFormFolderPath,
      `${modelNameInStartCase}Detail.tsx`,
    ];

    const { customFieldNames, customAssignments } =
      formatFieldsForAPIPayload(modelFields, model);

    const replacements = {
      modelSlug,
      '@gen{MICROSERVICE_SLUG}': microserviceSlug,
      '@gen{MODEL_NAME|camel}': modelNameInCamelCase,
      '@gen{MODEL_NAME|Pascal}': modelNameInStartCase,
      '@gen{DETAIL_PAGE_FIELDS}': formFields,
      '@gen{DEPENDENCY_RULES_JSON}': JSON.stringify(transformedDependencyRules),
      '// @gen:IMPORTS': `${consolidateImports([
        ...formFieldImports,
        ...dateImports,
      ]).join('\n')}`,
      '@gen{DETAIL_PAGE_INITIAL_VALUES}': resolvedInitialValues,
      '@gen{CUSTOM_FIELD_NAMES}': customFieldNames?.length
        ? `${customFieldNames.join(', ')}, `
        : '',
      '// @gen:CUSTOM_ASSIGNMENTS': customAssignments.join('\n'),
      'get@gen{MODEL_NAME|Pascal}URL': `get${modelNameInStartCase}URL`,
    };

    await createFileFromTemplate({
      destinationPathSegments: formPath,
      templatePathSegments: [
        frontend?.constructorPath,
        'entity-core',
        'core',
        'forms',
        'DetailForm.template.tsx',
      ],
      templateReplacements: replacements,
      user,
    });

    await formatFile(path.join(...formPath));
  }
}

module.exports = { addDetailForms };
