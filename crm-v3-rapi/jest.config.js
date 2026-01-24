/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Multi-project Jest configuration for comprehensive testing strategy.
 * Projects run in order: core (boot → unit → integration → contracts) → domain (unit → integration → contracts)
 */

module.exports = {
  // Global test timeout (per-project timeouts set via jest.setTimeout in setup files)
  testTimeout: 30000,
  // Run projects in sequence for proper test isolation
  projects: [
    // === CORE TESTS (generated code) ===

    // 1. Boot/Smoke tests - fail fast on initialization issues
    {
      displayName: 'core:boot',
      testMatch: ['<rootDir>/tests/core/boot/**/*.test.js'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/core/setup/helpers-boot.js'],
    },
    // 2. Core unit tests - fast, isolated, mocked dependencies
    {
      displayName: 'core:unit',
      testMatch: ['<rootDir>/tests/core/unit/**/*.test.js'],
      testEnvironment: 'node',
    },
    // 3. Core integration tests - real database, no mocking Prisma
    {
      displayName: 'core:integration',
      testMatch: ['<rootDir>/tests/core/integration/**/*.test.js'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/core/setup/helpers.js'],
      maxWorkers: 1,
    },
    // 4. Core contract tests - validate API response schemas
    {
      displayName: 'core:contracts',
      testMatch: ['<rootDir>/tests/core/contracts/**/*.test.js'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/core/setup/helpers.js'],
      maxWorkers: 1,
    },

    // === DOMAIN TESTS (custom code) ===

    // 5. Domain unit tests - interceptors, middleware, schemas, routes, queues
    {
      displayName: 'domain:unit',
      testMatch: ['<rootDir>/tests/domain/unit/**/*.test.js'],
      testEnvironment: 'node',
    },
    // 6. Domain integration tests - with real DB and dependencies
    {
      displayName: 'domain:integration',
      testMatch: ['<rootDir>/tests/domain/integration/**/*.test.js'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/domain/setup/helpers.js'],
      maxWorkers: 1,
    },
    // 7. Domain contract tests - custom route response schemas
    {
      displayName: 'domain:contracts',
      testMatch: ['<rootDir>/tests/domain/contracts/**/*.test.js'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/domain/setup/helpers.js'],
      maxWorkers: 1,
    },
  ],
  // Global settings
  verbose: true,
  collectCoverage: false,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
};
