/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file provides utilities for database interactions, specifically with the Prisma ORM. It includes functions for unique code validation, generating filters and search queries for list pages, and fetching paginated lists based on various criteria. It incorporates complex query construction for filtering, searching, and pagination.
 *
 *
 */

const _ = require('lodash');
const { Prisma } = require('@prisma/client');
const prisma = require('#configs/prisma.js');
const { getVisibilityFilters } = require('#utils/visibilityUtils.js');
const { isObject } = require('#utils/generalUtils.js');
const { createStandardError } = require('#utils/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { getDetailsFromAPI } = require('#utils/apiUtils.js');
const { logEvent } = require('#utils/basicLoggingUtils.js');
const { getRandomAlphanumeric, toCamelCase } = require('#utils/stringUtils.js');

// Cache for expensive capability checks
const ftsSupportCache = new Map();

// Fields that store UUIDs but do not follow the conventional `*Id` naming
const UUID_NAMED_FIELDS = new Set([
  'client',
  'createdBy',
  'updatedBy',
  'deletedBy',
    'sourceCampaign',
  'user',
]);

function shouldCastFieldValueToUuid(fieldName, value) {
  const isUuidString = (val) =>
    typeof val === 'string' &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
      val
    );

  const lower = String(fieldName || '').toLowerCase();
  const looksLikeIdField = lower === 'id' || lower.endsWith('id');
  const isNamedUuidField = UUID_NAMED_FIELDS.has(fieldName);

  if (!(looksLikeIdField || isNamedUuidField)) return false;

  if (Array.isArray(value)) {
    return value.length > 0 && value.every(isUuidString);
  }
  return isUuidString(value);
}

function escapeSQLValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) {
    return `'${value.toISOString().replace(/'/g, "''")}'`;
  }
  if (Array.isArray(value)) {
    const escapedItems = value.map((v) => escapeSQLValue(v));
    return `(${escapedItems.join(', ')})`;
  }
  // Fallback to string with single quotes escaped
  const str = String(value);
  return `'${str.replace(/'/g, "''")}'`;
}

function interpolateSqlWithParams(sql, params) {
  if (!params || params.length === 0) return sql;
  let interpolated = sql;
  for (let i = 0; i < params.length; i++) {
    const placeholder = new RegExp(`\\$${i + 1}(?![0-9])`, 'g');
    interpolated = interpolated.replace(placeholder, escapeSQLValue(params[i]));
  }
  return interpolated;
}

function queryRaw(prismaClient, sql, ...params) {
  const finalSql = interpolateSqlWithParams(sql, params);
  // Log the final SQL that will be executed (useful for debugging syntax errors)
  try {
    logEvent(`[RAW_SQL] ${finalSql}`);
  } catch (e) {
    // no-op logging failure
  }
  // Execute using parameterized queries when available; only use unsafe as a last resort
  const client = prismaClient || prisma;
  if (client && typeof client.$queryRaw === 'function') {
    try {
      if (params && params.length > 0) {
        // Convert positional placeholders ($1, $2, ...) into a Prisma.sql with bound params
        // Supports repeated placeholders referencing the same index (e.g., $1 used multiple times)
        const re = /(\$(\d+))(?!\d)/g;
        let built = Prisma.sql``;
        let lastIndex = 0;
        let match;
        while ((match = re.exec(sql)) !== null) {
          const placeholder = match[1];
          const paramNumber = parseInt(match[2], 10);
          const paramIdx = paramNumber - 1;
          const rawSegment = sql.slice(lastIndex, match.index);
          if (rawSegment) {
            built = Prisma.sql`${built}${Prisma.raw(rawSegment)}`;
          }
          built = Prisma.sql`${built}${params[paramIdx]}`;
          lastIndex = match.index + placeholder.length;
        }
        const tail = sql.slice(lastIndex);
        if (tail) {
          built = Prisma.sql`${built}${Prisma.raw(tail)}`;
        }
        return client.$queryRaw(built);
      }
      // No params; wrap the SQL as raw and execute
      const built = Prisma.sql`${Prisma.raw(sql)}`;
      return client.$queryRaw(built);
    } catch (err) {
      // Prisma v6 requires tagged template; if anything goes wrong, fall back to unsafe
      if (typeof client.$queryRawUnsafe === 'function') {
        return client.$queryRawUnsafe(finalSql);
      }
      throw err;
    }
  }
  if (client && typeof client.$queryRawUnsafe === 'function') {
    return client.$queryRawUnsafe(finalSql);
  }
  throw new Error('Prisma raw query method not available');
}

async function isCodeUnique(prisma, code, clientId) {
  return !(await prisma.block.findFirst({
    where: { code, client: clientId },
  }));
}

async function generateUniqueCode(prismaClient, clientId) {
  let isUnique = false;
  let code;

  while (!isUnique) {
    const prefix = getRandomAlphanumeric(4);
    const number = getRandomAlphanumeric(3);
    code = `${prefix}-${number}`;
    isUnique = await isCodeUnique(prismaClient, code, clientId);
  }

  return code;
}

/**
 * Renormalizes the `order` field for a given model to be strictly sequential (1, 2, 3,...).
 * WARNING: This can be resource-intensive as it reads and potentially updates
 * many rows within the specified conditions.
 *
 * @param {Object} params
 * @param {string} params.modelName - The name of the Prisma model (e.g., "fieldDefn").
 * @param {string} params.orderField - The name of the `order` field (default is "order").
 * @param {Object} params.conditions - Conditions to filter the records to renormalize (e.g., { modelId: 'xyz' }).
 * @param {Object} params.prisma - The Prisma client instance (or transaction client).
 */
