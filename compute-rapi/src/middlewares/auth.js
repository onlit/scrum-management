/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This middleware function is responsible for handling authentication by verifying
 * the provided access token against the authentication service.
 *
 * It extracts the access token from the request headers or query parameters and sends
 * a request to the authentication service to validate the token and retrieve user details.
 *
 * If the token is not provided, it sets req.user.isAuthenticated to false and proceeds
 * to the next middleware.
 *
 * Upon successful authentication, it sets req.user with the user details obtained from
 * the authentication service, including user ID, username, first name, last name, email,
 * role information, client details, and authentication status.
 *
 * If authentication fails, it returns a 401 Unauthorized error indicating an invalid
 * authentication token.
 *
 * Note: This middleware relies on environment variables such as ACCOUNTS_HOST defined
 *       in the .env file to determine the authentication service endpoint.
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
 * REVISED BY: Hamza Lachi
 * REVISION DATE: 8/06/2024
 * REVISION REASON: Added actAs
 */

const axios = require('axios');
const { isRequestInternal } = require('#utils/shared/generalUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { logEvent } = require('#utils/shared/loggingUtils.js');
const { createErrorWithTrace } = require('#utils/shared/traceUtils.js');

async function auth(req, res, next) {
  try {
    const accountsHost = process.env.ACCOUNTS_HOST;

    if (!accountsHost) {
      const error = createErrorWithTrace(
        ERROR_TYPES.INTERNAL,
        'Authentication service not configured',
        req,
        {
          severity: ERROR_SEVERITY.CRITICAL,
          context: 'auth_middleware',
        }
      );
      return next(error);
    }

    const actAs = req?.headers?.actas;
    const token = req.headers.authorization ?? req.query?.accessToken;
    const internalRequest = isRequestInternal(req);

    if (!token) {
      req.user = { isAuthenticated: false, internalRequest };
      next();
      return;
    }

    // Validate token format
    if (typeof token !== 'string' || token.length < 10) {
      const error = createErrorWithTrace(
        ERROR_TYPES.AUTHENTICATION,
        'Invalid token format',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'token_validation',
        }
      );
      return next(error);
    }

    const url = `${accountsHost}/api/v1/auth`;
    const config = {
      headers: {
        Authorization: token,
      },
    };

    const { data } = await axios.get(url, config);

    const clientDetails = data?.client ?? {};

    req.user = {
      actAs,
      id: data?.id,
      username: data?.username,
      firstName: data?.firstName,
      lastName: data?.lastName,
      email: data?.email,
      roleIds: data?.roleIds ?? [],
      roles: data?.roles ?? [],
      roleNames: data?.roleNames ?? [],
      client: clientDetails ?? {},
      accessToken: token,
      isAuthenticated: true,
      internalRequest,
    };

    next();
  } catch (err) {
    // Sanitize error message for logging to prevent sensitive information exposure
    const sanitizedErrorMessage = err.message
      ? err.message
          .replace(/[\r\n\t]/g, ' ')
          .substring(0, 200)
          .trim()
      : 'Authentication error occurred';
    // Log authentication errors securely
    logEvent(`[AUTH_ERROR]: ${sanitizedErrorMessage}`, req.traceId);
    const error = createErrorWithTrace(
      ERROR_TYPES.AUTHENTICATION,
      'Invalid authentication token. Please provide a valid token.',
      req,
      {
        severity: ERROR_SEVERITY.MEDIUM,
        context: 'auth_middleware',
        originalError: err,
      }
    );
    next(error);
  }
}

module.exports = auth;
