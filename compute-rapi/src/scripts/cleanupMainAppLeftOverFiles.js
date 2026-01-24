const getComputeMicroservicePaths = require('#configs/computePaths.js');
const { cleanupMicroservice } = require('#utils/api/cleanupUtils.js');
const { MAIN_APP_REPO_PATH } = require('#configs/constants.js');
const {
  removeMicroserviceFromDrawer,
} = require('#utils/frontend/drawerUtils.js');
const {
  createStandardError,
  withErrorHandling,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { logWithTrace } = require('#utils/shared/traceUtils.js');

const cleanupMainAppLeftOverFiles = withErrorHandling(
  async ({ microservice, user, mainAppClonePath, traceId = null } = {}) => {
    try {
      if (!microservice?.name) {
        return;
      }
      const paths = getComputeMicroservicePaths({
        microserviceName: microservice?.name,
      });
      if (user) {
        await removeMicroserviceFromDrawer(microservice, user);
      }
      const basePath = mainAppClonePath || MAIN_APP_REPO_PATH;
      await cleanupMicroservice({
        paths,
        microserviceName: microservice.name,
        mainAppBasePath: basePath,
        traceId,
      });
    } catch (error) {
      logWithTrace(
        '[Error]: Failed to cleanup main app leftover files.',
        { traceId },
        { error: error?.message }
      );
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to cleanup main app leftover files',
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'cleanup_main_app_leftover_files',
          details: { traceId, error: error?.message },
          originalError: error,
        }
      );
    }
  },
  'cleanup_main_app_leftover_files'
);

module.exports = cleanupMainAppLeftOverFiles;
