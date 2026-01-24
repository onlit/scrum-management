/**
 * CREATED BY: @gen{CREATOR_NAME}
 * CREATOR EMAIL: @gen{CREATOR_EMAIL}
 * CREATION DATE: @gen{NOW}
 *
 *
 * DESCRIPTION:
 * ------------------
 * Joi validation schema for vector search requests on @gen{MODEL_NAME|Pascal}.
 *
 * Validates:
 * - Query vector (required, exact dimension match)
 * - Target vector field name
 * - Embedding metadata for traceability
 * - Pagination options (cursor-based)
 * - Similarity threshold
 * - Pre-filter conditions
 * - Field selection
 */

const Joi = require('joi');

// @gen:start:VALID_VECTOR_FIELDS
// Valid vector fields for this model (injected by generator)
const VALID_VECTOR_FIELDS = [];
// @gen:end:VALID_VECTOR_FIELDS

// @gen:start:VECTOR_DIMENSIONS
// Vector dimensions by field name (injected by generator)
const VECTOR_DIMENSIONS = {};
// @gen:end:VECTOR_DIMENSIONS

/**
 * Embedding metadata schema
 * Tracks which model generated the embedding for traceability
 */
const embeddingMetadataSchema = Joi.object({
  model: Joi.string()
    .required()
    .messages({
      'string.base': 'Embedding model must be a string',
      'any.required': 'Embedding model is required for traceability',
    }),
  version: Joi.string()
    .required()
    .messages({
      'string.base': 'Embedding version must be a string',
      'any.required': 'Embedding version is required for traceability',
    }),
  provider: Joi.string()
    .optional()
    .messages({
      'string.base': 'Embedding provider must be a string',
    }),
}).required().messages({
  'any.required': 'Embedding metadata is required',
  'object.base': 'Embedding must be an object with model and version',
});

/**
 * Pagination schema
 * Supports cursor-based pagination with configurable limit
 */
const paginationSchema = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be a whole number',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100',
    }),
  cursor: Joi.string()
    .allow(null)
    .optional()
    .messages({
      'string.base': 'Cursor must be a string',
    }),
}).optional().default({});

/**
 * Main vector search request schema
 */
const @gen{MODEL_NAME|camel}VectorSearch = Joi.object({
  // Query vector (required)
  vector: Joi.array()
    .items(Joi.number())
    .required()
    .messages({
      'array.base': 'Vector must be an array of numbers',
      'any.required': 'Vector is required for similarity search',
      'array.includes': 'Each element in vector must be a number',
    }),

  // Target vector field (required)
  field: Joi.string()
    .required()
    .messages({
      'string.base': 'Field must be a string',
      'any.required': 'Field parameter is required to specify which vector field to search',
    }),

  // Embedding metadata (required for traceability)
  embedding: embeddingMetadataSchema,

  // Pagination options
  pagination: paginationSchema,

  // Similarity threshold (0-1)
  threshold: Joi.number()
    .min(0)
    .max(1)
    .optional()
    .messages({
      'number.base': 'Threshold must be a number',
      'number.min': 'Threshold must be at least 0',
      'number.max': 'Threshold cannot exceed 1',
    }),

  // Pre-filter conditions
  filter: Joi.object()
    .optional()
    .default({})
    .messages({
      'object.base': 'Filter must be an object',
    }),

  // Include similarity score in results
  includeScore: Joi.boolean()
    .optional()
    .default(true)
    .messages({
      'boolean.base': 'includeScore must be a boolean',
    }),

  // Fields to return in results
  select: Joi.array()
    .items(Joi.string())
    .optional()
    .messages({
      'array.base': 'Select must be an array of field names',
      'array.includes': 'Each select item must be a string',
    }),
});

module.exports = {
  @gen{MODEL_NAME|camel}VectorSearch,
  embeddingMetadataSchema,
  paginationSchema,
  VALID_VECTOR_FIELDS,
  VECTOR_DIMENSIONS,
};
