const getComputeMicroservicePaths = require('#configs/computePaths.js');
const {
  createStandardError,
  withErrorHandling,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { logWithTrace } = require('#utils/shared/traceUtils.js');
const { sshCommand } = require('#scripts/sshOperations.js');
const setupKubernetesIngress = require('#scripts/setupKubernetesIngress.js');

const cleanupK8sLeftOver = withErrorHandling(
  async ({ microserviceName, traceId = null } = {}) => {
    try {
      const { microservice, devOps } = getComputeMicroservicePaths({ microserviceName });

      // --- Stop Kubernetes services ---

      // Stop development environment
      await sshCommand({
        host: process.env.GIT_ENV_SERVER_IP,
        port: process.env.GIT_ENV_SERVER_PORT,
        user: process.env.GIT_ENV_SERVER_USER,
        privateKey: process.env.GIT_ENV_PRIVATE_KEY,
        command: `sudo su -c 'kubectl delete -f /mnt/synology-k8s/config/microservices/${devOps?.slug}/k8s/dev/'`,
      });

      // Stop production environment
      await sshCommand({
        host: process.env.GIT_ENV_SERVER_IP,
        port: process.env.GIT_ENV_SERVER_PORT,
        user: process.env.GIT_ENV_SERVER_USER,
        privateKey: process.env.GIT_ENV_PRIVATE_KEY,
        command: `sudo su -c 'kubectl delete -f /mnt/synology-k8s/config/microservices/${devOps?.slug}/k8s/prod/'`,
      });

      // --- Cleanup Kubernetes repository folders ---

      const safeSlug = (devOps?.slug || '').replace(/[^a-z0-9-]/gi, ''); // Sanitize to safe chars

      if (!/^[a-z0-9-]+$/.test(safeSlug)) {
        throw createStandardError(ERROR_TYPES.BAD_REQUEST, 'Invalid slug for directory removal', {
          severity: ERROR_SEVERITY.LOW,
          context: 'cleanup_app_devops_slug_validation',
          details: { traceId, slug: safeSlug },
        });
      }

      const rmPath = `/mnt/synology-k8s/config/microservices/${safeSlug}`;

      await sshCommand({
        host: process.env.GIT_ENV_SERVER_IP,
        port: process.env.GIT_ENV_SERVER_PORT,
        user: process.env.GIT_ENV_SERVER_USER,
        privateKey: process.env.GIT_ENV_PRIVATE_KEY,
        command: `sudo su -c 'rm -rf ${rmPath}'`,
      });

      // --- Cleanup Kubernetes ingress ---

      await setupKubernetesIngress({
        microserviceSlug: microservice?.slug,
        action: 'cleanUpDomain',
        traceId,
      });

      return { success: true };
    } catch (error) {
      logWithTrace(
        '[Error]: Failed to cleanup k8s leftover files.',
        { traceId },
        { error: error?.message }
      );
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to cleanup k8s leftover files',
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'cleanup_k8s_leftover',
          details: { traceId, error: error?.message },
          originalError: error,
        }
      );
    }
  },
  'cleanup_k8s_leftover'
);

module.exports = cleanupK8sLeftOver;
