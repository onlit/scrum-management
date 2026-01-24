const { sshCommand } = require('#scripts/sshOperations.js');
const {
  createStandardError,
  withErrorHandling,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { logWithTrace } = require('#utils/shared/traceUtils.js');

/**
 * Executes an SSH command on the remote server to interact with the ingress update script.
 * @param {Object} options - The options for the SSH command.
 * @param {string} options.environment - The environment (dev, staging, prod).
 * @param {string} options.action - The action to perform (addDomain, cleanUpDomain, applyIngress).
 * @param {string} [options.domain] - The domain name to add/remove.
 * @param {string} [options.serviceName] - The service name (required for addDomain).
 * @returns {Promise<void>} - Resolves when the command is executed successfully.
 */
async function executeSshCommand({ environment, action, domain, serviceName }) {
  // Path to the directory on the remote server where the script and yaml files are.
  const remoteDir = `/mnt/old-synology/ansiblebash-scripts/playbooks/ps-rke2/02-applications/04-pullstream/04-ingress/${environment}/pullstream.com/`;

  const nodeIngressFile = 'node.yaml';
  const nodeCertFile = 'pullstream-node-certificate.yaml';

  const commandMap = {
    addDomain: `sudo su -c 'cd ${remoteDir} && ./update_ingress.sh add node ${domain} ${serviceName}'`,
    cleanUpDomain: `sudo su -c 'cd ${remoteDir} && ./update_ingress.sh cleanup node ${domain}'`,
    // Apply both files that the script modifies.
    applyIngress: `sudo su -c 'kubectl apply -f ${remoteDir}${nodeIngressFile} && kubectl apply -f ${remoteDir}${nodeCertFile}'`,
  };

  const command = commandMap[action];
  if (!command) {
    throw new Error(`Invalid action provided to executeSshCommand: ${action}`);
  }

  // Assuming sshCommand is a function that executes the command on the remote server.
  return sshCommand({
    host: process.env.GIT_ENV_SERVER_IP,
    port: process.env.GIT_ENV_SERVER_PORT,
    user: process.env.GIT_ENV_SERVER_USER,
    privateKey: process.env.GIT_ENV_PRIVATE_KEY,
    command: command,
  });
}

/**
 * Adds a domain to the Kubernetes ingress configuration for a specific environment.
 * @param {string} environment - The environment (dev, staging, prod).
 * @param {string} microserviceSlug - The unique identifier for the microservice.
 * @returns {Promise<void>} - Resolves when the domain is added successfully.
 */
async function makeChangesToIngress(
  environment,
  microserviceSlug,
  action = 'addDomain'
) {
  const subdomain = environment === 'dev' ? 'sandbox.' : '';
  const stagingSuffix = environment === 'staging' ? '.staging' : '';
  const domain = `${subdomain}${microserviceSlug}${stagingSuffix}.pullstream.com`;

  const serviceName = `${microserviceSlug}-rapi`;

  await executeSshCommand({
    environment,
    action,
    domain,
    serviceName,
  });
}

/**
 * Applies the Kubernetes ingress configuration for a specific environment.
 * @param {string} environment - The environment (dev, staging, prod).
 * @returns {Promise<void>} - Resolves when the ingress configuration is applied successfully.
 */
async function applyIngressConfig(environment) {
  await executeSshCommand({
    environment,
    action: 'applyIngress',
  });
}

/**
 * Sets up Kubernetes ingress for the given microservice across all environments.
 * It modifies ingress files for all environments first, then applies the changes once.
 * @param {Object} options
 * @param {string} options.microserviceSlug - The unique identifier for the microservice.
 * @param {string} [options.action='addDomain'] - The action to perform ('addDomain' or 'cleanUpDomain').
 * @param {string|null} [options.traceId=null] - Optional trace ID for logging.
 * @returns {Promise<void>} - Resolves when all operations are completed successfully.
 */
const setupKubernetesIngress = withErrorHandling(
  async ({ microserviceSlug, action = 'addDomain', traceId = null } = {}) => {
    try {
      logWithTrace(
        'Starting Kubernetes ingress setup',
        { traceId },
        { microserviceSlug, action }
      );

      // 1. Make all file modifications for each environment first.
      logWithTrace(
        'Modifying ingress YAML files...',
        { traceId },
        { microserviceSlug }
      );
      await makeChangesToIngress('dev', microserviceSlug, action);
      await makeChangesToIngress('prod', microserviceSlug, action);
      logWithTrace(
        'Ingress YAML files modified successfully.',
        { traceId },
        { microserviceSlug }
      );

      // 2. Apply the consolidated changes once.
      logWithTrace(
        'Applying ingress configurations...',
        { traceId },
        { microserviceSlug }
      );
      await applyIngressConfig('dev');
      await applyIngressConfig('prod');
      logWithTrace(
        'Ingress configurations applied successfully.',
        { traceId },
        { microserviceSlug }
      );
    } catch (error) {
      logWithTrace(
        'Error setting up Kubernetes ingress',
        { traceId },
        { microserviceSlug, error: error?.message }
      );
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Error setting up Kubernetes ingress',
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'setup_kubernetes_ingress',
          details: { traceId, microserviceSlug, error: error?.message },
          originalError: error,
        }
      );
    }
  },
  'setup_kubernetes_ingress'
);

module.exports = setupKubernetesIngress;