async function renormalizeOrders({
  modelName,
  orderField = 'order',
  conditions,
  prisma: prismaClient, // Use the passed client
} = {}) {
  if (!prismaClient) {
    logEvent('[RENORMALIZE_ORDERS_ERROR] Prisma client instance is required');
    throw createStandardError(
      ERROR_TYPES.INTERNAL,
      'Prisma client instance is required for renormalizeOrders',
      {
        severity: ERROR_SEVERITY.HIGH,
        context: 'renormalize_orders',
      }
    );
  }
  if (!conditions || Object.keys(conditions).length === 0) {
    logEvent(
      '[RENORMALIZE_ORDERS_ERROR] Conditions are required to scope the renormalization.'
    );
    throw createStandardError(
      ERROR_TYPES.BAD_REQUEST,
      'Conditions are required to scope the renormalization.',
      {
        severity: ERROR_SEVERITY.LOW,
        context: 'renormalize_orders',
      }
    );
  }
  logEvent(
    `Renormalizing order for ${modelName} with conditions: ${JSON.stringify(
      conditions
    )}`
  );

  // 1. Fetch all items matching the conditions, ordered by their *current* order.
  //    Select only the id and current order field for efficiency.
  const itemsToRenormalize = await prismaClient[modelName].findMany({
    where: conditions,
    select: {
      id: true, // Need the ID to update
      [orderField]: true, // Need the current order to check if update is needed
    },
    orderBy: {
      [orderField]: 'asc',
    },
  });

  if (itemsToRenormalize.length === 0) {
    logEvent('No items found matching conditions, skipping renormalization.');
    return; // Nothing to do
  }

  logEvent(
    `Found ${itemsToRenormalize.length} items to potentially renormalize.`
  );

  // 2. Create promises for updates where the order needs changing.
  const updatePromises = [];
  itemsToRenormalize.forEach((item, index) => {
    const expectedOrder = index + 1; // Order should be 1, 2, 3, ...
    const currentOrder = item[orderField];

    // Only update if the current order is not the expected sequential order
    if (currentOrder !== expectedOrder) {
      logEvent(
        `Updating ${modelName} id ${item.id} from order ${currentOrder} to ${expectedOrder}`
      );
      updatePromises.push(
        prismaClient[modelName].update({
          where: { id: item.id },
          data: {
            [orderField]: expectedOrder,
          },
          select: { id: true }, // Don't need the full updated record here
        })
      );
    }
  });

  // 3. Execute all necessary updates concurrently.
  if (updatePromises.length > 0) {
    logEvent(`Executing ${updatePromises.length} order update(s).`);
    await Promise.all(updatePromises);
    logEvent(`Finished ${updatePromises.length} order update(s).`);
  } else {
    logEvent('All items are already in correct sequential order.');
  }
}

/**
 * Rebase the `order` field for a given model.
 *
 * @param {Object} params
 * @param {string} params.modelName - The name of the Prisma model (e.g., "menuDefn").
 * @param {string} params.orderField - The name of the `order` field (default is "order").
 * @param {Object} params.conditions - Additional conditions to filter the records (e.g., microserviceId).
 * @param {number} params.order - The `order` value to start rebasing from.
 * @param {Object} params.prisma - The Prisma client instance.
 */
async function rebaseOrders({
  modelName,
  orderField = 'order',
  conditions,
  order,
  prisma: prismaClient = prisma,
} = {}) {
  const whereConditions = {
    ...conditions,
    [orderField]: {
      gte: order,
    },
  };

  const updateData = {
    [orderField]: {
      increment: 1,
    },
  };

  // Dynamically update the specified model
  await prismaClient[modelName].updateMany({
    where: whereConditions,
    data: updateData,
  });
}

/**
 * Validates access to foreign keys across multiple models for a given user within a single transaction.
 * This function ensures that the current user has access to specified records, based on foreign keys, across different models.
 * It checks if the record exists and if the user has the visibility/access rights to it.
 *
 * @param {Object} params - The parameters for the function.
 * @param {Object} params.user - The user object to apply visibility filters based on user permissions.
 * @param {Array} params.validations - An array of validation objects, each specifying a model, and the fields with values to validate.
 *    Each validation object includes:
 *    - model: The name of the model (e.g., 'form') as defined in your ORM schema.
 *    - fieldValues: An object where each key is a field name to check, and the value is the foreign key to validate.
 *
 * @throws {Error} Throws an error if any of the validations fail, with a message indicating the invalid field and model.
 *
 * Example usage:
 * await verifyForeignKeyAccessBatch({
 *   user,
 *   validations: [
 *     {
 *       model: 'form',
 *       fieldValues: { formId },
 *     },
 *     {
 *       model: 'group',
 *       fieldValues: { groupId },
 *     },
 *   ],
 * });
 */
