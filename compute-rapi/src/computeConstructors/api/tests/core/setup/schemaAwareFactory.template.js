/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 * DESCRIPTION:
 * ------------------
 * Schema-aware factory utilities for generating test data that respects
 * database column constraints. This module reads Prisma schema metadata
 * to automatically generate values that fit within VarChar limits and
 * other database constraints.
 *
 * This is the proper solution to ensure test factories generate valid data
 * regardless of schema changes.
 */

const { TEST_PREFIX } = require('#tests/core/setup/constants.js');

/**
 * Cache for model field constraints to avoid repeated parsing
 */
const fieldConstraintsCache = new Map();

/**
 * Extract field constraints from Prisma model metadata
 * @param {Object} prismaClient - Prisma client instance
 * @param {string} modelName - Name of the model (PascalCase)
 * @returns {Map<string, Object>} Map of field name to constraints
 */
const getFieldConstraints = (prismaClient, modelName) => {
  const cacheKey = modelName;
  if (fieldConstraintsCache.has(cacheKey)) {
    return fieldConstraintsCache.get(cacheKey);
  }

  const constraints = new Map();
  const models = prismaClient?._runtimeDataModel?.models;

  if (!models) {
    return constraints;
  }

  const modelMeta = Array.isArray(models)
    ? models.find((m) => m.name === modelName)
    : models[modelName];

  if (!modelMeta?.fields) {
    return constraints;
  }

  for (const field of modelMeta.fields) {
    const constraint = {
      name: field.name,
      type: field.type,
      kind: field.kind,
      isRequired: field.isRequired,
      isList: field.isList,
      maxLength: null,
      nativeType: null,
    };

    // Extract native type constraints
    if (field.nativeType && Array.isArray(field.nativeType)) {
      const [typeName, typeArgs] = field.nativeType;
      constraint.nativeType = typeName;

      // Extract max length for VarChar types
      if (typeName === 'VarChar' && Array.isArray(typeArgs) && typeArgs[0]) {
        constraint.maxLength = parseInt(typeArgs[0], 10);
      }
    }

    constraints.set(field.name, constraint);
  }

  fieldConstraintsCache.set(cacheKey, constraints);
  return constraints;
};

/**
 * Generate a unique test identifier
 * Uses timestamp + random to ensure uniqueness across test runs
 * @returns {string} Short unique identifier (11 chars)
 */
const generateUniqueId = () => {
  const timestamp = String(Date.now()).slice(-6);
  const random = Math.random().toString(36).substring(2, 6);
  return `${timestamp}_${random}`;
};

/**
 * Generate a test string value that fits within the schema constraint
 * @param {string} fieldName - Name of the field
 * @param {number|null} maxLength - Maximum length constraint (null = unlimited)
 * @param {Object} options - Generation options
 * @param {string} options.prefix - Prefix for the value (default: TEST_PREFIX)
 * @param {string} options.uniqueId - Unique identifier to include
 * @returns {string} Generated test value that fits constraints
 */
const generateTestString = (fieldName, maxLength, options = {}) => {
  const prefix = options.prefix ?? TEST_PREFIX;
  const uniqueId = options.uniqueId ?? generateUniqueId();

  // Build the ideal value: prefix + uniqueId + fieldName
  const idealValue = `${prefix}${uniqueId}_${fieldName}`;

  // If no max length or value fits, return ideal value
  if (!maxLength || idealValue.length <= maxLength) {
    return idealValue;
  }

  // Value is too long - truncate intelligently
  // Priority: keep prefix (for cleanup) + uniqueId (for uniqueness)
  const essentialPart = `${prefix}${uniqueId}`;

  if (essentialPart.length >= maxLength) {
    // Even essential part is too long - use shortened version
    // Keep prefix + truncated uniqueId
    const availableForId = maxLength - prefix.length;
    if (availableForId > 0) {
      return `${prefix}${uniqueId.substring(0, availableForId)}`;
    }
    // Extreme case: max length smaller than prefix
    return prefix.substring(0, maxLength);
  }

  // We have room for some of the field name
  const availableForFieldName = maxLength - essentialPart.length - 1; // -1 for underscore
  if (availableForFieldName > 0) {
    const truncatedFieldName = fieldName.substring(0, availableForFieldName);
    return `${essentialPart}_${truncatedFieldName}`;
  }

  return essentialPart;
};

/**
 * Generate a test email that fits within constraints
 * @param {number|null} maxLength - Maximum length constraint
 * @param {Object} options - Generation options
 * @returns {string} Generated test email
 */
