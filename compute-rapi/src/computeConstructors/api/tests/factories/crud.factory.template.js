/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 * DESCRIPTION:
 * ------------------
 * Test data factory for ModelName.
 * Creates consistent, valid test data with d_compute_ prefix.
 */

const {
  generateTestEmail,
  generateTestUrl,
  generateTestValue,
  getPrismaClient,
} = require('#tests/core/setup/database.js');
const { DEFAULT_TEST_USER } = require('#tests/core/setup/testTokenUtils.js');
const validator = require('validator');
// @gen:FACTORY_IMPORTS

const DEFAULT_TEST_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DEFAULT_TEST_USER_ID = DEFAULT_TEST_USER?.id || DEFAULT_TEST_UUID;
const DEFAULT_TEST_CLIENT_ID = DEFAULT_TEST_USER?.clientId || DEFAULT_TEST_UUID;
const MODEL_NAME = 'ModelName';

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
 * Build ModelName data without persisting
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} ModelName data object
 */
const buildModelName = (overrides = {}) => {
  const prisma = getPrismaClient();
  const modelMeta = getModelMeta(prisma);
  const modelFields = getModelFields(modelMeta);
  const modelFieldKinds = getModelFieldKinds(modelMeta);

  const baseData = {
    // @gen:FACTORY_BUILD_FIELDS
    ...overrides,
  };

  return applyRequiredFieldDefaults(
    normalizeFactoryData(baseData, modelFields, modelFieldKinds),
    modelMeta
  );
};

/**
 * Build ModelName data for API submission.
 * Creates required related records in the database first, then returns
 * the data object (without saving ModelName itself).
 * Use this for POST/PUT contract tests that need valid foreign keys.
 *
 * @param {Object} overrides - Properties to override defaults
 * @returns {Promise<Object>} ModelName data object with valid foreign keys
 */
const buildModelNameForApi = async (overrides = {}) => {
  // @gen:FACTORY_FOR_API_FK_SETUP

  const data = buildModelName({
    // @gen:FACTORY_FOR_API_FK_DEFAULTS
    ...overrides,
  });

  return data;
};

const normalizeFactoryData = (
  data = {},
  modelFields = new Set(),
  modelFieldKinds = new Map()
) => {
  const normalized = { ...data };

  for (const [key, value] of Object.entries(data)) {
    if (key.endsWith('Id')) {
      if (typeof value === 'string' && !validator.isUUID(value)) {
        const uuidLike =
          /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}$/.test(
            value
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
        value
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
          normalized[idKey] = validator.isUUID(value) ? value : DEFAULT_TEST_UUID;
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
 * Create ModelName in database
 * @param {Object} overrides - Properties to override defaults
 * @returns {Promise<Object>} Created ModelName record
 */
const createModelName = async (overrides = {}) => {
  const prisma = getPrismaClient();
  const modelMeta = getModelMeta(prisma);
  const modelFields = getModelFields(modelMeta);
  const modelFieldKinds = getModelFieldKinds(modelMeta);

  // @gen:FACTORY_FK_SETUP

  const data = buildModelName({
    // @gen:FACTORY_FK_DEFAULTS
    ...overrides,
  });

  return prisma.modelName.create({
    data: normalizeFactoryData(data, modelFields, modelFieldKinds),
  });
};

/**
 * Create multiple ModelNames in database
 * @param {number} count - Number of records to create
 * @param {Object} overrides - Properties to override for all records
 * @returns {Promise<Object[]>} Array of created ModelName records
 */
const createManyModelNames = async (count, overrides = {}) => {
  const records = [];
  for (let i = 0; i < count; i++) {
    const record = await createModelName({
      ...overrides,
      // Add index suffix to make each unique
    });
    records.push(record);
  }
  return records;
};

/**
 * Traits for common ModelName variations
 */
const traits = {
  // Example: incomplete profile
  incomplete: {
    // @gen:TRAIT_INCOMPLETE_FIELDS
  },

  // Example: with relationships
  withRelations: async (modelNameData) => {
    // TODO: Set up related records for testing
    return modelNameData;
  },
};

/**
 * Apply a trait to ModelName data
 * @param {Object} data - Base ModelName data
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
  buildModelName,
  buildModelNameForApi,
  createModelName,
  createManyModelNames,
  traits,
  applyTrait,
};
