/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 * DESCRIPTION:
 * ------------------
 * Mock token validator for integration tests.
 * Verifies JWTs signed with the test secret and extracts user claims.
 *
 * SECURITY: Multiple defense layers prevent production use:
 * 1. File lives in tests/, not src/
 * 2. NODE_ENV !== 'test' throws error
 * 3. Production never imports this module
 */

const jwt = require('jsonwebtoken');
const { TEST_JWT_SECRET } = require('./testTokenUtils.js');

/**
 * Create a mock token validator for integration tests.
 * Verifies JWTs signed with the test secret and extracts user claims.
 *
 * SECURITY: This function includes a runtime check to prevent
 * accidental use outside of the test environment.
 *
 * @returns {Function} Token validator function
 * @throws {Error} If called outside test environment
 */
function createMockTokenValidator() {
  // Defense layer: Runtime environment check
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      'SECURITY: MockTokenValidator cannot run outside test environment. ' +
        'If you see this error in production, there is a serious misconfiguration. ' +
        'The mock validator should only exist in the tests/ directory, ' +
        'which should not be deployed to production.'
    );
  }

  /**
   * Validate a test JWT and extract user claims.
   *
   * @param {string} token - JWT token (with or without Bearer prefix)
   * @param {Request} req - Express request (unused, for interface compatibility)
   * @returns {Promise<Object>} User data extracted from token
   * @throws {Error} If token is invalid or expired
   */
  // eslint-disable-next-line no-unused-vars
  return async function mockTokenValidator(token, req) {
    // Strip "Bearer " prefix if present
    const rawToken = token.startsWith('Bearer ') ? token.slice(7) : token;

    // Verify signature and decode payload
    // This will throw if:
    // - Token is malformed
    // - Signature doesn't match TEST_JWT_SECRET
    // - Token is expired
    const decoded = jwt.verify(rawToken, TEST_JWT_SECRET);

    // Return user payload matching httpTokenValidator format
    return {
      id: decoded.sub,
      email: decoded.email,
      username: decoded.username,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
      roles: decoded.roles ?? [],
      roleIds: decoded.roleIds ?? [],
      roleNames: decoded.roleNames ?? [],
      client: {
        id: decoded.clientId,
        domain: decoded.clientDomain,
      },
    };
  };
}

module.exports = { createMockTokenValidator };
