/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This middleware handles internal server-to-server requests by allowing them to bypass
 * the standard CORS middleware. It identifies internal requests based on IP address and
 * user agent patterns before the CORS middleware is invoked.
 *
 * This prevents CORS errors for legitimate internal server requests while maintaining
 * security for browser-based requests.
 *
 *
 * REVISION 1:
 * REVISED BY: AI Assistant
 * REVISION DATE: 2025-01-27
 * REVISION REASON: Implement standardized error handling and trace ID conventions
 */
const HEALTH_PREFIX = '/api/v1/health';
const { logEvent } = require('#utils/shared/loggingUtils.js');

/**
 * Middleware to handle internal server-to-server requests
 * This should be placed BEFORE the CORS middleware in the middleware chain
 */
function internalRequestHandler(req, res, next) {
    // Suppress internal request logging for health probes
    const requestUrl = req.originalUrl || req.url || '';
    const isHealth = requestUrl.startsWith(HEALTH_PREFIX);  
  // Only handle requests without Origin header (server-to-server requests)
  if (!req.headers.origin) {
    const userAgent = req.get('User-Agent')?.substring(0, 200) || '';
    const clientIP = req?.ip || req.connection?.remoteAddress || '';

    // Check if request is from internal IP ranges
    const isInternalIP =
      /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|127\.0\.0\.1|::1)/.test(
        clientIP
      );

    // Check if request is from server-to-server user agents
    const isServerToServer =
      /python-requests|curl|axios|node-fetch|http-client/i.test(userAgent);

    if (isInternalIP || isServerToServer) {
      if (!isHealth) {
        logEvent(
          `[INTERNAL_REQUEST]: Allowing internal request from ${clientIP} with UA: ${userAgent}`,
          req.traceId
        );
      }

      // Set CORS headers for internal requests
      res.header('Access-Control-Allow-Origin', '*');
      res.header(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE, OPTIONS'
      );
      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-Forwarded-For, ActAs'
      );
      res.header(
        'Access-Control-Expose-Headers',
        'X-Total-Count, X-Rate-Limit-Limit, X-Rate-Limit-Remaining, X-Rate-Limit-Reset, ETag, Last-Modified'
      );
      res.header('Access-Control-Allow-Credentials', 'true');

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.header('Access-Control-Max-Age', '600');
        return res.status(200).end();
      }

      // Skip CORS middleware for this request by setting a flag
      req.skipCors = true;
    }
  }

  next();
}

module.exports = internalRequestHandler;
