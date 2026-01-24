/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 * DESCRIPTION:
 * ------------------
 * Domain-specific test helpers extending core setup.
 * Provides utilities for testing interceptors, middleware, and custom routes.
 */

const coreHelpers = require('#tests/core/setup/helpers.js');
const { InterceptorRegistry } = require('#domain/interceptors/interceptor.registry.js');

/**
 * Create a fresh InterceptorRegistry for testing.
 * @returns {InterceptorRegistry}
 */
function createTestRegistry() {
  return new InterceptorRegistry();
}

/**
 * Create a mock interceptor with default implementations.
 * All hooks return passthrough behavior by default.
 *
 * @param {Object} overrides - Hook implementations to override
 * @returns {Object} Mock interceptor
 */
function createMockInterceptor(overrides = {}) {
  return {
    beforeValidate: jest.fn().mockImplementation(async (data) => ({ data })),
    extendSchema: jest.fn().mockImplementation((schema) => schema),
    afterValidate: jest.fn().mockImplementation(async (data) => ({ data })),
    beforeCreate: jest.fn().mockImplementation(async (data) => ({ data })),
    afterCreate: jest.fn().mockImplementation(async (data) => ({ data })),
    beforeUpdate: jest.fn().mockImplementation(async (data) => ({ data })),
    afterUpdate: jest.fn().mockImplementation(async (data) => ({ data })),
    beforeDelete: jest.fn().mockImplementation(async (data) => ({ data })),
    afterDelete: jest.fn().mockImplementation(async (data) => ({ data })),
    beforeList: jest.fn().mockImplementation(async (data) => ({ data })),
    afterList: jest.fn().mockImplementation(async (data) => ({ data })),
    beforeRead: jest.fn().mockImplementation(async (data) => ({ data })),
    afterRead: jest.fn().mockImplementation(async (data) => ({ data })),
    onError: jest.fn().mockImplementation(async (error) => ({ data: { error } })),
    ...overrides,
  };
}

/**
 * Create a test context object for interceptor testing.
 *
 * @param {Object} overrides - Context properties to override
 * @returns {Object} Test context
 */
function createTestContext(overrides = {}) {
  return {
    operation: 'create',
    user: { id: 'test-user-id', email: 'test@example.com' },
    req: {},
    ...overrides,
  };
}

module.exports = {
  // Re-export core helpers
  ...coreHelpers,
  // Domain-specific helpers
  createTestRegistry,
  createMockInterceptor,
  createTestContext,
};

// Also expose globally for convenience
global.createTestRegistry = createTestRegistry;
global.createMockInterceptor = createMockInterceptor;
global.createTestContext = createTestContext;