const generateTestEmail = (maxLength, options = {}) => {
  const uniqueId = options.uniqueId ?? generateUniqueId();
  const domain = '@test.example.com';
  const prefix = TEST_PREFIX;

  const idealEmail = `${prefix}${uniqueId}${domain}`;

  if (!maxLength || idealEmail.length <= maxLength) {
    return idealEmail;
  }

  // Truncate the local part to fit
  const availableForLocal = maxLength - domain.length;
  if (availableForLocal > 0) {
    const localPart = `${prefix}${uniqueId}`.substring(0, availableForLocal);
    return `${localPart}${domain}`;
  }

  // Extreme case - use minimal email
  return `t${uniqueId.substring(0, 5)}@t.co`.substring(0, maxLength);
};

/**
 * Generate a test URL that fits within constraints
 * @param {string} fieldName - Name of the field
 * @param {number|null} maxLength - Maximum length constraint
 * @param {Object} options - Generation options
 * @returns {string} Generated test URL
 */
const generateTestUrl = (fieldName, maxLength, options = {}) => {
  const uniqueId = options.uniqueId ?? generateUniqueId();
  const baseUrl = 'https://example.com/';

  const idealUrl = `${baseUrl}${TEST_PREFIX}${uniqueId}`;

  if (!maxLength || idealUrl.length <= maxLength) {
    return idealUrl;
  }

  // Truncate to fit
  const availableForPath = maxLength - baseUrl.length;
  if (availableForPath > 0) {
    return `${baseUrl}${uniqueId.substring(0, availableForPath)}`;
  }

  return 'https://t.co'.substring(0, maxLength);
};

/**
 * Generate a test phone number
 * @param {number|null} maxLength - Maximum length constraint
 * @returns {string} E.164 format phone number
 */
const generateTestPhone = (maxLength) => {
  // E.164 format: +1234567890 (12 chars)
  const phone = '+1234567890';
  if (!maxLength || phone.length <= maxLength) {
    return phone;
  }
  return phone.substring(0, maxLength);
};

/**
 * Build schema-aware test data for a model
 * Generates values that respect all database constraints
 *
 * @param {Object} prismaClient - Prisma client instance
 * @param {string} modelName - Name of the model (PascalCase)
 * @param {Object} fieldValues - Map of field names to desired value types
 *   Supported types: 'string', 'email', 'url', 'phone', 'boolean', or literal value
 * @param {Object} overrides - Values to use instead of generated ones
 * @returns {Object} Generated test data respecting schema constraints
 */
const buildSchemaAwareData = (
  prismaClient,
  modelName,
  fieldValues,
  overrides = {},
) => {
  const constraints = getFieldConstraints(prismaClient, modelName);
  const uniqueId = generateUniqueId();
  const data = {};

  for (const [fieldName, valueType] of Object.entries(fieldValues)) {
    // Skip if override provided
    if (fieldName in overrides) {
      data[fieldName] = overrides[fieldName];
      continue;
    }

    const constraint = constraints.get(fieldName);
    const maxLength = constraint?.maxLength || null;

    // Generate appropriate value based on type
    if (typeof valueType === 'string') {
      switch (valueType) {
        case 'string':
          data[fieldName] = generateTestString(fieldName, maxLength, {
            uniqueId,
          });
          break;
        case 'email':
          data[fieldName] = generateTestEmail(maxLength, { uniqueId });
          break;
        case 'url':
          data[fieldName] = generateTestUrl(fieldName, maxLength, { uniqueId });
          break;
        case 'phone':
          data[fieldName] = generateTestPhone(maxLength);
          break;
        case 'boolean':
          data[fieldName] = true;
          break;
        default:
          // Treat as literal value
          data[fieldName] = valueType;
      }
    } else {
      // Use literal value
      data[fieldName] = valueType;
    }
  }

  return data;
};

/**
 * Get the maximum length for a field from schema
 * @param {Object} prismaClient - Prisma client instance
 * @param {string} modelName - Name of the model
 * @param {string} fieldName - Name of the field
 * @returns {number|null} Maximum length or null if unlimited
 */
const getFieldMaxLength = (prismaClient, modelName, fieldName) => {
  const constraints = getFieldConstraints(prismaClient, modelName);
  return constraints.get(fieldName)?.maxLength || null;
};

/**
 * Truncate a value to fit within schema constraints
 * @param {Object} prismaClient - Prisma client instance
 * @param {string} modelName - Name of the model
 * @param {string} fieldName - Name of the field
 * @param {string} value - Value to truncate
 * @returns {string} Truncated value
 */
const truncateToFit = (prismaClient, modelName, fieldName, value) => {
  const maxLength = getFieldMaxLength(prismaClient, modelName, fieldName);
  if (!maxLength || !value || value.length <= maxLength) {
    return value;
  }
  return value.substring(0, maxLength);
};

/**
 * Clear the constraints cache (useful for testing)
 */
const clearConstraintsCache = () => {
  fieldConstraintsCache.clear();
};

module.exports = {
  getFieldConstraints,
  generateUniqueId,
  generateTestString,
  generateTestEmail,
  generateTestUrl,
  generateTestPhone,
  buildSchemaAwareData,
  getFieldMaxLength,
  truncateToFit,
  clearConstraintsCache,
};
