/**
 * Base Validator
 *
 * Provides reusable validation utilities and custom Joi extensions
 * for domain-specific validation rules.
 *
 * This file is PROTECTED - never overwritten by the generator.
 *
 * @module domain/validators/base.validator
 */

const Joi = require('joi');

/**
 * Custom Joi extension for common validation patterns.
 */
const customJoi = Joi.extend((joi) => ({
  type: 'string',
  base: joi.string(),
  messages: {
    'string.alphanumeric': '{{#label}} must contain only alphanumeric characters',
    'string.phone': '{{#label}} must be a valid phone number',
  },
  rules: {
    alphanumeric: {
      validate(value, helpers) {
        if (!/^[a-zA-Z0-9]+$/.test(value)) {
          return helpers.error('string.alphanumeric');
        }
        return value;
      },
    },
    phone: {
      validate(value, helpers) {
        // Basic phone validation - customize as needed
        if (!/^\+?[\d\s-()]+$/.test(value)) {
          return helpers.error('string.phone');
        }
        return value;
      },
    },
  },
}));

/**
 * Create a validator function from a Joi schema.
 *
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {Object} [options] - Validation options
 * @returns {Function} Async validator function
 *
 * @example
 * const validateEmail = createValidator(Joi.string().email());
 * const result = await validateEmail('test@example.com');
 */
function createValidator(schema, options = {}) {
  const defaultOptions = {
    abortEarly: false,
    stripUnknown: true,
    ...options,
  };

  return async (data) => {
    return schema.validateAsync(data, defaultOptions);
  };
}

/**
 * Validate data against a schema, returning errors instead of throwing.
 *
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {*} data - Data to validate
 * @returns {{ value: *, errors: Array|null }}
 */
function validateSafe(schema, data) {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  return {
    value,
    errors: error
      ? error.details.map((d) => ({
          field: d.path.join('.'),
          message: d.message,
          type: d.type,
        }))
      : null,
  };
}

/**
 * Common validation schemas.
 */
const CommonSchemas = {
  /** UUID v4 format */
  uuid: Joi.string().uuid({ version: 'uuidv4' }),

  /** Non-empty trimmed string */
  requiredString: Joi.string().trim().min(1).required(),

  /** Optional trimmed string */
  optionalString: Joi.string().trim().allow('', null),

  /** Positive integer */
  positiveInt: Joi.number().integer().positive(),

  /** Email address */
  email: Joi.string().email().lowercase().trim(),

  /** ISO date string */
  isoDate: Joi.date().iso(),

  /** Boolean with string coercion */
  booleanish: Joi.boolean().truthy('true', '1').falsy('false', '0'),
};

module.exports = {
  Joi: customJoi,
  createValidator,
  validateSafe,
  CommonSchemas,
};
