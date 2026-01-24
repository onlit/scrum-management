/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 * DESCRIPTION:
 * ------------------
 * Middleware factory that intercepts OPTIONS requests with Accept: application/schema+json
 * and returns JSON Schema contract for the route.
 *
 * Follows Single Responsibility Principle: only handles schema OPTIONS detection.
 * Follows Fail Fast: validates Accept header before any processing.
 * Follows Open/Closed Principle: auth middleware is injected, not hardcoded.
 */

const { get } = require('#core/utils/schemaRegistry.js');

const SCHEMA_MEDIA_TYPE = 'application/schema+json';

/**
 * Checks if the Accept header requests schema response.
 * @param {string} acceptHeader - Accept header value
 * @returns {boolean} True if schema is requested
 */
function wantsSchemaResponse(acceptHeader) {
  if (!acceptHeader) return false;
  return acceptHeader.includes(SCHEMA_MEDIA_TYPE);
}

/**
 * Creates middleware that returns JSON Schema for OPTIONS requests.
 * Falls through to CORS middleware for normal OPTIONS preflight.
 * @param {Object} options - Configuration options
 * @param {Function} options.authMiddleware - Authentication middleware to protect schema endpoint
 * @returns {Function} Express middleware
 */
function createSchemaOptionsHandler({ authMiddleware } = {}) {
  return function schemaOptionsHandler(req, res, next) {
    // Only intercept OPTIONS requests
    if (req.method !== 'OPTIONS') {
      return next();
    }

    // Check Accept header for schema request
    const acceptHeader = req.get('Accept');
    if (!wantsSchemaResponse(acceptHeader)) {
      return next();
    }

    // Look up schema in registry
    const schemaConfig = get(req.path);

    if (!schemaConfig) {
      return res
        .status(404)
        .set('Content-Type', SCHEMA_MEDIA_TYPE)
        .json({ error: `No schema registered for path: ${req.path}` });
    }

    // Helper to send schema response
    const sendSchemaResponse = () => {
      // Set CORS headers for schema response
      const origin = req.get('Origin') || '*';
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Access-Control-Allow-Methods', Object.keys(schemaConfig.methods || {}).join(', '));
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

      // Return schema
      return res
        .set('Content-Type', SCHEMA_MEDIA_TYPE)
        .json(schemaConfig);
    };

    // If auth middleware provided, authenticate first
    if (authMiddleware) {
      return authMiddleware(req, res, (err) => {
        if (err) {
          return next(err);
        }
        // Check if user is authenticated after auth middleware runs
        if (!req.user?.isAuthenticated) {
          return res
            .status(401)
            .set('Content-Type', SCHEMA_MEDIA_TYPE)
            .json({ error: 'Authentication required', message: 'Valid authentication token required to access schema' });
        }
        return sendSchemaResponse();
      });
    }

    // No auth middleware, send response directly
    return sendSchemaResponse();
  };
}

module.exports = {
  createSchemaOptionsHandler,
  wantsSchemaResponse,
  SCHEMA_MEDIA_TYPE,
};
