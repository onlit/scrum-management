/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This middleware conditionally applies CORS based on whether the request
 * has been marked as an internal request by the internalRequestHandler middleware.
 * This prevents CORS errors for internal requests while maintaining CORS security
 * for browser-based requests.
 *
 */
const cors = require('cors');
const { corsOptions } = require('#configs/cors.js');
const { isRequestInternal } = require('#utils/generalUtils.js');

const HEALTH_PREFIX = '/api/v1/health';
/**
 * Conditional CORS middleware that skips CORS for internal requests
 */
function conditionalCors(req, res, next) {
  // Skip CORS if this is marked as an internal request
  if (req.skipCors || isRequestInternal(req)) {
    // For browser requests (with Origin header), we must still set CORS headers
    // otherwise the browser will block the response
    const origin = req.headers.origin;
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE, OPTIONS'
      );
      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-Forwarded-For, ActAs, X-Timezone'
      );
      res.header(
        'Access-Control-Expose-Headers',
        'X-Total-Count, X-Rate-Limit-Limit, X-Rate-Limit-Remaining, X-Rate-Limit-Reset, ETag, Last-Modified'
      );

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.header('Access-Control-Max-Age', '600');
        return res.status(200).end();
      }
    }
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
