const fs = require('fs');
const path = require('path');
const {
  ensureDirExists,
  createFileFromTemplate,
  cleanAndPrepareDir,
  copyMultipleFiles,
  modifyFile,
  formatFile,
  copyFolder,
} = require('#utils/shared/fileUtils.js');
const { logStep } = require('#utils/shared/loggingUtils.js');
const getComputeMicroservicePaths = require('#configs/computePaths.js');
const { createListPage } = require('#utils/frontend/listPageUtils.js');
const { createTableColumns } = require('#utils/frontend/tableColumnsUtils.js');
const {
  createEntityCoreRoutes,
  registerValidationSchemas,
} = require('#utils/frontend/apiRoutesUtils.js');
const { modifyDrawerLinksFile } = require('#utils/frontend/drawerUtils.js');
const { updateCommandsSh } = require('#utils/frontend/devopsUtils.js');
const { addCreateForms } = require('#utils/frontend/createFormUtils.js');
const { addDetailForms } = require('#utils/frontend/detailFormUtils.js');
const {
  createDetailPage,
  getDetailPageInfo,
} = require('#src/utils/frontend/detailPageUtils.js');
const {
  createValidationSchemaFile,
  formatValidationSchemaFile,
} = require('#src/utils/frontend/validationSchemaUtils.js');
const {
  createTableDataMappers,
} = require('#src/utils/frontend/dataMapperUtils.js');
const { addFormFlow } = require('#src/utils/frontend/formFlowUtils.js');
const {
  toStartCaseUpperUnderscore,
  toPlural,
  resolveModelSlug,
} = require('#utils/shared/stringUtils.js');
const {
  createStandardError,
  withErrorHandling,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { logWithTrace } = require('#utils/shared/traceUtils.js');
const {
  getReminderEntityModelKey,
  getReminderEntityModelValue,
} = require('#utils/frontend/commonUtils.js');
const {
  selectiveFrontendDelete,
} = require('#src/utils/frontend/selectiveFrontendDelete.js');
const {
  createFrontendManifest,
  saveFrontendManifest,
} = require('#src/utils/frontend/frontendManifestUtils.js');
const {
  createEntityCoreCoreIndex,
  createEntityCoreDomainIndex,
  createCoreBarrelExports,
} = require('#src/utils/frontend/entityCoreIndexUtils.js');
const {
  createAppDomainIndex,
  createCoreDetailComponent,
  createCorePageIndex,
} = require('#src/utils/frontend/corePageUtils.js');
const {
  generateDynamicRouteFiles,
  getDynamicRouteGeneratedFiles,
} = require('#src/utils/frontend/dynamicRouteUtils.js');

const escapeRegExp = (value = '') =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Validates and fixes duplicate declarations in _app.tsx
 * This function detects if route URL declarations (drawerRouteUrls, drawerMenusUrl,
 * userAccountMenuRouteUrls) appear multiple times and removes duplicates.
 *
 * Root cause of duplicates is unknown but this prevents corrupted output.
 */
function fixDuplicateRouteDeclarations(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Pattern to match the route declarations block (from comment to closing brace)
  const routeBlockPattern =
    /\/\/ Route URLs for AdminLayout components \(dependency injection to avoid circular imports\)\nconst drawerRouteUrls: DrawerRouteUrls = \{[\s\S]*?\};\n\nconst drawerMenusUrl = getRoute\('system-django\/getUserDrawMenusURL'\)\(\);\n\nconst userAccountMenuRouteUrls: UserAccountMenuRouteUrls = \{[\s\S]*?\};/g;

  const matches = content.match(routeBlockPattern);

  if (matches && matches.length > 1) {
    console.log(
      `[Frontend] Warning: Found ${matches.length} duplicate route declaration blocks in _app.tsx. Removing duplicates.`
    );

    // Keep only the first occurrence by replacing all matches and then adding back one
    let fixedContent = content;
    const firstMatch = matches[0];

    // Remove all occurrences
    for (const match of matches) {
      fixedContent = fixedContent.replace(`${match}\n\n`, '');
    }

    // Find where to insert (after queryClient declaration)
    const queryClientPos = fixedContent.indexOf(
      'const queryClient = new QueryClient(DEFAULT_QUERY_CLIENT_OPTIONS);'
    );
    if (queryClientPos !== -1) {
      // Insert before queryClient
      const insertPos = fixedContent.lastIndexOf('\n', queryClientPos - 2);
      fixedContent = `${fixedContent.slice(0, insertPos)}\n\n${firstMatch}${fixedContent.slice(insertPos)}`;
    }

    fs.writeFileSync(filePath, fixedContent, 'utf-8');
    console.log(`[Frontend] Fixed duplicate route declarations in _app.tsx`);
    return true;
  }

  return false;
}

// Main function responsible for setting up the front-end structure for a compute microservice
const main = withErrorHandling(
  async ({
    microservice,
    models,
    user,
    instanceId,
    externalFks,
    traceId = null,
  } = {}) => {
    try {
      // Check if a valid microservice and models are provided before proceeding
      if (!microservice?.name || !Array.isArray(models)) {
        return; // Exit if microservice or models are not valid
      }

      // Destructuring paths required for the main app and the frontend based on the microservice name
      const {
        mainApp, // Path to the main application
        frontend, // Path to the frontend
        microservice: { slug: microserviceSlug }, // Microservice slug used for folder and file names
        entityCore, // Path to entity-core package
      } = getComputeMicroservicePaths({
        microserviceName: microservice?.name,
      });

      // Paths to important directories within the project
      const COMPUTE_SRC_PATH = path.join(frontend?.path, 'src'); // Source folder path for the microservice frontend
      const MAIN_APPS_FOLDER_PATH = path.join(
        mainApp?.path,
        'apps',
        microserviceSlug
      ); // Folder for storing microservice apps
      const MAIN_SHARED_CORE_PKG_PATH = path.join(
        mainApp?.path,
        'packages',
        'shared-core'
      ); // Shared core package path within the main app

      await ensureDirExists(path.join(MAIN_SHARED_CORE_PKG_PATH, 'src'));

      // Common logging parameters used across steps for tracking user actions and instance
      const commonLogParams = {
        user,
        instanceId,
      };

      // Log step and prepare directories, including copying configuration files
      await logStep({ ...commonLogParams, stepCode: '5W4G-2PS' }, async () => {
        // Selectively clean frontend (preserves protected files like src/domain)
        const deleteResult = await selectiveFrontendDelete(frontend?.path);
        console.log(
          `[Frontend] Deleted ${deleteResult.deleted.length} files, preserved ${deleteResult.preserved.length} protected files`
        );

        // Selectively clean main app folder (preserves protected directories like src/domain)
        await ensureDirExists(MAIN_APPS_FOLDER_PATH);
        const mainAppDeleteResult = await selectiveFrontendDelete(
          MAIN_APPS_FOLDER_PATH
        );
        console.log(
          `[MainApp] Deleted ${mainAppDeleteResult.deleted.length} files, preserved ${mainAppDeleteResult.preserved.length} protected files`
        );

        const microservicePort = updateCommandsSh({
          mainApp,
          microserviceSlug,
        });

        // Copy multiple necessary configuration files for setting up the project
        await copyMultipleFiles([
          {
            src: path.join(
              frontend?.constructorPath,
              'app',
              'package.template.json'
            ),
            dest: path.join(frontend?.path, 'package.json'),
            replacements: {
              '@gen{APP_NAME}': microserviceSlug,
              '@gen{PORT}': microservicePort,
              '@gen{MICROSERVICE_SLUG}': microserviceSlug,
            },
          },
          {
            src: path.join(
              frontend?.constructorPath,
              'app',
              '.eslintrc.template.json'
            ),
            dest: path.join(frontend?.path, '.eslintrc.json'),
          },
          {
            src: path.join(
              frontend?.constructorPath,
              'app',
              '.gitignore.template'
            ),
            dest: path.join(frontend?.path, '.gitignore'),
          },
          {
            src: path.join(
              frontend?.constructorPath,
              'app',
              'next-env.d.template.ts'
            ),
            dest: path.join(frontend?.path, 'next-env.d.ts'),
          },
          {
            src: path.join(
              frontend?.constructorPath,
              'app',
              'next.config.template.ts'
            ),
            dest: path.join(frontend?.path, 'next.config.ts'),
            replacements: {
              '@gen{MS_SLUG}': microserviceSlug,
            },
          },
          {
            src: path.join(
              frontend?.constructorPath,
              'app',
              'tsconfig.template.json'
            ),
            dest: path.join(frontend?.path, 'tsconfig.json'),
          },
          // Copy configuration files to the main apps folder
          {
            src: path.join(frontend?.path, 'package.json'),
            dest: path.join(MAIN_APPS_FOLDER_PATH, 'package.json'),
          },
          {
            src: path.join(frontend?.path, '.eslintrc.json'),
            dest: path.join(MAIN_APPS_FOLDER_PATH, '.eslintrc.json'),
          },
          {
            src: path.join(frontend?.path, '.gitignore'),
            dest: path.join(MAIN_APPS_FOLDER_PATH, '.gitignore'),
          },
          {
            src: path.join(frontend?.path, 'next-env.d.ts'),
            dest: path.join(MAIN_APPS_FOLDER_PATH, 'next-env.d.ts'),
          },
          {
            src: path.join(frontend?.path, 'next.config.ts'),
            dest: path.join(MAIN_APPS_FOLDER_PATH, 'next.config.ts'),
          },
          {
            src: path.join(frontend?.path, 'tsconfig.json'),
            dest: path.join(MAIN_APPS_FOLDER_PATH, 'tsconfig.json'),
          },
        ]);

        await formatFile(path.join(frontend?.path, 'package.json'), 'json');
        await formatFile(
          path.join(MAIN_APPS_FOLDER_PATH, 'package.json'),
          'json'
        );

        const mainNextConfigFile = path.join(
          mainApp?.path,
          'apps',
          'main',
          'next.config.ts'
        );

        modifyFile(mainNextConfigFile, (content) => {
          if (content.includes(`/${microserviceSlug}/:path*`)) {
            return content;
          }

          // Insert the new rewrite rule
          const rewritePlaceholder = '// {{REWRITES}}';
          const newRule = `{
                            source: '/${microserviceSlug}/:path*',
                            destination: 'http://localhost:${microservicePort}/${microserviceSlug}/:path*'
                          },`;

          const newContent = content.replace(
            rewritePlaceholder,
            `${newRule}\n\t${rewritePlaceholder}`
          );

          return newContent;
        });

        await formatFile(mainNextConfigFile);

        const coreConstantsFile = path.join(
          MAIN_SHARED_CORE_PKG_PATH,
          'src',
          'config',
          'apps',
          'calendar',
          'constants.ts'
        );

        modifyFile(coreConstantsFile, (content) => {
          let modifiedContent = content;

          if (
            modifiedContent.includes('// @gen:REMINDER_ENTITY_MICROSERVICES')
          ) {
            const microserviceKey = toStartCaseUpperUnderscore(
              microservice?.name
            );
            const placeholder = '// @gen:REMINDER_ENTITY_MICROSERVICES';
            const exactMicroserviceEntryPattern = new RegExp(
              `^\\s*${escapeRegExp(microserviceKey)}:\\s*'${escapeRegExp(
                microservice?.name
              )}',\\s*$`,
              'm'
            );

            if (!exactMicroserviceEntryPattern.test(modifiedContent)) {
              const existingMicroservicePattern = new RegExp(
                `^\\s*${escapeRegExp(microserviceKey)}:\\s*'[^']+',\\s*\\r?\\n`,
                'gm'
              );
              modifiedContent = modifiedContent.replace(
                existingMicroservicePattern,
                ''
              );

              const microserviceEntry = `  ${microserviceKey}: '${microservice?.name}',\n  ${placeholder}`;
              modifiedContent = modifiedContent.replace(
                placeholder,
                microserviceEntry
              );
            }
          }

          if (modifiedContent.includes('// @gen:REMINDER_ENTITY_MODELS')) {
            // Remove any previously generated lines for this microservice to keep block idempotent
            const currentPrefix = `${toStartCaseUpperUnderscore(microservice?.name)}_`;
            const existingLinesForMicroservice = new RegExp(
              `^\\s*${currentPrefix}[A-Z0-9_]+:\\s*'[^']+',\\s*\\r?\\n`,
              'gm'
            );
            modifiedContent = modifiedContent.replace(
              existingLinesForMicroservice,
              ''
            );

            const modelEntries = models
              .filter((model) => !model?.deleted)
              .sort((a, b) =>
                (a?.name || '').localeCompare(b?.name || '', 'en', {
                  sensitivity: 'base',
                })
              )
              .map(
                (model) =>
                  `${getReminderEntityModelKey(microservice?.name, model?.name)}: '${getReminderEntityModelValue(model?.name)}',`
              )
              .join('\n');

            const modelsReplacement = modelEntries
              ? `${modelEntries}\n// @gen:REMINDER_ENTITY_MODELS`
              : '// @gen:REMINDER_ENTITY_MODELS';

            modifiedContent = modifiedContent.replace(
              '// @gen:REMINDER_ENTITY_MODELS',
              modelsReplacement
            );
          }

          return modifiedContent;
        });

        await formatFile(coreConstantsFile);
      });

      // Log step to create the source folders and pages (_app.tsx, _document.tsx, and index.tsx)
      await logStep({ ...commonLogParams, stepCode: 'JWAC-TA7' }, async () => {
        await cleanAndPrepareDir(path.join(frontend?.path, 'src', 'pages'));

        // Create the _app.tsx file from a template
        await createFileFromTemplate({
          templatePathSegments: [
            frontend?.constructorPath,
            'app',
            'pages',
            '_app.template.tsx',
          ],
          destinationPathSegments: [COMPUTE_SRC_PATH, 'pages', '_app.tsx'],
          user,
          templateReplacements: {
            '@gen{APP_NAME}': microservice?.label ?? microservice?.name ?? '',
          },
        });

        // Validate and fix any duplicate route declarations (safeguard against unknown bug)
        const appTsxPath = path.join(COMPUTE_SRC_PATH, 'pages', '_app.tsx');
        fixDuplicateRouteDeclarations(appTsxPath);

        // Create the _document.tsx file from a template
        await createFileFromTemplate({
          templatePathSegments: [
            frontend?.constructorPath,
            'app',
            'pages',
            '_document.template.tsx',
          ],
          destinationPathSegments: [COMPUTE_SRC_PATH, 'pages', '_document.tsx'],
          user,
        });

        const dashboardCharts = [];

        for (const model of models) {
          if (
            model?.deleted ||
            !model?.addToDashboard ||
            !model?.dashboardStageFieldId
          ) {
            continue;
          }

          dashboardCharts.push(
            `{
            label: '${toPlural(model?.label ?? model?.name)}',
            host: process?.env?.NEXT_PUBLIC_${toStartCaseUpperUnderscore(microservice?.name)}_HOST ?? '',
            slug: '${resolveModelSlug(model)}',
           }`
          );
        }

        const dashboardFile = [COMPUTE_SRC_PATH, 'pages', 'index.tsx'];

        // Create the index.tsx file from a template
        await createFileFromTemplate({
          templatePathSegments: [
            frontend?.constructorPath,
            'app',
            'pages',
            'index.template.tsx',
          ],
          destinationPathSegments: dashboardFile,
          user,
          templateReplacements: {
            '// @gen:CHARTS_DATA': dashboardCharts?.length
              ? dashboardCharts.join(',\n')
              : '',
          },
        });

        await formatFile(path.join(...dashboardFile));
      });

      // Log step to create routes and handle UI data mappers for the microservice
      await logStep({ ...commonLogParams, stepCode: 'II9E-5TN' }, async () => {
        // Check if dynamic routes should be used (default to true for new apps)
        const useDynamicRoutes = microservice?.useDynamicRoutes !== false;

        // Track models that have detail pages (for DetailCore mapping in entity registry)
        const modelsWithDetailPages = [];

        // Ensure directories for table columns and data mappers exist
        await ensureDirExists(
          path.join(frontend?.path, 'src', 'core', 'configs', 'tableColumns')
        );
        await ensureDirExists(
          path.join(frontend?.path, 'src', 'core', 'configs', 'dataMappers')
        );
        await ensureDirExists(
          path.join(
            frontend?.path,
            'src',
            'core',
            'configs',
            'validationSchemas'
          )
        );

        for (const model of models) {
          if (model?.deleted) {
            continue;
          }

          const { detailPageLink, shouldCreateDetailPage, children } =
            getDetailPageInfo({
              models,
              model,
              microserviceSlug,
            });

          await createTableColumns({
            frontend,
            microserviceSlug,
            detailPageLink,
            user,
            model,
            externalFks,
            models,
          });

          await createTableDataMappers({
            user,
            model,
            frontend,
            externalFks,
            models,
          });

          // Always create Core detail components (they contain related tabs)
          // With dynamic routes, we skip the static wrapper page but still need the Core
          if (shouldCreateDetailPage) {
            // Track this model for the entity registry's DetailCore mapping
            modelsWithDetailPages.push(model);

            if (useDynamicRoutes) {
              // Generate only the Core component (contains related tabs)
              await createCoreDetailComponent({
                model,
                frontend,
                microserviceSlug,
                microserviceName: microservice?.name,
                children,
                user,
              });
              // Create the barrel export for the Core component
              await createCorePageIndex({
                model,
                frontend,
              });
            } else {
              // Legacy: Create full static detail page (includes Core component)
              await createDetailPage({
                model,
                frontend,
                user,
                children,
                microserviceSlug,
                externalFks,
                models,
                microserviceName: microservice?.name,
              });
            }
          }
        }

        if (useDynamicRoutes) {
          // Generate dynamic route architecture (single pair of routes for all entities)
          await generateDynamicRouteFiles({
            frontend,
            models: models.filter((m) => !m?.deleted),
            microserviceSlug,
            microserviceName: microservice?.name,
            user,
            modelsWithDetailPages,
          });
          console.log(
            `[Frontend] Using dynamic routes for ${models.filter((m) => !m?.deleted).length} entities (${modelsWithDetailPages.length} with detail pages)`
          );
        } else {
          // Legacy: Create static list pages for each model
          for (const model of models) {
            await createListPage({
              model,
              frontend,
              microserviceSlug,
              user,
              microserviceName: microservice?.name,
            });
          }
          console.log(
            `[Frontend] Using static pages (legacy mode) for ${models.filter((m) => !m?.deleted).length} entities`
          );
        }
      });

      // Log step to modify drawer links for navigation
      await logStep({ ...commonLogParams, stepCode: 'VSZ7-1PZ' }, async () => {
        // Modify the drawer links file to add navigation for the new microservice routes
        await modifyDrawerLinksFile(microservice, models, user);
      });

      await logStep({ ...commonLogParams, stepCode: 'WUYR-E94' }, async () => {
        await addCreateForms({
          frontend,
          models,
          microserviceSlug,
          user,
          externalFks,
        });

        await addDetailForms({
          frontend,
          models,
          microserviceSlug,
          user,
          externalFks,
        });

        const hasFormFlow = models.some(({ useFormFlow }) => !!useFormFlow);

        if (hasFormFlow) {
          await ensureDirExists(
            path.join(frontend?.path, 'src', 'pages', 'ff')
          );
        }

        for (const model of models) {
          const modelName = model?.name ?? '';

          await createValidationSchemaFile({
            frontend,
            modelName,
            modelFields: model?.fieldDefns ?? '',
            user,
          });

          await formatValidationSchemaFile({ frontend, modelName });

          if (model?.useFormFlow) {
            await addFormFlow({
              frontend,
              model,
              models,
              user,
              microserviceSlug,
              externalFks,
            });
          }
        }

        // Copy pages folder to main app
        const frontendPagesPath = path.join(frontend?.path, 'src', 'pages');
        const mainAppPagesPath = path.join(
          MAIN_APPS_FOLDER_PATH,
          'src',
          'pages'
        );
        await ensureDirExists(mainAppPagesPath);
        await copyFolder(frontendPagesPath, mainAppPagesPath);

        // Copy components folder to main app (for GenericListPage, GenericDetailPage)
        const frontendComponentsPath = path.join(
          frontend?.path,
          'src',
          'components'
        );
        const mainAppComponentsPath = path.join(
          MAIN_APPS_FOLDER_PATH,
          'src',
          'components'
        );
        if (fs.existsSync(frontendComponentsPath)) {
          await ensureDirExists(mainAppComponentsPath);
          await copyFolder(frontendComponentsPath, mainAppComponentsPath);
        }

        // Copy config folder to main app (for entityRegistry)
        const frontendConfigPath = path.join(frontend?.path, 'src', 'config');
        const mainAppConfigPath = path.join(
          MAIN_APPS_FOLDER_PATH,
          'src',
          'config'
        );
        if (fs.existsSync(frontendConfigPath)) {
          await ensureDirExists(mainAppConfigPath);
          await copyFolder(frontendConfigPath, mainAppConfigPath);
        }

        // Copy configs to entity-core package core folder (tableColumns, dataMappers, validationSchemas)
        const frontendConfigsPath = path.join(
          frontend?.path,
          'src',
          'core',
          'configs'
        );
        const entityCoreConfigsPath = path.join(
          entityCore.microservicePath,
          'core',
          'configs'
        );
        await ensureDirExists(entityCoreConfigsPath);
        await copyFolder(frontendConfigsPath, entityCoreConfigsPath);

        // Copy forms to entity-core package core folder
        const frontendFormsPath = path.join(
          frontend?.path,
          'src',
          'core',
          'forms'
        );
        const entityCoreFormsPath = path.join(
          entityCore.microservicePath,
          'core',
          'forms'
        );
        await ensureDirExists(entityCoreFormsPath);
        await copyFolder(frontendFormsPath, entityCoreFormsPath);

        // Copy core/pages to main app (for detail page core components)
        const frontendCorePagesPath = path.join(
          frontend?.path,
          'src',
          'core',
          'pages'
        );
        const mainAppCorePagesPath = path.join(
          MAIN_APPS_FOLDER_PATH,
          'src',
          'core',
          'pages'
        );
        await ensureDirExists(mainAppCorePagesPath);
        await copyFolder(frontendCorePagesPath, mainAppCorePagesPath);

        // Create barrel export registries (forms, tableColumns, dataMappers, validationSchemas)
        await createCoreBarrelExports({
          entityCore,
          models,
        });

        // Create entity-core core/domain structure
        await createEntityCoreCoreIndex({
          entityCore,
          models,
          frontend,
          user,
        });

        await createEntityCoreDomainIndex({
          entityCore,
          frontend,
          user,
        });

        // Create app domain structure (protected - only created if it doesn't exist)
        await createAppDomainIndex({
          appPath: MAIN_APPS_FOLDER_PATH,
          frontend,
          user,
        });

        // Create barrel export (index.ts) for entity-core microservice folder
        await createFileFromTemplate({
          templatePathSegments: [
            frontend?.constructorPath,
            'entity-core',
            'index.template.ts',
          ],
          destinationPathSegments: [entityCore.microservicePath, 'index.ts'],
          user,
        });

        // Create routes in entity-core/routes/definitions/{slug}.ts
        await createEntityCoreRoutes({
          entityCore,
          frontend,
          models,
          microserviceName: microservice?.name,
          user,
          mainApp,
        });

        // Register validation schemas in entity-core/validationSchemas/index.ts
        await registerValidationSchemas({
          entityCore,
          microserviceName: microservice?.name,
        });
      });

      // Generate manifest of all generated files
      const generatedFiles = [];

      // Check if dynamic routes were used
      const useDynamicRoutes = microservice?.useDynamicRoutes !== false;

      for (const model of models) {
        if (model?.deleted) continue;
        const modelSlug = resolveModelSlug(model);
        // Track core generated files per model
        generatedFiles.push(
          `src/core/configs/tableColumns/${modelSlug}Columns.ts`
        );
        generatedFiles.push(
          `src/core/configs/dataMappers/${modelSlug}DataMapper.ts`
        );
        generatedFiles.push(
          `src/core/configs/validationSchemas/${modelSlug}Schema.ts`
        );

        // Only track static pages if not using dynamic routes
        if (!useDynamicRoutes) {
          generatedFiles.push(`src/pages/${modelSlug}/index.tsx`);
          generatedFiles.push(`src/pages/${modelSlug}/create.tsx`);
          generatedFiles.push(`src/pages/${modelSlug}/[id].tsx`);
        }
      }

      // Track common generated files
      generatedFiles.push('src/pages/_app.tsx');
      generatedFiles.push('src/pages/_document.tsx');
      generatedFiles.push('src/pages/index.tsx');
      generatedFiles.push('src/core/configs/validationSchemas/index.ts');

      // Track dynamic route files if using dynamic routes
      if (useDynamicRoutes) {
        generatedFiles.push(...getDynamicRouteGeneratedFiles());
      }

      const manifest = createFrontendManifest(
        generatedFiles,
        microservice?.name
      );
      await saveFrontendManifest(frontend?.path, manifest);
      console.log(
        `[Frontend] Manifest saved with ${generatedFiles.length} generated files`
      );
    } catch (error) {
      logWithTrace(
        '[ERROR] Failed to generate frontend files',
        { traceId },
        { error: error?.message }
      );
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to generate frontend files',
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'generate_frontend',
          details: { traceId, error: error?.message },
          originalError: error,
        }
      );
    }
  },
  'generate_frontend'
);

// Export the main function as a module
module.exports = main;
