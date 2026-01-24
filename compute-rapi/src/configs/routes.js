/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file exports utility functions for generating URLs related to microservices.
 * Each function accepts an optional query parameter and constructs a URL using
 * environment variables from the .env file.
 *
 * Note: These utility functions rely on environment variables such as ACCOUNTS_HOST, LOGS_HOST,
 *       and DRIVE_HOST defined in the .env file to generate the appropriate URLs.
 *
 *
 * REVISION 1:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 20/02/2024
 * REVISION REASON: Add Standard File Header Comments
 *
 *
 * REVISION 2:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 21/02/2024
 * REVISION REASON: Convert ESM to CJS
 */

const dotenv = require('dotenv');
const {
  ACCOUNTS_HOST,
  LOGS_HOST,
  DRIVE_HOST,
  GIT_HOST,
  SYSTEM_HOST,
} = require('#configs/constants.js');

dotenv.config();

/**
 *
 * Gitlab
 */

// Constructs a URL for accessing groups from gitlab using API endpoints.
function getGroupsURL({ query = '' } = {}) {
  return `${GIT_HOST}/api/v4/groups/${query}`;
}

// Constructs a URL for accessing repos/projects from gitlab using API endpoints.
function getProjectsURL({ query = '' } = {}) {
  return `${GIT_HOST}/api/v4/projects/${query}`;
}

/**
 *
 * Accounts
 */

// Constructs a URL for accessing microservices API endpoints.
function getMicroservicesURL({ query = '' } = {}) {
  return `${ACCOUNTS_HOST}/api/accounts/microservices/${query}`;
}

// Constructs a URL for registering microservices and models.
function getRegisterModelsURL({ query = '' } = {}) {
  return `${ACCOUNTS_HOST}/api/accounts/register-microservice-and-models/${query}`;
}

/**
 *
 * Logs
 */

// Constructs a URL for accessing logs API endpoints.
function getLogsURL({ query = '' } = {}) {
  return `${LOGS_HOST}/api/${query}`;
}

/**
 *
 * Drive
 */

// Constructs a URL for accessing files API endpoints.
const getFilesURL = ({ query = '' } = {}) => {
  return `${DRIVE_HOST}/api/v1/files/${query}`;
};

/**
 *
 * System
 */
const getSystemMenusURL = ({ query = '' } = {}) => {
  return `${SYSTEM_HOST}/api/menus/${query}`;
};

const getSystemMenusByMicroserviceURL = ({ query = '' } = {}) => {
  return `${SYSTEM_HOST}/api/get-all-ordered-menus-from-parent/${query}`;
};

const getInternalBulkCreateSubmenusURL = ({ query = '' } = {}) => {
  return `${SYSTEM_HOST}/api/internal/bulk-create-submenus/${query}`;
};

const getInternalMenusPublishURL = ({ query = '' } = {}) => {
  return `${SYSTEM_HOST}/api/internal/menus/publish/${query}`;
};

module.exports = {
  getGroupsURL,
  getProjectsURL,
  getMicroservicesURL,
  getRegisterModelsURL,
  getLogsURL,
  getFilesURL,
  getSystemMenusURL,
  getSystemMenusByMicroserviceURL,
  getInternalBulkCreateSubmenusURL,
  getInternalMenusPublishURL,
};
