const path = require('path');
const { mkdir } = require('fs').promises;
const {
  createFileFromTemplate,
  ensureDirExists,
  deleteDirContentsIfExists,
  copyFile,
} = require('#utils/shared/fileUtils.js');
const { DEVOPS_ENV, DEVOPS_DEFAULT_TYPES } = require('#configs/constants.js');
const { logStep } = require('#utils/shared/loggingUtils.js');
const getComputeMicroservicePaths = require('#configs/computePaths.js');
const {
  createStandardError,
  withErrorHandling,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { logWithTrace } = require('#utils/shared/traceUtils.js');

const main = withErrorHandling(
  async ({
    microserviceName,
    feRepoPath,
    rapiRepoPath,
    nginxRepoPath,
    user,
    instanceId,
    traceId = null,
  } = {}) => {
    try {
      // DEBUG: Log initial function arguments
      logWithTrace('[DEBUG] generateDevOps started with arguments', { traceId }, { microserviceName, feRepoPath, rapiRepoPath, nginxRepoPath, user, instanceId });

      const { microservice, devOps } = getComputeMicroservicePaths({
        microserviceName,
      });

      // DEBUG: Log the resolved paths from getComputeMicroservicePaths
      logWithTrace('[DEBUG] Resolved compute microservice paths', { traceId }, { microservice, devOps });

      // Early exit with a more specific error if critical paths are undefined
      if (!devOps?.path || !devOps?.constructorPath) {
        throw new Error(`Critical path is undefined. devOps.path: ${devOps?.path}, devOps.constructorPath: ${devOps?.constructorPath}`);
      }

      const commonLogParams = {
        user,
        instanceId,
      };
      const COMPUTE_DIRS = {
        // nginx: {
        //   path: {
        //     constructor: path.join(devOps?.constructorPath, 'nginx'),
        //     compute: path.join(devOps?.path, 'nginx'),
        //   },
        // },
        k8s: {
          path: path.join(devOps?.constructorPath, 'k8s'),
          dev: {
            constructor: path.join(devOps?.constructorPath, 'k8s', 'dev'),
            compute: path.join(devOps?.path, 'k8s', 'dev'),
          },
          // staging: {
          //   constructor: path.join(devOps?.constructorPath, 'k8s', 'staging'),
          //   compute: path.join(devOps?.path, 'k8s', 'staging'),
          // },
          prod: {
            constructor: path.join(devOps?.constructorPath, 'k8s', 'prod'),
            compute: path.join(devOps?.path, 'k8s', 'prod'),
          },
        },
      };

      // DEBUG: Log the constructed directory paths
      logWithTrace('[DEBUG] COMPUTE_DIRS structure initialized', { traceId }, COMPUTE_DIRS);

      await logStep({ ...commonLogParams, stepCode: 'EEK6-TQB' }, async () => {
        // Deleting output dir
        logWithTrace('[DEBUG] Attempting to ensure directory exists', { traceId }, { path: devOps?.path });
        await ensureDirExists(devOps?.path);
        logWithTrace('[DEBUG] Attempting to delete directory contents', { traceId }, { path: devOps?.path });
        await deleteDirContentsIfExists(devOps?.path);

        // Creating README.md
        const readmeTemplatePath = path.join(devOps?.constructorPath, 'README.template.md');
        const readmeOutputPath = path.join(devOps?.path, 'README.md');
        logWithTrace('[DEBUG] Attempting to copy README.md', { traceId }, { from: readmeTemplatePath, to: readmeOutputPath });
        await copyFile(
          readmeTemplatePath,
          readmeOutputPath,
          { '{{MS_NAME}}': microservice?.name }
        );

        // Creating deploy.sh
        const deployTemplatePath = path.join(devOps?.constructorPath, 'deploy.template.sh');
        const deployOutputPath = path.join(devOps?.path, 'deploy.sh');
        logWithTrace('[DEBUG] Attempting to copy deploy.sh', { traceId }, { from: deployTemplatePath, to: deployOutputPath });
        await copyFile(
          deployTemplatePath,
          deployOutputPath,
          { '{{MICROSERVICE_SLUG}}': microservice?.slug }
        );

        // Creating .gitlab-ci.yml
        const gitlabCiTemplatePath = path.join(devOps?.constructorPath, '.gitlab-ci.template.yml');
        const gitlabCiOutputPath = path.join(devOps?.path, '.gitlab-ci.yml');
        logWithTrace('[DEBUG] Attempting to copy .gitlab-ci.yml', { traceId }, { from: gitlabCiTemplatePath, to: gitlabCiOutputPath });
        await copyFile(
          gitlabCiTemplatePath,
          gitlabCiOutputPath,
          { '{{MICROSERVICE_SLUG}}': microservice?.slug }
        );
      });

      await logStep({ ...commonLogParams, stepCode: 'V102-PSF' }, async () => {
        // This step is commented out, but we can log that we are skipping it.
        logWithTrace('[DEBUG] Skipping step V102-PSF (Nginx setup)', { traceId });
      });

      await logStep({ ...commonLogParams, stepCode: 'LV6M-B7Y' }, async () => {
        // Creating k8s dirs
        const k8sBasePath = path.join(devOps?.path, 'k8s');
        logWithTrace('[DEBUG] Attempting to create k8s base directory', { traceId }, { path: k8sBasePath });
        await mkdir(k8sBasePath, { recursive: true });

        // Creating k8s sub dirs
        await Promise.all(
          Object.entries(COMPUTE_DIRS?.k8s).map(async ([key, dirPaths]) => {
            if (!dirPaths?.compute) return;
            logWithTrace('[DEBUG] Attempting to create k8s sub-directory', { traceId }, { key, path: dirPaths.compute });
            await mkdir(dirPaths?.compute, { recursive: true });
          })
        );
      });

      await logStep({ ...commonLogParams, stepCode: '6QOI-4I2' }, async () => {
        // NOTE: The duplicate directory creation was removed to avoid redundancy.

        // Creating k8s yaml files
        await Promise.all(
          DEVOPS_DEFAULT_TYPES.map(async (branch) => {
            logWithTrace(`[DEBUG] Starting k8s file generation for branch: ${branch}`, { traceId });

            // Creating env file
            logWithTrace(`[DEBUG] k8s [${branch}] 00-env.yaml paths`, { traceId }, { constructor: COMPUTE_DIRS?.k8s[branch]?.constructor, compute: COMPUTE_DIRS?.k8s[branch]?.compute });
            await createFileFromTemplate({
              destinationPathSegments: [
                COMPUTE_DIRS?.k8s[branch]?.compute,
                '00-env.yaml',
              ],
              templatePathSegments: [
                COMPUTE_DIRS?.k8s[branch]?.constructor,
                '00-env.template.yaml',
              ],
              templateReplacements: {
                '{{MICROSERVICE_SLUG}}': microservice?.slug,
                '{{MICROSERVICE_POSTGRES_USER}}':
                  DEVOPS_ENV?.MICROSERVICE_POSTGRES_USER,
                '{{MICROSERVICE_POSTGRES_PASSWORD}}':
                  DEVOPS_ENV?.MICROSERVICE_POSTGRES_PASSWORD,
                '{{MICROSERVICE_POSTGRES_DB}}':
                  DEVOPS_ENV?.MICROSERVICE_POSTGRES_DB(microservice?.slug),
                '{{MICROSERVICE_POSTGRES_DATABASE_URL}}':
                  DEVOPS_ENV?.MICROSERVICE_POSTGRES_DATABASE_URL(
                    microservice?.slug
                  ),
                '{{MICROSERVICE_PGBOUNCER_DATABASE_URL}}':
                  DEVOPS_ENV?.MICROSERVICE_PGBOUNCER_DATABASE_URL(
                    microservice?.slug
                  ),
              },
            });

            // Creating db file
            logWithTrace(`[DEBUG] k8s [${branch}] 01-db.yaml paths`, { traceId }, { constructor: COMPUTE_DIRS?.k8s[branch]?.constructor, compute: COMPUTE_DIRS?.k8s[branch]?.compute });
            await createFileFromTemplate({
              destinationPathSegments: [
                COMPUTE_DIRS?.k8s[branch]?.compute,
                '01-db.yaml',
              ],
              templatePathSegments: [
                COMPUTE_DIRS?.k8s[branch]?.constructor,
                '01-db.template.yaml',
              ],
              templateReplacements: {
                '{{MICROSERVICE_SLUG}}': microservice?.slug,
              },
            });

            // Creating pgbouncer file
            logWithTrace(`[DEBUG] k8s [${branch}] 02-pgbouncer.yaml paths`, { traceId }, { constructor: COMPUTE_DIRS?.k8s[branch]?.constructor, compute: COMPUTE_DIRS?.k8s[branch]?.compute });
            await createFileFromTemplate({
              destinationPathSegments: [
                COMPUTE_DIRS?.k8s[branch]?.compute,
                '02-pgbouncer.yaml',
              ],
              templatePathSegments: [
                COMPUTE_DIRS?.k8s[branch]?.constructor,
                '02-pgbouncer.template.yaml',
              ],
              templateReplacements: {
                '{{MICROSERVICE_SLUG}}': microservice?.slug,
              },
            });

            // Creating redis file
            logWithTrace(`[DEBUG] k8s [${branch}] 03-redis.yaml paths`, { traceId }, { constructor: COMPUTE_DIRS?.k8s[branch]?.constructor, compute: COMPUTE_DIRS?.k8s[branch]?.compute });
            await createFileFromTemplate({
              destinationPathSegments: [
                COMPUTE_DIRS?.k8s[branch]?.compute,
                '03-redis.yaml',
              ],
              templatePathSegments: [
                COMPUTE_DIRS?.k8s[branch]?.constructor,
                '03-redis.template.yaml',
              ],
              templateReplacements: {
                '{{MICROSERVICE_SLUG}}': microservice?.slug,
              },
            });

            // Creating rapi file
            logWithTrace(`[DEBUG] k8s [${branch}] 04-rapi.yaml paths`, { traceId }, { constructor: COMPUTE_DIRS?.k8s[branch]?.constructor, compute: COMPUTE_DIRS?.k8s[branch]?.compute });
            await createFileFromTemplate({
              destinationPathSegments: [
                COMPUTE_DIRS?.k8s[branch]?.compute,
                '04-rapi.yaml',
              ],
              templatePathSegments: [
                COMPUTE_DIRS?.k8s[branch]?.constructor,
                '04-rapi.template.yaml',
              ],
              templateReplacements: {
                '{{MICROSERVICE_SLUG}}': microservice?.slug,
                '{{RAPI_REPO_PATH}}': rapiRepoPath,
              },
            });

            // Creating migration file
            logWithTrace(`[DEBUG] k8s [${branch}] jobs/00-migration.yaml paths`, { traceId }, { constructor: COMPUTE_DIRS?.k8s[branch]?.constructor, compute: COMPUTE_DIRS?.k8s[branch]?.compute });
            await createFileFromTemplate({
              destinationPathSegments: [
                COMPUTE_DIRS?.k8s[branch]?.compute,
                'jobs',
                '00-migration.yaml',
              ],
              templatePathSegments: [
                COMPUTE_DIRS?.k8s[branch]?.constructor,
                'jobs',
                '00-migration.template.yaml',
              ],
              templateReplacements: {
                '{{MICROSERVICE_SLUG}}': microservice?.slug,
                '{{RAPI_REPO_PATH}}': rapiRepoPath,
              },
            });
          })
        );
      });
    } catch (error) {
      logWithTrace(
        '[ERROR] Failed to generate DevOps files',
        { traceId },
        // DEBUG: Added error.stack for more detailed error context
        { error: error?.message, stack: error?.stack }
      );
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to generate DevOps files',
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'generate_devops',
          details: { traceId, error: error?.message },
          originalError: error,
        }
      );
    }
  },
  'generate_devops'
);

module.exports = main;
