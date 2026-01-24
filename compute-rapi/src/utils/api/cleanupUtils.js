/**
 * CREATED BY: Claude Code Assistant
 * CREATION DATE: 2025-01-17
 *
 * DESCRIPTION:
 * ------------------
 * Comprehensive cleanup utilities for removing all traces of a generated microservice
 * from the compute output directories, main app integrations, and configuration files.
 */

const fs = require('fs').promises;
const path = require('path');
const { deleteDirIfExists, modifyFile } = require('#utils/shared/fileUtils.js');
const {
  createStandardError,
  withErrorHandling,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  logWithTrace,
  logOperationStart,
  logOperationSuccess,
  logOperationError,
} = require('#utils/shared/traceUtils.js');
const {
  toStartCaseUpperUnderscore,
  toCamelCase,
} = require('#utils/shared/stringUtils.js');
const { deleteFileIfExists } = require('#utils/shared/fileUtils.js');

/**
 * Removes all generated repository directories for a microservice
 * @param {Object} paths - Paths object from getComputeMicroservicePaths
 * @param {Object} req - Request object for trace ID context
 */
const cleanupGeneratedRepositories = withErrorHandling(async (paths, req) => {
  const repositories = [
    { name: 'REST API', path: paths.restAPI.path },
    { name: 'Frontend', path: paths.frontend.path },
    { name: 'DevOps', path: paths.devOps.path },
    { name: 'Main App Copy', path: paths.mainApp.path },
  ];

  logOperationStart('cleanupGeneratedRepositories', req, {
    repositoryCount: repositories.length,
  });

  for (const repo of repositories) {
    try {
      await deleteDirIfExists(repo.path);
      logWithTrace(`Removed ${repo.name} repository`, req, { path: repo.path });
    } catch (error) {
      logOperationError('cleanupGeneratedRepositories', req, error);
      logWithTrace(`Failed to remove ${repo.name} repository`, req, {
        path: repo.path,
        error: error.message,
      });
    }
  }

  // Remove the parent microservice directory if it's empty
  try {
    await deleteDirIfExists(paths.microservice.path);
    logWithTrace('Removed microservice directory', req, {
      path: paths.microservice.path,
    });
  } catch (error) {
    logOperationError('cleanupGeneratedRepositories', req, error);
    logWithTrace('Failed to remove microservice directory', req, {
      path: paths.microservice.path,
      error: error.message,
    });
  }

  logOperationSuccess('cleanupGeneratedRepositories', req, {
    processedRepositories: repositories.length,
  });
}, 'repository_cleanup');

/**
 * Removes package.json export entries for a microservice
 * @param {string} packageJsonPath - Path to package.json file
 * @param {string} microserviceSlug - Microservice slug
 * @param {Object} req - Request object for trace ID context
 */
const removePackageJsonExports = withErrorHandling(
  async (packageJsonPath, microserviceSlug, req) => {
    logOperationStart('removePackageJsonExports', req, {
      packageJsonPath,
      microserviceSlug,
    });

    try {
      const packageContent = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageContent);

      if (!packageJson.exports) {
        logWithTrace('No exports to clean up', req, { packageJsonPath });
        return; // No exports to clean up
      }

      // Remove all exports related to this microservice
      const exportsToRemove = Object.keys(packageJson.exports).filter(
        (exportKey) => exportKey.includes(`/apps/${microserviceSlug}/`)
      );

      exportsToRemove.forEach((exportKey) => {
        delete packageJson.exports[exportKey];
      });

      // Write back the modified package.json
      await fs.writeFile(
        packageJsonPath,
        `${JSON.stringify(packageJson, null, 2)}\n`,
        'utf8'
      );

      logWithTrace('Removed exports from package.json', req, {
        packageJsonPath,
        removedCount: exportsToRemove.length,
      });

      logOperationSuccess('removePackageJsonExports', req, {
        removedExports: exportsToRemove.length,
      });
    } catch (error) {
      logOperationError('removePackageJsonExports', req, error);
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to clean package.json exports',
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'package_json_export_cleanup',
          details: { packageJsonPath, microserviceSlug, error: error.message },
        }
      );
    }
  },
  'package_json_export_removal'
);

/**
 * Removes environment variables from Docker files
 * @param {string} mainAppPath - Path to main app directory
 * @param {string} microserviceName - Microservice name for env var
 * @param {Object} req - Request object for trace ID context
 */
