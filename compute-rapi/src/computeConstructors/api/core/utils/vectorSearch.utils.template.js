/**
 * Vector Search Utilities
 *
 * Core utilities for executing vector similarity searches using pgvector.
 * Handles raw SQL generation, cursor pagination, and result transformation.
 *
 * @module core/utils/vectorSearch.utils
 */

const _ = require('lodash');
const { toSnakeCase } = require('#utils/stringUtils.js');

// Distance operators for pgvector
const DISTANCE_OPERATORS = {
  Cosine: '<=>',
  L2: '<->',
  InnerProduct: '<#>',
};

// @gen:start:VECTOR_FIELD_CONFIG
// Vector field configurations injected by generator
const VECTOR_FIELDS = {
  // Example: embedding: { dimension: 1536, metric: 'Cosine', indexType: 'HNSW' }
};
// @gen:end:VECTOR_FIELD_CONFIG

/**
 * Encode cursor for pagination
 * @param {Object} params - Cursor parameters
 * @param {number} params.score - Similarity score
 * @param {string} params.id - Record ID
 * @returns {string} Base64 encoded cursor
 */
function encodeCursor({ score, id }) {
  const payload = JSON.stringify({ score, id });
  return Buffer.from(payload).toString('base64');
}

/**
 * Decode cursor from pagination
 * @param {string} cursor - Base64 encoded cursor
 * @returns {Object|null} Decoded cursor or null if invalid
 */
