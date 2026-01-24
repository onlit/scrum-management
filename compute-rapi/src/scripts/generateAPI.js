const path = require('path');
const { mkdir, readdir } = require('fs').promises;
const {
  ensureDirExists,
  selectiveDeleteDirContents,
  copyFile,
  createFileFromTemplate,
  formatFile,
  writeFileSync,
  readFileSync,
  deleteFileSync,
  deleteDirIfExists,
  copyFolder,
} = require('#utils/shared/fileUtils.js');
const {
  COMPUTE_API_SRC_FOLDERS,
  COMPUTE_API_DOCKER_FILE_TYPES,
  COMPUTE_API_UTILS,
  COMPUTE_API_SECURITY_UTILS,
} = require('#configs/constants.js');
const { logStep } = require('#utils/shared/loggingUtils.js');
const { logWithTrace } = require('#utils/shared/traceUtils.js');
const {
  processModels,
  createMiddlewareFiles,
  addImportsInAppJs,
  addRoutesInAppJs,
  createUndeleteController,
  createDetailResolverConfig,
} = require('#utils/api/apiSetupUtils.js');
const { processModelSchemas } = require('#utils/api/joiSchemaUtils.js');
const getComputeMicroservicePaths = require('#configs/computePaths.js');
const {
  createPrismaSchemaFile,
  generateMigrationName,
} = require('#utils/api/prismaUtils.js');
const {
  processImportExportControllers,
} = require('#utils/api/importExportSetupUtils.js');
const { runCommand } = require('#utils/shared/shellUtils.js');
const {
  withErrorHandling,
  createStandardError,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  createGenerationManifest,
  writeManifest,
} = require('#utils/api/manifestUtils.js');
const {
  scaffoldDomainLayer,
  scaffoldAllInterceptors,
} = require('#utils/api/domainScaffoldUtils.js');
const {
  analyzeMigrationIssues,
  applyMigrationFixes,
  buildMigrationValidationErrors,
} = require('#utils/api/migrationIssuesHandler.js');
const {
  updateManifest: updateMigrationManifest,
} = require('#utils/api/migrationManifestUtils.js');
const { resolveModelSlug } = require('#utils/api/commonUtils.js');

