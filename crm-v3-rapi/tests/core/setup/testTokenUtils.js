/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Test JWT utilities for integration tests.
 * Creates signed JWTs that the mock validator can verify locally.
 *
 * SECURITY: This file is in tests/, not deployed to production.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Test JWT secret - cryptographically secure.
 *
 * Security design:
 * 1. Generated using crypto.randomBytes() with 256-bit entropy
 * 2. Unique per test run - prevents secret reuse across environments
 * 3. Can be overridden via TEST_JWT_SECRET env var for CI/CD reproducibility
 * 4. This file is in tests/, not deployed to production
 * 5. Test JWTs won't validate against production accounts-node-rapi
 */
const TEST_JWT_SECRET =
  process.env.TEST_JWT_SECRET || crypto.randomBytes(32).toString('base64');

/**
 * Default test user matching existing test data patterns
 */
const DEFAULT_TEST_USER = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'd_compute_user@test.example.com',
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  roles: ['recruiter'],
  roleIds: ['role_recruiter'],
  roleNames: ['Recruiter'],
  clientId: '22222222-2222-4222-8222-222222222222',
  clientDomain: 'test.pullstream.com',
};

/**
 * Create a signed test JWT.
 *
 * @param {Object} userOverrides - Override default user properties
 * @returns {string} Signed JWT token
 *
 * @example
 * const token = createTestToken();
 * const adminToken = createTestToken({ roles: ['admin'] });
 */
function createTestToken(userOverrides = {}) {
  const user = { ...DEFAULT_TEST_USER, ...userOverrides };

  const payload = {
    sub: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: user.roles,
    roleIds: user.roleIds,
    roleNames: user.roleNames,
    clientId: user.clientId,
    clientDomain: user.clientDomain,
  };

  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Create Authorization header value with Bearer prefix.
 *
 * @param {Object} userOverrides - Override default user properties
 * @returns {string} Authorization header value
 *
 * @example
 * request(app)
 *   .get('/api/v1/candidates')
 *   .set('Authorization', createAuthHeaderValue())
 */
function createAuthHeaderValue(userOverrides = {}) {
  return `Bearer ${createTestToken(userOverrides)}`;
}

/**
 * Create headers object for supertest .set() method.
 *
 * @param {Object} userOverrides - Override default user properties
 * @returns {Object} Headers object with Authorization
 *
 * @example
 * request(app)
 *   .get('/api/v1/candidates')
 *   .set(createAuthHeaders())
 */
function createAuthHeaders(userOverrides = {}) {
  return {
    Authorization: createAuthHeaderValue(userOverrides),
  };
}

module.exports = {
  TEST_JWT_SECRET,
  DEFAULT_TEST_USER,
  createTestToken,
  createAuthHeaderValue,
  createAuthHeaders,
};
