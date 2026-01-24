/**
 * CREATED BY: Hamza Lachi
 * CREATOR EMAIL: hamza@pullstream.com
 * CREATION DATE: 09/09/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * The protectInternal middleware function is designed to restrict access
 * exclusively to internal requests. It verifies that the incoming request
 * has been marked as internal via the `user.internalRequest` flag. If this
 * condition is not met, the middleware logs the failure and raises an
 * authorization error with detailed trace context. This ensures that only
 * trusted internal requests can proceed, while all others are blocked with
 * a structured error response.
 *
 */
const { createErrorWithTrace } = require('#utils/shared/traceUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { logEvent } = require('#utils/shared/loggingUtils.js');

async function protectInternal(req, res, next) {
  const { user } = req;

  if (!user.internalRequest) {
    logEvent(
      'Internal check failed in protectInternal middleware',
      req.traceId
    );
    const error = createErrorWithTrace(
      ERROR_TYPES.AUTHORIZATION,
      'Internal requests required.',
      req,
      {
        severity: ERROR_SEVERITY.MEDIUM,
        context: 'protect_internal_middleware',
        details: {
          path: req.path,
          method: req.method,
          hasUser: !!user,
          internalRequest: user?.internalRequest,
        },
      }
    );

    return next(error);
  }

  next();
}

module.exports = protectInternal;
