/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 * DESCRIPTION:
 * ------------------
 * Lightweight test helpers for boot/smoke tests.
 * Includes full cleanup to ensure Jest exits cleanly.
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

// Extend Jest timeout for boot tests
jest.setTimeout(30000);

// Global afterAll to cleanup all resources
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
 * Create a delay (useful for testing async operations)
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
  waitFor,
  delay,
};

// Also expose globally for convenience
global.waitFor = waitFor;
global.delay = delay;
