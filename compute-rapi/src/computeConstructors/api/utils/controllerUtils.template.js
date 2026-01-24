/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * Controller Utilities
 *
 * DRY utilities for Express controllers. Consolidates repeated patterns
 * for validation, error handling, context creation, and interceptor flows.
 *
 *
 */

const { ERROR_TYPES } = require('#configs/constants.js');
const {
  handleValidationError,
  handleDatabaseError,
} = require('./errorHandlingUtils.js');
const { logOperationError } = require('./traceUtils.js');

/**
 * Operations that include recordId in context.
 */
const RECORD_ID_OPERATIONS = ['update', 'delete', 'read'];

/**
 * Validate data against a Joi schema with standardized error handling.
 * Uses abortEarly: false to collect all errors and stripUnknown: true.
 *
 * @param {Object} schema - Joi schema to validate against
 * @param {Object} data - Data to validate
 * @param {Object} req - Express request (for traceId logging)
 * @param {string} operationName - Operation name for error context
 * @returns {Promise<Object>} Validated and stripped data
 * @throws {Error} Standardized validation error with validationErrors array
 */
async function validateWithSchema(schema, data, req, operationName) {
  try {
    return await schema.validateAsync(data, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError(operationName, req, error);
      throw handleValidationError(error, operationName);
    }
    logOperationError(operationName, req, error);
    throw error;
  }
}

/**
 * Check if an interceptor result signals a halt.
 * If halted, sends the response and returns true.
 *
 * @param {Object} result - Interceptor result { data, halt?, response? }
 * @param {Object} res - Express response object
 * @returns {boolean} True if halted (response sent), false otherwise
 */
function checkInterceptorHalt(result, res) {
  if (!result?.halt) {
    return false;
  }
  res.status(result.response?.status || 200).json(result.response?.body);
  return true;
}

/**
 * Unified controller error handler.
 * Integrates with interceptor onError hook and standardizes all errors.
 *
 * @param {Error} error - The caught error
 * @param {Object} options - Handler options
 * @param {Object} options.req - Express request
 * @param {Object} options.res - Express response
 * @param {Object} [options.interceptor] - Model interceptor (optional)
 * @param {Object} [options.context] - Interceptor context (optional)
 * @param {string} options.operationName - Operation name for logging/context
 * @returns {Promise<boolean|never>} True if handled by interceptor, otherwise throws
 */
async function handleControllerError(error, options) {
  const { req, res, interceptor, context, operationName } = options;

  // Let interceptor try to handle the error first
  if (interceptor?.onError) {
    const interceptorContext = context || { req, operation: operationName };
    const errorResult = await interceptor.onError(error, interceptorContext);

    if (errorResult?.data?.handled) {
      res
        .status(errorResult.data.response?.status || 400)
        .json(errorResult.data.response?.body);
      return true;
    }
  }

  // Log the error
  logOperationError(operationName, req, error);

  // Re-throw if already standardized
  if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
    throw error;
  }

  // Convert to standardized database error
  throw handleDatabaseError(error, operationName);
}

/**
 * Create a standardized operation context for interceptors.
 *
 * @param {Object} req - Express request
 * @param {string} model - Model name (PascalCase)
 * @param {string} operation - Operation type (create|read|update|delete|list)
 * @param {Object} [extras] - Additional context properties
 * @returns {Object} Operation context for interceptors
 */
function createOperationContext(req, model, operation, extras = {}) {
  const context = {
    req,
    user: req.user,
    model,
    operation,
    ...extras,
  };

  // Add recordId for operations that target a specific record
  if (RECORD_ID_OPERATIONS.includes(operation) && req.params?.id) {
    context.recordId = req.params.id;
  }

  return context;
}

module.exports = {
  validateWithSchema,
  checkInterceptorHalt,
  handleControllerError,
  createOperationContext,
};
