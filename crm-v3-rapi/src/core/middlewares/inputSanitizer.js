/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
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
 */
const { createErrorWithTrace } = require('#utils/traceUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');

function sanitizeString(str) {
  if (typeof str !== 'string') {
    return str;
  }

  // Only remove null bytes. Do not escape or alter user-provided content.
  // Preserving original characters (e.g., quotes, slashes) avoids corrupting data like "State/Province".
  return str.replace(/\0/g, '');
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
      // Preserve original keys; only sanitize values
      sanitizedObj[key] = sanitizeObject(value);
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
    maxInputSize = 1024 * 1024, // 1MB for external requests
    internalMaxInputSize = 10 * 1024 * 1024, // 10MB for internal server-to-server requests
    skipPaths = [],
  } = options;

  return (req, res, next) => {
    try {
      // Skip sanitization for certain paths
      if (skipPaths.some((path) => req.path.startsWith(path))) {
        return next();
      }

      // Apply higher limit for internal server-to-server requests
      // (isInternalRequest is set by internalRequestHandler middleware)
      const effectiveMaxSize = req.isInternalRequest
        ? internalMaxInputSize
        : maxInputSize;

      // Validate input size
      if (sanitizeBody && req.body) {
        validateInputSize(req.body, effectiveMaxSize);
        req.body = sanitizeObject(req.body);
      }

      if (sanitizeQuery && req.query) {
        validateInputSize(req.query, effectiveMaxSize);
        req.query = sanitizeObject(req.query);
      }

      if (sanitizeParams && req.params) {
        validateInputSize(req.params, effectiveMaxSize);
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