const removeDockerEnvironmentVariables = withErrorHandling(
  async (mainAppPath, microserviceName, req) => {
    const environments = ['dev', 'staging', 'prod'];
    const envVarName = `NEXT_PUBLIC_${toStartCaseUpperUnderscore(microserviceName)}_HOST`;

    logOperationStart('removeDockerEnvironmentVariables', req, {
      environments,
      envVarName,
      mainAppPath,
    });

    for (const env of environments) {
      const dockerfilePath = path.join(mainAppPath, `Dockerfile.${env}`);

      try {
        await modifyFile(dockerfilePath, (content) => {
          // Remove lines containing the environment variable
          const lines = content.split('\n');
          const filteredLines = lines.filter(
            (line) => !line.includes(envVarName)
          );
          return filteredLines.join('\n');
        });

        logWithTrace(`Removed env var from Dockerfile`, req, {
          dockerfile: `Dockerfile.${env}`,
          envVarName,
        });
      } catch (error) {
        logOperationError('removeDockerEnvironmentVariables', req, error);
        logWithTrace(`Failed to remove env vars from Dockerfile`, req, {
          dockerfile: `Dockerfile.${env}`,
          envVarName,
          error: error.message,
        });
      }
    }

    logOperationSuccess('removeDockerEnvironmentVariables', req, {
      processedEnvironments: environments.length,
    });
  },
  'docker_env_var_removal'
);

/**
 * Removes microservice rewrite rules from Next.js config
 * @param {string} nextConfigPath - Path to next.config.ts file
 * @param {string} microserviceSlug - Microservice slug
 * @param {Object} req - Request object for trace ID context
 */
const removeNextConfigRewrites = withErrorHandling(
  async (nextConfigPath, microserviceSlug, req) => {
    logOperationStart('removeNextConfigRewrites', req, {
      nextConfigPath,
      microserviceSlug,
    });

    try {
      await modifyFile(nextConfigPath, (content) => {
        // Remove the specific rewrite rule for this microservice
        const rewritePattern = new RegExp(
          `\\s*{[^}]*source:\\s*['"][/]${microserviceSlug}[/]:path\\*['"][^}]*}[,]?`,
          'g'
        );

        let modifiedContent = content.replace(rewritePattern, '');

        // Clean up any trailing commas in rewrites array
        modifiedContent = modifiedContent.replace(/,(\s*])/g, '$1');

        return modifiedContent;
      });

      logWithTrace('Removed rewrite rules from Next.js config', req, {
        nextConfigPath,
        microserviceSlug,
      });

      logOperationSuccess('removeNextConfigRewrites', req, {
        microserviceSlug,
      });
    } catch (error) {
      logOperationError('removeNextConfigRewrites', req, error);
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to remove Next.js config rewrites',
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'next_config_rewrite_removal',
          details: { nextConfigPath, microserviceSlug, error: error.message },
        }
      );
    }
  },
  'next_config_rewrite_removal'
);

/**
 * Removes microservice startup commands from commands.sh
 * @param {string} commandsPath - Path to commands.sh file
 * @param {string} microserviceSlug - Microservice slug
 * @param {Object} req - Request object for trace ID context
 */
const removeStartupCommands = withErrorHandling(
  async (commandsPath, microserviceSlug, req) => {
    logOperationStart('removeStartupCommands', req, {
      commandsPath,
      microserviceSlug,
    });

    try {
      await modifyFile(commandsPath, (content) => {
        const lines = content.split('\n');
        const filteredLines = lines.filter(
          (line) => !line.includes(microserviceSlug) || line.trim() === ''
        );
        return filteredLines.join('\n');
      });

      logWithTrace('Removed startup commands', req, {
        commandsPath,
        microserviceSlug,
      });

      logOperationSuccess('removeStartupCommands', req, {
        microserviceSlug,
      });
    } catch (error) {
      logOperationError('removeStartupCommands', req, error);
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to remove startup commands',
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'startup_command_removal',
          details: { commandsPath, microserviceSlug, error: error.message },
        }
      );
    }
  },
  'startup_command_removal'
);

/**
 * Removes microservice directories from main app packages
 * @param {string} mainAppBasePath - Base path to main app
 * @param {string} microserviceSlug - Microservice slug
 * @param {Object} req - Request object for trace ID context
 */
const removeMainAppDirectories = withErrorHandling(
  async (mainAppBasePath, microserviceSlug, req) => {
    const directoriesToRemove = [
      path.join(mainAppBasePath, 'apps', microserviceSlug),
    ];

    logOperationStart('removeMainAppDirectories', req, {
      directoriesToRemove,
      microserviceSlug,
    });

    for (const dirPath of directoriesToRemove) {
      try {
        await deleteDirIfExists(dirPath);
        logWithTrace('Removed directory', req, { dirPath });
      } catch (error) {
        logOperationError('removeMainAppDirectories', req, error);
        logWithTrace('Failed to remove directory', req, {
          dirPath,
          error: error.message,
        });
      }
    }

    logOperationSuccess('removeMainAppDirectories', req, {
      processedDirectories: directoriesToRemove.length,
    });
  },
  'main_app_directory_removal'
);

