/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
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
 */
const dotenv = require('dotenv');

dotenv.config();

const { ACCOUNTS_HOST, LOGS_HOST, DRIVE_HOST, GIT_HOST, SYSTEM_HOST, BPA_HOST } = process.env;

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

function getMicroserviceRegisterURL({ query = '' } = {}) {
  return `${ACCOUNTS_HOST}/api/v1/microservices/register/${query}`;
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

const getSystemCreateMenuURL = ({ query = '' } = {}) => {
  return `${SYSTEM_HOST}/api/create-menu/${query}`;
};

const getBulkCreateSystemMenusURL = ({ query = '' } = {}) => {
  return `${SYSTEM_HOST}/api/bulk-create-menus/${query}`;
};

/**
 * 
 * Automata
 */
const getAutomataTriggerURL = ({ query = '' } = {}) => {
  return `${BPA_HOST}/api/trigger/${query}`;
};

const getAutomataConnectionWithAModelURL = ({ query = '' } = {}) => {
  return `${SYSTEM_HOST}/api/automata-connection-with-a-models/${query}`;
};


module.exports = {
  getGroupsURL,
  getProjectsURL,
  getMicroserviceRegisterURL,
  getLogsURL,
  getFilesURL,
  getSystemMenusURL,
  getSystemCreateMenuURL,
  getBulkCreateSystemMenusURL,
  getAutomataTriggerURL,
  getAutomataConnectionWithAModelURL,
};
