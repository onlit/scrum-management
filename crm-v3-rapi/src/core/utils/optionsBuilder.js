/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Converts Joi schemas to OPTIONS response format using joi-to-json.
 *
 * Follows Single Responsibility Principle: only handles schema conversion.
 * Follows Open/Closed Principle: METHOD_ERRORS can be extended without modification.
 * Follows DRY: reuses TYPE_OPERATORS from filterSchemaUtils.
 */

const joiToJson = require('joi-to-json');
const { extractTypesFromSchema, TYPE_OPERATORS } = require('./filterSchemaUtils.js');
const {
  ERROR_TYPES,
  STATUS_CODES,
  ERROR_MESSAGES,
} = require('#core/exceptions/domain.exception.js');

/**
 * Helper to create error entry from existing constants.
 * @param {string} type - Error type from ERROR_TYPES
 * @returns {Object} Error definition { status, code, message }
 */
function errorFromType(type) {
  return {
    status: STATUS_CODES[type],
    code: type,
    message: ERROR_MESSAGES[type],
  };
}

/**
 * Static error definitions per HTTP method.
 * Uses ERROR_TYPES from domain.exception.js for consistency.
 * All methods also receive AUTHENTICATION and AUTHORIZATION errors.
 */
const METHOD_ERRORS = {
  GET: [
    errorFromType(ERROR_TYPES.BAD_REQUEST),
  ],
  POST: [
    errorFromType(ERROR_TYPES.BAD_REQUEST),
    errorFromType(ERROR_TYPES.VALIDATION),
  ],
  PUT: [
    errorFromType(ERROR_TYPES.BAD_REQUEST),
    errorFromType(ERROR_TYPES.VALIDATION),
    errorFromType(ERROR_TYPES.NOT_FOUND),
  ],
  PATCH: [
    errorFromType(ERROR_TYPES.BAD_REQUEST),
    errorFromType(ERROR_TYPES.VALIDATION),
    errorFromType(ERROR_TYPES.NOT_FOUND),
  ],
  DELETE: [
    errorFromType(ERROR_TYPES.NOT_FOUND),
  ],
};

const COMMON_ERRORS = [
  errorFromType(ERROR_TYPES.AUTHENTICATION),
  errorFromType(ERROR_TYPES.AUTHORIZATION),
];

