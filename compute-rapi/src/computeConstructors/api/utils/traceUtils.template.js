/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * TraceId Utility Functions
 *
 * This module provides standardized utilities for working with traceId
 * across the application for consistent request tracking and correlation.
 *
 *
 */
const validator = require('validator');
const { logEvent } = require('#utils/basicLoggingUtils.js');
const { createStandardError } = require('#utils/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');

const HEALTH_PREFIX = '/api/v1/health';
/**
 * Extract traceId from request with fallback handling
 * @param {Object} req - Express request object
 * @returns {string} - TraceId or fallback value
 */
function getTraceId(req) {
  return req?.traceId || 'unknown-trace-id';
}

/**
 * Log an event with automatic traceId extraction from request
 * @param {string} message - Log message
 * @param {Object} req - Express request object
 * @param {Object} additionalData - Optional additional data to log
 */
function logWithTrace(message, req, additionalData = null) {
  if ((req?.originalUrl || req?.url || '').startsWith(HEALTH_PREFIX)) return;
  const traceId = getTraceId(req);
  const fullMessage = additionalData
    ? `${message} | Data: ${JSON.stringify(additionalData)}`
    : message;

  logEvent(fullMessage, traceId);
}

/**
 * Log the start of a controller operation
 * @param {string} operation - Name of the operation (e.g., 'createMicroservice')
 * @param {Object} req - Express request object
 * @param {Object} additionalData - Optional additional data to log
 */
function logOperationStart(operation, req, additionalData = null) {
  if ((req?.originalUrl || req?.url || '').startsWith(HEALTH_PREFIX)) return;
  const traceId = getTraceId(req);
  const message = `[OPERATION_START] ${operation}`;
  const fullMessage = additionalData
    ? `${message} | Data: ${JSON.stringify(additionalData)}`
    : message;

  logEvent(fullMessage, traceId);
}

/**
 * Log the completion of a controller operation
 * @param {string} operation - Name of the operation
 * @param {Object} req - Express request object
 * @param {Object} result - Operation result data
 */
function logOperationSuccess(operation, req, result = null) {
  if ((req?.originalUrl || req?.url || '').startsWith(HEALTH_PREFIX)) return;
  const traceId = getTraceId(req);
  const message = `[OPERATION_SUCCESS] ${operation}`;
  const fullMessage = result
    ? `${message} | Result: ${JSON.stringify(result)}`
    : message;

  logEvent(fullMessage, traceId);
}

/**
 * Log a failed controller operation
 * @param {string} operation - Name of the operation
 * @param {Object} req - Express request object
 * @param {Error} error - Error that occurred
 */
function logOperationError(operation, req, error) {
  if ((req?.originalUrl || req?.url || '').startsWith(HEALTH_PREFIX)) return;
  const traceId = getTraceId(req);
  const message = `[OPERATION_ERROR] ${operation} failed: ${error.message}`;

  logEvent(message, traceId);
}

/**
 * Log database operation start
 * @param {string} operation - Database operation (e.g., 'create_microservice')
 * @param {Object} req - Express request object
 * @param {Object} data - Data being processed
 */
function logDatabaseStart(operation, req, data = null) {
  if ((req?.originalUrl || req?.url || '').startsWith(HEALTH_PREFIX)) return;
  const traceId = getTraceId(req);
  const message = `[DB_START] ${operation}`;
  const fullMessage = data
    ? `${message} | Data: ${JSON.stringify(data)}`
    : message;

  logEvent(fullMessage, traceId);
}

/**
 * Log database operation completion
 * @param {string} operation - Database operation
 * @param {Object} req - Express request object
 * @param {Object} result - Database result
 */
function logDatabaseSuccess(operation, req, result = null) {
  if ((req?.originalUrl || req?.url || '').startsWith(HEALTH_PREFIX)) return;
  const traceId = getTraceId(req);
  const message = `[DB_SUCCESS] ${operation}`;
  const fullMessage = result
    ? `${message} | Result: ${JSON.stringify(result)}`
    : message;

  logEvent(fullMessage, traceId);
}

/**
 * Create a standardized error with traceId automatically included
 * @param {string} type - Error type from ERROR_TYPES
 * @param {string} message - Error message
 * @param {Object} req - Express request object
 * @param {Object} options - Additional options for createStandardError
 * @returns {Error} - Standardized error with traceId
 */
function createErrorWithTrace(type, message, req, options = {}) {
  const traceId = getTraceId(req);

  // Ensure traceId is included in details
  const enhancedOptions = {
    ...options,
    details: {
      ...options.details,
      traceId,
    },
  };

  return createStandardError(type, message, enhancedOptions);
}

/**
 * Assert that a value is a valid UUID parameter, throwing a traced error if not
 * @param {*} value - The value to validate as a UUID
 * @param {Object} req - Express request object for tracing
 * @param {string} context - Context for the error (e.g., 'get_model_name_param')
 * @throws {Error} Throws a traced BAD_REQUEST error if value is not a valid UUID
 */
function assertValidUuidParam(value, req, context) {
  const id = value == null ? '' : String(value);
  if (!validator.isUUID(id)) {
    throw createErrorWithTrace(
      ERROR_TYPES.BAD_REQUEST,
      'Invalid id format. Expected a UUID.',
      req,
      {
        severity: ERROR_SEVERITY.LOW,
        context,
      }
    );
  }
}

/**
 * Wrap async controller functions with standardized logging and error handling
 * @param {Function} controllerFn - Controller function to wrap
 * @param {string} operationName - Name of the operation for logging
 * @returns {Function} - Wrapped controller function
 */
function withTraceLogging(controllerFn, operationName) {
  return async (req, res, next) => {
    if ((req?.originalUrl || req?.url || '').startsWith(HEALTH_PREFIX)) {
      return controllerFn(req, res, next);
    }
    try {
      logOperationStart(operationName, req, {
        method: req.method,
        path: req.path,
        params: req.params,
      });

      const result = await controllerFn(req, res, next);

      logOperationSuccess(operationName, req, {
        statusCode: res.statusCode,
      });

      return result;
    } catch (error) {
      logOperationError(operationName, req, error);

      // Re-throw to let error middleware handle it
      throw error;
    }
  };
}

module.exports = {
  getTraceId,
  logWithTrace,
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
  withTraceLogging,
  assertValidUuidParam,
};
