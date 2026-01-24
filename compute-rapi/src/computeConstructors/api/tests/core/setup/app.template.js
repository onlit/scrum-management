/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 * DESCRIPTION:
 * ------------------
 * Test app factory for integration and contract tests.
 * Creates a configured Express app instance with mock authentication.
 */

const http = require('http');
const { initializeApp } = require('#src/app.js');
const { createAuthMiddleware } = require('#middlewares/auth.js');
const { createMockTokenValidator } = require('./mockTokenValidator.js');
const {
  createAuthHeaders,
  createTestToken,
  createAuthHeaderValue,
  DEFAULT_TEST_USER,
} = require('./testTokenUtils.js');

const DEFAULT_TEST_HOST = '127.0.0.1';

const servers = new Set();
let testApp = null;

/**
 * Get or create the test Express application.
 * Uses mock token validator for authentication.
 *
 * @returns {Promise<Express>} Test application instance
 */
async function getTestApp() {
  if (testApp) {
    return testApp;
  }

  // Create mock validator and auth middleware
  const mockValidator = createMockTokenValidator();
  const testAuthMiddleware = createAuthMiddleware(mockValidator);

  // Initialize app with test auth
  testApp = await initializeApp({
    authMiddleware: testAuthMiddleware,
  });

  return testApp;
}

/**
 * Create a test HTTP server wrapping the app.
 *
 * @returns {Server} HTTP server instance
 */
const createTestServer = async () => {
  const app = await getTestApp();
  const server = http.createServer(app);

  servers.add(server);
  return server;
};

const waitForServerListen = (server, port) =>
  new Promise((resolve, reject) => {
    const handleError = (error) => {
      server.off('listening', handleListen);
      reject(error);
    };
    const handleListen = () => {
      server.off('error', handleError);
      resolve();
    };
    server.once('error', handleError);
    server.listen(port, DEFAULT_TEST_HOST, handleListen);
  });

/**
 * Create and start a test server.
 *
 * @param {number} port - Port to listen on (default: 0 for random)
 * @returns {Promise<Server>} Started server instance
 */
const startTestServer = async (port = 0) => {
  const server = await createTestServer();
  await waitForServerListen(server, port);
  return server;
};

/**
 * Create a mock authenticated user object for test assertions.
 *
 * @param {Object} overrides - Override default user properties
 * @returns {Object} Mock user object
 */
const createMockUser = (overrides = {}) => ({
  ...DEFAULT_TEST_USER,
  isAuthenticated: true,
  ...overrides,
});

/**
 * Close all test servers and cleanup resources.
 */
const closeTestServers = async () => {
  const closing = Array.from(servers).map(
    (server) =>
      new Promise((resolve) => {
        if (server.listening) {
          server.close(resolve);
          return;
        }
        resolve();
      })
  );
  await Promise.all(closing);
  servers.clear();
  testApp = null;
};

module.exports = {
  getTestApp,
  createTestServer,
  startTestServer,
  closeTestServers,
  createMockUser,
  // Re-export auth helpers for convenience
  createAuthHeaders,
  createTestToken,
  createAuthHeaderValue,
  DEFAULT_TEST_USER,
};
