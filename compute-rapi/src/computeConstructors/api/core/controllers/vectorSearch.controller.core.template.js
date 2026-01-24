/**
 * CREATED BY: @gen{CREATOR_NAME}
 * CREATOR EMAIL: @gen{CREATOR_EMAIL}
 * CREATION DATE: @gen{NOW}
 *
 *
 * DESCRIPTION:
 * ------------------
 * Vector search controller for @gen{MODEL_NAME|Pascal} model.
 * Handles vector similarity search requests using pgvector.
 *
 * Endpoint: POST /api/@gen{MODEL_NAME|kebab}/vector-search
 *
 * Features:
 * - Semantic/similarity search using pgvector
 * - Cursor-based pagination
 * - Pre-filtering with standard field conditions
 * - Configurable similarity threshold
 * - Embedding metadata tracking for traceability
 */

const prisma = require('#configs/prisma.js');
const { getRegistry } = require('#domain/interceptors/interceptor.registry.js');
const {
  @gen{MODEL_NAME|camel}VectorSearch,
} = require('#core/schemas/@gen{MODEL_NAME|camel}.vectorSearch.schema.js');
const {
  executeVectorSearch,
  getVectorFieldConfig,
  isVectorField,
} = require('#core/utils/vectorSearch.utils.js');
const { getVisibilityFilters } = require('#utils/visibilityUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
} = require('#utils/traceUtils.js');
const { handleValidationError } = require('#utils/errorHandlingUtils.js');
const { v4: uuidv4 } = require('uuid');

// Resolve interceptor for this model
const interceptor = getRegistry().resolve('@gen{MODEL_NAME|Pascal}');

// Table name for raw queries
const TABLE_NAME = '@gen{MODEL_NAME|snake}';

// @gen:start:VALID_VECTOR_FIELDS
// Valid vector fields for this model (injected by generator)
const VALID_VECTOR_FIELDS = [];
// @gen:end:VALID_VECTOR_FIELDS

// @gen:start:VECTOR_DIMENSIONS
// Vector dimensions by field name (injected by generator)
const VECTOR_DIMENSIONS = {};
// @gen:end:VECTOR_DIMENSIONS

/**
 * Vector search error codes
 */
const VECTOR_ERROR_CODES = {
  VECTOR_DIMENSION_MISMATCH: 'Vector dimension does not match field configuration',
  VECTOR_FIELD_NOT_FOUND: 'Specified field is not a vector field',
  VECTOR_FIELD_REQUIRED: 'Field parameter is required for vector search',
  VECTOR_INVALID_FORMAT: 'Vector must be an array of numbers',
  VECTOR_EMBEDDING_METADATA_REQUIRED: 'Embedding model and version are required',
  VECTOR_THRESHOLD_OUT_OF_RANGE: 'Threshold must be between 0 and 1',
  VECTOR_LIMIT_EXCEEDED: 'Limit cannot exceed 100',
  VECTOR_EXTENSION_UNAVAILABLE: 'pgvector extension is not available',
  VECTOR_INDEX_NOT_READY: 'Vector index is still building',
};

/**
 * Execute vector similarity search on @gen{MODEL_NAME|Pascal}
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function vectorSearch@gen{MODEL_NAME|Pascal}(req, res) {
  const requestId = req.headers['x-request-id'] || uuidv4();
  const { user, body } = req;

  logOperationStart('vectorSearch@gen{MODEL_NAME|Pascal}', req, {
    user: user?.id,
    field: body?.field,
    vectorLength: body?.vector?.length,
  });

  try {
    // Validate request body
    let params;
    try {
      params = await @gen{MODEL_NAME|camel}VectorSearch.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        return handleValidationError(error, res, req);
      }
      throw error;
    }

    const {
      vector,
      field,
      embedding,
      pagination = {},
      threshold,
      filter = {},
      includeScore = true,
      select,
    } = params;

    // Validate vector field exists
    if (!VALID_VECTOR_FIELDS.includes(field)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VECTOR_FIELD_NOT_FOUND',
          message: VECTOR_ERROR_CODES.VECTOR_FIELD_NOT_FOUND,
          details: {
            field,
            validFields: VALID_VECTOR_FIELDS,
          },
          retryable: false,
        },
        meta: { requestId },
      });
    }

    // Validate vector dimension
    const expectedDimension = VECTOR_DIMENSIONS[field];
    if (vector.length !== expectedDimension) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VECTOR_DIMENSION_MISMATCH',
          message: VECTOR_ERROR_CODES.VECTOR_DIMENSION_MISMATCH,
          details: {
            provided: vector.length,
            expected: expectedDimension,
            field,
          },
          retryable: false,
        },
        meta: { requestId },
      });
    }

    // Apply visibility filters
    const visibilityFilters = getVisibilityFilters({ req, user });
    const combinedFilter = { ...filter, ...visibilityFilters };

    // Execute beforeVectorSearch interceptor hook
    let searchParams = {
      vector,
      field,
      embedding,
      pagination,
      threshold,
      filter: combinedFilter,
      includeScore,
      select,
    };

    if (interceptor?.beforeVectorSearch) {
      const hookResult = await interceptor.beforeVectorSearch(searchParams, {
        req,
        user,
        requestId,
      });
      if (hookResult?.halt) {
        return res.status(hookResult.status || 200).json(hookResult.response);
      }
      searchParams = hookResult?.data || searchParams;
    }

    // Execute vector search
    const result = await executeVectorSearch({
      prisma,
      tableName: TABLE_NAME,
      vector: searchParams.vector,
      field: searchParams.field,
      pagination: searchParams.pagination,
      threshold: searchParams.threshold,
      filter: searchParams.filter,
      includeScore: searchParams.includeScore,
      select: searchParams.select,
    });

    // Execute afterVectorSearch interceptor hook
    let finalResult = result;
    if (interceptor?.afterVectorSearch) {
      const hookResult = await interceptor.afterVectorSearch(result, {
        req,
        user,
        requestId,
        params: searchParams,
      });
      if (hookResult?.halt) {
        return res.status(hookResult.status || 200).json(hookResult.response);
      }
      finalResult = hookResult?.data || result;
    }

    logOperationSuccess('vectorSearch@gen{MODEL_NAME|Pascal}', req, {
      resultCount: finalResult.data.length,
      hasMore: finalResult.pagination.hasMore,
    });

    // Return response
    return res.status(200).json({
      success: true,
      data: finalResult.data,
      pagination: finalResult.pagination,
      meta: {
        requestId,
        ...finalResult.meta,
        embedding: {
          model: embedding.model,
          version: embedding.version,
          provider: embedding.provider,
        },
      },
    });
  } catch (error) {
    logOperationError('vectorSearch@gen{MODEL_NAME|Pascal}', req, error);

    // Handle pgvector-specific errors
    if (error.message?.includes('vector')) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'VECTOR_EXTENSION_UNAVAILABLE',
          message: VECTOR_ERROR_CODES.VECTOR_EXTENSION_UNAVAILABLE,
          details: { originalError: error.message },
          retryable: true,
        },
        meta: { requestId },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred during vector search',
        retryable: false,
      },
      meta: { requestId },
    });
  }
}

module.exports = {
  vectorSearch@gen{MODEL_NAME|Pascal},
  VECTOR_ERROR_CODES,
  VALID_VECTOR_FIELDS,
  VECTOR_DIMENSIONS,
};
