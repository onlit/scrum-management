const { createErrorWithTrace } = require('#utils/shared/traceUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { logEvent } = require('#utils/shared/loggingUtils.js');

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
