/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 * DESCRIPTION:
 * ------------------
 * Authentication middleware with dependency injection for testing.
 *
 * Production: Uses httpTokenValidator to validate JWTs via accounts-node-rapi
 * Testing: Accepts injected mockTokenValidator for local JWT verification
 */

const axios = require('axios');
const { isRequestInternal } = require('#utils/generalUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { logEvent } = require('#utils/loggingUtils.js');
const { createErrorWithTrace } = require('#utils/traceUtils.js');

/**
 * HTTP token validator - validates tokens against accounts-node-rapi.
 * This is the default validator used in production.
 *
 * @param {string} token - Authorization header value
 * @param {Request} req - Express request object
 * @returns {Promise<Object>} User data from accounts service
 */
// eslint-disable-next-line no-unused-vars
async function httpTokenValidator(token, req) {
  const accountsHost = process.env.ACCOUNTS_HOST;

  if (!accountsHost) {
    throw new Error('Authentication service not configured');
  }

  const { data } = await axios.get(`${accountsHost}/api/v1/auth`, {
    headers: { Authorization: token },
  });

  return {
    id: data?.id,
    username: data?.username,
    firstName: data?.firstName,
    lastName: data?.lastName,
    email: data?.email,
    roleIds: data?.roleIds ?? [],
    roles: data?.roles ?? [],
    roleNames: data?.roleNames ?? [],
    client: data?.client ?? {},
  };
}

/**
 * Factory function to create auth middleware with injectable validator.
 *
 * @param {Function} tokenValidator - Async function that validates tokens
 * @returns {Function} Express middleware function
 *
 * @example
 * // Production (default)
 * const auth = createAuthMiddleware();
 *
 * // Testing
 * const auth = createAuthMiddleware(mockTokenValidator);
 */
function createAuthMiddleware(tokenValidator = httpTokenValidator) {
  return async function auth(req, res, next) {
    try {
      // Extract timezone from request header (defaults to UTC)
      const headerTimezone =
        req.headers?.['x-timezone'] || req.headers?.['X-Timezone'];
      req.timezone =
        headerTimezone && typeof headerTimezone === 'string'
          ? headerTimezone.trim() || 'UTC'
          : 'UTC';

      const actAs = req?.headers?.actas;
      const token = req.headers.authorization ?? req.query?.accessToken;
      const internalRequest = isRequestInternal(req);

      if (!token) {
        // Allow anonymous/internal flows
        const bodyCreatedBy =
          req?.body?.createdBy ||
          req?.body?.created_by ||
          req?.query?.createdBy ||
          req?.query?.created_by;
        const bodyClient = req?.body?.client || req?.query?.client;

        req.user = {
          isAuthenticated: false,
          internalRequest,
          id: bodyCreatedBy || null,
          client: bodyClient ? { id: bodyClient } : {},
          actAs,
        };
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

      // Use injected validator to validate token and get user data
      const userData = await tokenValidator(token, req);

      req.user = {
        ...userData,
        actAs,
        accessToken: token,
        isAuthenticated: true,
        internalRequest,
      };

      next();
    } catch (err) {
      const sanitizedErrorMessage = err.message
        ? err.message
            .replace(/[\r\n\t]/g, ' ')
            .substring(0, 200)
            .trim()
        : 'Authentication error occurred';

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
  };
}

// Default middleware instance for backward compatibility
const defaultAuthMiddleware = createAuthMiddleware();

// Export default middleware (routes can use directly)
module.exports = defaultAuthMiddleware;

// Export factory and validator for testing and advanced use cases
module.exports.createAuthMiddleware = createAuthMiddleware;
module.exports.httpTokenValidator = httpTokenValidator;
