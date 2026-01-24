/**
 * Domain Exception Types
 *
 * CANONICAL SOURCE for all error type constants.
 * This file is the single source of truth for ERROR_TYPES, STATUS_CODES,
 * ERROR_MESSAGES, and ERROR_TITLES used across both Core and Domain layers.
 *
 * Used by:
 * - Domain layer interceptors for business logic exceptions
 * - Core layer controllers via re-export from configs/constants.js
 * - Middleware error handlers for standardized responses
 *
 * @module shared/exceptions/domain.exception
 */

/**
 * Standard error types with semantic meaning.
 * Uses SCREAMING_SNAKE_CASE values matching keys for consistency.
 */
const ERROR_TYPES = {
  VALIDATION: 'VALIDATION',
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT: 'RATE_LIMIT',
  INTERNAL: 'INTERNAL',
  BAD_REQUEST: 'BAD_REQUEST',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  BUSINESS_RULE: 'BUSINESS_RULE',
  DEPENDENCY: 'DEPENDENCY',
};

/**
 * HTTP status code mapping for error types.
 */
const STATUS_CODES = {
  [ERROR_TYPES.VALIDATION]: 422,
  [ERROR_TYPES.AUTHENTICATION]: 401,
  [ERROR_TYPES.AUTHORIZATION]: 403,
  [ERROR_TYPES.NOT_FOUND]: 404,
  [ERROR_TYPES.CONFLICT]: 409,
  [ERROR_TYPES.RATE_LIMIT]: 429,
  [ERROR_TYPES.INTERNAL]: 500,
  [ERROR_TYPES.BAD_REQUEST]: 400,
  [ERROR_TYPES.SERVICE_UNAVAILABLE]: 503,
  [ERROR_TYPES.BUSINESS_RULE]: 422,
  [ERROR_TYPES.DEPENDENCY]: 424,
};

/**
 * Standard error messages for each error type.
 */
const ERROR_MESSAGES = {
  [ERROR_TYPES.VALIDATION]: 'Validation failed',
  [ERROR_TYPES.AUTHENTICATION]: 'Authentication required',
  [ERROR_TYPES.AUTHORIZATION]: 'Insufficient permissions',
  [ERROR_TYPES.NOT_FOUND]: 'Resource not found',
  [ERROR_TYPES.CONFLICT]: 'Resource conflict',
  [ERROR_TYPES.RATE_LIMIT]: 'Rate limit exceeded',
  [ERROR_TYPES.INTERNAL]: 'Internal server error',
  [ERROR_TYPES.BAD_REQUEST]: 'Bad request',
  [ERROR_TYPES.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
  [ERROR_TYPES.BUSINESS_RULE]: 'Business rule violation',
  [ERROR_TYPES.DEPENDENCY]: 'Dependency error',
};

/**
 * Error titles for responses (human-readable).
 */
const ERROR_TITLES = {
  [ERROR_TYPES.VALIDATION]: 'Validation Failed',
  [ERROR_TYPES.AUTHENTICATION]: 'Unauthorized',
  [ERROR_TYPES.AUTHORIZATION]: 'Forbidden',
  [ERROR_TYPES.NOT_FOUND]: 'Not Found',
  [ERROR_TYPES.CONFLICT]: 'Conflict',
  [ERROR_TYPES.RATE_LIMIT]: 'Rate Limited',
  [ERROR_TYPES.INTERNAL]: 'Internal Server Error',
  [ERROR_TYPES.BAD_REQUEST]: 'Bad Request',
  [ERROR_TYPES.SERVICE_UNAVAILABLE]: 'Service Unavailable',
  [ERROR_TYPES.BUSINESS_RULE]: 'Business Rule Violation',
  [ERROR_TYPES.DEPENDENCY]: 'Dependency Error',
};

/**
 * Domain exception for business logic errors.
 * Provides structured error information for API responses.
 */
class DomainException extends Error {
  /**
   * @param {string} type - Error type from ERROR_TYPES
   * @param {string} message - Human-readable error message
   * @param {Object} [details] - Additional error details
   */
  constructor(type, message, details = {}) {
    super(message);
    this.name = 'DomainException';
    this.type = type;
    this.details = details;
    this.statusCode = STATUS_CODES[type] || 500;
    this.timestamp = new Date().toISOString();

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DomainException);
    }
  }

  /**
   * Convert to JSON response format.
   * @returns {Object}
   */
  toJSON() {
    return {
      success: false,
      error: {
        type: this.type,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp,
      },
    };
  }
}

/**
 * Shorthand factory for creating domain exceptions.
 *
 * @param {string} type - Error type from ERROR_TYPES
 * @param {string} message - Error message
 * @param {Object} [details] - Additional details
 * @returns {DomainException}
 */
function createDomainError(type, message, details) {
  return new DomainException(type, message, details);
}

/**
 * Check if an error is a DomainException.
 * @param {Error} error
 * @returns {boolean}
 */
function isDomainException(error) {
  return error instanceof DomainException;
}

module.exports = {
  ERROR_TYPES,
  STATUS_CODES,
  ERROR_MESSAGES,
  ERROR_TITLES,
  DomainException,
  createDomainError,
  isDomainException,
};
