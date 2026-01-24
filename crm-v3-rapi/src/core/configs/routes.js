/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
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

const { ACCOUNTS_HOST, LOGS_HOST, DRIVE_HOST, SYSTEM_HOST, BPA_HOST, SYSTEM_V2_HOST } = process.env;


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

/**
 * System V2 Registry
 */
const getSystemV2RegistryURL = ({ query = '' } = {}) => {
  return `${SYSTEM_V2_HOST}/api/v1/registry/register${query}`;
};

module.exports = {
  getMicroserviceRegisterURL,
  getLogsURL,
  getFilesURL,
  getSystemMenusURL,
  getSystemCreateMenuURL,
  getBulkCreateSystemMenusURL,
  getAutomataTriggerURL,
  getAutomataConnectionWithAModelURL,
  getSystemV2RegistryURL
};
