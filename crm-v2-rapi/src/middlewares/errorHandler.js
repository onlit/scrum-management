/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This errorHandler middleware function is responsible for handling errors that occur
 * during the processing of HTTP requests. It catches errors thrown by previous middleware
 * functions or route handlers and sends an appropriate error response to the client.
 *
 * It first checks if the error is related to validation using Joi. If so, it extracts
 * the error details and sends a 422 Unprocessable Entity response with the validation
 * error messages.
 *
 * If the error message contains 'prisma' and the application is not running in a
 * development environment, it replaces the error message with a generic message to
 * avoid exposing sensitive information.
 *
 * The function logs the error details and sends an error response to the client with
 * the appropriate status code, error message, and optionally the stack trace (only in
 * development mode).
 *
 * Note: This middleware should be added as the last error-handling middleware in the
 *       middleware chain to ensure that it catches all errors that occur during request
 *       processing.
 *
 *
 * REVISION 1:
 * REVISED BY: AI Assistant
 * REVISION DATE: 2025-01-27
 * REVISION REASON: Implement standardized error handling and trace ID conventions
 */

const { DEV_ENV_NAME } = require('#configs/constants.js');
const { logEvent } = require('#utils/shared/loggingUtils.js');
const { getDefaultTitleForStatus } = require('#utils/shared/generalUtils.js');
const {
  handleValidationError,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, STATUS_CODES } = require('#configs/constants.js');

// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  const onDevEnv = process.env.NODE_ENV === DEV_ENV_NAME;

  // Get or generate a trace ID
  const traceId = req.traceId || 'unknown-trace-id';

  // Handle standardized errors first
  if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
    // This is a standardized error - use its properties directly
    const detail = error.message || 'Something went wrong';
    const status = STATUS_CODES[error.type] || error.statusCode || 500;
    const title = error.title || getDefaultTitleForStatus(status);
    const code = error.type || ERROR_TYPES.INTERNAL;
    // Prefer explicit validationErrors on the error object, then fall back to details.validationErrors
    const validationErrorsFromError = error.validationErrors;
    const validationErrorsFromDetails = error.details?.validationErrors;
    const validationErrors =
      validationErrorsFromError || validationErrorsFromDetails;

    // Log with standardized format (already handled in createStandardError)
    // Just send the response
    const errorResponse = {
      traceId,
      status,
      title,
      code,
      detail,
      ...(error.severity && { severity: error.severity }),
      ...(error.context && { context: error.context }),
      ...(error.details && { details: error.details }),
    };

    // Add validation errors array for 422 responses
    if (status === 422 && validationErrors) {
      errorResponse.errors = validationErrors;
    }

    // Only include stack trace in development mode
    if (onDevEnv) {
      errorResponse._debug = {
        stack: error.stack,
        timestamp: error.timestamp,
      };
    }

    return res.status(status).json(errorResponse);
  }

  // Legacy error handling for non-standardized errors
  let detail = error.message || 'Something went wrong';
  let status = error.statusCode || 500;
  let title = error.title || getDefaultTitleForStatus(status);
  let code = error.type || ERROR_TYPES.INTERNAL;
  let { validationErrors } = error;

  // Handle Prisma errors - avoid exposing database details in production
  if (!onDevEnv && detail.includes('prisma')) {
    detail = `Database operation failed ${
      error?.code ? `(code: ${error.code})` : ''
    }`;
  }

  // Handle Joi validation errors using standardized handler
  if (error?.isJoi) {
    const standardizedError = handleValidationError(
      error,
      'request_validation'
    );
    // Extract values from standardized error and continue with normal processing
    status =
      STATUS_CODES[standardizedError.type] ||
      standardizedError.statusCode ||
      422;
    title = 'Validation Failed';
    code = standardizedError.type;
    detail = standardizedError.message;
    validationErrors =
      standardizedError.validationErrors ||
      standardizedError.details?.validationErrors ||
      [];
  }

  // Legacy validation error formatting (fallback)
  if (error?.details && Array.isArray(error.details)) {
    status = 422;
    title = 'Validation Failed';
    code = ERROR_TYPES.VALIDATION;

    // Format validation errors according to the standard
    validationErrors = error.details.map((e) => ({
      field: e.context?.key || 'unknown',
      message: e.message,
      value: e.context?.value,
    }));

    detail = 'One or more fields did not pass validation.';
  }

  // Sanitize error message for logging to prevent log injection
  const sanitizedMessage = error.message
    ? error.message.replace(/[\r\n\t]/g, ' ').trim()
    : 'Unknown error';

  const errorMessage = `[TraceID: ${traceId}] [Error ${status}]: ${sanitizedMessage}`;

  // Log error details
  if (onDevEnv) {
    const stackMessage = error?.stack
      ? error.stack.replace(/[\r\n\t]/g, ' ').trim()
      : 'No stack trace';

    logEvent(`${errorMessage} [Stack]: ${stackMessage}`, traceId);
    logEvent(`[ERROR_DETAILS]: ${errorMessage}`, traceId);
    logEvent(`[STACK_TRACE]: ${stackMessage}`, traceId);
  } else {
    logEvent(errorMessage, traceId);
  }

  if (validationErrors) {
    logEvent(
      `[TraceID: ${traceId}] [VALIDATION_ERRORS]: ${JSON.stringify(
        validationErrors
      )}`,
      traceId
    );
  }

  // Prepare the response according to the standard format
  const errorResponse = {
    traceId,
    status,
    title,
    code,
    detail,
  };

  // Add validation errors array for 422 responses
  if (status === 422 && validationErrors) {
    errorResponse.errors = validationErrors;
  }

  // Only include stack trace in development mode
  if (onDevEnv) {
    errorResponse._debug = {
      stack: error.stack,
    };
  }

  // Send error response to client
  res.status(status).json(errorResponse);
}

module.exports = errorHandler;
