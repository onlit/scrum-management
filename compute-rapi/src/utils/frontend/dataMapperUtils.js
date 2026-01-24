const path = require('path');
const { toCamelCase } = require('#utils/shared/stringUtils.js');
const {
  createFileFromTemplate,
  formatFile,
} = require('#utils/shared/fileUtils.js');
const {
  getDisplayValueField,
  getFormattedFieldName,
  DISPLAY_VALUE_PROP,
} = require('#utils/api/commonUtils.js');
const {
  isExternalForeignKey,
  isInternalForeignKey,
} = require('#utils/api/fieldTypeValidationUtils.js');
const { createStandardError } = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES } = require('#configs/constants.js');

const { getModelName, getModelFields } = require('./commonUtils.js');

async function createTableDataMapperFile({
  frontend,
  mappedKeys,
  modelName,
  user,
}) {
  if (!mappedKeys?.length) {
    throw createStandardError(
      ERROR_TYPES.BAD_REQUEST,
      'Table should at least one column',
      { context: 'createTableDataMapperFile', details: { modelName } }
    );
  }

  const camelCased = toCamelCase(modelName);

  await createFileFromTemplate({
    destinationPathSegments: [
      frontend?.path,
      'src',
      'core',
      'configs',
      'dataMappers',
      `${camelCased}DataMapper.ts`,
    ],
    templatePathSegments: [
      frontend?.constructorPath,
      'entity-core',
      'core',
      'configs',
      'dataMapper.template.ts',
    ],
    templateReplacements: {
      '// @gen:KEYS': `${mappedKeys},`,
    },
    user,
  });
}

async function formatTableDataMapperFile({ frontend, modelName }) {
  const camelCased = toCamelCase(modelName);
  await formatFile(
    path.join(
      frontend?.path,
      'src',
      'core',
      'configs',
      'dataMappers',
      `${camelCased}DataMapper.ts`
    )
  );
}

function generateMappedKeys({ modelFields, externalFks, models, model = null }) {
  // Optionally use logWithTrace for debug if needed
  // logWithTrace('[generateMappedKeys] Starting processing', context, { modelFields, externalFks });
  const fieldMappings = modelFields
    .filter(({ showInTable }) => !!showInTable)
    .map((field) => {
      // logWithTrace('[generateMappedKeys] Processing field', context, { field });

      const { name, dataType, foreignKeyModel } = field;

      const nameCamelCased = toCamelCase(name);

      if (isInternalForeignKey(field)) {
        // logWithTrace('[generateMappedKeys] Internal FK detected', context, { field });

        const { displayValueField } = getDisplayValueField(
          foreignKeyModel,
          externalFks,
          null,
          models
        );

        // logWithTrace('[generateMappedKeys] Resolved display field', context, { field, displayPath: displayValueField });

        const labelPath = `row?.${nameCamelCased}?.${DISPLAY_VALUE_PROP} ?? row?.${nameCamelCased}?.${displayValueField}`;

        return `${nameCamelCased}Id: { id: row?.${nameCamelCased}?.id, label: ${labelPath} ?? '...' }`;
      }

      if (isExternalForeignKey(field)) {
        const formattedName = getFormattedFieldName(nameCamelCased, true);

        return `${formattedName}: { id: row?.${formattedName}, label: row?.details?.${formattedName}?.${DISPLAY_VALUE_PROP} ?? '...' }`;
      }

      if (dataType === 'Date' || dataType === 'DateTime') {
        return `${nameCamelCased}: parseBackendDateTime(row?.${nameCamelCased})`;
      }

      return `${nameCamelCased}: row?.${nameCamelCased}`;
    })
    .join(',\n');

  // Add tags mapping (reserved field - always included)
  const tagsMapping = `tags: row?.tags`;

  // Add workflowId mapping if showAutomataSelector is enabled
  const workflowIdMapping = model?.showAutomataSelector
    ? `workflowId: { id: row?.workflowId, label: row?.details?.workflowId?.${DISPLAY_VALUE_PROP} ?? row?.details?.workflowId?.name ?? '...' }`
    : null;

  // Combine all mappings
  const allMappings = [fieldMappings, tagsMapping, workflowIdMapping]
    .filter(Boolean)
    .join(',\n');

  return allMappings;
}

async function createTableDataMappers({
  user,
  model,
  frontend,
  externalFks,
  models,
} = {}) {
  // Get model name and fields
  const modelName = getModelName({ model });

  const modelFields = getModelFields({ model });

  const mappedKeys = generateMappedKeys({ modelFields, externalFks, models, model });

  await createTableDataMapperFile({
    frontend,
    mappedKeys,
    modelName,
    user,
  });

  await formatTableDataMapperFile({ frontend, modelName });
}

module.exports = {
  createTableDataMapperFile,
  formatTableDataMapperFile,
  createTableDataMappers,
};
