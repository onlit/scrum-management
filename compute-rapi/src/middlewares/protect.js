/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
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
 */

const { createErrorWithTrace } = require('#utils/shared/traceUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');

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

  next();
}

module.exports = protect;
