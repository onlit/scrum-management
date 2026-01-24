/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Test data factory for ClientHistory.
 * Creates consistent, valid test data with d_compute_ prefix.
 */

const {
  generateTestId,
  generateTestEmail,
  getPrismaClient,
} = require('#tests/core/setup/database.js');
const { DEFAULT_TEST_USER } = require('#tests/core/setup/testTokenUtils.js');
const validator = require('validator');

const DEFAULT_TEST_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DEFAULT_TEST_USER_ID = DEFAULT_TEST_USER?.id || DEFAULT_TEST_UUID;
const DEFAULT_TEST_CLIENT_ID = DEFAULT_TEST_USER?.clientId || DEFAULT_TEST_UUID;
const MODEL_NAME = 'ClientHistory';

const getModelMeta = (prismaClient) => {
  const models = prismaClient?._runtimeDataModel?.models;
  if (!models) {
    return null;
  }
  if (Array.isArray(models)) {
    return models.find((entry) => entry.name === MODEL_NAME) || null;
  }
  return models[MODEL_NAME] || null;
};

const getModelFields = (modelMeta) =>
  new Set(modelMeta?.fields?.map((field) => field.name) ?? []);

const getModelFieldKinds = (modelMeta) =>
  new Map(modelMeta?.fields?.map((field) => [field.name, field.kind]) ?? []);

/**
 * Build ClientHistory data without persisting
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} ClientHistory data object
 */
const buildClientHistory = (overrides = {}) => {
  const testId = generateTestId('clientHistory');
  const prisma = getPrismaClient();
  const modelMeta = getModelMeta(prisma);
  const modelFields = getModelFields(modelMeta);
  const modelFieldKinds = getModelFieldKinds(modelMeta);

  const baseData = {
    url: `https://example.com/d_compute_${testId}`,
    ...overrides,
  };

  return applyRequiredFieldDefaults(
    normalizeFactoryData(baseData, modelFields, modelFieldKinds),
    modelMeta,
  );
};

/**
 * Build ClientHistory data for API submission.
 * Creates required related records in the database first, then returns
 * the data object (without saving ClientHistory itself).
 * Use this for POST/PUT contract tests that need valid foreign keys.
 *
 * @param {Object} overrides - Properties to override defaults
 * @returns {Promise<Object>} ClientHistory data object with valid foreign keys
 */
const buildClientHistoryForApi = async (overrides = {}) => {
  // No internal FK setup needed

  const data = buildClientHistory({
    ...overrides,
  });

  return data;
};

const normalizeFactoryData = (
  data = {},
  modelFields = new Set(),
  modelFieldKinds = new Map(),
) => {
  const normalized = { ...data };

  for (const [key, value] of Object.entries(data)) {
    if (key.endsWith('Id')) {
      if (typeof value === 'string' && !validator.isUUID(value)) {
        const uuidLike =
          /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}$/.test(
            value,
          );
        normalized[key] = uuidLike ? DEFAULT_TEST_UUID : value;
      }
      continue;
    }

    if (
      key !== 'id' &&
      !key.endsWith('Id') &&
      typeof value === 'string' &&
      /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}$/.test(
        value,
      )
    ) {
      const idKey = `${key}Id`;
      const hasModelMeta = modelFieldKinds.size > 0;
      const canConvert =
        !hasModelMeta ||
        (!modelFieldKinds.has(key) && modelFieldKinds.has(idKey)) ||
        (modelFieldKinds.get(key) === 'object' && modelFieldKinds.has(idKey));
      if (canConvert) {
        if (!(idKey in normalized)) {
          normalized[idKey] = validator.isUUID(value)
            ? value
            : DEFAULT_TEST_UUID;
        }
        delete normalized[key];
      }
    }
  }

  if (modelFields.has('client') && normalized.client == null) {
    normalized.client = DEFAULT_TEST_CLIENT_ID;
  }
  if (modelFields.has('createdBy') && normalized.createdBy == null) {
    normalized.createdBy = DEFAULT_TEST_USER_ID;
  }
  if (modelFields.has('updatedBy') && normalized.updatedBy == null) {
    normalized.updatedBy = DEFAULT_TEST_USER_ID;
  }

  return normalized;
};

const applyRequiredFieldDefaults = (data = {}, modelMeta = null) => {
  if (!modelMeta?.fields?.length) {
    return data;
  }

  const next = { ...data };
  for (const field of modelMeta.fields) {
    if (!field?.isRequired || field?.kind !== 'scalar') {
      continue;
    }
    if (field.name === 'id') {
      continue;
    }
    const isUuidField =
      field.name.endsWith('Id') ||
      field.name === 'client' ||
      field.name === 'createdBy' ||
      field.name === 'updatedBy';
    if (!isUuidField) {
      continue;
    }
    if (next[field.name] == null) {
      if (field.name === 'client') {
        next[field.name] = DEFAULT_TEST_CLIENT_ID;
      } else if (field.name === 'createdBy' || field.name === 'updatedBy') {
        next[field.name] = DEFAULT_TEST_USER_ID;
      } else {
        next[field.name] = DEFAULT_TEST_UUID;
      }
    }
  }

  return next;
};

/**
 * Create ClientHistory in database
 * @param {Object} overrides - Properties to override defaults
 * @returns {Promise<Object>} Created ClientHistory record
 */
const createClientHistory = async (overrides = {}) => {
  const prisma = getPrismaClient();
  const modelMeta = getModelMeta(prisma);
  const modelFields = getModelFields(modelMeta);
  const modelFieldKinds = getModelFieldKinds(modelMeta);

  // No internal FK setup needed

  const data = buildClientHistory({
    ...overrides,
  });

  return prisma.clientHistory.create({
    data: normalizeFactoryData(data, modelFields, modelFieldKinds),
  });
};

/**
 * Create multiple ClientHistorys in database
 * @param {number} count - Number of records to create
 * @param {Object} overrides - Properties to override for all records
 * @returns {Promise<Object[]>} Array of created ClientHistory records
 */
const createManyClientHistorys = async (count, overrides = {}) => {
  const records = [];
  for (let i = 0; i < count; i++) {
    const record = await createClientHistory({
      ...overrides,
      // Add index suffix to make each unique
    });
    records.push(record);
  }
  return records;
};

/**
 * Traits for common ClientHistory variations
 */
const traits = {
  // Example: incomplete profile
  incomplete: {
    // No optional fields to set as null
  },

  // Example: with relationships
  withRelations: async (clientHistoryData) => {
    // TODO: Set up related records for testing
    return modelNameData;
    return clientHistoryData;
  },
};

/**
 * Apply a trait to ClientHistory data
 * @param {Object} data - Base ClientHistory data
 * @param {string} traitName - Name of trait to apply
 * @returns {Object|Promise<Object>} Modified data
 */
const applyTrait = (data, traitName) => {
  const trait = traits[traitName];
  if (!trait) {
    throw new Error(`Unknown trait: ${traitName}`);
  }

  if (typeof trait === 'function') {
    return trait(data);
  }

  return { ...data, ...trait };
};

module.exports = {
  buildClientHistory,
  buildClientHistoryForApi,
  createClientHistory,
  createManyClientHistorys,
  traits,
  applyTrait,
};
