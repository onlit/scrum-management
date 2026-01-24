/**
 * Vector Migration Utilities
 *
 * Utilities for generating pgvector-compatible migrations including:
 * - Extension setup
 * - Vector column creation
 * - HNSW and IVFFlat index generation
 *
 * @module utils/api/vectorMigrationUtils
 */

const _ = require('lodash');
const { toSnakeCase } = require('#utils/shared/stringUtils.js');

/**
 * pgvector operator classes for each distance metric
 */
const DISTANCE_OPS = {
  Cosine: 'vector_cosine_ops',
  L2: 'vector_l2_ops',
  InnerProduct: 'vector_ip_ops',
};

/**
 * Default index parameters
 */
const DEFAULT_INDEX_PARAMS = {
  HNSW: {
    m: 16,          // Max connections per layer (2-100)
    efConstruct: 64, // Construction search width (4-1000)
  },
  IVFFlat: {
    lists: 100,      // Number of inverted lists
  },
};

/**
 * Extract vector field configurations from models
 *
 * @param {Array} models - Array of model definitions with fieldDefns
 * @returns {Array} Array of vector field configurations
 */
function extractVectorFields(models) {
  return _.flatMap(models, (model) =>
    _.chain(model.fieldDefns || model.fields || [])
      .filter((field) => field.dataType === 'Vector')
      .map((field) => ({
        modelName: model.name,
        tableName: toSnakeCase(model.name),
        fieldName: field.name,
        columnName: toSnakeCase(field.name),
        dimension: field.vectorDimension,
        distanceMetric: field.vectorDistanceMetric || 'Cosine',
        indexType: field.vectorIndexType || 'HNSW',
        indexConfig: _.get(field, 'vectorIndexConfigs[0]', {}),
      }))
      .value()
  );
}

/**
 * Generate SQL for enabling pgvector extension
 *
 * @returns {string} SQL statement
 */
function generateExtensionSQL() {
  return 'CREATE EXTENSION IF NOT EXISTS vector;';
}

/**
 * Generate SQL for creating a vector index
 *
 * @param {Object} field - Vector field configuration
 * @returns {string|null} SQL statement or null if no index
 */
function generateIndexSQL(field) {
  if (field.indexType === 'None') {
    return null;
  }

  const indexName = `idx_${field.tableName}_${field.columnName}_${_.toLower(field.indexType)}`;
  const opsClass = DISTANCE_OPS[field.distanceMetric] || DISTANCE_OPS.Cosine;

  if (field.indexType === 'HNSW') {
    const m = _.get(field.indexConfig, 'hnswM', DEFAULT_INDEX_PARAMS.HNSW.m);
    const efConstruct = _.get(
      field.indexConfig,
      'hnswEfConstruct',
      DEFAULT_INDEX_PARAMS.HNSW.efConstruct
    );

    return (
      `CREATE INDEX IF NOT EXISTS "${indexName}" ON "${field.tableName}" ` +
      `USING hnsw ("${field.columnName}" ${opsClass}) ` +
      `WITH (m = ${m}, ef_construction = ${efConstruct});`
    );
  }

  if (field.indexType === 'IVFFlat') {
    const lists = _.get(
      field.indexConfig,
      'ivfLists',
      DEFAULT_INDEX_PARAMS.IVFFlat.lists
    );

    return (
      `CREATE INDEX IF NOT EXISTS "${indexName}" ON "${field.tableName}" ` +
      `USING ivfflat ("${field.columnName}" ${opsClass}) ` +
      `WITH (lists = ${lists});`
    );
  }

  return null;
}

/**
 * Generate complete migration SQL for all vector fields
 *
 * @param {Array} vectorFields - Array of vector field configurations
 * @param {string} [microserviceName] - Optional microservice name for comments
 * @returns {string|null} Complete SQL migration or null if no vector fields
 */
