/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * Standardized Error Handling Utilities
 *
 * This module provides consistent error handling patterns across the application.
 *
 *
 */
/**
 * Standardized Error Handling Utilities
 *
 * This module provides consistent error handling patterns across the application.
 */

const { logEvent } = require('./basicLoggingUtils.js');
const { createError } = require('./generalUtils.js');
const {
  ERROR_TYPES,
  ERROR_SEVERITY,
  ERROR_MESSAGES,
  STATUS_CODES,
} = require('#configs/constants.js');

/**
 * Creates a standardized error object
 * @param {string} type - Error type from ERROR_TYPES
 * @param {string} message - Custom error message (optional)
 * @param {Object} options - Additional options
 * @param {string} options.severity - Error severity level
 * @param {Object} options.details - Additional error details
 * @param {Error} options.originalError - Original error object
 * @param {string} options.context - Context where error occurred
 * @returns {Error} Standardized error object
 */
function createStandardError(type, message, options = {}) {
  const {
    severity = ERROR_SEVERITY.MEDIUM,
    details = {},
    originalError = null,
    context = 'unknown',
  } = options;

  const errorMessage = message || ERROR_MESSAGES[type] || 'Unknown error';
  const statusCode = STATUS_CODES[type] || 500;

  const error = createError({
    status: statusCode,
    message: errorMessage,
  });

  // Add additional properties
  error.type = type;
  error.severity = severity;
  error.details = details;
  error.context = context;
  error.timestamp = new Date().toISOString();

  // Log the error with appropriate level and traceId if available
  const logLevel =
    severity === ERROR_SEVERITY.CRITICAL || severity === ERROR_SEVERITY.HIGH
      ? 'error'
      : 'warn';
  const logMessage = `[${logLevel.toUpperCase()}] ${type}: ${errorMessage} in ${context}`;

  // Extract traceId from details if present (for logging context)
  const traceId = details.traceId || null;

  if (originalError) {
    error.originalError = originalError.message;
    logEvent(`${logMessage} | Original: ${originalError.message}`, traceId);
  } else {
    logEvent(logMessage, traceId);
  }

  return error;
}

/**
 * Wraps async functions with standardized error handling
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context for error logging
 * @returns {Function} Wrapped function
 */
function withErrorHandling(fn, context = 'async_operation') {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      // Re-throw if it's already a standardized error
      if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
        throw error;
      }

      // Convert to standardized error
      throw createStandardError(ERROR_TYPES.INTERNAL, 'Operation failed', {
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
        context,
      });
    }
  };
}

/**
 * Express-specific wrapper that combines withErrorHandling with Express next() pattern
 * This replaces the legacy wrapAsync middleware
 * @param {Function} handler - Express route handler (req, res, next) => {}
 * @param {string} context - Context for error logging
 * @returns {Function} Express route handler with standardized error handling
 */
function wrapExpressAsync(handler, context = 'express_route') {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      // Re-throw if it's already a standardized error - Express errorHandler will handle it
      if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
        return next(error);
      }

      // Convert to standardized error
      const standardizedError = createStandardError(
        ERROR_TYPES.INTERNAL,
        'Route handler failed',
        {
          severity: ERROR_SEVERITY.HIGH,
          originalError: error,
          context,
          details: {
            method: req.method,
            path: req.path,
            url: req.url,
            traceId: req.traceId,
          },
        }
      );
      next(standardizedError);
    }
  };
}

/**
 * Handles database errors and converts them to standardized errors
 * @param {Error} error - Database error
 * @param {string} operation - Database operation that failed
 * @returns {Error} Standardized error
 */
function handleDatabaseError(error, operation = 'database_operation') {
  const errorMessage = error.message ? error.message.toLowerCase() : '';

  // Define error patterns with their corresponding error configurations
  const errorPatterns = [
    {
      codes: ['UNIQUE_CONSTRAINT_FAILED'],
      messagePatterns: ['unique constraint', 'duplicate'],
      config: {
        type: ERROR_TYPES.CONFLICT,
        message:
          'Resource already exists: The data you are trying to add or update would create a duplicate. Please use unique values.',
        severity: ERROR_SEVERITY.LOW,
      },
    },
    {
      codes: ['FOREIGN_KEY_CONSTRAINT_FAILED'],
      messagePatterns: ['foreign key', 'reference'],
      config: {
        type: ERROR_TYPES.BAD_REQUEST,
        message:
          'Invalid reference: The related resource you specified does not exist or is not valid. Please check your input.',
        severity: ERROR_SEVERITY.MEDIUM,
      },
    },
    {
      codes: [],
      messagePatterns: ['not found', 'does not exist'],
      config: {
        type: ERROR_TYPES.NOT_FOUND,
        message:
          'Resource not found: The item you are trying to access does not exist in the database.',
        severity: ERROR_SEVERITY.LOW,
      },
    },
    {
      codes: ['DATABASE_OPERATION_FAILED', 'UNEXPECTED_ERROR'],
      messagePatterns: [],
      config: {
        type: ERROR_TYPES.INTERNAL,
        message:
          'Database operation failed: An unexpected error occurred while processing your request. Please try again or contact support.',
        severity: ERROR_SEVERITY.HIGH,
      },
    },
  ];

  // Check for matching error pattern
  for (const pattern of errorPatterns) {
    const codeMatch = error.code && pattern.codes.includes(error.code);
    const messageMatch = pattern.messagePatterns.some((msg) =>
      errorMessage.includes(msg)
    );

    if (codeMatch || messageMatch) {
      return createStandardError(pattern.config.type, pattern.config.message, {
        severity: pattern.config.severity,
        originalError: error,
        context: operation,
        details: { databaseOperation: operation },
      });
    }
  }

  // Default to internal error for unknown database errors
  return createStandardError(
    ERROR_TYPES.INTERNAL,
    'Database operation failed',
    {
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
      context: operation,
      details: { databaseOperation: operation },
    }
  );
}

/**
 * Handles validation errors from Joi
 * @param {Object} joiError - Joi validation error
 * @param {string} context - Context where validation failed
 * @returns {Error} Standardized error
 */
function handleValidationError(joiError, context = 'validation') {
  const details = joiError.details || [];

  // Format validation errors with field and message structure
  const validationErrors = details.map((detail) => ({
    field: detail.context?.key || detail.path?.join('.') || 'unknown',
    message: detail.message,
    value: detail.context?.value,
  }));

  const error = createStandardError(
    ERROR_TYPES.VALIDATION,
    'Input validation failed',
    {
      severity: ERROR_SEVERITY.LOW,
      details: {},
      context,
    }
  );

  // Add the validationErrors directly to the error object for the error handler
  error.validationErrors = validationErrors;

  return error;
}

module.exports = {
  createStandardError,
  withErrorHandling,
  wrapExpressAsync,
  handleDatabaseError,
  handleValidationError,
};
