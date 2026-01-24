/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * Comprehensive Error Boundary Middleware
 *
 * Provides enhanced error handling capabilities with:
 * - Async error wrapping
 * - Error categorization
 * - Structured error reporting
 * - Memory leak prevention
 */

const { logEvent } = require('#utils/loggingUtils.js');
const {
  ERROR_TYPES,
  ERROR_SEVERITY,
  ERROR_TITLES,
  STATUS_CODES,
} = require('#configs/constants.js');

/**
 * Categorize error based on error type and message
 */
function categorizeError(error) {
  if (error?.type && Object.values(ERROR_TYPES).includes(error.type)) {
    return error.type;
  }

  const status = error?.status || error?.statusCode;

  if (
    error.isJoi ||
    error.name === 'ValidationError' ||
    error.type === ERROR_TYPES.VALIDATION
  ) {
    return ERROR_TYPES.VALIDATION;
  }

  if (status === 401 || error.message.includes('authentication')) {
    return ERROR_TYPES.AUTHENTICATION;
  }

  if (status === 403 || error.message.includes('authorization')) {
    return ERROR_TYPES.AUTHORIZATION;
  }

  if (error.message.includes('prisma') || error.code?.startsWith('P')) {
    return ERROR_TYPES.INTERNAL;
  }

  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return ERROR_TYPES.SERVICE_UNAVAILABLE;
  }

  if (error.code === 'EMFILE' || error.code === 'ENOMEM') {
    return ERROR_TYPES.INTERNAL;
  }

  if (status === 404 || error.message.includes('not found')) {
    return ERROR_TYPES.NOT_FOUND;
  }

  if (
    status === 409 ||
    error.message.includes('conflict') ||
    error.message.includes('duplicate')
  ) {
    return ERROR_TYPES.CONFLICT;
  }

  if (status === 429 || error.message.includes('rate limit')) {
    return ERROR_TYPES.RATE_LIMIT;
  }

  if (status === 400 || error.message.includes('bad request')) {
    return ERROR_TYPES.BAD_REQUEST;
  }

  return ERROR_TYPES.INTERNAL;
}

/**
 * Determine error severity
 */
function getErrorSeverity(error, category) {
  const status = error?.status || error?.statusCode;
  if (status >= 500) {
    return ERROR_SEVERITY.CRITICAL;
  }

  if (
    category === ERROR_TYPES.INTERNAL ||
    category === ERROR_TYPES.SERVICE_UNAVAILABLE
  ) {
    return ERROR_SEVERITY.HIGH;
  }

  if (
    category === ERROR_TYPES.AUTHENTICATION ||
    category === ERROR_TYPES.AUTHORIZATION ||
    category === ERROR_TYPES.BAD_REQUEST
  ) {
    return ERROR_SEVERITY.MEDIUM;
  }

  if (
    category === ERROR_TYPES.RATE_LIMIT ||
    category === ERROR_TYPES.CONFLICT
  ) {
    return ERROR_SEVERITY.LOW;
  }

  return ERROR_SEVERITY.LOW;
}

/**
 * Async error wrapper for route handlers
 */
function asyncErrorHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Enhanced error boundary middleware
 */
function errorBoundary(error, req, res, next) {
  try {
    const category = categorizeError(error);
    const severity = getErrorSeverity(error, category);

    // Sanitize error for logging
    const sanitizedError = {
      message: error.message
        ?.replace(/[\r\n\t]/g, ' ')
        .substring(0, 500)
        .trim(),
      stack: error.stack
        ?.replace(/[\r\n\t]/g, ' ')
        .substring(0, 1000)
        .trim(),
      status: error.status || error.statusCode || 500,
      code: error.code,
      category,
      severity,
      timestamp: new Date().toISOString(),
      url: req.originalUrl,
      method: req.method,
      userAgent: req.get('User-Agent')?.substring(0, 200),
      ip: req.ip,
    };

    // Log structured error
    logEvent(
      `[ERROR_BOUNDARY][${severity.toUpperCase()}]: ${JSON.stringify(
        sanitizedError
      )}`,
      req.traceId
    );

    // Augment the error object with standardized details for the final error handler.
    // This ensures that while we categorize and log detailed, structured errors here,
    // the final response to the client is consistently formatted by the main errorHandler.
    error.category = category;
    error.severity = severity;
    error.traceId = req.traceId;

    // Apply standardized error properties using constants
    error.statusCode = STATUS_CODES[category] || error.statusCode || 500;
    error.title = ERROR_TITLES[category] || 'Internal Server Error';
    error.type = category;

    // Special handling for internal errors to prevent information leakage
    if (category === ERROR_TYPES.INTERNAL) {
      if (error.message.includes('prisma') || error.code?.startsWith('P')) {
        error.message = 'A database error occurred.';
      }
    }

    // Pass the augmented error to the next middleware (the main errorHandler)
    return next(error);
  } catch (boundaryError) {
    // Fallback for when the error boundary itself fails
    logEvent(`[ERROR_BOUNDARY_FAILURE]: ${boundaryError.message}`);

    // Create a generic error to avoid infinite loops and pass to the final handler
    const fallbackError = new Error('A critical system error occurred.');
    fallbackError.statusCode = 500;
    fallbackError.type = ERROR_TYPES.INTERNAL;
    fallbackError.title = 'Internal Server Error';

    return next(fallbackError);
  }
}

/**
 * Memory-safe error handler for high-volume scenarios
 */
function createBoundedErrorHandler(maxErrors = 1000) {
  const errorCache = new Map();
  let errorCount = 0;

  return function boundedErrorHandler(error, req, res, next) {
    // Prevent memory leaks from error accumulation
    if (errorCount >= maxErrors) {
      errorCache.clear();
      errorCount = 0;
    }

    const errorKey = `${error.message}_${req.url}_${req.method}`;

    if (errorCache.has(errorKey)) {
      // Skip detailed logging for repeated errors
      const cachedError = errorCache.get(errorKey);
      cachedError.count++;

      if (cachedError.count % 10 === 0) {
        logEvent(
          `[REPEATED_ERROR]: ${errorKey} occurred ${cachedError.count} times`
        );
      }
    } else {
      errorCache.set(errorKey, { count: 1, timestamp: Date.now() });
      errorCount++;
    }

    return errorBoundary(error, req, res, next);
  };
}

module.exports = {
  errorBoundary,
  asyncErrorHandler,
  createBoundedErrorHandler,
};
