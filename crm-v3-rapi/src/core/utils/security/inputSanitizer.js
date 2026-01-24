/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * Input Sanitization and Validation Utilities
 *
 * Provides secure input sanitization to prevent log injection and other attacks
 */

const crypto = require('crypto');
const { CONFIG } = require('#configs/securityConfig.js');
const { logWithTrace } = require('#utils/traceUtils.js');

/**
 * Sanitizes a string for safe logging by removing/escaping dangerous characters
 * @param {any} input - Input to sanitize
 * @param {number} maxLength - Maximum length of output
 * @returns {string} - Sanitized string safe for logging
 */
function sanitizeForLogging(input, maxLength = 500, req = null) {
  if (input === null || input === undefined) {
    return 'null';
  }

  let str;
  if (typeof input === 'object') {
    try {
      str = JSON.stringify(input);
    } catch (error) {
      if (req) {
        logWithTrace('Failed to stringify object in sanitizeForLogging', req, {
          error: error.message,
          context: 'sanitize_for_logging',
        });
      }
      return '[Circular Object]';
    }
  } else {
    str = String(input);
  }

  // Truncate if too long
  if (str.length > maxLength) {
    str = `${str.substring(0, maxLength)}...`;
  }

  // Remove or escape potentially dangerous characters
  str = str
    .replace(/[\r\n\t]/g, ' ') // Replace newlines and tabs with spaces
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // Remove control characters
    .replace(/[<>&"']/g, (char) => {
      // Escape HTML/XML characters
      switch (char) {
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '&':
          return '&amp;';
        case '"':
          return '&quot;';
        case "'":
          return '&#x27;';
        default:
          return char;
      }
    });

  return str;
}

/**
 * Sanitizes user agent string
 * @param {string} userAgent - User agent string
 * @returns {string} - Sanitized user agent
 */
function sanitizeUserAgent(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') {
    return 'unknown';
  }

  // Limit length and sanitize
  const sanitized = sanitizeForLogging(userAgent, CONFIG.MAX_USER_AGENT_LENGTH);

  // Additional validation for user agent
  if (sanitized.length < 3 || !/[a-zA-Z]/.test(sanitized)) {
    return 'invalid';
  }

  return sanitized;
}

/**
 * Sanitizes URL for safe logging
 * @param {string} url - URL to sanitize
 * @returns {string} - Sanitized URL
 */
function sanitizeURL(url) {
  if (!url || typeof url !== 'string') {
    return 'unknown';
  }

  // Limit length
  let sanitized = url.substring(0, CONFIG.MAX_URL_LENGTH);

  // Remove any embedded credentials
  sanitized = sanitized.replace(/\/\/[^@/]+@/, '//***@');

  // Sanitize for logging
  sanitized = sanitizeForLogging(sanitized, CONFIG.MAX_URL_LENGTH);

  return sanitized;
}

/**
 * Sanitizes HTTP headers for logging
 * @param {Object} headers - Headers object
 * @returns {Object} - Sanitized headers object
 */
function sanitizeHeaders(headers) {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  const sanitized = {};
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'x-access-token',
    'proxy-authorization',
  ];

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();

    if (sensitiveHeaders.includes(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeForLogging(value, CONFIG.MAX_HEADER_LENGTH);
    } else {
      sanitized[key] = sanitizeForLogging(value);
    }
  }

  return sanitized;
}

/**
 * Sanitizes request body for logging
 * @param {any} body - Request body
 * @param {boolean} redactSensitive - Whether to redact sensitive fields
 * @param {number} maxDepth - Maximum recursion depth to prevent stack overflow
 * @returns {any} - Sanitized body
 */
function sanitizeRequestBody(
  body,
  redactSensitive = true,
  maxDepth = 5,
  req = null
) {
  if (maxDepth <= 0) {
    return '[Max Depth Reached]';
  }

  if (!body) {
    return null;
  }

  if (typeof body === 'string') {
    // Check if it's JSON
    try {
      const parsed = JSON.parse(body);
      return sanitizeRequestBody(parsed, redactSensitive, maxDepth - 1, req);
    } catch (error) {
      if (req) {
        logWithTrace('Failed to parse JSON in sanitizeRequestBody', req, {
          error: error.message,
          context: 'sanitize_request_body',
        });
      }
      return sanitizeForLogging(body, 1000, req);
    }
  }

  if (typeof body !== 'object') {
    return sanitizeForLogging(body);
  }

  if (Array.isArray(body)) {
    return body
      .slice(0, 10)
      .map((item) =>
        sanitizeRequestBody(item, redactSensitive, maxDepth - 1, req)
      );
  }

  const sanitized = {};
  const sensitiveFields = [
    'password',
    'passwd',
    'pwd',
    'secret',
    'token',
    'key',
    'auth',
    'credential',
    'pin',
    'ssn',
    'social',
    'credit',
    'card',
    'cvv',
    'ccv',
  ];

  for (const [key, value] of Object.entries(body)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveFields.some((field) =>
      lowerKey.includes(field)
    );

    if (redactSensitive && isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeRequestBody(
        value,
        redactSensitive,
        maxDepth - 1,
        req
      );
    } else {
      sanitized[key] = sanitizeForLogging(value);
    }
  }

  return sanitized;
}