const main = withErrorHandling(
  async ({
    microservice,
    models,
    enums,
    user,
    instanceId,
    k8sRepoID,
    k8sCiPipelineToken,
    externalFks,
    migrationOptions = {},
    traceId = null,
  } = {}) => {
    // Create logging context for consistent traceId in all log calls
    const logCtx = { traceId: traceId || instanceId || 'generate-api' };

    if (!microservice?.name || !Array.isArray(models)) {
      throw createStandardError(
        ERROR_TYPES.BAD_REQUEST,
        'Invalid parameters: microservice name and models array are required',
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'generateAPI_validation',
          details: {
            microserviceName: microservice?.name,
            modelsCount: models?.length,
          },
        }
      );
    }

    const {
      microservice: { slug: microserviceSlug },
      restAPI,
    } = getComputeMicroservicePaths({
      microserviceName: microservice?.name,
    });

    const COMPUTE_SRC_PATH = path.join(restAPI?.path, 'src');

    const commonLogParams = {
      user,
      instanceId,
    };

    // Extract migration options
    const {
      skipMigrationAnalysis = false,
      applyAutoFixes = false,
      appliedFixes: preAppliedFixes = [],
    } = migrationOptions;

    // Migration Issues Analysis (before generation)
    let appliedMigrationFixes = Array.isArray(preAppliedFixes)
      ? [...preAppliedFixes]
      : [];
    let currentModels = models;

    if (!skipMigrationAnalysis) {
      const migrationReport = await analyzeMigrationIssues({
        microservice,
        models,
        restAPI,
        req: { traceId: instanceId },
      });

      const migrationValidationErrors =
        buildMigrationValidationErrors(migrationReport);
      if (migrationValidationErrors) {
        throw createStandardError(
          ERROR_TYPES.VALIDATION,
          'Migration issues detected. Fix them before generation.',
          {
            severity: ERROR_SEVERITY.HIGH,
            context: 'migration_validation',
            details: {
              validationErrors: migrationValidationErrors,
              migrationReport,
            },
          }
        );
      }

      // Apply auto-fixes automatically when available
      if (applyAutoFixes && migrationReport.hasFixableChanges) {
        const prismaClient = require('#configs/prisma.js');
        const fixResult = await applyMigrationFixes({
          report: migrationReport,
          prisma: prismaClient,
          req: { traceId: instanceId },
        });
        appliedMigrationFixes = [
          ...appliedMigrationFixes,
          ...fixResult.appliedFixes,
        ];

        // Re-fetch models with updated isOptional values
        const updatedMicroservice = await prismaClient.microservice.findFirst({
          where: { id: microservice.id },
          include: {
            modelDefns: {
              where: { deleted: null },
              include: {
                fieldDefns: { where: { deleted: null } },
              },
            },
          },
        });
        currentModels = updatedMicroservice?.modelDefns || models;
      }
    }

    // Use updated models for generation (may include auto-fixes)
    // eslint-disable-next-line no-param-reassign
    models = currentModels;

    // Try to capture any previously generated Prisma schema before we clear the output directory.
    // This lets us generate a proper migration diff against the previous state instead of from-empty.
    const previousPrismaSchemaPath = path.join(
      restAPI?.path,
      'prisma',
      'schema.prisma'
    );
    let previousSchemaContent = null;
    try {
      previousSchemaContent = readFileSync(previousPrismaSchemaPath);
      logWithTrace('[MIGRATION] Previous schema captured', logCtx, {
        path: previousPrismaSchemaPath,
        length: previousSchemaContent?.length || 0,
        preview: previousSchemaContent?.substring(0, 200),
      });
    } catch (captureError) {
      logWithTrace('[MIGRATION] No previous schema found', logCtx, {
        path: previousPrismaSchemaPath,
        error: captureError?.message,
      });
      // It's okay if it doesn't exist; we'll fall back to from-empty.
    }

    // Backup existing migrations (if any) outside the directory we're about to clean
    const migrationsBackupPath = path.join(
      restAPI?.path,
      '..',
      `${restAPI?.slug}-migrations-backup`
    );
    const existingMigrationsPath = path.join(
      restAPI?.path,
      'prisma',
      'migrations'
    );
    try {
      await copyFolder(existingMigrationsPath, migrationsBackupPath);
    } catch (ignore) {
      // No prior migrations to back up; continue.
    }

    await logStep({ ...commonLogParams, stepCode: 'CC1K-YH8' }, async () => {
      // Deleting output dir (preserving protected directories like domain/, infrastructure/)
      await ensureDirExists(restAPI?.path);
      const deleteResult = await selectiveDeleteDirContents(restAPI?.path);
      logWithTrace('[SAFE-DEL] Cleaned output directory', logCtx, {
        deleted: deleteResult.deleted.length,
        preserved: deleteResult.preserved.length,
      });

      // Scaffold domain layer (creates directories and base files only if they don't exist)
      const scaffoldResult = await scaffoldDomainLayer(restAPI?.path);
      logWithTrace('[SCAFFOLD] Domain layer setup', logCtx, {
        created: scaffoldResult.created.length,
        skipped: scaffoldResult.skipped.length,
      });

      // Scaffold interceptor stubs for all models (only creates if not exist)
      const interceptorResult = await scaffoldAllInterceptors(
        restAPI?.path,
        models
      );
      logWithTrace('[INTERCEPT] Interceptors setup', logCtx, {
        created: interceptorResult.created.length,
        skipped: interceptorResult.skipped.length,
      });

      // Copy docs folder from templates and process template files
      const docsTemplatePath = path.join(restAPI?.constructorPath, 'docs');
      const docsDestPath = path.join(restAPI?.path, 'docs');
      await ensureDirExists(docsDestPath);

      // Copy each template doc file
      await copyFile(
        path.join(docsTemplatePath, 'ARCHITECTURE.template.md'),
        path.join(docsDestPath, 'ARCHITECTURE.md')
      );
      await copyFile(
        path.join(docsTemplatePath, 'EXTENSION_GUIDE.template.md'),
        path.join(docsDestPath, 'EXTENSION_GUIDE.md')
      );
      await copyFile(
        path.join(docsTemplatePath, 'DISPLAY_VALUES_GUIDELINES.template.md'),
        path.join(docsDestPath, 'DISPLAY_VALUES_GUIDELINES.md')
      );

      // Creating package.json
      await copyFile(
        path.join(restAPI?.constructorPath, 'package.template.json'),
        path.join(restAPI?.path, 'package.json'),
        { '{{ APP_NAME }}': restAPI?.slug }
      );

      // Creating eslint.config.js
      await copyFile(
        path.join(restAPI?.constructorPath, 'eslint.config.template.js'),
        path.join(restAPI?.path, 'eslint.config.js')
      );

      // Creating .gitignore
      await copyFile(
        path.join(restAPI?.constructorPath, '.gitignore.template'),
        path.join(restAPI?.path, '.gitignore')
      );

      // Creating jest.config.js
      await createFileFromTemplate({
        destinationPathSegments: [restAPI?.path, 'jest.config.js'],
        templatePathSegments: [
          restAPI?.constructorPath,
          'jest.config.template.js',
        ],
        user,
      });

      // Creating README.md
      await createFileFromTemplate({
        destinationPathSegments: [restAPI?.path, 'README.md'],
        templatePathSegments: [restAPI?.constructorPath, 'README.template.md'],
        templateReplacements: {
          '{{ APP_NAME }}': microservice?.label ?? microservice?.name,
        },
        user,
      });
    });

    await logStep({ ...commonLogParams, stepCode: 'RI3A-PDK' }, async () => {
      // Creating Docker files
      const templatePath = path.join(
        restAPI?.constructorPath,
        'Dockerfile.template'
      );
      for (const fileType of COMPUTE_API_DOCKER_FILE_TYPES) {
        await copyFile(
          templatePath,
          path.join(restAPI?.path, `Dockerfile.${fileType}`)
        );
      }

      // Creating entrypoint.sh
      await copyFile(
        path.join(restAPI?.constructorPath, 'entrypoint.template.sh'),
        path.join(restAPI?.path, 'entrypoint.sh'),
        { '{{ APP_NAME }}': microserviceSlug }
      );

      // Creating gitlab-ci.yml
      await createFileFromTemplate({
        destinationPathSegments: [restAPI?.path, '.gitlab-ci.yml'],
        templatePathSegments: [
          restAPI?.constructorPath,
          '.gitlab-ci.template.yml',
        ],
        templateReplacements: {
          '{{K8S_CI_PIPELINE_TOKEN}}': k8sCiPipelineToken,
          '{{K8S_REPO_ID}}': k8sRepoID,
        },
        user,
      });

      // Creating schema.prisma
      await createPrismaSchemaFile({
        restAPI,
        user,
        enums,
        models,
        microserviceId: microservice?.id,
      });

      // Diagnostic: Compare new schema with previous
      const newSchemaPath = path.join(restAPI?.path, 'prisma', 'schema.prisma');
      try {
        const newSchemaContent = readFileSync(newSchemaPath);
        logWithTrace('[MIGRATION] New schema created', logCtx, {
          path: newSchemaPath,
          length: newSchemaContent?.length || 0,
          preview: newSchemaContent?.substring(0, 200),
          modelsCount: models?.length || 0,
          modelNames: models?.map((m) => m.name).join(', '),
        });

        // Compare lengths to detect if schemas are identical
        if (previousSchemaContent && newSchemaContent) {
          const schemasIdentical = previousSchemaContent === newSchemaContent;
          if (schemasIdentical) {
            logWithTrace(
              '[MIGRATION][WARN] Schemas are identical - no migration will be generated',
              logCtx,
              {
                schemasIdentical,
              }
            );
          }
        }
      } catch (newSchemaError) {
        logWithTrace('[MIGRATION][ERROR] Failed to read new schema', logCtx, {
          error: newSchemaError?.message,
        });
      }

      // Creating src folders
      for (const folder of COMPUTE_API_SRC_FOLDERS) {
        await mkdir(path.join(COMPUTE_SRC_PATH, folder), { recursive: true });
      }

      // Creating middlewares
      await createMiddlewareFiles({
        restAPI,
        COMPUTE_SRC_PATH,
        user,
        req: logCtx,
      });

      // Creating app.js
      await createFileFromTemplate({
        destinationPathSegments: [COMPUTE_SRC_PATH, 'app.js'],
        templatePathSegments: [restAPI?.constructorPath, 'app.template.js'],
        user,
      });

      // Creating server.js
      await createFileFromTemplate({
        destinationPathSegments: [COMPUTE_SRC_PATH, 'server.js'],
        templatePathSegments: [restAPI?.constructorPath, 'server.template.js'],
        user,
      });

      // Creating utils/*
      // Compute non-standard UUID fields (UUID dataType but not ending with 'id') for database utils
      const nonStandardUuidFields = (() => {
        const isNonStandardUuidField = (field) => {
          const name = field?.name || '';
          if (field?.isForeignKey) return false;
          if (field?.dataType !== 'UUID') return false;
          const lower = name.toLowerCase();
          if (lower === 'id' || lower.endsWith('id')) return false;
          return true;
        };

        const names = new Set();
        for (const { fieldDefns = [] } of models || []) {
          for (const field of fieldDefns) {
            if (isNonStandardUuidField(field)) names.add(field.name);
          }
        }
        return Array.from(names).sort();
      })();

      const NON_STANDARD_UUIDS_REPLACEMENT = nonStandardUuidFields
        .map((n) => `  '${n}',`)
        .join('\n');

      // Creating utils/* in core layer
      for (const util of COMPUTE_API_UTILS) {
        const templateReplacements = { '{{SLUG}}': microserviceSlug };
        if (util === 'databaseUtils') {
          templateReplacements['// NON_STANDARD_UUIDs'] =
            NON_STANDARD_UUIDS_REPLACEMENT;
        }

        await createFileFromTemplate({
          destinationPathSegments: [
            COMPUTE_SRC_PATH,
            'core',
            'utils',
            `${util}.js`,
          ],
          templatePathSegments: [
            restAPI?.constructorPath,
            'utils',
            `${util}.template.js`,
          ],
          user,
          templateReplacements,
        });
      }

      // Creating security utils/* in core layer
      for (const securityUtil of COMPUTE_API_SECURITY_UTILS) {
        await createFileFromTemplate({
          destinationPathSegments: [
            COMPUTE_SRC_PATH,
            'core',
            'utils',
            'security',
            `${securityUtil}.js`,
          ],
          templatePathSegments: [
            restAPI?.constructorPath,
            'utils',
            'security',
            `${securityUtil}.template.js`,
          ],
          user,
        });
      }
    });

    await logStep({ ...commonLogParams, stepCode: 'K8UZ-1OO' }, async () => {
      // Creating configs/constants.js in core layer
      const constantsDestinationPathSegments = [
        COMPUTE_SRC_PATH,
        'core',
        'configs',
        'constants.js',
      ];

      // Build UUID_KEY_VALUE_PAIRS in new format: host -> { route, models: { ModelName: { fieldName: true } } }
      const groupedByHost = new Map();

      externalFks.forEach(({ fieldName, details }) => {
        const modelName = details?.externalModelId?.name;
        const envHost = details?.externalMicroserviceId?.backendEnvName;
        const isNode = details?.externalMicroserviceId?.isNode;

        if (!envHost || !modelName || !fieldName) return;

        const existing = groupedByHost.get(envHost) || {
          envHost,
          route: isNode ? 'NODE_DETAILS_ROUTE' : 'DJANGO_DETAILS_ROUTE',
          models: {},
        };

        // If any entry for this host is Node, prefer NODE_DETAILS_ROUTE
        if (isNode) existing.route = 'NODE_DETAILS_ROUTE';

        if (!existing.models[modelName]) {
          existing.models[modelName] = {};
        }
        existing.models[modelName][fieldName] = true;

        groupedByHost.set(envHost, existing);
      });

      const detailResolverConfigs = Array.from(groupedByHost.values()).map(
        ({ envHost, route, models }) =>
          createDetailResolverConfig({ envHost, route, models })
      );

      await createFileFromTemplate({
        destinationPathSegments: constantsDestinationPathSegments,
        templatePathSegments: [
          restAPI?.constructorPath,
          'configs',
          'constants.template.js',
        ],
        templateReplacements: {
          '{{ APP_NAME }}': microservice?.name,
          '// KEY_VALUE_USES': detailResolverConfigs.join(','),
          // Display value templates per model
          '  // DISPLAY_VALUE_TEMPLATES': models
            .filter((m) => (m?.displayValueTemplate || '').trim().length > 0)
            .map((m) => {
              // Build sets of Date and DateTime field names for this model
              const dateFields = new Set();
              const dateTimeFields = new Set();
              for (const field of m.fieldDefns || []) {
                if (field?.dataType === 'Date') {
                  dateFields.add(field.name);
                } else if (field?.dataType === 'DateTime') {
                  dateTimeFields.add(field.name);
                }
              }

              // Auto-append format hints to date/datetime fields in template
              let tpl = m.displayValueTemplate || '';

              // Match {fieldName} patterns and append hints if field is date/datetime
              tpl = tpl.replace(/\{([^}|]+)\}/g, (match, fieldName) => {
                const trimmedField = fieldName.trim();
                if (dateTimeFields.has(trimmedField)) {
                  return `{${trimmedField}|datetime}`;
                }
                if (dateFields.has(trimmedField)) {
                  return `{${trimmedField}|date}`;
                }
                return match;
              });

              tpl = tpl.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
              return `  '${m.name}': '${tpl}',`;
            })
            .join('\n'),
          // Fallback display fields per model
          '  // DISPLAY_VALUE_FALLBACK_FIELDS': models
            .filter((m) => m?.displayValue?.name)
            .map((m) => `  '${m.name}': '${m.displayValue.name}',`)
            .join('\n'),
          // Model name to slug mapping (for registration and URL generation)
          '  // MODEL_SLUGS': models
            .map((m) => `  '${m.name}': '${resolveModelSlug(m)}',`)
            .join('\n'),
        },
        user,
      });

      await formatFile(path.join(...constantsDestinationPathSegments), 'babel');

      // Creating configs/bullQueue.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'configs',
          'bullQueue.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'configs',
          'bullQueue.template.js',
        ],
        user,
      });

      // Creating configs/prisma.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'configs',
          'prisma.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'configs',
          'prisma.template.js',
        ],
        user,
      });

      // Creating configs/routes.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'configs',
          'routes.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'configs',
          'routes.template.js',
        ],
        user,
      });

      // Creating configs/cors.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'configs',
          'cors.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'configs',
          'cors.template.js',
        ],
        user,
      });

      // Creating configs/securityConfig.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'configs',
          'securityConfig.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'configs',
          'securityConfig.template.js',
        ],
        user,
      });

      // Creating schemas/visibility.schema.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'schemas',
          'visibility.schemas.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'schemas',
          'visibility.schemas.template.js',
        ],
        user,
      });

      await processImportExportControllers({
        models,
        srcPath: COMPUTE_SRC_PATH,
        restAPI,
        user,
        req: logCtx,
      });

      // Creating schemas/undelete.schema.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'schemas',
          'undelete.schemas.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'schemas',
          'undelete.schemas.template.js',
        ],
        user,
      });

      // Creating schemas/getBulkDetail.schemas.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'schemas',
          'getBulkDetail.schemas.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'schemas',
          'getBulkDetail.schemas.template.js',
        ],
        user,
      });

      // Adding imports in app.js
      await addImportsInAppJs({ COMPUTE_SRC_PATH, models, req: logCtx });

      // Adding routes in app.js
      await addRoutesInAppJs({ COMPUTE_SRC_PATH, models, req: logCtx });
    });

    await logStep({ ...commonLogParams, stepCode: 'AEV8-PCY' }, async () => {
      // Creating routes/* (in core/ directory for generated files)
      await processModels({
        models,
        user,
        currentMicroserviceId: microservice?.id,
        folder: 'core/routes/v1',
        templateFolder: 'routes/v1', // Template location differs from output folder
        templatesName: 'crud.routes.core.template.js',
        srcPath: COMPUTE_SRC_PATH,
        templatesPath: restAPI?.constructorPath,
        getNewFileName: (name) => `${name}.routes.core.js`,
        externalFks,
        req: logCtx,
      });

      // Creating routes/health.routes.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'routes/v1',
          'health.routes.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'routes/v1',
          'health.routes.template.js',
        ],
        user,
      });

      // Creating routes/import.routes.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'routes/v1',
          'import.routes.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'routes/v1',
          'import.routes.template.js',
        ],
        user,
      });

      // Creating controllers/health.controller.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'controllers',
          'health.controller.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'controllers',
          'health.controller.template.js',
        ],
        user,
      });

      // Creating routes/export.routes.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'routes/v1',
          'export.routes.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'routes/v1',
          'export.routes.template.js',
        ],
        user,
      });

      // Creating routes/undelete.routes.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'routes/v1',
          'undelete.routes.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'routes/v1',
          'undelete.routes.template.js',
        ],
        user,
      });

      // Creating routes/getBulkDetail.routes.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'routes/v1',
          'getBulkDetail.routes.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'routes/v1',
          'getBulkDetail.routes.template.js',
        ],
        user,
      });

      // Creating routes/getInternalBulkDetail.routes.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'routes/v1',
          'getInternalBulkDetail.routes.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'routes/v1',
          'getInternalBulkDetail.routes.template.js',
        ],
        user,
      });

      // Creating controllers/* (in core/ directory for generated files)
      await processModels({
        models,
        user,
        currentMicroserviceId: microservice?.id,
        folder: 'core/controllers',
        templateFolder: 'controllers', // Template location differs from output folder
        templatesName: 'crud.controller.core.template.js',
        srcPath: COMPUTE_SRC_PATH,
        templatesPath: restAPI?.constructorPath,
        getNewFileName: (name) => `${name}.controller.core.js`,
        externalFks,
        req: logCtx,
      });

      // Creating controllers/undelete.controller.js
      await createUndeleteController({
        models,
        restAPI,
        COMPUTE_SRC_PATH,
        user,
        req: logCtx,
      });

      // Creating controllers/getBulkDetail.controller.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'controllers',
          'getBulkDetail.controller.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'controllers',
          'getBulkDetail.controller.template.js',
        ],
        user,
      });

      // Creating controllers/getInternalBulkDetail.controller.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'controllers',
          'getInternalBulkDetail.controller.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'controllers',
          'getInternalBulkDetail.controller.template.js',
        ],
        user,
      });
    });

    await logStep({ ...commonLogParams, stepCode: '748I-Y17' }, async () => {
      // Creating schemas/* (in core/ directory for generated files)
      const schemasFolder = 'core/schemas';

      await processModels({
        models,
        user,
        folder: schemasFolder,
        templateFolder: 'schemas', // Template location differs from output folder
        currentMicroserviceId: microservice?.id,
        srcPath: COMPUTE_SRC_PATH,
        templatesName: 'crud.schema.core.template.js',
        templatesPath: restAPI?.constructorPath,
        getNewFileName: (name) => `${name}.schema.core.js`,
        externalFks,
        req: logCtx,
        getAdditionalTemplateReplacements: ({ fieldDefns }) => {
          const hasDate = Array.isArray(fieldDefns)
            ? fieldDefns.some((f) => f?.dataType === 'Date')
            : false;
          const hasDateTime = Array.isArray(fieldDefns)
            ? fieldDefns.some((f) => f?.dataType === 'DateTime')
            : false;

          let importsSnippet = '';
          if (hasDate && hasDateTime) {
            importsSnippet =
              "const { validateISODate, validateISODateTime } = require('#utils/dateValidationUtils.js');";
          } else if (hasDate) {
            importsSnippet =
              "const { validateISODate } = require('#utils/dateValidationUtils.js');";
          } else if (hasDateTime) {
            importsSnippet =
              "const { validateISODateTime } = require('#utils/dateValidationUtils.js');";
          }

          return { '// IMPORTS': importsSnippet };
        },
      });

      await processModelSchemas({
        models,
        folder: schemasFolder,
        srcPath: COMPUTE_SRC_PATH,
        req: logCtx,
      });

      // Creating tests/core/unit/controllers/*
      await processModels({
        models,
        user,
        currentMicroserviceId: microservice?.id,
        folder: 'tests/core/unit/controllers',
        templateFolder: 'tests/core/unit/controllers',
        srcPath: restAPI?.path,
        templatesName: 'crud.test.template.js',
        templatesPath: restAPI?.constructorPath,
        getNewFileName: (name) => `${name}.test.js`,
        externalFks,
        req: logCtx,
      });

      // Creating static test templates in parallel for improved performance
      await Promise.all([
        // tests/core/setup/* (static templates - not model-specific)
        createFileFromTemplate({
          destinationPathSegments: [
            restAPI?.path,
            'tests',
            'core',
            'setup',
            'database.js',
          ],
          templatePathSegments: [
            restAPI?.constructorPath,
            'tests',
            'core',
            'setup',
            'database.template.js',
          ],
          user,
        }),
        createFileFromTemplate({
          destinationPathSegments: [
            restAPI?.path,
            'tests',
            'core',
            'setup',
            'app.js',
          ],
          templatePathSegments: [
            restAPI?.constructorPath,
            'tests',
            'core',
            'setup',
            'app.template.js',
          ],
          user,
        }),
        createFileFromTemplate({
          destinationPathSegments: [
            restAPI?.path,
            'tests',
            'core',
            'setup',
            'helpers.js',
          ],
          templatePathSegments: [
            restAPI?.constructorPath,
            'tests',
            'core',
            'setup',
            'helpers.template.js',
          ],
          user,
        }),
        createFileFromTemplate({
          destinationPathSegments: [
            restAPI?.path,
            'tests',
            'core',
            'setup',
            'helpers-boot.js',
          ],
          templatePathSegments: [
            restAPI?.constructorPath,
            'tests',
            'core',
            'setup',
            'helpers-boot.template.js',
          ],
          user,
        }),
        createFileFromTemplate({
          destinationPathSegments: [
            restAPI?.path,
            'tests',
            'core',
            'setup',
            'constants.js',
          ],
          templatePathSegments: [
            restAPI?.constructorPath,
            'tests',
            'core',
            'setup',
            'constants.template.js',
          ],
          user,
        }),
        // Test token utilities for signed JWT authentication
        createFileFromTemplate({
          destinationPathSegments: [
            restAPI?.path,
            'tests',
            'core',
            'setup',
            'testTokenUtils.js',
          ],
          templatePathSegments: [
            restAPI?.constructorPath,
            'tests',
            'core',
            'setup',
            'testTokenUtils.template.js',
          ],
          user,
        }),
        // Mock token validator for integration tests
        createFileFromTemplate({
          destinationPathSegments: [
            restAPI?.path,
            'tests',
            'core',
            'setup',
            'mockTokenValidator.js',
          ],
          templatePathSegments: [
            restAPI?.constructorPath,
            'tests',
            'core',
            'setup',
            'mockTokenValidator.template.js',
          ],
          user,
        }),
        // Schema-aware factory utilities for test data generation
        createFileFromTemplate({
          destinationPathSegments: [
            restAPI?.path,
            'tests',
            'core',
            'setup',
            'schemaAwareFactory.js',
          ],
          templatePathSegments: [
            restAPI?.constructorPath,
            'tests',
            'core',
            'setup',
            'schemaAwareFactory.template.js',
          ],
          user,
        }),
        // tests/core/boot/* (static templates)
        createFileFromTemplate({
          destinationPathSegments: [
            restAPI?.path,
            'tests',
            'core',
            'boot',
            'app.boot.test.js',
          ],
          templatePathSegments: [
            restAPI?.constructorPath,
            'tests',
            'core',
            'boot',
            'app.boot.test.template.js',
          ],
          user,
        }),
        // tests/core/contracts/schemas/* (static templates)
        createFileFromTemplate({
          destinationPathSegments: [
            restAPI?.path,
            'tests',
            'core',
            'contracts',
            'schemas',
            'common.schema.js',
          ],
          templatePathSegments: [
            restAPI?.constructorPath,
            'tests',
            'core',
            'contracts',
            'schemas',
            'common.schema.template.js',
          ],
          user,
        }),
        // parseFilters middleware unit test
        createFileFromTemplate({
          destinationPathSegments: [
            restAPI?.path,
            'tests',
            'core',
            'unit',
            'middlewares',
            'parseFilters.test.js',
          ],
          templatePathSegments: [
            restAPI?.constructorPath,
            'tests',
            'core',
            'unit',
            'middlewares',
            'parseFilters.test.template.js',
          ],
          user,
        }),
        // filterSchemaUtils unit test
        createFileFromTemplate({
          destinationPathSegments: [
            restAPI?.path,
            'tests',
            'core',
            'unit',
            'utils',
            'filterSchemaUtils.test.js',
          ],
          templatePathSegments: [
            restAPI?.constructorPath,
            'tests',
            'core',
            'unit',
            'utils',
            'filterSchemaUtils.test.template.js',
          ],
          user,
        }),
        // parseFilters integration test
        createFileFromTemplate({
          destinationPathSegments: [
            restAPI?.path,
            'tests',
            'core',
            'integration',
            'middlewares',
            'parseFilters.integration.test.js',
          ],
          templatePathSegments: [
            restAPI?.constructorPath,
            'tests',
            'core',
            'integration',
            'middlewares',
            'parseFilters.integration.test.template.js',
          ],
          user,
        }),
        // handleFilterValidationError unit test
        createFileFromTemplate({
          destinationPathSegments: [
            restAPI?.path,
            'tests',
            'core',
            'unit',
            'utils',
            'errorHandlingUtils.filterValidation.test.js',
          ],
          templatePathSegments: [
            restAPI?.constructorPath,
            'tests',
            'core',
            'unit',
            'utils',
            'errorHandlingUtils.filterValidation.test.template.js',
          ],
          user,
        }),
        // schemaOptionsHandler middleware unit test
        createFileFromTemplate({
          destinationPathSegments: [
            restAPI?.path,
            'tests',
            'core',
            'unit',
            'middlewares',
            'schemaOptionsHandler.test.js',
          ],
          templatePathSegments: [
            restAPI?.constructorPath,
            'tests',
            'core',
            'unit',
            'middlewares',
            'schemaOptionsHandler.test.template.js',
          ],
          user,
        }),
        // schemaRegistry util unit test
        createFileFromTemplate({
          destinationPathSegments: [
            restAPI?.path,
            'tests',
            'core',
            'unit',
            'utils',
            'schemaRegistry.test.js',
          ],
          templatePathSegments: [
            restAPI?.constructorPath,
            'tests',
            'core',
            'unit',
            'utils',
            'schemaRegistry.test.template.js',
          ],
          user,
        }),
        // optionsBuilder util unit test
        createFileFromTemplate({
          destinationPathSegments: [
            restAPI?.path,
            'tests',
            'core',
            'unit',
            'utils',
            'optionsBuilder.test.js',
          ],
          templatePathSegments: [
            restAPI?.constructorPath,
            'tests',
            'core',
            'unit',
            'utils',
            'optionsBuilder.test.template.js',
          ],
          user,
        }),
        // OPTIONS schema contract test
        createFileFromTemplate({
          destinationPathSegments: [
            restAPI?.path,
            'tests',
            'core',
            'contracts',
            'options.contract.test.js',
          ],
          templatePathSegments: [
            restAPI?.constructorPath,
            'tests',
            'core',
            'contracts',
            'options.contract.test.template.js',
          ],
          templateReplacements: {
            // Use first model's route path as sample for OPTIONS schema tests
            '{{ROUTE_PATH}}': resolveModelSlug(models[0]) || 'resources',
          },
          user,
        }),
      ]);

      // Creating tests/core/contracts/schemas/* (model-specific)
      await processModels({
        models,
        user,
        currentMicroserviceId: microservice?.id,
        folder: 'tests/core/contracts/schemas',
        templateFolder: 'tests/core/contracts/schemas',
        srcPath: restAPI?.path,
        templatesName: 'crud.schema.template.js',
        templatesPath: restAPI?.constructorPath,
        getNewFileName: (name) => `${name}.schema.js`,
        externalFks,
        req: logCtx,
      });

      // Creating tests/core/contracts/* (model-specific)
      await processModels({
        models,
        user,
        currentMicroserviceId: microservice?.id,
        folder: 'tests/core/contracts',
        templateFolder: 'tests/core/contracts',
        srcPath: restAPI?.path,
        templatesName: 'crud.contract.test.template.js',
        templatesPath: restAPI?.constructorPath,
        getNewFileName: (name) => `${name}.contract.test.js`,
        externalFks,
        req: logCtx,
      });

      // Creating tests/factories/* (model-specific)
      await processModels({
        models,
        user,
        currentMicroserviceId: microservice?.id,
        folder: 'tests/factories',
        srcPath: restAPI?.path,
        templatesName: 'crud.factory.template.js',
        templatesPath: restAPI?.constructorPath,
        getNewFileName: (name) => `${name}.factory.js`,
        externalFks,
        req: logCtx,
      });

      // Creating tests/core/integration/* (model-specific)
      await processModels({
        models,
        user,
        currentMicroserviceId: microservice?.id,
        folder: 'tests/core/integration',
        templateFolder: 'tests/core/integration',
        srcPath: restAPI?.path,
        templatesName: 'crud.integration.test.template.js',
        templatesPath: restAPI?.constructorPath,
        getNewFileName: (name) => `${name}.integration.test.js`,
        externalFks,
        req: logCtx,
      });

      // Creating tests/core/integration/errors/* (model-specific)
      await processModels({
        models,
        user,
        currentMicroserviceId: microservice?.id,
        folder: 'tests/core/integration/errors',
        templateFolder: 'tests/core/integration/errors',
        srcPath: restAPI?.path,
        templatesName: 'crud.errors.test.template.js',
        templatesPath: restAPI?.constructorPath,
        getNewFileName: (name) => `${name}.errors.test.js`,
        externalFks,
        req: logCtx,
      });
    });

    await logStep({ ...commonLogParams, stepCode: 'FPNX-O3S' }, async () => {
      // Creating bullQueues/workers/importWorker.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'bullQueues',
          'workers',
          'importWorker.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'bullQueues',
          'workers',
          'importWorker.template.js',
        ],
        user,
      });

      // Creating bullQueues/workers/exportWorker.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'bullQueues',
          'workers',
          'exportWorker.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'bullQueues',
          'workers',
          'exportWorker.template.js',
        ],
        user,
      });

      // Creating bullQueues/queues/importQueue.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'bullQueues',
          'queues',
          'importQueue.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'bullQueues',
          'queues',
          'importQueue.template.js',
        ],
        user,
      });

      // Creating bullQueues/queues/exportQueue.js in core layer
      await createFileFromTemplate({
        destinationPathSegments: [
          COMPUTE_SRC_PATH,
          'core',
          'bullQueues',
          'queues',
          'exportQueue.js',
        ],
        templatePathSegments: [
          restAPI?.constructorPath,
          'bullQueues',
          'queues',
          'exportQueue.template.js',
        ],
        user,
      });

      const prismaPath = path.join(restAPI?.path, 'prisma');
      const migrationsDirPath = path.join(prismaPath, 'migrations');

      // Restore previous migrations if a backup exists
      try {
        await ensureDirExists(migrationsDirPath);
        await copyFolder(migrationsBackupPath, migrationsDirPath);
      } catch (ignore) {
        // No prior migrations to restore; continue.
      }

      const prismaSchemaPath = path.join(prismaPath, 'schema.prisma');

      try {
        await runCommand(
          'npx',
          ['prisma', 'validate', '--schema', prismaSchemaPath],
          { cwd: restAPI?.path }
        );
      } catch (validateError) {
        throw new Error(
          `Prisma schema validation failed: ${validateError.message || validateError}`
        );
      }

      // Check if there are existing migrations (not just previous schema)
      // If no migrations exist, we should generate from-empty to create init migration
      let hasExistingMigrations = false;
      try {
        const migrationEntries = await readdir(migrationsDirPath, {
          withFileTypes: true,
        });
        hasExistingMigrations = migrationEntries?.some((d) =>
          d.isDirectory?.()
        );
        logWithTrace('[MIGRATION] Existing migrations check', logCtx, {
          hasExistingMigrations,
          entriesFound:
            migrationEntries?.map((e) => e.name).join(', ') || 'none',
        });
      } catch (checkMigrationsError) {
        logWithTrace(
          '[MIGRATION] Could not check existing migrations',
          logCtx,
          {
            error: checkMigrationsError?.message,
          }
        );
        // If we can't check, assume no migrations exist
      }

      // Prefer diffing against the previous schema if it existed AND there are existing migrations.
      // If there's a previous schema but no migrations, use from-empty to create init migration.
      // First, write diff to a temporary file; only create a migration folder if diff is non-empty
      const migrationOutputTempPath = path.join(
        prismaPath,
        'migration.temp.sql'
      );

      // Use from-schema-datamodel only if BOTH previous schema AND existing migrations exist
      const shouldDiffAgainstPrevious =
        previousSchemaContent && hasExistingMigrations;
      logWithTrace('[MIGRATION] Diff strategy determined', logCtx, {
        shouldDiffAgainstPrevious,
        previousSchemaExists: !!previousSchemaContent,
        hasExistingMigrations,
      });

      const diffArgs = shouldDiffAgainstPrevious
        ? [
            'prisma',
            'migrate',
            'diff',
            '--from-schema-datamodel',
            path.join(prismaPath, 'schema.previous.prisma'),
            '--to-schema-datamodel',
            prismaSchemaPath,
            '--script',
            '--output',
            migrationOutputTempPath,
          ]
        : [
            'prisma',
            'migrate',
            'diff',
            '--from-empty',
            '--script',
            '--to-schema-datamodel',
            prismaSchemaPath,
            '--output',
            migrationOutputTempPath,
          ];

      // If we're diffing against previous schema, write it to a temp file for prisma to diff against.
      if (shouldDiffAgainstPrevious) {
        const previousSchemaTempPath = path.join(
          prismaPath,
          'schema.previous.prisma'
        );
        writeFileSync(previousSchemaTempPath, previousSchemaContent);
        logWithTrace(
          '[MIGRATION] Previous schema written to temp file for diff',
          logCtx
        );
      }

      // Log the prisma migrate diff command details
      logWithTrace('[MIGRATION] Running prisma migrate diff', logCtx, {
        diffMode: shouldDiffAgainstPrevious
          ? 'from-schema-datamodel'
          : 'from-empty',
        workingDirectory: restAPI?.path,
        diffArgs,
      });

      await runCommand('npx', diffArgs, { cwd: restAPI?.path }, true);

      // Check if prisma migrate diff created the temp file
      const fs = require('fs');
      const tempFileExists = fs.existsSync(migrationOutputTempPath);
      const tempFileSize = tempFileExists
        ? fs.statSync(migrationOutputTempPath).size
        : 0;
      logWithTrace('[MIGRATION] Prisma migrate diff completed', logCtx, {
        tempFilePath: migrationOutputTempPath,
        tempFileExists,
        tempFileSize: `${tempFileSize} bytes`,
      });

      // Clean up temp previous schema if we created one and evaluate the diff
      if (shouldDiffAgainstPrevious) {
        const previousSchemaTempPath = path.join(
          prismaPath,
          'schema.previous.prisma'
        );
        try {
          deleteFileSync(previousSchemaTempPath);
        } catch (ignore) {
          // No prior schema to delete; continue.
        }
      }

      try {
        logWithTrace('[MIGRATION] Reading temp migration file', logCtx);
        const sql = readFileSync(migrationOutputTempPath) || '';

        const sqlWithoutComments = sql
          .split('\n')
          .filter((line) => !/^\s*--/.test(line))
          .join('\n')
          .trim();

        logWithTrace('[MIGRATION] SQL diff analysis', logCtx, {
          sqlLength: sql.length,
          sqlWithoutCommentsLength: sqlWithoutComments.length,
        });

        if (!sqlWithoutComments) {
          // Empty diff => remove temp file and do not create a migration folder
          logWithTrace(
            '[MIGRATION] Empty SQL diff - no migration folder will be created',
            logCtx
          );
          deleteFileSync(migrationOutputTempPath);
        } else {
          logWithTrace(
            '[MIGRATION] Non-empty SQL diff - creating migration folder',
            logCtx
          );
          // Non-empty diff => create a new migration folder and place migration.sql there
          // Check if an init migration already exists
          let hasInitMigration = false;
          try {
            const dirents = await readdir(migrationsDirPath, {
              withFileTypes: true,
            });
            hasInitMigration = dirents?.some(
              (d) => d.isDirectory?.() && /_init$/.test(d.name)
            );
          } catch (ignore) {
            // No prior migrations to check; continue.
          }

          const migrationName = generateMigrationName(
            hasInitMigration ? 'update' : 'init'
          );

          const prismaMigrationsPath = path.join(
            migrationsDirPath,
            migrationName
          );
          await ensureDirExists(prismaMigrationsPath);

          const finalMigrationPath = path.join(
            prismaMigrationsPath,
            'migration.sql'
          );
          writeFileSync(finalMigrationPath, sql);
          deleteFileSync(migrationOutputTempPath);

          logWithTrace(
            '[MIGRATION] Migration file created successfully',
            logCtx,
            {
              migrationName,
              migrationPath: prismaMigrationsPath,
              finalMigrationPath,
            }
          );
        }
      } catch (migrationError) {
        // Log the error for debugging instead of silently ignoring
        logWithTrace('[MIGRATION][ERROR] Migration creation failed', logCtx, {
          error: migrationError?.message,
          stack: migrationError?.stack,
          tempFilePath: migrationOutputTempPath,
          migrationsDir: migrationsDirPath,
          continuing: true,
        });
        // Continue generation but log that migrations failed
      }

      // Delete backup directory if it exists
      try {
        await deleteDirIfExists(migrationsBackupPath);
      } catch (ignore) {
        // No prior migrations to delete; continue.
      }

      // Final diagnostic: Check if migrations folder was created
      const fsFinal = require('fs');
      const migrationsExist = fsFinal.existsSync(migrationsDirPath);
      if (migrationsExist) {
        const migrationFolders = fsFinal.readdirSync(migrationsDirPath);
        logWithTrace('[MIGRATION] Summary - migrations folder exists', logCtx, {
          path: migrationsDirPath,
          folders: migrationFolders,
        });
      } else {
        logWithTrace(
          '[MIGRATION] Summary - no migrations folder created',
          logCtx,
          {
            path: migrationsDirPath,
          }
        );
      }
    });

    // Write generation manifest
    const manifest = createGenerationManifest({
      microserviceId: microservice?.id,
      microserviceName: microserviceSlug,
      models: currentModels.map((m) => ({
        name: m.name,
        id: m.id,
        fieldCount: m.fieldDefns?.length || 0,
      })),
      generatedFiles: [], // TODO: Track individual files in future enhancement
    });

    await writeManifest(restAPI?.path, manifest);
    logWithTrace('[MANIFEST] Generated manifest', logCtx, {
      modelsTracked: currentModels.length,
    });

    // Update migration manifest after successful generation
    await updateMigrationManifest({
      restAPIPath: restAPI?.path,
      microservice,
      models: currentModels,
      user,
      appliedFixes: appliedMigrationFixes,
    });

    if (appliedMigrationFixes.length > 0) {
      logWithTrace('[MIGRATION] Applied auto-fixes', logCtx, {
        fixCount: appliedMigrationFixes.length,
        fixes: appliedMigrationFixes,
      });
    }
  },
  'generateAPI'
);

module.exports = main;