async function verifyForeignKeyAccessBatch({ user, validations } = {}) {
  // Prepare the queries and track their corresponding model and fieldName
  const queryIdentifiers = [];

  const queries = validations.reduce((acc, validation) => {
    Object.entries(validation?.fieldValues ?? {}).forEach(
      ([fieldName, fieldValue]) => {
        const model = validation?.model;
        if (model && fieldValue) {
          // Push an identifier for each query to match them with their results later
          queryIdentifiers.push({ model, fieldName });

          // Only add the Prisma findFirst call for truthy fieldValue, avoiding unnecessary queries
          acc.push(
            prisma?.[model].findFirst({
              where: {
                id: fieldValue,
                ...getVisibilityFilters(user),
              },
              select: { id: true },
            })
          );
        }
      }
    );
    return acc;
  }, []);

  // Execute all the queries within a single transaction
  const results = await prisma.$transaction(queries);

  // Iterate over the results to find any null responses indicating a failed validation
  const failedIndex = results.findIndex((result) => result === null);

  if (failedIndex !== -1) {
    // Use the failedIndex to find the corresponding model and field from queryIdentifiers
    const { model, fieldName } = queryIdentifiers[failedIndex];
    throw createStandardError(
      ERROR_TYPES.VALIDATION,
      `Invalid ${fieldName} in ${model}.`,
      {
        severity: ERROR_SEVERITY.LOW,
        context: 'validate_foreign_keys_db',
        details: { model, fieldName, failedIndex },
      }
    );
  }
}

/**
 * Generates filters and search queries for a list page.
 *
 * @async
 * @function getListFiltersAndQueries
 *
 * @param {Object} options - The options object.
 * @param {Object} options.user - The user object.
 * @param {String} options.search - The search string.
 * @param {Object} options.filters - The filter object.
 * @param {Object} options.schema - The schema object.
 * @param {Array} options.filterFields - The fields to filter on.
 * @param {Array} options.searchFields - The fields to search on.
 *
 * @returns {Promise<Object>} The where object.
 */
async function getListFiltersAndQueries({
  user,
  search,
  filters,
  schema,
  filterFields,
  searchFields,
}) {
  const baseFilters = getVisibilityFilters(user) || {};
  const where = {
    ...baseFilters,
    // Always ensure AND is initialized as an array so we can push into it safely
    AND: Array.isArray(baseFilters.AND) ? [...baseFilters.AND] : [],
  };
  const filterKeys = Object.keys(filters);

  if (filterKeys.length) {
    const validatedQuery = await schema.validateAsync(filters, {
      stripUnknown: true,
      abortEarly: false,
    });

    for (const field of filterKeys) {
      const value = validatedQuery[field];
      if (filterFields.includes(field) && !!value) {
        where.AND.push({
          [toCamelCase(field)]: { equals: value === 'null' ? null : value },
        });
      }
    }
  }

  if (searchFields.length && search) {
    const searchConditions = searchFields.map((field) => ({
      [field]: { contains: search, mode: 'insensitive' },
    }));

    where.AND.push({ OR: searchConditions });
  }

  return where;
}

/**
 * Returns a paginated list of items for the provided model.
 * Now uses optimized implementation by default for better performance.
 *
 * @async
 * @function getPaginatedList
 *
 * @param {Object} options - The options object.
 * @param {Object} options.query - The query object containing pagination and filtering parameters.
 * @param {Object} options.user - The user object used for authorization.
 * @param {Object} options.schema - The schema object used for filtering and querying.
 * @param {Array} options.filterFields - The fields to use for filtering.
 * @param {Array} options.searchFields - The fields to use for searching.
 * @param {Object} options.prisma - The Prisma client instance used for database operations.
 * @param {string} options.model - The name of the Prisma model to query.
 *
 * @returns {Promise<Object>} Returns an object containing the paginated list and pagination metadata.
 */
async function getPaginatedList({
  query,
  user,
  schema,
  filterFields,
  searchFields,
  prisma,
  model,
  include,
  select,
  customWhere = {},
  executionMode = 'transaction',
}) {
  // Use the optimized implementation and normalize the response shape
  const optimizedResult = await getOptimizedPaginatedList({
    query,
    user,
    schema,
    filterFields,
    searchFields,
    prisma,
    model,
    include,
    select,
    customWhere,
    useIndexedSearch: true,
    executionMode,
  });

  const {
    totalCount,
    pageCount,
    currentPage,
    perPage,
    results,
    _meta = {},
  } = optimizedResult || {};

  return {
    currentPage: currentPage || 1,
    results: results || [],
    totalCount: totalCount || 0,
    pageCount: pageCount || 0,
    perPage: perPage || (query?.pageSize ? +query.pageSize : query?.perPage ? +query.perPage : 10),
    hasNextPage: !!_meta.hasNextPage,
    hasPreviousPage: !!_meta.hasPreviousPage,
    isTotalUnknown: !!_meta.isTotalUnknown,
  };
}

function buildRegularSearchConditions(search, searchFields) {
  const escapedSearch = search.replace(/[%_\\]/g, '\\$&');

  const exactMatchConditions = searchFields.map((field) => ({
    [field]: { equals: search, mode: 'insensitive' },
  }));

  const startsWithConditions = searchFields.map((field) => ({
    [field]: { startsWith: search, mode: 'insensitive' },
  }));

  const containsConditions = searchFields.map((field) => ({
    [field]: { contains: escapedSearch, mode: 'insensitive' },
  }));

  return {
    OR: [
      ...exactMatchConditions,
      ...startsWithConditions,
      ...containsConditions,
    ],
  };
}

// Keep this synchronous to match tests
function buildFullTextSearchConditions(
  search,
  searchFields /* prisma, model */
) {
  if (!search || !searchFields.length) return {};
  // Default to regular search conditions synchronously for compatibility
  return buildRegularSearchConditions(search, searchFields);
}

/**
 * Extracts the raw value from a Prisma condition object for validation.
 * The parseFilters middleware converts query params like `isEnabled=true`
 * to condition objects like `{equals: true}`. We need to extract the raw
 * value for Joi schema validation, then use the original condition for queries.
 *
 * @param {*} value - The value (may be raw or condition object)
 * @returns {*} The raw value for validation
 */
