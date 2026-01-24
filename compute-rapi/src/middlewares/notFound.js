/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This notFound middleware function is responsible for handling requests for resources
 * that are not found on the server. When invoked, it creates a new Error object with a
 * message indicating that the requested resource was not found, including the original URL
 * of the request. It then sets the status code of the error to 404 Not Found and passes
 * the error to the next middleware function in the chain for error handling.
 *
 *
 * REVISION 1:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 20/02/2024
 * REVISION REASON: Add Standard File Header Comments
 *
 *
 * REVISION 2:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 21/02/2024
 * REVISION REASON: Convert ESM to CJS
 *
 *
 * REVISION 3:
 * REVISED BY: Kiro AI
 * REVISION DATE: 21/07/2025
 * REVISION REASON: Update to follow error handling standards
 */

const { createErrorWithTrace } = require('#utils/shared/traceUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');

function notFound(req, res, next) {
  // Sanitize URL to prevent log injection attacks
  const sanitizedUrl = req.originalUrl
    ? req.originalUrl.replace(/[^\w\-._~:/?#[\]@!$'()*+,;=%]/g, '')
    : 'unknown';

  const error = createErrorWithTrace(
    ERROR_TYPES.NOT_FOUND,
    `The requested resource at ${sanitizedUrl} was not found.`,
    req,
    {
      severity: ERROR_SEVERITY.LOW,
      context: 'not_found_middleware',
      details: { requestedUrl: sanitizedUrl, method: req.method },
    }
  );

  next(error);
}

module.exports = notFound;
