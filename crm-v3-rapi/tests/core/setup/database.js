/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Database utilities for integration tests.
 * - Creates test records with a scoped test prefix for identification
 * - Provides cleanup functions to remove test data
 * - Ensures test isolation between test runs
 */

const crypto = require('crypto');
const prisma = require('#configs/prisma.js');
const { TEST_PREFIX } = require('#tests/core/setup/constants.js');

let cachedScopedPrefix = null;

const getScopedTestPrefix = () => {
  if (cachedScopedPrefix) {
    return cachedScopedPrefix;
  }
  const testPath = global.expect?.getState?.().testPath;
  if (!testPath) {
    return TEST_PREFIX;
  }
  const hash = crypto.createHash('sha1').update(testPath).digest('hex').slice(0, 8);
  cachedScopedPrefix = `${TEST_PREFIX}${hash}_`;
  return cachedScopedPrefix;
};

const getTestPrefix = () => process.env.TEST_PREFIX || getScopedTestPrefix();

const getModelMeta = (modelName) => {
  const models = prisma?._runtimeDataModel?.models;
  if (!models) {
    return null;
  }
  if (Array.isArray(models)) {
    return models.find((entry) => entry.name === modelName) || null;
  }
  return models[modelName] || null;
};

const isUuidField = (field) => {
  const nativeType = Array.isArray(field?.nativeType)
    ? field.nativeType[0]
    : field?.nativeType;
  return nativeType === 'Uuid';
};

const getDefaultIdentifierFields = (modelName) => {
  const modelMeta = getModelMeta(modelName);
  if (!modelMeta?.fields?.length) {
    return ['id', 'email', 'name'];
  }
  const stringFields = modelMeta.fields
    .filter(
      (field) =>
        field?.kind === 'scalar' &&
        field?.type === 'String' &&
        !field?.isList &&
        !isUuidField(field)
    )
    .map((field) => field.name);
  return stringFields.length ? stringFields : ['id', 'email', 'name'];
};

/**
 * Generate a test-prefixed identifier
 * @param {string} suffix - Optional suffix for the identifier
 * @returns {string} Test-prefixed identifier
 */
const generateTestId = (suffix = '') => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const prefix = getTestPrefix();
  return `${prefix}${timestamp}_${random}${suffix ? `_${suffix}` : ''}`;
};

/**
 * Generate test email with the active test prefix
 * @param {string} suffix - Optional suffix
 * @returns {string} Test email address
 */
const generateTestEmail = (suffix = '') => {
  const id = generateTestId(suffix);
  return `${id}@test.example.com`;
};

/**
 * Clean up all test records from a model
 * Removes records where identifying fields start with the active test prefix
 *
 * IMPORTANT: This cleanup method relies on string fields that start with the test prefix.
 * UUID primary keys will NOT be matched by this cleanup since UUIDs don't start with the test prefix.
 * To ensure proper cleanup:
 * - Use test-prefixed values for string fields (name, email, code, etc.)
 * - The cleanup will find records through these string fields, not the UUID id
 * - Always create test records using factory functions that apply the test prefix
 *
 * @param {string} modelName - Prisma model name (e.g., 'user', 'candidate')
 * @param {Object} options - Cleanup options
 * @param {string[]} options.identifierFields - Fields to check for test prefix (auto-detected when omitted)
 */
const cleanupTestRecords = async (modelName, options = {}) => {
  const identifierFields = Array.isArray(options.identifierFields) && options.identifierFields.length
    ? options.identifierFields
    : getDefaultIdentifierFields(modelName);

  const model = prisma[modelName];
  if (!model) {
    console.warn(`Model ${modelName} not found in Prisma client`);
    return { count: 0 };
  }

  // Build OR conditions for each identifier field
  const orConditions = identifierFields
    .map((field) => ({
      [field]: { startsWith: getTestPrefix() },
    }))
    .filter(Boolean);

  if (orConditions.length === 0) {
    return { count: 0 };
  }

  try {
    const result = await model.deleteMany({
      where: { OR: orConditions },
    });
    return result;
  } catch (error) {
    // Field might not exist on model, try each field individually
    if (process.env.DEBUG_TESTS) {
      console.debug(`[cleanup] Bulk cleanup failed for ${modelName}, trying individual fields:`, error.message);
    }
    let totalDeleted = 0;
    for (const condition of orConditions) {
      try {
        const result = await model.deleteMany({ where: condition });
        totalDeleted += result.count;
      } catch (fieldError) {
        // Field doesn't exist on this model, skip silently
        if (process.env.DEBUG_TESTS) {
          const fieldName = Object.keys(condition)[0];
          console.debug(`[cleanup] Field '${fieldName}' not found on ${modelName}, skipping`);
        }
      }
    }
    return { count: totalDeleted };
  }
};

/**
 * Clean up all test records from multiple models
 * @param {string[]} modelNames - Array of Prisma model names
 */
const cleanupAllTestRecords = async (modelNames) => {
  const results = {};
  for (const modelName of modelNames) {
    results[modelName] = await cleanupTestRecords(modelName);
  }
  return results;
};

/**
 * Get Prisma client for tests
 * @returns {PrismaClient} Prisma client instance
 */
const getPrismaClient = () => prisma;

/**
 * Disconnect Prisma client (call in afterAll)
 */
const disconnectPrisma = async () => {
  await prisma.$disconnect();
};

module.exports = {
  TEST_PREFIX,
  generateTestId,
  generateTestEmail,
  cleanupTestRecords,
  cleanupAllTestRecords,
  getPrismaClient,
  disconnectPrisma,
};