function extractRawValueFromCondition(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object' || Array.isArray(value)) return value;

  // Handle Prisma condition objects from parseFilters middleware
  if ('equals' in value) return value.equals;
  if ('in' in value && Array.isArray(value.in)) return value.in[0]; // First value for type checking
  if ('gte' in value) return value.gte;
  if ('lte' in value) return value.lte;
  if ('gt' in value) return value.gt;
  if ('lt' in value) return value.lt;

  // Not a recognized condition object, return as-is
  return value;
}

/**
 * Coerces a query parameter string value to the expected type based on Joi schema.
 * Query parameters from URLs are always strings, so we need to convert them
 * to the types expected by the schema (boolean, number, etc.).
 *
 * @param {*} value - The value to coerce
 * @param {string} expectedType - The expected Joi type ('boolean', 'number', 'string', etc.)
 * @returns {*} The coerced value
 */
function coerceToSchemaType(value, expectedType) {
  if (typeof value !== 'string') return value;

  // Handle "null" string specially - it's processed later in filter building
  if (value === 'null') return value;

  switch (expectedType) {
    case 'boolean':
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value; // Let Joi validation handle invalid values

    case 'number':
      if (value === '') return value;
      const num = Number(value);
      return Number.isFinite(num) ? num : value;

    default:
      // Keep strings (including UUIDs) as-is
      return value;
  }
}

/**
 * Extracts field types from a Joi schema using describe().
 * @param {Object} schema - Joi schema object
 * @returns {Object} Map of field names to their Joi types
 */
function getSchemaFieldTypes(schema) {
  const fieldTypes = {};
  try {
    const description = schema.describe();
    if (description.keys) {
      for (const [field, fieldSchema] of Object.entries(description.keys)) {
        fieldTypes[field] = fieldSchema.type;
      }
    }
  } catch (e) {
    // If describe() fails, return empty map - values won't be coerced
  }
  return fieldTypes;
}

async function buildAdvancedFilterConditions(filters, filterFields, schema) {
  const filterConditions = [];
  const rawKeys = Object.keys(filters || {});
  const supportedKeys = rawKeys.filter((k) => filterFields.includes(k));
  if (!supportedKeys.length) return filterConditions;

  // Get expected types from Joi schema for proper coercion
  const fieldTypes = getSchemaFieldTypes(schema);

  // Validate only supported filter keys to avoid injecting defaults for unrelated fields
  // Pre-process values:
  // 1. Extract raw values from Prisma condition objects (e.g., {equals: true} → true)
  // 2. Coerce query parameter strings to proper types based on schema
  const toValidate = supportedKeys.reduce((acc, key) => {
    const rawValue = extractRawValueFromCondition(filters[key]);
    const expectedType = fieldTypes[key] || fieldTypes[toCamelCase(key)];
    acc[key] = coerceToSchemaType(rawValue, expectedType);
    return acc;
  }, {});

  let validatedFilters;
  try {
    validatedFilters = await schema.validateAsync(toValidate, {
      stripUnknown: true,
      abortEarly: false,
    });
  } catch (validationError) {
    logEvent(
      `[FILTER_VALIDATION_WARNING] Invalid filter values ignored: ${validationError.message} | Filters: ${JSON.stringify(toValidate)}`
    );
    return filterConditions;
  }

  // Build Prisma filter conditions using the original filter values
  // (which may be condition objects from parseFilters middleware)
  for (const field of Object.keys(validatedFilters)) {
    if (!filterFields.includes(field)) continue;

    // Use original filter value (may be condition object) for building Prisma query
    const originalValue = filters[field];
    const camelCaseField = toCamelCase(field);

    if (originalValue === 'null' || originalValue === null) {
      filterConditions.push({ [camelCaseField]: null });
    } else if (Array.isArray(originalValue)) {
      filterConditions.push({ [camelCaseField]: { in: originalValue } });
    } else if (typeof originalValue === 'object' && originalValue !== null) {
      // Handle Prisma condition objects from parseFilters middleware
      // Supports: equals, in, gt, gte, lt, lte operators
      if (originalValue.equals !== undefined) {
        // { equals: value } → direct equality filter
        filterConditions.push({ [camelCaseField]: originalValue.equals });
      } else if (originalValue.in !== undefined) {
        // { in: [...] } → IN filter
        filterConditions.push({ [camelCaseField]: { in: originalValue.in } });
      } else {
        // Range operators: gte, lte, gt, lt
        const rangeCondition = {};
        if (originalValue.gte !== undefined) rangeCondition.gte = originalValue.gte;
        if (originalValue.lte !== undefined) rangeCondition.lte = originalValue.lte;
        if (originalValue.gt !== undefined) rangeCondition.gt = originalValue.gt;
        if (originalValue.lt !== undefined) rangeCondition.lt = originalValue.lt;
        if (Object.keys(rangeCondition).length) {
          filterConditions.push({ [camelCaseField]: rangeCondition });
        }
      }
    } else {
      filterConditions.push({ [camelCaseField]: originalValue });
    }
  }

  return filterConditions;
}

