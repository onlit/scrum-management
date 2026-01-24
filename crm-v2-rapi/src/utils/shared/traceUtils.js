/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
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
 * REVISION 1:
 * REVISED BY: AI Assistant
 * REVISION DATE: 2025-01-27
 * REVISION REASON: Implement standardized error handling and trace ID conventions
 */
/**
 * TraceId Utility Functions
 *
 * This module provides standardized utilities for working with traceId
 * across the application for consistent request tracking and correlation.
 */

const { logEvent } = require('#utils/shared/basicLoggingUtils.js');
const { createStandardError } = require('#utils/shared/errorHandlingUtils.js');

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

  // basicLoggingUtils.logEvent supports an optional second param for traceId string only
  logEvent(fullMessage, typeof traceId === 'string' ? traceId : null);
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

  logEvent(fullMessage, typeof traceId === 'string' ? traceId : null);
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

  logEvent(fullMessage, typeof traceId === 'string' ? traceId : null);
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

  logEvent(message, typeof traceId === 'string' ? traceId : null);
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

  logEvent(fullMessage, typeof traceId === 'string' ? traceId : null);
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

  logEvent(fullMessage, typeof traceId === 'string' ? traceId : null);
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
};
