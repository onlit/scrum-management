/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * This middleware adds a unique traceId to each request.
 * The traceId is used for request tracking, logging, and correlation
 * across the application and in error responses.
 *
 *
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Middleware that adds a unique traceId to each request
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function traceId(req, res, next) {
  // Generate a unique trace ID (UUID v4)
  const id = uuidv4();

  // Add the trace ID to the request object
  req.traceId = id;

  // Add the trace ID to response headers for client visibility
  res.setHeader('X-Trace-ID', id);

  // Continue to the next middleware
  next();
}

module.exports = traceId;