function buildFieldCondition(field, condition, params, paramIndex) {
  let sql = '';
  let nextIndex = paramIndex;

  if (condition.equals !== undefined) {
    if (condition.equals === null) {
      sql = `"${field}" IS NULL`;
    } else {
      const cast = shouldCastFieldValueToUuid(field, condition.equals)
        ? '::uuid'
        : '';
      sql = `"${field}" = $${nextIndex}${cast}`;
      params.push(condition.equals);
      nextIndex++;
    }
  } else if (condition.contains !== undefined) {
    sql = `"${field}" ILIKE $${nextIndex}`;
    params.push(`%${condition.contains}%`);
    nextIndex++;
  } else if (condition.startsWith !== undefined) {
    sql = `"${field}" ILIKE $${nextIndex}`;
    params.push(`${condition.startsWith}%`);
    nextIndex++;
  } else if (condition.endsWith !== undefined) {
    sql = `"${field}" ILIKE $${nextIndex}`;
    params.push(`%${condition.endsWith}`);
    nextIndex++;
  } else if (condition.in !== undefined && Array.isArray(condition.in)) {
    const castToUuid = shouldCastFieldValueToUuid(field, condition.in);
    const placeholders = condition.in.map(() => {
      const placeholder = `$${nextIndex}${castToUuid ? '::uuid' : ''}`;
      nextIndex++;
      return placeholder;
    });
    sql = `"${field}" IN (${placeholders.join(', ')})`;
    params.push(...condition.in);
  } else if (condition.gte !== undefined) {
    sql = `"${field}" >= $${nextIndex}`;
    params.push(condition.gte);
    nextIndex++;
  } else if (condition.lte !== undefined) {
    sql = `"${field}" <= $${nextIndex}`;
    params.push(condition.lte);
    nextIndex++;
  } else if (condition.gt !== undefined) {
    sql = `"${field}" > $${nextIndex}`;
    params.push(condition.gt);
    nextIndex++;
  } else if (condition.lt !== undefined) {
    sql = `"${field}" < $${nextIndex}`;
    params.push(condition.lt);
    nextIndex++;
  }

  return { sql, nextIndex };
}

function buildRawSQLWhereClause(where, model, startingParamIndex = 1) {
  const conditions = [];
  const params = [];
  let paramIndex = startingParamIndex;

  for (const [key, value] of Object.entries(where || {})) {
    if (key === 'deleted' || key === 'AND' || key === 'OR' || key === 'NOT') {
      continue;
    }

    if (value === null) {
      conditions.push(`"${key}" IS NULL`);
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      const condition = buildFieldCondition(key, value, params, paramIndex);
      if (condition.sql) {
        conditions.push(condition.sql);
        paramIndex = condition.nextIndex;
      }
    } else {
      const cast = shouldCastFieldValueToUuid(key, value) ? '::uuid' : '';
      conditions.push(`"${key}" = $${paramIndex}${cast}`);
      params.push(value);
      paramIndex++;
    }
  }

  if (where && where.AND && Array.isArray(where.AND)) {
    const andConditions = [];
    for (const andCond of where.AND) {
      for (const [key, value] of Object.entries(andCond)) {
        if (key === 'OR') continue;
        if (value === null) {
          andConditions.push(`"${key}" IS NULL`);
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          const condition = buildFieldCondition(key, value, params, paramIndex);
          if (condition.sql) {
            andConditions.push(condition.sql);
            paramIndex = condition.nextIndex;
          }
        } else {
          const cast = shouldCastFieldValueToUuid(key, value) ? '::uuid' : '';
          andConditions.push(`"${key}" = $${paramIndex}${cast}`);
          params.push(value);
          paramIndex++;
        }
      }
    }
    if (andConditions.length > 0) {
      conditions.push(`(${andConditions.join(' AND ')})`);
    }
  }

  return {
    sql: conditions.join(' AND '),
    params,
  };
}

