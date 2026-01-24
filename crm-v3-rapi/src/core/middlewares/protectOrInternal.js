/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The protectOrInternal middleware function is designed to protect routes that require
 * authentication OR allow internal requests. It checks whether the user is authenticated
 * or if the request is internal. If neither condition is met, it creates an error
 * indicating that authentication is required.
 *
 *
 */

const { createErrorWithTrace } = require('#utils/traceUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { logEvent } = require('#utils/loggingUtils.js');

async function protectOrInternal(req, res, next) {
  const { user } = req;

  if (!user.isAuthenticated && !user.internalRequest) {
    logEvent(
      'Authentication check failed in protectOrInternal middleware',
      req.traceId
    );
    const error = createErrorWithTrace(
      ERROR_TYPES.AUTHENTICATION,
      'Authentication required. Please provide a valid token.',
      req,
      {
        severity: ERROR_SEVERITY.MEDIUM,
        context: 'protect_or_internal_middleware',
        details: {
          path: req.path,
          method: req.method,
          hasUser: !!user,
          isAuthenticated: user?.isAuthenticated,
          internalRequest: user?.internalRequest,
        },
      }
    );

    return next(error);
  }

  next();
}

module.exports = protectOrInternal;
