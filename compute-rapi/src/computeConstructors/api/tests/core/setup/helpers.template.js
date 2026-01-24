/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 * DESCRIPTION:
 * ------------------
 * Common test helpers and Jest setup for all test types.
 * Loaded via setupFilesAfterEnv in jest.config.js
 */

const { disconnectPrisma } = require('#tests/core/setup/database.js');
const { closeTestServers } = require('#tests/core/setup/app.js');
const { stopCleanup } = require('#middlewares/securityLogger.js');

// Provide safe defaults for CORS config during tests
if (!process.env.CORS_HOSTS) {
  process.env.CORS_HOSTS = 'localhost';
}
if (!process.env.ALLOWED_SUB_DOMAINS) {
  process.env.ALLOWED_SUB_DOMAINS = 'test';
}

// Extend Jest timeout for integration tests
jest.setTimeout(30000);

// Global afterAll to disconnect Prisma and cleanup resources
afterAll(async () => {
  stopCleanup(); // Clear securityLogger intervals
  await closeTestServers();
  await disconnectPrisma();
});

/**
 * Wait for a condition to be true (for async operations)
 * @param {Function} condition - Function that returns boolean
 * @param {Object} options - Options
 * @param {number} options.timeout - Max wait time in ms (default: 5000)
 * @param {number} options.interval - Check interval in ms (default: 100)
 * @returns {Promise<void>}
 */
const waitFor = async (condition, options = {}) => {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`waitFor timed out after ${timeout}ms`);
};

/**
 * Assert that a Joi schema validates successfully
 * @param {Object} schema - Joi schema
 * @param {*} value - Value to validate
 * @param {string} message - Custom error message
 */
const expectValidSchema = (schema, value, message = '') => {
  const { error } = schema.validate(value, { abortEarly: false });
  if (error) {
    const details = error.details.map((d) => d.message).join(', ');
    throw new Error(
      `Schema validation failed${message ? ` (${message})` : ''}: ${details}`
    );
  }
};

/**
 * Assert that a Joi schema fails validation
 * @param {Object} schema - Joi schema
 * @param {*} value - Value to validate
 * @param {string} expectedError - Expected error message substring (optional)
 */
const expectInvalidSchema = (schema, value, expectedError = '') => {
  const { error } = schema.validate(value, { abortEarly: false });
  if (!error) {
    throw new Error('Expected schema validation to fail, but it succeeded');
  }
  if (expectedError && !error.message.includes(expectedError)) {
    throw new Error(
      `Expected error containing "${expectedError}", got: ${error.message}`
    );
  }
};

/**
 * Create a delay (useful for testing async operations)
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
  waitFor,
  expectValidSchema,
  expectInvalidSchema,
  delay,
};

// Also expose globally for convenience
global.waitFor = waitFor;
global.expectValidSchema = expectValidSchema;
global.expectInvalidSchema = expectInvalidSchema;
global.delay = delay;
