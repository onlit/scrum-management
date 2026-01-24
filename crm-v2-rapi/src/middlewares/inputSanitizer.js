/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * Input Sanitization Middleware
 *
 * This middleware sanitizes all incoming request data to prevent
 * XSS attacks, SQL injection, and other malicious input.
 *
 *
 * REVISION 1:
 * REVISED BY: AI Assistant
 * REVISION DATE: 2025-01-27
 * REVISION REASON: Implement standardized error handling and trace ID conventions
 */

const validator = require('validator');
const { createErrorWithTrace } = require('#utils/shared/traceUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');

function sanitizeString(str) {
  if (typeof str !== 'string') {
    return str;
  }

  // Remove null bytes
  let sanitized = str.replace(/\0/g, '');

  // Check if the string is a valid URL - if so, don't HTML escape it
  if (
    validator.isURL(sanitized, {
      require_protocol: true,
      protocols: ['http', 'https'],
    })
  ) {
    // For URLs, only normalize whitespace but don't HTML escape
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    return sanitized;
  }

  // Escape HTML to prevent XSS for non-URL strings
  sanitized = validator.escape(sanitized);

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}

function sanitizeObject(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (typeof obj === 'object') {
    const sanitizedObj = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize the key as well
      const sanitizedKey = sanitizeString(key);
      sanitizedObj[sanitizedKey] = sanitizeObject(value);
    }
    return sanitizedObj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  return obj;
}

function validateInputSize(data, maxSize = 1024 * 1024) {
  // 1MB default
  const jsonSize = JSON.stringify(data).length;
  if (jsonSize > maxSize) {
    throw new Error(
      `Input data too large: ${jsonSize} bytes (max: ${maxSize})`
    );
  }
}

function inputSanitizer(options = {}) {
  const {
    sanitizeBody = true,
    sanitizeQuery = true,
    sanitizeParams = true,
    maxInputSize = 1024 * 1024, // 1MB
    skipPaths = [],
  } = options;

  return (req, res, next) => {
    try {
      // Skip sanitization for certain paths
      if (skipPaths.some((path) => req.path.startsWith(path))) {
        return next();
      }

      // Validate input size
      if (sanitizeBody && req.body) {
        validateInputSize(req.body, maxInputSize);
        req.body = sanitizeObject(req.body);
      }

      if (sanitizeQuery && req.query) {
        validateInputSize(req.query, maxInputSize);
        req.query = sanitizeObject(req.query);
      }

      if (sanitizeParams && req.params) {
        validateInputSize(req.params, maxInputSize);
        req.params = sanitizeObject(req.params);
      }

      next();
    } catch (error) {
      const sanitizationError = createErrorWithTrace(
        ERROR_TYPES.BAD_REQUEST,
        `Input validation failed: ${error.message}`,
        req,
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'input_sanitizer_middleware',
          originalError: error,
          details: {
            path: req.path,
            method: req.method,
            hasBody: !!req.body,
            hasQuery: !!req.query,
          },
        }
      );
      next(sanitizationError);
    }
  };
}

module.exports = inputSanitizer;
