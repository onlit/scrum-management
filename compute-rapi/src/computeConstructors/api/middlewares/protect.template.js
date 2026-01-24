/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * The protect middleware function is designed to protect routes that require authentication.
 * It checks whether the user is authenticated by inspecting the user object attached to the
 * request. If the user is not authenticated, it creates an error using the createError function
 * from the generalUtils module, indicating that authentication is required. The error has a
 * status code of 401 Unauthorized. Otherwise, if the user is authenticated, it allows the request
 * to proceed by calling the next middleware function in the chain.
 *
 *
 */

const { createErrorWithTrace } = require('#utils/traceUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const validator = require('validator');

async function protect(req, res, next) {
  const { user } = req;

  if (!user.isAuthenticated) {
    const error = createErrorWithTrace(
      ERROR_TYPES.AUTHENTICATION,
      'Authentication required. Please provide a valid token.',
      req,
      {
        severity: ERROR_SEVERITY.MEDIUM,
        context: 'protect_middleware',
      }
    );

    return next(error);
  }

  const userId = user?.id;
  if (!userId || !validator.isUUID(String(userId))) {
    const error = createErrorWithTrace(
      ERROR_TYPES.BAD_REQUEST,
      'Invalid authenticated user id. Expected a UUID.',
      req,
      {
        severity: ERROR_SEVERITY.LOW,
        context: 'protect_middleware_user',
      }
    );

    return next(error);
  }

  const clientId = user?.client?.id;
  if (!clientId || !validator.isUUID(String(clientId))) {
    const error = createErrorWithTrace(
      ERROR_TYPES.BAD_REQUEST,
      'Invalid authenticated client id. Expected a UUID.',
      req,
      {
        severity: ERROR_SEVERITY.LOW,
        context: 'protect_middleware_client',
      }
    );

    return next(error);
  }

  next();
}

module.exports = protect;
