/**
 * CREATED BY: Hamza Lachi
 * CREATOR EMAIL: hamza@pullstream.com
 * CREATION DATE: 09/3/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file is responsible for constructing and exporting paths related to the compute microservices, including their REST API, frontend, and DevOps components. It utilizes configuration constants and utility functions to generate structured paths.
 *
 *
 * REVISION 1:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 15/03/2024
 * REVISION REASON: Added comments for clarity and documentation. Ensured consistent code formatting and structure for improved maintainability.
 */

const path = require('path');
const {
  COMPUTE_PATH,
  CONSTRUCTORS_PATH,
  MAIN_APP_REPO_NAME,
} = require('#configs/constants.js');
const { convertToSlug } = require('#utils/shared/stringUtils.js');

/**
 * Generates structured paths for a given microservice and its components (REST API, frontend, DevOps).
 * @param {Object} options - Options object containing the microservice name.
 * @param {string} options.microserviceName - Name of the microservice.
 * @returns {Object} An object containing path information for the microservice and its components.
 */
function getComputeMicroservicePaths({ microserviceName } = {}) {
  const MICROSERVICE_SLUG = convertToSlug(microserviceName);
  const COMPUTE_MICROSERVICE_PATH = path.join(COMPUTE_PATH, MICROSERVICE_SLUG);

  // REST API paths
  const REST_API_REPO_NAME = `${MICROSERVICE_SLUG}-rapi`;
  const REST_API_REPO_SLUG = convertToSlug(REST_API_REPO_NAME);
  const COMPUTE_REST_API_PATH = path.join(
    COMPUTE_MICROSERVICE_PATH,
    REST_API_REPO_SLUG
  );
  const REST_API_CONSTRUCTOR_PATH = path.join(CONSTRUCTORS_PATH, 'api');

  // Main App paths
  const MAIN_APP_REPO_SLUG = convertToSlug(MAIN_APP_REPO_NAME);
  const COMPUTE_MAIN_APP_PATH = path.join(
    COMPUTE_MICROSERVICE_PATH,
    `${MAIN_APP_REPO_SLUG}-${MICROSERVICE_SLUG}`
  );

  // Frontend paths
  const FRONTEND_REPO_NAME = `${MICROSERVICE_SLUG}-fe`;
  const FRONTEND_REPO_SLUG = convertToSlug(FRONTEND_REPO_NAME);
  const COMPUTE_FRONTEND_PATH = path.join(
    COMPUTE_MICROSERVICE_PATH,
    FRONTEND_REPO_SLUG
  );
  const FRONTEND_CONSTRUCTOR_PATH = path.join(CONSTRUCTORS_PATH, 'frontend');

  // DevOps paths
  const DEVOPS_REPO_NAME = `${MICROSERVICE_SLUG}-k8s`;
  const DEVOPS_REPO_SLUG = convertToSlug(DEVOPS_REPO_NAME);
  const COMPUTE_DEVOPS_PATH = path.join(
    COMPUTE_MICROSERVICE_PATH,
    DEVOPS_REPO_SLUG
  );
  const DEVOPS_CONSTRUCTOR_PATH = path.join(CONSTRUCTORS_PATH, 'devops');

  // Entity-core package path (inside main app)
  const ENTITY_CORE_PATH = path.join(
    COMPUTE_MAIN_APP_PATH,
    'packages',
    'entity-core',
    'src'
  );

  return {
    microservice: {
      name: microserviceName,
      slug: MICROSERVICE_SLUG,
      path: COMPUTE_MICROSERVICE_PATH,
      constructorPath: null, // No constructor path for the microservice itself
    },
    restAPI: {
      name: REST_API_REPO_NAME,
      slug: REST_API_REPO_SLUG,
      path: COMPUTE_REST_API_PATH,
      constructorPath: REST_API_CONSTRUCTOR_PATH,
    },
    mainApp: {
      name: MAIN_APP_REPO_NAME,
      slug: MAIN_APP_REPO_SLUG,
      path: COMPUTE_MAIN_APP_PATH,
      constructorPath: null,
    },
    frontend: {
      name: FRONTEND_REPO_NAME,
      slug: FRONTEND_REPO_SLUG,
      path: COMPUTE_FRONTEND_PATH,
      constructorPath: FRONTEND_CONSTRUCTOR_PATH,
    },
    devOps: {
      name: DEVOPS_REPO_NAME,
      slug: DEVOPS_REPO_SLUG,
      path: COMPUTE_DEVOPS_PATH,
      constructorPath: DEVOPS_CONSTRUCTOR_PATH,
    },
    entityCore: {
      path: ENTITY_CORE_PATH,
      microservicePath: path.join(ENTITY_CORE_PATH, MICROSERVICE_SLUG),
      routesPath: path.join(ENTITY_CORE_PATH, 'routes'),
    },
  };
}

module.exports = getComputeMicroservicePaths;