function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const payload = Buffer.from(cursor, 'base64').toString('utf-8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

/**
 * Transform distance to similarity score based on metric
 * @param {number} distance - Raw distance from pgvector
 * @param {string} metric - Distance metric (Cosine, L2, InnerProduct)
 * @returns {number} Similarity score (0-1 for Cosine, varies for others)
 */
function transformDistanceToScore(distance, metric) {
  switch (metric) {
    case 'Cosine':
      // Cosine distance is 1 - cosine_similarity, so similarity = 1 - distance
      return Math.max(0, 1 - distance);
    case 'L2':
      // L2 distance: lower is better, convert to similarity
      // Using inverse formula: 1 / (1 + distance)
      return 1 / (1 + distance);
    case 'InnerProduct':
      // Inner product returns negative values for similarity
      // Higher (less negative) is more similar
      return -distance;
    default:
      return 1 - distance;
  }
}

/**
 * Build SQL WHERE clause for vector search
 * @param {Object} params - Query parameters
 * @param {Object} params.filter - Pre-filter conditions
 * @param {Object} params.cursor - Decoded cursor for pagination
 * @param {number} params.threshold - Minimum similarity threshold
 * @param {string} params.metric - Distance metric
 * @param {string} params.vectorColumn - Column name for vector field
 * @returns {Object} { clause: string, values: array }
 */
function buildWhereClause({ filter, cursor, threshold, metric, vectorColumn }) {
  const conditions = [];
  const values = [];
  let paramIndex = 2; // $1 is reserved for the query vector

  // Soft delete filter
  conditions.push('"deleted" IS NULL');

  // Apply pre-filters
  if (!_.isEmpty(filter)) {
    _.forOwn(filter, (value, key) => {
      const snakeKey = toSnakeCase(key);
      if (Array.isArray(value)) {
        conditions.push(`"${snakeKey}" = ANY($${paramIndex})`);
        values.push(value);
      } else if (value === null) {
        conditions.push(`"${snakeKey}" IS NULL`);
      } else {
        conditions.push(`"${snakeKey}" = $${paramIndex}`);
        values.push(value);
      }
      paramIndex++;
    });
  }

  // Threshold filter (distance-based)
  if (!_.isNil(threshold) && threshold > 0) {
    const operator = DISTANCE_OPERATORS[metric] || '<=>';
    // Convert similarity threshold to distance threshold
    let distanceThreshold;
    switch (metric) {
      case 'Cosine':
        distanceThreshold = 1 - threshold;
        break;
      case 'L2':
        distanceThreshold = (1 / threshold) - 1;
        break;
      case 'InnerProduct':
        distanceThreshold = -threshold;
        break;
      default:
        distanceThreshold = 1 - threshold;
    }
    conditions.push(`"${vectorColumn}" ${operator} $1 < $${paramIndex}`);
    values.push(distanceThreshold);
    paramIndex++;
  }

  // Cursor-based pagination
  if (cursor) {
    const operator = DISTANCE_OPERATORS[metric] || '<=>';
    // Score-based cursor: get records with worse (higher distance) scores
    // or same score but different ID
    conditions.push(
      `("${vectorColumn}" ${operator} $1 > $${paramIndex} OR ` +
      `("${vectorColumn}" ${operator} $1 = $${paramIndex} AND "id" > $${paramIndex + 1}))`
    );
    // Convert score back to distance for cursor comparison
    let cursorDistance;
    switch (metric) {
      case 'Cosine':
        cursorDistance = 1 - cursor.score;
        break;
      case 'L2':
        cursorDistance = (1 / cursor.score) - 1;
        break;
      case 'InnerProduct':
        cursorDistance = -cursor.score;
        break;
      default:
        cursorDistance = 1 - cursor.score;
    }
    values.push(cursorDistance, cursor.id);
    paramIndex += 2;
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
  };
}

/**
 * Build SQL SELECT clause
 * @param {Object} params - Query parameters
 * @param {string[]} params.select - Fields to select
 * @param {boolean} params.includeScore - Whether to include similarity score
 * @param {string} params.vectorColumn - Column name for vector field
 * @param {string} params.metric - Distance metric
 * @returns {string} SELECT clause
 */
function buildSelectClause({ select, includeScore, vectorColumn, metric }) {
  const operator = DISTANCE_OPERATORS[metric] || '<=>';

  // Default fields if none specified
  const fields = _.isEmpty(select)
    ? ['"id"', '"createdAt"', '"updatedAt"']
    : select.map((f) => `"${toSnakeCase(f)}"`);

  if (includeScore !== false) {
    fields.push(`"${vectorColumn}" ${operator} $1 AS "_distance"`);
  }

  return `SELECT ${fields.join(', ')}`;
}

/**
 * Transform database row to API response
 * @param {Object} row - Database row
 * @param {string} metric - Distance metric
 * @param {boolean} includeScore - Whether to include score
 * @returns {Object} Transformed row
 */
function transformRow(row, metric, includeScore) {
  const result = _.omit(row, ['_distance']);

  if (includeScore !== false && row._distance !== undefined) {
    result._score = transformDistanceToScore(row._distance, metric);
  }

  return result;
}

/**
 * Execute vector similarity search
 * @param {Object} params - Search parameters
 * @param {Object} params.prisma - Prisma client instance
 * @param {string} params.tableName - Database table name
 * @param {number[]} params.vector - Query vector
 * @param {string} params.field - Vector field name
 * @param {Object} params.pagination - Pagination options
 * @param {number} params.threshold - Similarity threshold
 * @param {Object} params.filter - Pre-filter conditions
 * @param {boolean} params.includeScore - Include similarity score
 * @param {string[]} params.select - Fields to return
 * @returns {Promise<Object>} Search results with pagination
 */
async function executeVectorSearch({
  prisma,
  tableName,
  vector,
  field,
  pagination = {},
  threshold,
  filter,
  includeScore = true,
  select,
}) {
  const fieldConfig = VECTOR_FIELDS[field];
  if (!fieldConfig) {
    throw new Error(`Vector field '${field}' is not configured`);
  }

  const { dimension, metric = 'Cosine' } = fieldConfig;
  const vectorColumn = toSnakeCase(field);
  const limit = Math.min(pagination.limit || 20, 100);
  const cursor = decodeCursor(pagination.cursor);

  // Validate vector dimension
  if (_.size(vector) !== dimension) {
    throw new Error(
      `Vector dimension mismatch: expected ${dimension}, got ${_.size(vector)}`
    );
  }

  // Build query components
  const selectClause = buildSelectClause({
    select,
    includeScore,
    vectorColumn,
    metric,
  });

  const { clause: whereClause, values: whereValues } = buildWhereClause({
    filter,
    cursor,
    threshold,
    metric,
    vectorColumn,
  });

  const operator = DISTANCE_OPERATORS[metric] || '<=>';
  const orderClause = `ORDER BY "${vectorColumn}" ${operator} $1, "id"`;
  const limitClause = `LIMIT ${limit + 1}`; // Fetch one extra to check hasMore

  // Construct full query
  const query = `
    ${selectClause}
    FROM "${tableName}"
    ${whereClause}
    ${orderClause}
    ${limitClause}
  `;

  // Format vector as pgvector string
  const vectorString = `[${vector.join(',')}]`;
  const queryParams = [vectorString, ...whereValues];

  // Execute raw query
  const rows = await prisma.$queryRawUnsafe(query, ...queryParams);

  // Check if there are more results
  const hasMore = rows.length > limit;
  const results = hasMore ? _.take(rows, limit) : rows;

  // Transform results
  const transformedResults = results.map((row) =>
    transformRow(row, metric, includeScore)
  );

  // Generate next cursor
  let nextCursor = null;
  if (hasMore && results.length > 0) {
    const lastRow = _.last(results);
    const lastScore = includeScore !== false
      ? transformDistanceToScore(lastRow._distance, metric)
      : 0;
    nextCursor = encodeCursor({ score: lastScore, id: lastRow.id });
  }

  return {
    data: transformedResults,
    pagination: {
      cursor: nextCursor,
      hasMore,
      limit,
    },
    meta: {
      field,
      metric,
      dimension,
      threshold: threshold || null,
      totalMatches: transformedResults.length,
    },
  };
}

/**
 * Get vector field configuration
 * @param {string} fieldName - Field name
 * @returns {Object|null} Field configuration or null
 */
function getVectorFieldConfig(fieldName) {
  return VECTOR_FIELDS[fieldName] || null;
}

/**
 * Check if a field is a vector field
 * @param {string} fieldName - Field name
 * @returns {boolean}
 */
function isVectorField(fieldName) {
  return Object.prototype.hasOwnProperty.call(VECTOR_FIELDS, fieldName);
}

/**
 * Get all configured vector fields
 * @returns {string[]} Array of vector field names
 */
function getVectorFieldNames() {
  return Object.keys(VECTOR_FIELDS);
}

module.exports = {
  executeVectorSearch,
  encodeCursor,
  decodeCursor,
  transformDistanceToScore,
  buildWhereClause,
  buildSelectClause,
  transformRow,
  getVectorFieldConfig,
  isVectorField,
  getVectorFieldNames,
  DISTANCE_OPERATORS,
  VECTOR_FIELDS,
};
