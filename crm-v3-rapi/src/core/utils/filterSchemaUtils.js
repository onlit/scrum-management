/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * Schema introspection utilities for filter parsing.
 * Extracts field types and allowed operators from Joi schemas.
 *
 *
 */

const _ = require('lodash');
const { toCamelCase } = require('#utils/stringUtils.js');

const TYPE_OPERATORS = {
  number: ['eq', 'in', 'gt', 'gte', 'lt', 'lte', 'between'],
  date: ['eq', 'gt', 'gte', 'lt', 'lte', 'between'],
  boolean: ['eq'],
  enum: ['eq', 'in'],
  string: ['eq', 'in'],
};

/**
 * Extracts field types and allowed operators from a Joi schema
 * @param {Object} schema - Joi schema object
 * @returns {Object} Map of field names to type info { type, operators, values? }
 */
function extractTypesFromSchema(schema) {
  const typeMap = {};

  if (!schema || typeof schema.describe !== 'function') {
    return typeMap;
  }

  const described = schema.describe();

  for (const [field, descriptor] of Object.entries(described.keys || {})) {
    const camelField = toCamelCase(field);

    if (descriptor.type === 'number') {
      typeMap[camelField] = { type: 'number', operators: TYPE_OPERATORS.number };
    } else if (descriptor.type === 'date') {
      typeMap[camelField] = { type: 'date', operators: TYPE_OPERATORS.date };
    } else if (descriptor.type === 'boolean') {
      typeMap[camelField] = { type: 'boolean', operators: TYPE_OPERATORS.boolean };
    } else if (descriptor.allow && descriptor.allow.length) {
      typeMap[camelField] = {
        type: 'enum',
        values: descriptor.allow.filter(v => v !== ''),
        operators: TYPE_OPERATORS.enum,
      };
    } else {
      typeMap[camelField] = { type: 'string', operators: TYPE_OPERATORS.string };
    }
  }

  return typeMap;
}

module.exports = {
  extractTypesFromSchema,
  TYPE_OPERATORS,
};
