const path = require('path');
const { toCamelCase } = require('#src/utils/shared/stringUtils.js');
const {
  createFileFromTemplate,
  formatFile,
} = require('#utils/shared/fileUtils.js');
const {
  createStandardError,
  ERROR_TYPES,
  ERROR_SEVERITY,
  withErrorHandling,
} = require('#utils/shared/errorHandlingUtils.js');
const {
  logWithTrace,
  logOperationStart,
  logOperationSuccess,
  logOperationError,
} = require('#utils/shared/traceUtils.js');

const processImportExportControllers = withErrorHandling(async ({
  models = [], // Default to empty array to avoid errors if models is undefined
  srcPath,
  restAPI,
  user,
  req,
} = {}) => {
  logOperationStart('processImportExportControllers', req, { 
    modelCount: models.length,
    srcPath 
  });

  const initialModelData = {
    camelCaseNames: [],
    schemaImports: [],
    schemaMappingLogic: [],
  };

  const { camelCaseNames, schemaImports, schemaMappingLogic } = models.reduce(
    (acc, { name }) => {
      const camelCaseName = toCamelCase(name);

      acc.camelCaseNames.push(camelCaseName);
      acc.schemaImports.push(
        `const { ${camelCaseName}Create, ${camelCaseName}Update } = require('#core/schemas/${camelCaseName}.schema.core.js');`
      );
      acc.schemaMappingLogic.push(
        `if (modelName === '${camelCaseName}') {
        createSchema = ${camelCaseName}Create;
        updateSchema = ${camelCaseName}Update;
      }`
      );
      return acc;
    },
    initialModelData
  );

  const modelNamesListPlaceholder = camelCaseNames
    .map((name) => `'${name}'`)
    .join(',\n');
  const modelSchemaImportsPlaceholder = schemaImports.join('\n');
  const modelToSchemaMapPlaceholder = schemaMappingLogic.join('\n');

  // Destination path for generated files (in core layer)
  const destinationControllersDir = 'core/controllers';
  // Template path (templates are NOT in core/)
  const templateControllersDir = 'controllers';

  // Configuration for each controller file to be generated
  const controllerFileConfigs = [
    {
      filename: 'import.controller.js',
      templateName: 'import.controller.template.js',
      replacements: {
        '// MODELS_LIST_CAMEL_CASE': modelNamesListPlaceholder,
        '// MODEL_SCHEMA_IMPORTS': modelSchemaImportsPlaceholder,
        '// MODEL_TO_SCHEMA_MAP': modelToSchemaMapPlaceholder,
      },
    },
    {
      filename: 'export.controller.js',
      templateName: 'export.controller.template.js',
      replacements: {
        '// MODELS_LIST_CAMEL_CASE': modelNamesListPlaceholder,
      },
    },
  ];

  logWithTrace('Processing controller files', req, {
    controllerCount: controllerFileConfigs.length
  });

  // Loop through configurations to create and format files
  for (const config of controllerFileConfigs) {
    const destinationPathSegments = [srcPath, destinationControllersDir, config.filename];

    const templatePathSegments = [
      restAPI?.constructorPath,
      templateControllersDir,
      config.templateName,
    ];

    try {
      await createFileFromTemplate({
        destinationPathSegments,
        templatePathSegments,
        user,
        templateReplacements: config.replacements,
      });

      await formatFile(path.join(...destinationPathSegments), 'babel');
      
      logWithTrace('Created and formatted controller file', req, { 
        filename: config.filename 
      });
    } catch (error) {
      logOperationError('processImportExportControllers', req, error);
      throw createStandardError(ERROR_TYPES.INTERNAL, `Failed to create controller file: ${config.filename}`, {
        severity: ERROR_SEVERITY.HIGH,
        context: 'import_export_controller_creation',
        details: { 
          filename: config.filename,
          error: error.message 
        }
      });
    }
  }

  logOperationSuccess('processImportExportControllers', req, { 
    processedControllers: controllerFileConfigs.length 
  });
}, 'import_export_controller_setup');

module.exports = { processImportExportControllers };
