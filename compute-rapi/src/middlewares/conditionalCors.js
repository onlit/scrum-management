/**
 * CREATED BY: Claude Code
 * CREATION DATE: 25/07/2025
 *
 * DESCRIPTION:
 * ------------------
 * This middleware conditionally applies CORS based on whether the request
 * has been marked as an internal request by the internalRequestHandler middleware.
 * This prevents CORS errors for internal requests while maintaining CORS security
 * for browser-based requests.
 */

const cors = require('cors');
const { corsOptions } = require('#configs/cors.js');

const HEALTH_PREFIX = '/api/v1/health';

/**
 * Conditional CORS middleware that skips CORS for internal requests
 */
function conditionalCors(req, res, next) {
  // Skip CORS if this is marked as an internal request
  if (req.skipCors) {
    return next();
  }

  // Skip CORS for health endpoints (liveness/readiness)
  if (req.path && req.path.startsWith(HEALTH_PREFIX)) {
    return next();
  }

  // Apply standard CORS for all other requests
  return cors(corsOptions)(req, res, next);
}

module.exports = conditionalCors;