async function getOptimizedCount(where, prismaClient, model) {
  const hasOrConditions = where.OR && where.OR.length > 0;
  const hasAndConditions = where.AND && where.AND.length > 0;
  const hasNestedConditions = (where.AND || []).some(
    (cond) =>
      cond.OR ||
      cond.AND ||
      Object.values(cond).some(
        (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
      )
  );

  const isComplexQuery =
    hasOrConditions ||
    (hasAndConditions && where.AND.length > 3) ||
    hasNestedConditions;

  // If OR conditions are present, avoid raw SQL fallback to prevent logic drift
  if (!isComplexQuery || hasNestedConditions || hasOrConditions) {
    return prismaClient[model].count({
      where: { ...where, deleted: null },
    });
  }

  const tableName = model.charAt(0).toUpperCase() + model.slice(1);
  try {
    const whereClause = buildRawSQLWhereClause(where, model);
    const countQuery = `
      SELECT COUNT(*) as count
      FROM "${tableName}"
      WHERE deleted IS NULL ${whereClause.sql ? `AND ${whereClause.sql}` : ''}
    `;
    const result = await queryRaw(
      prismaClient,
      countQuery,
      ...whereClause.params
    );
    return parseInt(result[0]?.count || 0, 10);
  } catch (error) {
    logEvent(
      `[OPTIMIZED_COUNT_ERROR] Falling back to regular count: ${error.message}`
    );
    return prismaClient[model].count({
      where: { ...where, deleted: null },
    });
  }
}

async function estimateCount(prismaClient, model, where) {
  const tableName = model.charAt(0).toUpperCase() + model.slice(1);
  try {
    const statsQuery = `
      SELECT 
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples,
        last_vacuum,
        last_analyze
      FROM pg_stat_user_tables
      WHERE schemaname = 'public' AND relname = $1
    `;
    // Run metadata query outside any active transaction to avoid aborting the tx on error
    const stats = await queryRaw(undefined, statsQuery, tableName);
    if (!stats || stats.length === 0) {
      return prismaClient[model].count({
        where: { ...where, deleted: null },
      });
    }
    const liveRows = parseInt(stats[0]?.live_tuples || 0, 10);
    if (liveRows < 10000) {
      return prismaClient[model].count({
        where: { ...where, deleted: null },
      });
    }
    if (where.AND?.length > 0 || where.OR?.length > 0) {
      const sampleSize = Math.min(1000, Math.floor(liveRows * 0.01));
      const sampleQuery = `
        SELECT COUNT(*) as count
        FROM (
          SELECT 1
          FROM "${tableName}"
          WHERE deleted IS NULL
          LIMIT ${sampleSize}
        ) as sample
      `;
      const sampleResult = await queryRaw(prismaClient, sampleQuery);
      const sampleCount = parseInt(sampleResult[0]?.count || 0, 10);
      if (sampleCount === sampleSize) {
        return Math.floor(liveRows * 0.8);
      }
      return sampleCount;
    }
    return liveRows;
  } catch (error) {
    logEvent(`[ESTIMATE_COUNT_ERROR] ${error.message}`);
    return prismaClient[model].count({
      where: { ...where, deleted: null },
    });
  }
}

async function smartCountStrategy(
  where,
  prismaClient,
  model,
  currentPage /* , perPage */
) {
  try {
    if (currentPage <= 2) {
      return getOptimizedCount(where, prismaClient, model);
    }

    const tableName = model.charAt(0).toUpperCase() + model.slice(1);
    const sizeCheckQuery = `
      SELECT 
        pg_relation_size('"${tableName}"'::regclass) as table_size,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      WHERE schemaname = 'public' AND relname = $1
    `;
    // Run metadata query outside any active transaction to avoid aborting the tx on error
    const sizeResult = await queryRaw(undefined, sizeCheckQuery, tableName);
    if (!sizeResult || sizeResult.length === 0) {
      return getOptimizedCount(where, prismaClient, model);
    }
    const tableSize = parseInt(sizeResult[0]?.table_size || 0, 10);
    const rowCount = parseInt(sizeResult[0]?.row_count || 0, 10);
    const SMALL_TABLE_ROWS = 10000;
    const MEDIUM_TABLE_ROWS = 100000;
    const LARGE_TABLE_SIZE = 100 * 1024 * 1024;

    if (rowCount < SMALL_TABLE_ROWS) {
      return getOptimizedCount(where, prismaClient, model);
    }
    if (rowCount < MEDIUM_TABLE_ROWS || currentPage <= 5) {
      return getOptimizedCount(where, prismaClient, model);
    }
    if (tableSize > LARGE_TABLE_SIZE && currentPage > 5) {
      return estimateCount(prismaClient, model, where);
    }
    return getOptimizedCount(where, prismaClient, model);
  } catch (error) {
    logEvent(`[SMART_COUNT_ERROR] ${error.message}`);
    return getOptimizedCount(where, prismaClient, model);
  }
}

async function checkFullTextSearchSupport(prismaClient, model) {
  if (ftsSupportCache.has(model)) {
    return ftsSupportCache.get(model);
  }
  const tableName = model.charAt(0).toUpperCase() + model.slice(1);
  try {
    const result = await queryRaw(
      prismaClient,
      `
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE (table_name = $1 OR table_name = LOWER($1))
        AND table_schema = 'public'
        AND column_name = 'search_vector'
      ) as has_search_vector
    `,
      tableName
    );
    const supported = !!result[0]?.has_search_vector;
    try {
      logEvent(`[FTS_SUPPORTED] Model: ${model}, Supported: ${supported}`);
    } catch (e) {
      /* no-op */
    }
    ftsSupportCache.set(model, supported);
    return supported;
  } catch (error) {
    logEvent(`[FTS_CHECK_ERROR] ${error.message}`);
    return false;
  }
}

function buildPostgreSQLFullTextSearch(search, model) {
  const trimmed = (search || '').trim();
  if (!trimmed) return {};
  return {
    _fullTextSearch: {
      query: trimmed, // raw user input; SQL will use websearch_to_tsquery
      vector: 'search_vector',
      model,
    },
  };
}

async function executeFullTextSearchQuery({
  prisma: prismaClient,
  model,
  where,
  orderBy,
  include,
  select,
  skip,
  take,
  searchQuery,
}) {
  const tableName = model.charAt(0).toUpperCase() + model.slice(1);
  try {
    // Parameters: $1 searchQuery, $2 take, $3 skip, so offset where params at 4
    // Build a pruned WHERE for FTS that excludes search-derived ORs; keep visibility/deleted only
    const ftsWhere = (() => {
      const source = where || {};
      const clone = _.cloneDeep(source);
      if (Object.prototype.hasOwnProperty.call(clone, 'OR')) {
        delete clone.OR;
      }
      if (Array.isArray(clone.AND)) {
        clone.AND = clone.AND.map((andCond) => {
          if (!andCond || typeof andCond !== 'object') return andCond;
          if (Object.prototype.hasOwnProperty.call(andCond, 'OR')) {
            const { OR, ...rest } = andCond;
            return rest;
          }
          return andCond;
        }).filter((c) => c && Object.keys(c).length > 0);
        if (clone.AND.length === 0) delete clone.AND;
      }
      return clone;
    })();
    const whereClause = buildRawSQLWhereClause(ftsWhere, model, 4);
    // IMPORTANT: Do not select the tsvector column as Prisma cannot deserialize it via $queryRaw.
    // We fetch only the primary keys (ids) ordered by rank, then hydrate via Prisma.
    const query = `
      SELECT id,
             ts_rank(search_vector, websearch_to_tsquery('english', $1)) as search_rank
      FROM "${tableName}"
      WHERE deleted IS NULL 
        ${whereClause.sql ? `AND ${whereClause.sql}` : ''}
        AND search_vector @@ websearch_to_tsquery('english', $1)
      ORDER BY search_rank DESC, "createdAt" DESC
      LIMIT $2 OFFSET $3
    `;
    const rankedRows = await queryRaw(
      prismaClient,
      query,
      searchQuery,
      take,
      skip,
      ...whereClause.params
    );

    const ids = rankedRows.map((r) => r.id);
    if (!ids.length) return [];

    // Hydrate full records via Prisma to avoid raw tsvector deserialization, preserving order from FTS.
    const hydrationWhere = _.cloneDeep(where || {});
    hydrationWhere.id = { in: ids };
    // Drop top-level OR (search-derived) to avoid excluding valid FTS IDs during hydration
    if (
      searchQuery &&
      Object.prototype.hasOwnProperty.call(hydrationWhere, 'OR')
    ) {
      delete hydrationWhere.OR;
    }
    const prismaArgs = {
      where: hydrationWhere,
    };
    if (include && Object.keys(include).length > 0) {
      prismaArgs.include = include;
    } else if (select && Object.keys(select).length > 0) {
      prismaArgs.select = select;
    }
    const records = await prismaClient[model].findMany(prismaArgs);

    // Log FTS performance metrics and where clause
    logEvent(
      `[FTS_RESULTS] Model: ${model}, FTS found: ${rankedRows.length} records, Prisma hydrated: ${records.length} records`
    );
    logEvent(
      `[FTS_WHERE_CLAUSE] Model: ${model}, Where: ${JSON.stringify(
        prismaArgs.where
      )}`
    );

    const positionById = new Map(ids.map((id, index) => [id, index]));
    records.sort(
      (a, b) => (positionById.get(a.id) ?? 0) - (positionById.get(b.id) ?? 0)
    );
    return records;
  } catch (error) {
    logEvent(
      `[FTS_QUERY_ERROR] Falling back to regular search: ${error.message}`
    );
    return prismaClient[model].findMany({
      where,
      orderBy,
      include,
      select,
      skip,
      take,
    });
  }
}

async function getOptimizedPaginatedList({
  query,
  user,
  schema,
  filterFields,
  searchFields,
  prisma: prismaClient,
  model,
  include,
  select,
  customWhere = {},
  useIndexedSearch = true,
  executionMode = 'transaction',
}) {
  const startTime = Date.now();
  try {
    const {
      pageSize,
      perPage: perPageInput,
      page,
      search,
      ordering = '',
      countStrategy = 'smart',
      ...filters
    } = query;

    const visibilityFilters = getVisibilityFilters(user);
    const baseWhere = { ...visibilityFilters, deleted: null };

    // Default to regular search; opt-in to FTS if supported
    let isFullTextSearch = false;
    let searchQuery = null;
    const hasSearch = !!(search && searchFields.length);
    const where = { ...baseWhere, ...customWhere };

    let ftsCheckMs = 0;
    if (hasSearch) {
      const x0 = Date.now();
      const ftsSupported = await checkFullTextSearchSupport(
        prismaClient,
        model
      );
      ftsCheckMs = Date.now() - x0;
      if (useIndexedSearch && ftsSupported) {
        isFullTextSearch = true;
        const fts = buildPostgreSQLFullTextSearch(search, model);
        searchQuery = fts._fullTextSearch.query;
      } else {
        const regular = buildFullTextSearchConditions(search, searchFields);
        if (regular.OR?.length) where.OR = regular.OR;
      }
    }

    const filterConditions = await buildAdvancedFilterConditions(
      filters,
      filterFields,
      schema
    );
    if (filterConditions.length) {
      where.AND = Array.isArray(where.AND) ? where.AND : [];
      where.AND.push(...filterConditions);
    }

    const resolvedPageSize = pageSize ?? perPageInput;
    const perPage = Math.min(Math.max(+(resolvedPageSize ?? 10), 1), 100);
    const currentPage = Math.max(+(page ?? 1), 1);
    const skip = (currentPage - 1) * perPage;

    const allowedOrderFields = [
      ...filterFields,
      'createdAt',
      'updatedAt',
      'id',
    ];
    const hasHyphen = typeof ordering === 'string' && ordering.startsWith('-');
    const orderingField = hasHyphen ? ordering.substring(1) : ordering;
    const orderCol = allowedOrderFields.includes(orderingField)
      ? orderingField
      : 'createdAt';
    const orderDirection = hasHyphen ? 'desc' : 'asc';
    const orderBy = [
      { [orderCol]: orderDirection },
      ...(orderCol !== 'id' ? [{ id: 'asc' }] : []),
    ];

    const hasValidInclude = isObject(include) && Object.keys(include).length;
    const hasValidSelect = isObject(select) && Object.keys(select).length;

    let totalCount;
    let items;
    let queueWaitMs = 0;
    let countMs = 0;
    let itemsMs = 0;
    // Default behavior: always use fast path for searches (skip count, use +1 fetch)
    const allowParallel = true;
    const useFastSearchPath = hasSearch;
    if (executionMode === 'parallel' && allowParallel) {
      // Optional parallel mode (no transaction) - use with caution
      let countPromise = Promise.resolve(0);
      if (!useFastSearchPath) {
        const c0 = Date.now();
        if (countStrategy === 'exact') {
          countPromise = getOptimizedCount(where, prismaClient, model);
        } else if (countStrategy === 'estimate') {
          countPromise = estimateCount(prismaClient, model, where);
        } else {
          countPromise = smartCountStrategy(
            where,
            prismaClient,
            model,
            currentPage,
            perPage
          );
        }
        countPromise = countPromise.then((r) => {
          countMs = Date.now() - c0;
          return r;
        });
      }

      const i0 = Date.now();
      const itemsPromise = (
        isFullTextSearch
          ? executeFullTextSearchQuery({
              prisma: prismaClient,
              model,
              where,
              orderBy,
              include: hasValidInclude ? include : undefined,
              select: hasValidSelect ? select : undefined,
              skip,
              take: useFastSearchPath ? perPage + 1 : perPage,
              searchQuery,
            })
          : prismaClient[model].findMany({
              where,
              orderBy,
              include: hasValidInclude ? include : undefined,
              select: hasValidSelect ? select : undefined,
              skip,
              take: useFastSearchPath ? perPage + 1 : perPage,
            })
      ).then((r) => {
        itemsMs = Date.now() - i0;
        return r;
      });

      [totalCount, items] = await Promise.all([countPromise, itemsPromise]);
    } else {
      // Safe default: transactional, sequential (with extended timeout)
      const txOptions = {
        maxWait: +(process.env.PRISMA_TX_MAX_WAIT_MS || 15000),
        timeout: +(process.env.PRISMA_TX_TIMEOUT_MS || 30000),
        isolationLevel: 'ReadCommitted',
      };
      const wallBeforeTx = Date.now();
      const resultsInTx = await prismaClient.$transaction(async (tx) => {
        const txEnterAt = Date.now();
        queueWaitMs = txEnterAt - wallBeforeTx;

        let countResult = 0;
        if (!useFastSearchPath) {
          const c0 = Date.now();
          let countPromise;
          if (countStrategy === 'exact') {
            countPromise = getOptimizedCount(where, tx, model);
          } else if (countStrategy === 'estimate') {
            countPromise = estimateCount(tx, model, where);
          } else {
            countPromise = smartCountStrategy(
              where,
              tx,
              model,
              currentPage,
              perPage
            );
          }
          countResult = await countPromise;
          countMs = Date.now() - c0;
        }

        const i0 = Date.now();
        const itemsPromise = isFullTextSearch
          ? executeFullTextSearchQuery({
              prisma: tx,
              model,
              where,
              orderBy,
              include: hasValidInclude ? include : undefined,
              select: hasValidSelect ? select : undefined,
              skip,
              take: useFastSearchPath ? perPage + 1 : perPage,
              searchQuery,
            })
          : tx[model].findMany({
              where,
              orderBy,
              include: hasValidInclude ? include : undefined,
              select: hasValidSelect ? select : undefined,
              skip,
              take: useFastSearchPath ? perPage + 1 : perPage,
            });
        const itemsResult = await itemsPromise;
        itemsMs = Date.now() - i0;

        return [countResult, itemsResult];
      }, txOptions);
      [totalCount, items] = resultsInTx;
    }

    let hasNextPage = false;
    if (useFastSearchPath) {
      hasNextPage = Array.isArray(items) && items.length > perPage;
      if (hasNextPage) items.pop();
    }
    const totalPages = useFastSearchPath
      ? null
      : Math.ceil(totalCount / perPage);
    if (!useFastSearchPath) {
      hasNextPage = currentPage < totalPages;
    }
    const hasPreviousPage = currentPage > 1;

    const h0 = Date.now();
    const results =
      (await getDetailsFromAPI({
        results: items,
        token: user?.accessToken,
      })) || items;
    const hydrationMs = Date.now() - h0;

    const executionTime = Date.now() - startTime;
    try {
      logEvent(
        `[PROF] model=${model} ftsCheck=${ftsCheckMs}ms queueWait=${queueWaitMs}ms count=${countMs}ms items=${itemsMs}ms hydrate=${hydrationMs}ms total=${executionTime}ms`
      );
    } catch (e) {
      /* no-op */
    }
    if (executionTime > 1000) {
      logEvent(
        `[SLOW_QUERY] Model: ${model}, Time: ${executionTime}ms, Count: ${totalCount}`
      );
    }

    return {
      totalCount,
      pageCount: totalPages,
      currentPage,
      perPage,
      results,
      _meta: {
        executionTime,
        hasNextPage,
        hasPreviousPage,
        isTotalUnknown: !!useFastSearchPath,
        searchApplied: !!search,
        filtersApplied: Object.keys(filters).length,
      },
    };
  } catch (error) {
    // Avoid passing an object as traceId; include data inside the message
    logEvent(
      `[PAGINATION_ERROR] ${error.message} | Data: ${JSON.stringify({
        model,
        queryKeys: Object.keys(query || {}),
      })}`
    );
    throw createStandardError(
      ERROR_TYPES.INTERNAL,
      'Failed to retrieve paginated data',
      {
        severity: ERROR_SEVERITY.MEDIUM,
        context: 'optimized_pagination',
        details: { model, error: error.message },
      }
    );
  }
}

module.exports = {
  isCodeUnique,
  generateUniqueCode,
  getListFiltersAndQueries,
  getPaginatedList,
  verifyForeignKeyAccessBatch,
  rebaseOrders,
  renormalizeOrders,
  getOptimizedPaginatedList,
  buildFullTextSearchConditions,
  buildAdvancedFilterConditions,
  getOptimizedCount,
  estimateCount,
  smartCountStrategy,
  buildRawSQLWhereClause,
  buildFieldCondition,
  checkFullTextSearchSupport,
  buildPostgreSQLFullTextSearch,
  executeFullTextSearchQuery,
};
