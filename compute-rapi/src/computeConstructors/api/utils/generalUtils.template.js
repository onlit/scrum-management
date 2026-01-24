/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file offers a collection of general-purpose utilities, including functions for filtering entities, creating custom error objects, and converting object keys to camelCase. It provides foundational tools that can be used across various parts of an application for common tasks.
 *
 *
 */
const ipRangeCheck = require('ip-range-check');
const { ERROR_TYPES } = require('#configs/constants.js');
const {
  toCamelCase,
  toSnakeCase,
  convertModelNameToSlug,
  resolveModelSlug,
} = require('#utils/stringUtils.js');

// Matches ISO date-only strings like 2025-08-31
const ISO_DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Check if the current environment is a test environment
 * @returns {boolean} True if running in test environment
 */
const isTestEnv = () =>
  process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

function normalizeDateStringsToDate(input) {
  if (input == null) return input;

  if (typeof input === 'string') {
    if (ISO_DATE_ONLY_REGEX.test(input)) {
      return new Date(`${input}T00:00:00.000Z`);
    }
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => normalizeDateStringsToDate(item));
  }

  if (isObject(input)) {
    const result = {};
    for (const key in input) {
      result[key] = normalizeDateStringsToDate(input[key]);
    }
    return result;
  }

  return input;
}

function compareVersions(v1Str, v2Str) {
  const v1Parts = v1Str.split('.').map(Number);
  const v2Parts = v2Str.split('.').map(Number);

  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const p1 = v1Parts[i] || 0;
    const p2 = v2Parts[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

function isRequestInternal(req) {
  const internalNetwork = process.env.INTERNAL_NETWORK;
  const clientIp = req.ip ?? req.connection.remoteAddress;
  // Filter out undefined/null values to prevent ipRangeCheck errors
  const ranges = ['192.168.50.0/24', internalNetwork].filter(Boolean);
  return ipRangeCheck(clientIp, ranges);
}

function filterDeleted(entities) {
  return entities.filter(({ deleted }) => !deleted);
}

/**
 * Creates an error object with the specified status, title, code, and message.
 *
 * INTERNAL USE ONLY: Use createStandardError from errorHandlingUtils.js for all new error handling.
 *
 * @param {Object} error - The error object.
 * @param {number} error.status - The HTTP status code of the error.
 * @param {string} error.message - The error message (detail).
 * @param {string} [error.title] - A short, human-readable summary of the problem type.
 * @param {string} [error.code] - An application-specific, machine-readable error code.
 * @param {Array} [error.validationErrors] - Array of validation error objects.
 *
 * @returns {Error} The error object with the specified properties.
 */
function createError({ status, message, title, code, validationErrors }) {
  const error = new Error(message);
  error.statusCode = status;
  error.title = title || getDefaultTitleForStatus(status);
  error.code = code || getDefaultCodeForStatus(status);
  error.validationErrors = validationErrors;
  return error;
}

/**
 * Gets a default title for an HTTP status code.
 *
 * @param {number} status - The HTTP status code
 * @returns {string} A human-readable title for the status code
 */
function getDefaultTitleForStatus(status) {
  const titles = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Validation Failed',
    500: 'Internal Server Error',
    503: 'Service Unavailable',
  };

  return titles[status] || 'Error';
}

/**
 * Gets a default error code for an HTTP status code.
 *
 * @param {number} status - The HTTP status code
 * @returns {string} A machine-readable error code
 */
function getDefaultCodeForStatus(status) {
  const codes = {
    400: ERROR_TYPES.BAD_REQUEST,
    401: ERROR_TYPES.AUTHENTICATION,
    403: ERROR_TYPES.AUTHORIZATION,
    404: ERROR_TYPES.NOT_FOUND,
    409: ERROR_TYPES.CONFLICT,
    422: ERROR_TYPES.VALIDATION,
    500: ERROR_TYPES.INTERNAL,
    503: ERROR_TYPES.SERVICE_UNAVAILABLE,
  };

  return codes[status] || ERROR_TYPES.INTERNAL;
}

/**
 * Converts all the keys in the given object to camel case.
 * @param {Object} object - The object to convert.
 * @returns {Object} - The object with camel cased keys.
 */
function objectKeysToCamelCase(object) {
  const result = {};
  for (const key in object) {
    result[toCamelCase(key)] = object[key];
  }
  return result;
}

function isObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function convertKeysToSnakeCase(object) {
  if (!isObject(object)) return object;
  const result = {};
  for (const key in object) {
    const value = object[key];
    // Shallow conversion is sufficient for our current use case
    result[toSnakeCase(key)] = value;
  }
  return result;
}

/**
 * Validates if a phone number follows E.164 international format
 *
 * @param {string} value - The phone number to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidE164PhoneNumber(value) {
  if (!value || typeof value !== 'string') return false;

  // E.164 format: +{CountryCode}{PhoneNumber}
  // - Must start with +
  // - Country code: 1-3 digits
  // - Phone number: 7-14 digits
  // - No spaces or hyphens
  const e164Regex = /^\+\d{1,3}\d{7,14}$/;

  return e164Regex.test(value);
}

module.exports = {
  compareVersions,
  isRequestInternal,
  filterDeleted,
  createError,
  getDefaultTitleForStatus,
  getDefaultCodeForStatus,
  objectKeysToCamelCase,
  isObject,
  convertKeysToSnakeCase,
  normalizeDateStringsToDate,
  isValidE164PhoneNumber,
  convertModelNameToSlug,
  resolveModelSlug,
  isTestEnv,
};
