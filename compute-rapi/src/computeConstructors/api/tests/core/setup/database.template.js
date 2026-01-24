/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 * DESCRIPTION:
 * ------------------
 * Database utilities for integration tests.
 * - Creates test records with a scoped test prefix for identification
 * - Provides cleanup functions to remove test data
 * - Ensures test isolation between test runs
 * - Provides schema-aware value generation that respects database constraints
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

/**
 * Get the maximum length constraint for a field from Prisma schema
 * @param {string} modelName - Name of the model (PascalCase)
 * @param {string} fieldName - Name of the field
 * @returns {number|null} Maximum length or null if unlimited
 */
const getFieldMaxLength = (modelName, fieldName) => {
  const modelMeta = getModelMeta(modelName);
  if (!modelMeta?.fields) return null;

  const field = modelMeta.fields.find((f) => f.name === fieldName);
  if (!field?.nativeType || !Array.isArray(field.nativeType)) return null;

  const [typeName, typeArgs] = field.nativeType;
  if (typeName === 'VarChar' && Array.isArray(typeArgs) && typeArgs[0]) {
    return parseInt(typeArgs[0], 10);
  }
  return null;
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
        !isUuidField(field),
    )
    .map((field) => field.name);
  return stringFields.length ? stringFields : ['id', 'email', 'name'];
};

/**
 * Generate a short unique suffix for test data
 * @returns {string} Short unique identifier (11 chars, e.g., "971791_abcd")
 */
const generateUniqueSuffix = () => {
  const timestamp = String(Date.now()).slice(-6);
  const random = Math.random().toString(36).substring(2, 6);
  return `${timestamp}_${random}`;
};

/**
 * Generate a test-prefixed identifier
 * @param {string} suffix - Optional suffix for the identifier (kept for backward compatibility)
 * @returns {string} Test-prefixed identifier
 */
const generateTestId = (_suffix = '') => {
  const uniqueSuffix = generateUniqueSuffix();
  const prefix = getTestPrefix();
  // Don't include the model suffix in the ID - it makes values too long
  // The uniqueSuffix alone provides sufficient uniqueness
  return `${prefix}${uniqueSuffix}`;
};

/**
 * Generate a schema-aware test string value that fits within database constraints
 * This is the proper way to generate test data - it reads the schema and truncates if needed
 *
 * @param {string} modelName - Name of the model (PascalCase, e.g., 'Company')
 * @param {string} fieldName - Name of the field (e.g., 'name', 'fax')
 * @param {Object} options - Generation options
 * @param {string} options.uniqueId - Unique identifier to include (default: auto-generated)
 * @param {string} options.suffix - Additional suffix to add (e.g., field name for clarity)
 * @returns {string} Generated test value that fits within schema constraints
 */
const generateTestValue = (modelName, fieldName, options = {}) => {
  const maxLength = getFieldMaxLength(modelName, fieldName);
  const uniqueId = options.uniqueId ?? generateUniqueSuffix();
  const prefix = getTestPrefix();
  const suffix = options.suffix ?? fieldName;

  // Build the ideal value: prefix + uniqueId + suffix
  const idealValue = `${prefix}${uniqueId}_${suffix}`;

  // If no max length or value fits, return ideal value
  if (!maxLength || idealValue.length <= maxLength) {
    return idealValue;
  }

  // Value is too long - truncate intelligently
  // Priority: keep prefix (for cleanup) + uniqueId (for uniqueness)
  const essentialPart = `${prefix}${uniqueId}`;

  if (essentialPart.length >= maxLength) {
    // Even essential part is too long - truncate uniqueId
    const availableForId = maxLength - prefix.length;
    if (availableForId > 0) {
      return `${prefix}${uniqueId.substring(0, availableForId)}`;
    }
    // Extreme case: max length smaller than prefix
    return prefix.substring(0, maxLength);
  }

  // We have room for some of the suffix
  const availableForSuffix = maxLength - essentialPart.length - 1; // -1 for underscore
  if (availableForSuffix > 0) {
    const truncatedSuffix = suffix.substring(0, availableForSuffix);
    return `${essentialPart}_${truncatedSuffix}`;
  }

  return essentialPart;
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
 * Generate a schema-aware test URL that fits within database constraints
 * @param {string} modelName - Name of the model (PascalCase)
 * @param {string} fieldName - Name of the field
 * @returns {string} Generated test URL
 */
const generateTestUrl = (modelName, fieldName) => {
  const maxLength = getFieldMaxLength(modelName, fieldName);
  const uniqueId = generateUniqueSuffix();
  const baseUrl = 'https://example.com/';
  const prefix = getTestPrefix();

  const idealUrl = `${baseUrl}${prefix}${uniqueId}`;

  if (!maxLength || idealUrl.length <= maxLength) {
    return idealUrl;
  }

  // Truncate to fit
  const availableForPath = maxLength - baseUrl.length;
  if (availableForPath > 0) {
    return `${baseUrl}${uniqueId.substring(0, availableForPath)}`;
  }

  return 'https://t.co'.substring(0, maxLength);
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
      } catch (_fieldError) {
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
  generateTestUrl,
  generateTestValue,
  getFieldMaxLength,
  cleanupTestRecords,
  cleanupAllTestRecords,
  getPrismaClient,
  disconnectPrisma,
};