const RESERVED_PARAMS = [
  { name: 'page', required: false, schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'pageSize', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
  { name: 'search', required: false, schema: { type: 'string' } },
  { name: 'ordering', required: false, schema: { type: 'string', description: 'Field name, prefix with - for descending' } },
];

/**
 * Recursively sets additionalProperties: false on all object schemas.
 * @param {Object} schema - JSON Schema object
 */
function setStrictMode(schema) {
  if (!schema || typeof schema !== 'object') return;

  if (schema.type === 'object') {
    schema.additionalProperties = false;
  }

  if (schema.properties) {
    for (const prop of Object.values(schema.properties)) {
      setStrictMode(prop);
    }
  }

  if (schema.items) {
    setStrictMode(schema.items);
  }
}

/**
 * Recursively normalizes schema types by removing null and converting arrays to strings.
 * Transforms type: ["string", "null"] to type: "string"
 * @param {Object} schema - JSON Schema object
 */
function normalizeSchemaTypes(schema) {
  if (!schema || typeof schema !== 'object') return;

  // If type is an array, filter out "null" and flatten to string if single type remains
  if (Array.isArray(schema.type)) {
    const nonNullTypes = schema.type.filter((t) => t !== 'null');
    schema.type = nonNullTypes.length === 1 ? nonNullTypes[0] : nonNullTypes;
  }

  // Recurse into properties
  if (schema.properties) {
    for (const prop of Object.values(schema.properties)) {
      normalizeSchemaTypes(prop);
    }
  }

  // Recurse into array items
  if (schema.items) {
    normalizeSchemaTypes(schema.items);
  }
}

/**
 * Converts a Joi schema to JSON Schema draft-07 with strict mode.
 * @param {Object} joiSchema - Joi schema object
 * @param {Object} options - Conversion options
 * @param {boolean} options.allOptional - Remove required array
 * @returns {Object|null} JSON Schema or null
 */
function joiToJsonSchema(joiSchema, options = {}) {
  if (!joiSchema) return null;

  const jsonSchema = joiToJson(joiSchema, 'json');
  jsonSchema.additionalProperties = false;

  if (options.allOptional) {
    delete jsonSchema.required;
  }

  setStrictMode(jsonSchema);
  normalizeSchemaTypes(jsonSchema);
  return jsonSchema;
}

/**
 * Builds query parameter definitions from schema and filter fields.
 * @param {Object} joiSchema - Joi schema for type introspection
 * @param {Array<string>} filterFields - List of filterable field names
 * @returns {Array<Object>} Query parameter definitions
 */
function buildQueryParams(joiSchema, filterFields) {
  const typeMap = extractTypesFromSchema(joiSchema);
  const params = [];

  for (const field of filterFields) {
    const fieldType = typeMap[field] || { type: 'string', operators: TYPE_OPERATORS.string };

    const param = {
      name: field,
      required: false,
      schema: { type: fieldType.type === 'enum' ? 'string' : fieldType.type },
    };

    // Add allowed values for enums
    if (fieldType.type === 'enum' && fieldType.values) {
      param.schema.enum = fieldType.values;
    }

    // Add operators if more than just 'eq'
    if (fieldType.operators.length > 1) {
      param.ops = fieldType.operators;
    }

    params.push(param);
  }

  // Add reserved pagination/search params
  return [...RESERVED_PARAMS, ...params];
}

/**
 * Builds response schema from create schema with standard fields.
 * @param {Object} createSchema - Joi create schema
 * @param {string} method - HTTP method
 * @returns {Object} JSON Schema for response
 */
function buildResponseSchema(createSchema, method) {
  const base = joiToJsonSchema(createSchema) || { type: 'object', properties: {} };

  const standardFields = {
    id: { type: 'string', format: 'uuid' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  };

  base.properties = { ...standardFields, ...base.properties };
  base.required = ['id', ...(base.required || [])];

  // GET list wraps in { items: [...], totalCount, pageCount, currentPage, perPage }
  if (method === 'GET') {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['items', 'totalCount', 'pageCount', 'currentPage', 'perPage'],
      properties: {
        items: { type: 'array', items: base },
        totalCount: { type: 'integer' },
        pageCount: { type: 'integer' },
        currentPage: { type: 'integer' },
        perPage: { type: 'integer' },
      },
    };
  }

  return base;
}

/**
 * Builds method-specific schema object.
 * @param {string} method - HTTP method
 * @param {Object} schemas - Object with create/update Joi schemas
 * @returns {Object} Method schema with request_schema, response_schema, errors
 */
function buildMethodSchema(method, schemas) {
  const methodErrors = [...(METHOD_ERRORS[method] || []), ...COMMON_ERRORS];

  switch (method) {
    case 'GET':
      return {
        request_schema: null,
        response_schema: buildResponseSchema(schemas.create, 'GET'),
        errors: methodErrors,
      };

    case 'POST':
      return {
        request_schema: joiToJsonSchema(schemas.create),
        response_schema: buildResponseSchema(schemas.create, 'POST'),
        errors: methodErrors,
      };

    case 'PUT':
    case 'PATCH':
      return {
        request_schema: joiToJsonSchema(schemas.update || schemas.create, { allOptional: method === 'PATCH' }),
        response_schema: buildResponseSchema(schemas.create, method),
        errors: methodErrors,
      };

    case 'DELETE':
      return {
        request_schema: null,
        response_schema: {
          type: 'object',
          additionalProperties: false,
          required: ['message'],
          properties: {
            message: { type: 'string' },
          },
        },
        errors: methodErrors,
      };

    default:
      return {
        request_schema: null,
        response_schema: null,
        errors: methodErrors,
      };
  }
}

/**
 * Builds complete OPTIONS response for a route.
 * @param {Object} options - Build options
 * @param {Object} options.schemas - Object with create/update Joi schemas
 * @param {Array<string>} options.filterFields - List of filterable field names
 * @param {Array<string>} options.methods - List of HTTP methods supported
 * @returns {Object} Complete OPTIONS response object
 */
function buildOptionsResponse({ schemas, filterFields = [], methods }) {
  return {
    query_params: methods.includes('GET')
      ? buildQueryParams(schemas.create || schemas.update, filterFields)
      : [],
    methods: Object.fromEntries(
      methods.map((m) => [m, buildMethodSchema(m, schemas)])
    ),
  };
}

module.exports = {
  joiToJsonSchema,
  buildQueryParams,
  buildResponseSchema,
  buildMethodSchema,
  buildOptionsResponse,
  METHOD_ERRORS,
  COMMON_ERRORS,
  setStrictMode,
  normalizeSchemaTypes,
};
