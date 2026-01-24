/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Test data factory for Opportunity.
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
const MODEL_NAME = 'Opportunity';

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
 * Build Opportunity data without persisting
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Opportunity data object
 */
const buildOpportunity = (overrides = {}) => {
  const testId = generateTestId('opportunity');
  const prisma = getPrismaClient();
  const modelMeta = getModelMeta(prisma);
  const modelFields = getModelFields(modelMeta);
  const modelFieldKinds = getModelFieldKinds(modelMeta);

  const baseData = {
    actualValue: 42,
    probability: 42,
    dataSource: `d_compute_${testId}_dataSource`,
    sentiment: 'FEARFUL',
    customerPriority: 'URGENT',
    notes: `d_compute_${testId}_notes`,
    name: `d_compute_${testId}_name`,
    description: `d_compute_${testId}_description`,
    estimatedValue: 42,
    estimatedCloseDate: new Date().toISOString().split('T')[0],
    statusAssignedDate: new Date().toISOString(),
    ...overrides,
  };

  return applyRequiredFieldDefaults(
    normalizeFactoryData(baseData, modelFields, modelFieldKinds),
    modelMeta,
  );
};

/**
 * Build Opportunity data for API submission.
 * Creates required related records in the database first, then returns
 * the data object (without saving Opportunity itself).
 * Use this for POST/PUT contract tests that need valid foreign keys.
 *
 * @param {Object} overrides - Properties to override defaults
 * @returns {Promise<Object>} Opportunity data object with valid foreign keys
 */
const buildOpportunityForApi = async (overrides = {}) => {
  // No internal FK setup needed

  const data = buildOpportunity({
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
 * Create Opportunity in database
 * @param {Object} overrides - Properties to override defaults
 * @returns {Promise<Object>} Created Opportunity record
 */
const createOpportunity = async (overrides = {}) => {
  const prisma = getPrismaClient();
  const modelMeta = getModelMeta(prisma);
  const modelFields = getModelFields(modelMeta);
  const modelFieldKinds = getModelFieldKinds(modelMeta);

  // No internal FK setup needed

  const data = buildOpportunity({
    ...overrides,
  });

  return prisma.opportunity.create({
    data: normalizeFactoryData(data, modelFields, modelFieldKinds),
  });
};

/**
 * Create multiple Opportunitys in database
 * @param {number} count - Number of records to create
 * @param {Object} overrides - Properties to override for all records
 * @returns {Promise<Object[]>} Array of created Opportunity records
 */
const createManyOpportunitys = async (count, overrides = {}) => {
  const records = [];
  for (let i = 0; i < count; i++) {
    const record = await createOpportunity({
      ...overrides,
      // Add index suffix to make each unique
    });
    records.push(record);
  }
  return records;
};

/**
 * Traits for common Opportunity variations
 */
const traits = {
  // Example: incomplete profile
  incomplete: {
    actualValue: null,
    probability: null,
    dataSource: null,
  },

  // Example: with relationships
  withRelations: async (opportunityData) => {
    // TODO: Set up related records for testing
    return modelNameData;
    return opportunityData;
  },
};

/**
 * Apply a trait to Opportunity data
 * @param {Object} data - Base Opportunity data
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
  buildOpportunity,
  buildOpportunityForApi,
  createOpportunity,
  createManyOpportunitys,
  traits,
  applyTrait,
};