/**
 * Validates and sanitizes client information
 * @param {Object} req - Express request object
 * @returns {Object} - Sanitized client information
 */
function sanitizeClientInfo(req) {
  const info = {
    method: req.method || 'unknown',
    url: sanitizeURL(req.originalUrl || req.url),
    userAgent: sanitizeUserAgent(req.get('User-Agent')),
    timestamp: new Date().toISOString(),
  };

  // Add content type if present
  const contentType = req.get('Content-Type');
  if (contentType) {
    info.contentType = sanitizeForLogging(contentType, 100);
  }

  // Add content length if present
  const contentLength = req.get('Content-Length');
  if (contentLength) {
    const length = parseInt(contentLength, 10);
    info.contentLength = Number.isNaN(length) ? 'invalid' : length;
  }

  // Add referer if present
  const referer = req.get('Referer') || req.get('Referrer');
  if (referer) {
    info.referer = sanitizeURL(referer);
  }

  return info;
}

/**
 * Generates a correlation ID for request tracking
 * @param {Object} req - Express request object
 * @returns {string} - Unique correlation ID
 */
function generateCorrelationId(req) {
  // Check if correlation ID already exists
  const existingId = req.get('X-Correlation-ID') || req.get('X-Request-ID');
  if (existingId && /^[a-zA-Z0-9\-_]{8,64}$/.test(existingId)) {
    return sanitizeForLogging(existingId, 64);
  }

  return crypto.randomBytes(16).toString('hex');
}

/**
 * Validates if a string contains only safe characters for logging
 * @param {string} input - Input string to validate
 * @returns {boolean} - True if string is safe for logging
 */
function isLogSafe(input) {
  if (!input || typeof input !== 'string') {
    return false;
  }

  // Check for control characters, unusual unicode, etc.
  const dangerousChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/;
  const logInjection = /(\r|\n|\t|%0[ad]|%09|%00)/i;

  return !dangerousChars.test(input) && !logInjection.test(input);
}

/**
 * Safely converts any input to a loggable string
 * @param {any} input - Input to convert
 * @param {number} maxDepth - Maximum object depth to traverse
 * @returns {string} - Safe string representation
 */
function toSafeString(input, maxDepth = 3, req = null) {
  if (maxDepth <= 0) {
    return '[Max Depth Reached]';
  }

  if (input === null) return 'null';
  if (input === undefined) return 'undefined';

  if (typeof input === 'string') {
    return sanitizeForLogging(input, undefined, req);
  }

  if (typeof input === 'number' || typeof input === 'boolean') {
    return String(input);
  }

  if (input instanceof Date) {
    return input.toISOString();
  }

  if (input instanceof Error) {
    if (req) {
      logWithTrace('Error object encountered in toSafeString', req, {
        error: input.message,
        context: 'to_safe_string',
      });
    }
    return `Error: ${sanitizeForLogging(input.message, undefined, req)}`;
  }

  if (Array.isArray(input)) {
    const items = input
      .slice(0, 5)
      .map((item) => toSafeString(item, maxDepth - 1, req));
    const suffix = input.length > 5 ? `, ... (${input.length - 5} more)` : '';
    return `[${items.join(', ')}${suffix}]`;
  }

  if (typeof input === 'object') {
    try {
      const keys = Object.keys(input).slice(0, 10);
      const pairs = keys.map((key) => {
        const value = toSafeString(input[key], maxDepth - 1, req);
        return `${key}: ${value}`;
      });
      const suffix = Object.keys(input).length > 10 ? ', ...' : '';
      return `{${pairs.join(', ')}${suffix}}`;
    } catch (error) {
      if (req) {
        logWithTrace('Object conversion error in toSafeString', req, {
          error: error.message,
          context: 'to_safe_string',
        });
      }
      return '[Object - Conversion Error]';
    }
  }

  return sanitizeForLogging(String(input), undefined, req);
}

module.exports = {
  sanitizeForLogging,
  sanitizeUserAgent,
  sanitizeURL,
  sanitizeHeaders,
  sanitizeRequestBody,
  sanitizeClientInfo,
  generateCorrelationId,
  isLogSafe,
  toSafeString,
};
