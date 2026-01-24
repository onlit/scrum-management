/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Test data factory for CallSchedule.
 * Creates consistent, valid test data with d_compute_ prefix.
 */

const {
  generateTestId,
  generateTestEmail,
  getPrismaClient,
} = require('#tests/core/setup/database.js');
const { DEFAULT_TEST_USER } = require('#tests/core/setup/testTokenUtils.js');
const validator = require('validator');
const {
  createCallListPipelineStage,
} = require('#tests/factories/callListPipelineStage.factory.js');
const { createPerson } = require('#tests/factories/person.factory.js');

const DEFAULT_TEST_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DEFAULT_TEST_USER_ID = DEFAULT_TEST_USER?.id || DEFAULT_TEST_UUID;
const DEFAULT_TEST_CLIENT_ID = DEFAULT_TEST_USER?.clientId || DEFAULT_TEST_UUID;
const MODEL_NAME = 'CallSchedule';

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
 * Build CallSchedule data without persisting
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} CallSchedule data object
 */
const buildCallSchedule = (overrides = {}) => {
  const testId = generateTestId('callSchedule');
  const prisma = getPrismaClient();
  const modelMeta = getModelMeta(prisma);
  const modelFields = getModelFields(modelMeta);
  const modelFieldKinds = getModelFieldKinds(modelMeta);

  const baseData = {
    scheduleDatetime: new Date().toISOString(),
    ...overrides,
  };

  return applyRequiredFieldDefaults(
    normalizeFactoryData(baseData, modelFields, modelFieldKinds),
    modelMeta,
  );
};

/**
 * Build CallSchedule data for API submission.
 * Creates required related records in the database first, then returns
 * the data object (without saving CallSchedule itself).
 * Use this for POST/PUT contract tests that need valid foreign keys.
 *
 * @param {Object} overrides - Properties to override defaults
 * @returns {Promise<Object>} CallSchedule data object with valid foreign keys
 */
const buildCallScheduleForApi = async (overrides = {}) => {
  const callListPipelineStage = overrides.callListPipelineStageId
    ? null
    : await createCallListPipelineStage();
  const person = overrides.personId ? null : await createPerson();

  const data = buildCallSchedule({
    callListPipelineStageId:
      overrides.callListPipelineStageId || callListPipelineStage?.id,
    personId: overrides.personId || person?.id,
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
 * Create CallSchedule in database
 * @param {Object} overrides - Properties to override defaults
 * @returns {Promise<Object>} Created CallSchedule record
 */
const createCallSchedule = async (overrides = {}) => {
  const prisma = getPrismaClient();
  const modelMeta = getModelMeta(prisma);
  const modelFields = getModelFields(modelMeta);
  const modelFieldKinds = getModelFieldKinds(modelMeta);

  const callListPipelineStage = overrides.callListPipelineStageId
    ? null
    : await createCallListPipelineStage();
  const person = overrides.personId ? null : await createPerson();

  const data = buildCallSchedule({
    callListPipelineStageId: callListPipelineStage?.id,
    personId: person?.id,
    ...overrides,
  });

  return prisma.callSchedule.create({
    data: normalizeFactoryData(data, modelFields, modelFieldKinds),
  });
};

/**
 * Create multiple CallSchedules in database
 * @param {number} count - Number of records to create
 * @param {Object} overrides - Properties to override for all records
 * @returns {Promise<Object[]>} Array of created CallSchedule records
 */
const createManyCallSchedules = async (count, overrides = {}) => {
  const records = [];
  for (let i = 0; i < count; i++) {
    const record = await createCallSchedule({
      ...overrides,
      // Add index suffix to make each unique
    });
    records.push(record);
  }
  return records;
};

/**
 * Traits for common CallSchedule variations
 */
const traits = {
  // Example: incomplete profile
  incomplete: {
    // No optional fields to set as null
  },

  // Example: with relationships
  withRelations: async (callScheduleData) => {
    // TODO: Set up related records for testing
    return modelNameData;
    return callScheduleData;
  },
};

/**
 * Apply a trait to CallSchedule data
 * @param {Object} data - Base CallSchedule data
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
  buildCallSchedule,
  buildCallScheduleForApi,
  createCallSchedule,
  createManyCallSchedules,
  traits,
  applyTrait,
};
