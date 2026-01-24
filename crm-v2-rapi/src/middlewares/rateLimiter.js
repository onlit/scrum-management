/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module provides tiered rate limiting middleware for different types of endpoints.
 * It implements multiple rate limiting strategies based on endpoint criticality and
 * potential for abuse, with stricter limits for authentication and write operations.
 *
 * Features:
 * - General API rate limiting for standard operations
 * - Strict rate limiting for authentication endpoints
 * - Enhanced rate limiting for write operations (POST, PUT, PATCH, DELETE)
 * - File upload rate limiting with smaller windows
 * - Memory-efficient implementation with proper cleanup
 */

const rateLimit = require('express-rate-limit');
const { logEvent } = require('#utils/shared/loggingUtils.js');

/**
 * General API rate limiter for standard read operations
 * More permissive for regular API usage
 */
const generalApiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // 100 requests per 5 minutes
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res, next, options) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    logEvent(
      `[RATE_LIMIT_EXCEEDED][GENERAL]: IP ${clientIP} exceeded general API rate limit`
    );
    res.status(options.statusCode).json({
      traceId: req.traceId,
      status: options.statusCode,
      title: 'Rate Limit Exceeded',
      code: 'RATE_LIMIT_GENERAL',
      detail:
        'Too many requests, please try again later. Limit: 100 requests per 5 minutes.',
    });
  },
});

/**
 * Strict rate limiter for authentication and authorization endpoints
 * Much stricter limits to prevent brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes
  skipSuccessfulRequests: false, // Count all auth attempts
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res, next, options) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent')?.substring(0, 100) || 'unknown';
    logEvent(
      `[RATE_LIMIT_EXCEEDED][AUTH]: IP ${clientIP} exceeded auth rate limit. UserAgent: ${userAgent}`
    );
    res.status(options.statusCode).json({
      traceId: req.traceId,
      status: options.statusCode,
      title: 'Authentication Rate Limit Exceeded',
      code: 'RATE_LIMIT_AUTH',
      detail:
        'Too many authentication attempts, please try again later. Limit: 10 requests per 15 minutes.',
    });
  },
});

/**
 * Write operations rate limiter for create/update/delete operations
 * Moderate restrictions to prevent abuse while allowing normal usage
 */
const writeOperationsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // 30 write operations per 5 minutes
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  skip: (req) => {
    // Skip rate limiting for internal requests
    return req.user?.internalRequest === true;
  },
  handler: (req, res, next, options) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const { method } = req;
    const { path } = req;
    logEvent(
      `[RATE_LIMIT_EXCEEDED][WRITE]: IP ${clientIP} exceeded write rate limit on ${method} ${path}`
    );
    res.status(options.statusCode).json({
      traceId: req.traceId,
      status: options.statusCode,
      title: 'Write Operations Rate Limit Exceeded',
      code: 'RATE_LIMIT_WRITE',
      detail:
        'Too many write operations, please try again later. Limit: 30 requests per 5 minutes.',
    });
  },
});

/**
 * File upload rate limiter with very strict limits
 * Prevents abuse of file upload endpoints
 */
const fileUploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 15 minutes (increased from 10)
  max: 10, // 15 file uploads per 15 minutes (increased from 5)
  skipSuccessfulRequests: false, // Count all upload attempts
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res, next, options) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const fileName = req.file?.originalname || 'unknown';
    logEvent(
      `[RATE_LIMIT_EXCEEDED][FILE_UPLOAD]: IP ${clientIP} exceeded file upload rate limit. File: ${fileName}`
    );
    res.status(options.statusCode).json({
      traceId: req.traceId,
      status: options.statusCode,
      title: 'File Upload Rate Limit Exceeded',
      code: 'RATE_LIMIT_UPLOAD',
      detail:
        'Too many file uploads, please try again later. Limit: 10 uploads per 10 minutes.',
    });
  },
});

/**
 * Burst rate limiter for very short windows to prevent rapid-fire requests
 * Protects against immediate abuse while allowing normal usage patterns
 */
const burstLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  skipSuccessfulRequests: true,
  standardHeaders: false, // Don't expose burst limiting headers
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res, next, options) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    logEvent(
      `[RATE_LIMIT_EXCEEDED][BURST]: IP ${clientIP} exceeded burst rate limit`
    );
    res.status(options.statusCode).json({
      traceId: req.traceId,
      status: options.statusCode,
      title: 'Request Rate Too High',
      code: 'RATE_LIMIT_BURST',
      detail:
        'Request rate too high, please slow down. Limit: 20 requests per minute.',
    });
  },
});

/**
 * Middleware factory to apply appropriate rate limiting based on endpoint type
 */
function createEndpointRateLimiter(endpointType = 'general') {
  switch (endpointType) {
    case 'auth':
      return [burstLimiter, authLimiter];
    case 'write':
      return [burstLimiter, writeOperationsLimiter];
    case 'upload':
      return [burstLimiter, fileUploadLimiter];
    case 'general':
    default:
      return [burstLimiter, generalApiLimiter];
  }
}

/**
 * Middleware to automatically detect endpoint type and apply appropriate rate limiting
 */
function smartRateLimiter(req, res, next) {
  const path = req.path.toLowerCase();
  const method = req.method.toUpperCase();

  // Determine endpoint type based on path and method
  let endpointType = 'general';

  if (
    path.includes('/auth') ||
    path.includes('/login') ||
    path.includes('/logout')
  ) {
    endpointType = 'auth';
  } else if (path.includes('/import') || path.includes('/upload')) {
    endpointType = 'upload';
  } else if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    endpointType = 'write';
  }

  // Apply appropriate rate limiters
  const limiters = createEndpointRateLimiter(endpointType);

  // Apply limiters sequentially
  let currentIndex = 0;

  function applyNextLimiter(err) {
    if (err) return next(err);

    if (currentIndex >= limiters.length) {
      return next();
    }

    const limiter = limiters[currentIndex++];
    limiter(req, res, applyNextLimiter);
  }

  applyNextLimiter();
}

module.exports = {
  generalApiLimiter,
  authLimiter,
  writeOperationsLimiter,
  fileUploadLimiter,
  burstLimiter,
  createEndpointRateLimiter,
  smartRateLimiter,
};
