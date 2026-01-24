/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * Express middleware factory for parsing query filter parameters.
 * Transforms field__operator=value syntax into Prisma-compatible filter objects.
 *
 *
 */

const _ = require('lodash');
const { extractTypesFromSchema } = require('#core/utils/filterSchemaUtils.js');
const { handleFilterValidationError } = require('#core/utils/errorHandlingUtils.js');
const { toCamelCase } = require('#core/utils/stringUtils.js');

const OPERATOR_SUFFIX_REGEX = /^(.+)__(eq|in|gt|gte|lt|lte|between)$/;
const RESERVED_PARAMS = ['page', 'pageSize', 'perPage', 'search', 'ordering', 'countStrategy', 'autocomplete'];

/**
 * Coerces a string value to the target type
 * @param {string} value - String value from query param
 * @param {string} type - Target type (number, date, boolean, string, enum)
 * @returns {*} Coerced value
 * @throws {Error} If value cannot be coerced to target type
 */
function coerceValue(value, type) {
  if (value === 'null') return null;

  switch (type) {
    case 'number': {
      if (value === '' || value.trim() === '') throw new Error('expected number');
      const num = Number(value);
      if (Number.isNaN(num)) throw new Error('expected number');
      return num;
    }

    case 'date': {
      const date = new Date(value);
      if (isNaN(date.getTime())) throw new Error('expected valid date (ISO 8601)');
      return date.toISOString();
    }

    case 'boolean':
      if (value === 'true') return true;
      if (value === 'false') return false;
      throw new Error('expected true or false');

    case 'enum':
    case 'string':
    default:
      return String(value);
  }
}

/**
 * Builds a Prisma-compatible condition object from operator and value
 * @param {string} operator - Filter operator (eq, in, gt, gte, lt, lte, between)
 * @param {string} value - Raw string value from query param
 * @param {Object} fieldType - Field type info { type, operators, values? }
 * @param {string} field - Field name for error reporting
 * @param {Array} errors - Array to push errors to
 * @returns {Object|null} Prisma condition object or null on error
 */
function buildCondition(operator, value, fieldType, field, errors) {
  switch (operator) {
    case 'eq':
      return { equals: coerceValue(value, fieldType.type) };

    case 'in': {
      const parts = value.split(',').map(v => v.trim()).filter(Boolean);
      if (parts.length === 0) {
        errors.push({ field, operator, reason: 'list cannot be empty', value });
        return null;
      }
      if (fieldType.type === 'enum') {
        const invalid = parts.filter(p => !fieldType.values.includes(p));
        if (invalid.length) {
          errors.push({
            field,
            operator,
            reason: `invalid values: ${invalid.join(', ')}`,
            value,
          });
          return null;
        }
      }
      return { in: parts.map(v => coerceValue(v, fieldType.type)) };
    }

    case 'gt':
      return { gt: coerceValue(value, fieldType.type) };

    case 'gte':
      return { gte: coerceValue(value, fieldType.type) };

    case 'lt':
      return { lt: coerceValue(value, fieldType.type) };

    case 'lte':
      return { lte: coerceValue(value, fieldType.type) };

    case 'between': {
      const parts = value.split(',').map(v => v.trim());
      if (parts.length !== 2) {
        errors.push({
          field,
          operator,
          reason: 'requires exactly 2 comma-separated values',
          value,
        });
        return null;
      }
      return {
        gte: coerceValue(parts[0], fieldType.type),
        lte: coerceValue(parts[1], fieldType.type),
      };
    }

    default:
      return null;
  }
}

/**
 * Parses a single filter parameter from query string
 * @param {string} key - Query param key (e.g., "amount__gte" or "status")
 * @param {string} value - Query param value
 * @param {Object} options - Parser options
 * @param {Array} options.filterFields - List of allowed filter field names
 * @param {Object} options.typeMap - Map of field names to type info
 * @param {Array} options.errors - Array to push errors to
 * @returns {Object|null} { field, condition } or null on error
 */
function parseFilterParam(key, value, { filterFields, typeMap, errors }) {
  const match = key.match(OPERATOR_SUFFIX_REGEX);

  let field, operator;
  if (match) {
    field = toCamelCase(match[1]);
    operator = match[2];
  } else {
    field = toCamelCase(key);
    operator = 'eq'; // implicit
  }

  // Validate field exists
  if (!filterFields.includes(field)) {
    errors.push({ field, operator, reason: 'unknown field' });
    return null;
  }

  const fieldType = typeMap[field] || { type: 'string', operators: ['eq', 'in'] };

  // Validate operator allowed for field type
  if (!fieldType.operators.includes(operator)) {
    errors.push({
      field,
      operator,
      reason: `operator '${operator}' not supported for ${fieldType.type} field`,
    });
    return null;
  }

  // Parse and coerce value
  try {
    const condition = buildCondition(operator, value, fieldType, field, errors);
    if (condition === null) return null;
    return { field, condition };
  } catch (err) {
    errors.push({ field, operator, reason: err.message, value });
    return null;
  }
}

/**
 * Express middleware factory for parsing query filter parameters
 * @param {Object} options - Middleware options
 * @param {Object} options.schema - Joi schema for type introspection
 * @param {Array} options.filterFields - List of allowed filter field names
 * @returns {Function} Express middleware function
 */
function parseFilters({ schema, filterFields }) {
  return (req, res, next) => {
    const errors = [];
    const typeMap = extractTypesFromSchema(schema);

    for (const [key, value] of Object.entries(req.query)) {
      // Convert key to camelCase before checking reserved params
      // This handles both snake_case (page_size) and camelCase (pageSize) inputs
      const normalizedKey = toCamelCase(key);
      if (RESERVED_PARAMS.includes(normalizedKey)) continue;

      const parsed = parseFilterParam(key, value, {
        filterFields,
        typeMap,
        errors,
      });

      if (parsed) {
        req.query[parsed.field] = parsed.condition;
        if (key !== parsed.field) delete req.query[key];
      }
    }

    if (errors.length) {
      return next(handleFilterValidationError(errors));
    }
    next();
  };
}

module.exports = {
  parseFilters,
  coerceValue,
  buildCondition,
  parseFilterParam,
  RESERVED_PARAMS,
};
