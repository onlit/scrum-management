/**
 * Database Optimization Utilities
 *
 * This module provides utilities for optimizing database queries and performance.
 */

const { logEvent } = require('#utils/shared/loggingUtils.js');
const { createStandardError } = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');

/**
 * Creates optimized Prisma query options with pagination and filtering
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (1-based)
 * @param {number} options.limit - Items per page (max 100)
 * @param {string} options.sortBy - Field to sort by
 * @param {string} options.sortOrder - Sort order ('asc' or 'desc')
 * @param {Object} options.where - Prisma where clause
 * @param {Object} options.include - Prisma include clause
 * @param {Object} options.select - Prisma select clause
 * @returns {Object} Optimized Prisma query options
 */
function createOptimizedQuery(options = {}) {
  const {
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    where = {},
    include = {},
    select = null,
  } = options;

  // Validate and sanitize pagination
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  // Validate sort order
  const safeSortOrder = ['asc', 'desc'].includes(sortOrder)
    ? sortOrder
    : 'desc';

  // Build query options
  const queryOptions = {
    where,
    skip,
    take: safeLimit,
    orderBy: {
      [sortBy]: safeSortOrder,
    },
  };

  // Add include or select (prefer select for performance)
  if (select) {
    queryOptions.select = select;
  } else if (Object.keys(include).length > 0) {
    queryOptions.include = include;
  }

  return queryOptions;
}

/**
 * Creates a paginated response object
 * @param {Array} data - Query results
 * @param {number} total - Total count
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} Paginated response
 */
function createPaginatedResponse(data, total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage,
      hasPrevPage,
    },
  };
}

/**
 * Optimizes database queries by batching operations
 * @param {Array} operations - Array of database operations
 * @param {number} batchSize - Size of each batch
 * @returns {Promise<Array>} Results of all operations
 */
async function batchOperations(operations, batchSize = 10) {
  const results = [];

  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Creates efficient search filters for text fields
 * @param {string} searchTerm - Search term
 * @param {Array<string>} fields - Fields to search in
 * @param {string} mode - Search mode ('contains', 'startsWith', 'endsWith')
 * @returns {Object} Prisma OR filter
 */
function createSearchFilter(searchTerm, fields, mode = 'contains') {
  if (!searchTerm || !fields.length) {
    return {};
  }

  const sanitizedTerm = searchTerm.trim();
  if (!sanitizedTerm) {
    return {};
  }

  return {
    OR: fields.map((field) => ({
      [field]: {
        [mode]: sanitizedTerm,
        mode: 'insensitive',
      },
    })),
  };
}

/**
 * Creates efficient date range filters
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @param {string} field - Date field name
 * @returns {Object} Prisma date filter
 */
function createDateRangeFilter(startDate, endDate, field = 'createdAt') {
  const filter = {};

  if (startDate) {
    const start = new Date(startDate);
    if (!Number.isNaN(start.getTime())) {
      filter[field] = { ...filter[field], gte: start };
    }
  }

  if (endDate) {
    const end = new Date(endDate);
    if (!Number.isNaN(end.getTime())) {
      // Set to end of day
      end.setHours(23, 59, 59, 999);
      filter[field] = { ...filter[field], lte: end };
    }
  }

  return Object.keys(filter).length > 0 ? filter : {};
}

/**
 * Optimizes includes to prevent N+1 queries
 * @param {Object} baseInclude - Base include object
 * @param {Array<string>} requiredRelations - Required relations
 * @returns {Object} Optimized include object
 */
function optimizeIncludes(baseInclude = {}, requiredRelations = []) {
  const optimizedInclude = { ...baseInclude };

  // Only include relations that are actually needed
  requiredRelations.forEach((relation) => {
    if (!optimizedInclude[relation]) {
      optimizedInclude[relation] = true;
    }
  });

  return optimizedInclude;
}

/**
 * Creates a connection pool configuration for better performance
 * @returns {Object} Database connection configuration
 */
function getDatabaseConfig() {
  return {
    // Connection pool settings
    connectionLimit: parseInt(process.env.DATABASE_CONNECTION_LIMIT, 10) || 10,

    // Query timeout settings
    queryTimeout: parseInt(process.env.DATABASE_QUERY_TIMEOUT, 10) || 30000, // 30 seconds

    // Connection timeout
    connectTimeout: parseInt(process.env.DATABASE_CONNECT_TIMEOUT, 10) || 10000, // 10 seconds

    // Enable query logging in development
    log:
      process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  };
}

/**
 * Validates and sanitizes database filters to prevent injection
 * @param {Object} filters - Raw filters from client
 * @param {Array<string>} allowedFields - Allowed filter fields
 * @returns {Object} Sanitized filters
 */
function sanitizeFilters(filters, allowedFields) {
  const sanitized = {};

  Object.keys(filters).forEach((key) => {
    if (allowedFields.includes(key)) {
      const value = filters[key];

      // Only allow safe filter operations
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        sanitized[key] = value;
      } else if (typeof value === 'object' && value !== null) {
        // Allow certain Prisma filter operations
        const allowedOperations = [
          'equals',
          'contains',
          'startsWith',
          'endsWith',
          'gt',
          'gte',
          'lt',
          'lte',
          'in',
          'notIn',
        ];
        const sanitizedValue = {};

        Object.keys(value).forEach((op) => {
          if (allowedOperations.includes(op)) {
            sanitizedValue[op] = value[op];
          }
        });

        if (Object.keys(sanitizedValue).length > 0) {
          sanitized[key] = sanitizedValue;
        }
      } else {
        // Log and throw error for invalid filter value
        logEvent(`[FILTER_SANITIZATION_ERROR] Invalid filter value for key: ${key}`);
        throw createStandardError(
          ERROR_TYPES.BAD_REQUEST,
          `Invalid filter value for key: ${key}`,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'sanitize_filters',
            details: { key, value },
          }
        );
      }
    }
  });

  return sanitized;
}

module.exports = {
  createOptimizedQuery,
  createPaginatedResponse,
  batchOperations,
  createSearchFilter,
  createDateRangeFilter,
  optimizeIncludes,
  getDatabaseConfig,
  sanitizeFilters,
};