/**
 * Removes entity-core microservice directory (configs, forms, etc.)
 * @param {Object} paths - Paths object from getComputeMicroservicePaths
 * @param {Object} req - Request object for trace ID context
 */
const removeEntityCoreDirectory = withErrorHandling(
  async (paths, req) => {
    const entityCoreMsPath = paths.entityCore?.microservicePath;

    if (!entityCoreMsPath) {
      logWithTrace('No entity-core path to clean up', req);
      return;
    }

    logOperationStart('removeEntityCoreDirectory', req, {
      entityCoreMsPath,
    });

    try {
      await deleteDirIfExists(entityCoreMsPath);
      logWithTrace('Removed entity-core microservice directory', req, {
        path: entityCoreMsPath,
      });

      logOperationSuccess('removeEntityCoreDirectory', req, {
        path: entityCoreMsPath,
      });
    } catch (error) {
      logOperationError('removeEntityCoreDirectory', req, error);
      logWithTrace('Failed to remove entity-core directory', req, {
        path: entityCoreMsPath,
        error: error.message,
      });
    }
  },
  'entity_core_directory_removal'
);

/**
 * Removes route definition file and unregisters from routes/index.ts
 * @param {Object} paths - Paths object from getComputeMicroservicePaths
 * @param {string} microserviceSlug - Microservice slug
 * @param {Object} req - Request object for trace ID context
 */
const removeEntityCoreRoutes = withErrorHandling(
  async (paths, microserviceSlug, req) => {
    const routesPath = paths.entityCore?.routesPath;

    if (!routesPath) {
      logWithTrace('No entity-core routes path to clean up', req);
      return;
    }

    logOperationStart('removeEntityCoreRoutes', req, {
      routesPath,
      microserviceSlug,
    });

    try {
      // 1. Remove the route definition file
      const definitionFilePath = path.join(
        routesPath,
        'definitions',
        `${microserviceSlug}.ts`
      );
      await deleteFileIfExists(definitionFilePath);
      logWithTrace('Removed route definition file', req, {
        path: definitionFilePath,
      });

      // 2. Unregister from routes/index.ts
      const routesIndexPath = path.join(routesPath, 'index.ts');
      const msNameCamel = toCamelCase(microserviceSlug);

      await modifyFile(routesIndexPath, (content) => {
        let modifiedContent = content;

        // Remove import statement
        const importPattern = new RegExp(
          `import\\s*\\{[^}]*\\}\\s*from\\s*['\"]\\.\\/definitions\\/${microserviceSlug}['\"];?\\n?`,
          'g'
        );
        modifiedContent = modifiedContent.replace(importPattern, '');

        // Remove registry entry: 'slug': slugRoutes, (handles quoted/unquoted slugs)
        // Escape hyphens in slug for regex safety
        const escapedSlug = microserviceSlug.replace(/-/g, '\\-');
        const registryPattern = new RegExp(
          `^[ \\t]*['"]?${escapedSlug}['"]?:\\s*${msNameCamel}Routes,?[ \\t]*\\r?\\n`,
          'gm'
        );
        modifiedContent = modifiedContent.replace(registryPattern, '');

        return modifiedContent;
      });

      logWithTrace('Unregistered routes from index', req, {
        indexPath: routesIndexPath,
      });

      logOperationSuccess('removeEntityCoreRoutes', req, {
        microserviceSlug,
      });
    } catch (error) {
      logOperationError('removeEntityCoreRoutes', req, error);
      logWithTrace('Failed to remove entity-core routes', req, {
        microserviceSlug,
        error: error.message,
      });
    }
  },
  'entity_core_routes_removal'
);

/**
 * Removes validation schema registration from entity-core
 * @param {Object} paths - Paths object from getComputeMicroservicePaths
 * @param {string} microserviceSlug - Microservice slug
 * @param {Object} req - Request object for trace ID context
 */