function generateVectorMigrationSQL(vectorFields, microserviceName = '') {
  if (_.isEmpty(vectorFields)) {
    return null;
  }

  const statements = [];

  // Header comment
  if (microserviceName) {
    statements.push(`-- Vector migration for ${microserviceName}`);
    statements.push(`-- Generated at ${new Date().toISOString()}`);
    statements.push('');
  }

  // Enable pgvector extension
  statements.push('-- Enable pgvector extension');
  statements.push(generateExtensionSQL());
  statements.push('');

  // Generate indexes for each vector field
  statements.push('-- Vector indexes');
  _.forEach(vectorFields, (field) => {
    const indexSQL = generateIndexSQL(field);
    if (indexSQL) {
      statements.push(`-- Index for ${field.modelName}.${field.fieldName}`);
      statements.push(indexSQL);
      statements.push('');
    }
  });

  return statements.join('\n');
}

/**
 * Generate migration file content for vector fields
 *
 * @param {Array} models - Array of model definitions
 * @param {string} microserviceName - Microservice name
 * @returns {Object|null} Migration file content or null if no vector fields
 */
function generateVectorMigrationFile(models, microserviceName) {
  const vectorFields = extractVectorFields(models);

  if (_.isEmpty(vectorFields)) {
    return null;
  }

  const upSQL = generateVectorMigrationSQL(vectorFields, microserviceName);

  // Generate down migration (drop indexes)
  const downStatements = vectorFields
    .filter((f) => f.indexType !== 'None')
    .map((field) => {
      const indexName = `idx_${field.tableName}_${field.columnName}_${_.toLower(field.indexType)}`;
      return `DROP INDEX IF EXISTS "${indexName}";`;
    });

  const downSQL = downStatements.length > 0
    ? downStatements.join('\n')
    : '-- No indexes to drop';

  return {
    up: upSQL,
    down: downSQL,
    vectorFields,
    metadata: {
      microserviceName,
      generatedAt: new Date().toISOString(),
      fieldCount: vectorFields.length,
    },
  };
}

/**
 * Validate vector field configuration
 *
 * @param {Object} field - Field definition
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
function validateVectorFieldConfig(field) {
  const errors = [];

  if (field.dataType !== 'Vector') {
    return { valid: true, errors: [] };
  }

  // Dimension validation
  if (!field.vectorDimension) {
    errors.push(`Vector field '${field.name}' requires vectorDimension`);
  } else if (field.vectorDimension < 1 || field.vectorDimension > 16000) {
    errors.push(
      `Vector field '${field.name}' dimension must be between 1 and 16000`
    );
  }

  // Distance metric validation
  if (field.vectorDistanceMetric && !DISTANCE_OPS[field.vectorDistanceMetric]) {
    errors.push(
      `Vector field '${field.name}' has invalid distance metric: ${field.vectorDistanceMetric}`
    );
  }

  // Index type validation
  const validIndexTypes = ['HNSW', 'IVFFlat', 'None'];
  if (field.vectorIndexType && !validIndexTypes.includes(field.vectorIndexType)) {
    errors.push(
      `Vector field '${field.name}' has invalid index type: ${field.vectorIndexType}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if model has any vector fields
 *
 * @param {Object} model - Model definition
 * @returns {boolean}
 */
function hasVectorFields(model) {
  const fields = model.fieldDefns || model.fields || [];
  return _.some(fields, (field) => field.dataType === 'Vector');
}

/**
 * Get vector field names from a model
 *
 * @param {Object} model - Model definition
 * @returns {string[]} Array of vector field names
 */
function getVectorFieldNames(model) {
  const fields = model.fieldDefns || model.fields || [];
  return _.chain(fields)
    .filter((field) => field.dataType === 'Vector')
    .map('name')
    .value();
}

module.exports = {
  extractVectorFields,
  generateVectorMigrationSQL,
  generateVectorMigrationFile,
  generateExtensionSQL,
  generateIndexSQL,
  validateVectorFieldConfig,
  hasVectorFields,
  getVectorFieldNames,
  DISTANCE_OPS,
  DEFAULT_INDEX_PARAMS,
};
