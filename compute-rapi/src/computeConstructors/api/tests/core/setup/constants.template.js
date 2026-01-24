/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 * DESCRIPTION:
 * ------------------
 * Test constants and fixtures shared across test suites.
 */

/**
 * Non-existent UUID for 404 testing
 * This UUID is guaranteed to not match any real record
 */
const NON_EXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Invalid UUID format for 400 testing
 */
const INVALID_UUID = 'not-a-valid-uuid';

/**
 * Test data prefix for identification and cleanup
 */
const TEST_PREFIX = 'd_compute_';

module.exports = {
  NON_EXISTENT_UUID,
  INVALID_UUID,
  TEST_PREFIX,
};