const removeEntityCoreValidationSchemas = withErrorHandling(
  async (paths, microserviceSlug, req) => {
    const entityCorePath = paths.entityCore?.path;

    if (!entityCorePath) {
      logWithTrace('No entity-core path for validation schema cleanup', req);
      return;
    }

    const msNameCamel = toCamelCase(microserviceSlug);

    logOperationStart('removeEntityCoreValidationSchemas', req, {
      entityCorePath,
      microserviceSlug,
    });

    try {
      const validationSchemasIndexPath = path.join(
        entityCorePath,
        'validationSchemas',
        'index.ts'
      );

      await modifyFile(validationSchemasIndexPath, (content) => {
        let modifiedContent = content;

        // Remove import statement (handles '../{slug}', '../{slug}/validationSchemas', and '../{slug}/core/configs/validationSchemas' paths)
        const importPattern = new RegExp(
          `import\\s*\\{\\s*validationSchemas\\s+as\\s+${msNameCamel}ValidationSchemas\\s*\\}\\s*from\\s*['\"]\\.\\.\\/${microserviceSlug}(/validationSchemas|/core/configs/validationSchemas)?['\"];?\\n?`,
          'g'
        );
        modifiedContent = modifiedContent.replace(importPattern, '');

        // Remove registry entry: 'slug': slugValidationSchemas, (handles quoted/unquoted slugs)
        // Escape hyphens in slug for regex safety
        const escapedSlug = microserviceSlug.replace(/-/g, '\\-');
        const registryPattern = new RegExp(
          `^[ \\t]*['"]?${escapedSlug}['"]?:\\s*${msNameCamel}ValidationSchemas,?[ \\t]*\\r?\\n`,
          'gm'
        );
        modifiedContent = modifiedContent.replace(registryPattern, '');

        return modifiedContent;
      });

      logWithTrace('Removed validation schema registration', req, {
        indexPath: validationSchemasIndexPath,
      });

      logOperationSuccess('removeEntityCoreValidationSchemas', req, {
        microserviceSlug,
      });
    } catch (error) {
      logOperationError('removeEntityCoreValidationSchemas', req, error);
      logWithTrace('Failed to remove validation schema registration', req, {
        microserviceSlug,
        error: error.message,
      });
    }
  },
  'entity_core_validation_schema_removal'
);

/**
 * Comprehensive cleanup function that removes all traces of a microservice
 * @param {Object} params - Cleanup parameters
 * @param {Object} params.paths - Paths object from getComputeMicroservicePaths
 * @param {string} params.microserviceName - Original microservice name
 * @param {string} params.mainAppBasePath - Base path to main app repository
 * @param {number} params.port - Port number assigned to microservice (optional)
 * @param {Object} params.req - Request object for trace ID context
 */
const cleanupMicroservice = withErrorHandling(
  async ({ paths, microserviceName, mainAppBasePath, req }) => {
    logOperationStart('cleanupMicroservice', req, {
      microserviceName,
      hasMainAppPath: !!mainAppBasePath,
    });

    try {
      // 1. Clean up main app integrations
      if (mainAppBasePath) {
        // Remove Docker environment variables
        await removeDockerEnvironmentVariables(
          mainAppBasePath,
          microserviceName,
          req
        );

        // Remove Next.js config rewrites
        const nextConfigPath = path.join(
          mainAppBasePath,
          'apps',
          'main',
          'next.config.ts'
        );

        await removeNextConfigRewrites(
          nextConfigPath,
          paths.microservice.slug,
          req
        );

        // Remove startup commands
        const commandsPath = path.join(mainAppBasePath, 'commands.sh');
        await removeStartupCommands(commandsPath, paths.microservice.slug, req);

        // Remove main app directories
        await removeMainAppDirectories(
          mainAppBasePath,
          paths.microservice.slug,
          req
        );

        // 2. Clean up entity-core package
        // Remove entity-core microservice directory (configs, forms, etc.)
        await removeEntityCoreDirectory(paths, req);

        // Remove route definition and unregister from routes/index.ts
        await removeEntityCoreRoutes(paths, paths.microservice.slug, req);

        // Remove validation schema registration
        await removeEntityCoreValidationSchemas(
          paths,
          paths.microservice.slug,
          req
        );
      }

      logOperationSuccess('cleanupMicroservice', req, {
        microserviceName,
      });
    } catch (error) {
      logOperationError('cleanupMicroservice', req, error);
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Error during microservice cleanup',
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'microservice_cleanup',
          details: { microserviceName, error: error.message },
        }
      );
    }
  },
  'microservice_cleanup'
);

module.exports = {
  cleanupGeneratedRepositories,
  removePackageJsonExports,
  removeDockerEnvironmentVariables,
  removeNextConfigRewrites,
  removeStartupCommands,
  removeMainAppDirectories,
  removeEntityCoreDirectory,
  removeEntityCoreRoutes,
  removeEntityCoreValidationSchemas,
  cleanupMicroservice,
};
