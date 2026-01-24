const { createStandardError } = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');

function isIntType(type) {
  const intTypes = ['Int', 'Float', 'Decimal', 'Latitude', 'Longitude', 'Percentage'];
  return intTypes.includes(type);
}

function isStringType(type) {
  const stringTypes = [
    'String',
    'Email',
    'Json',
    'StringArray',
    'IntArray',
    'IPAddress',
    'URL',
    'UUID',
    'Phone',
    'Slug',
  ];
  return stringTypes.includes(type);
}

function isInternalForeignKey(field) {
  const foreignKeyModel = field?.foreignKeyModel;
  return (
    field?.dataType === 'UUID' &&
    field?.isForeignKey &&
    field?.foreignKeyTarget === 'Internal' &&
    !!foreignKeyModel?.name
  );
}

function isExternalForeignKey(field) {
  return (
    field?.dataType === 'UUID' &&
    field?.isForeignKey &&
    field?.foreignKeyTarget === 'External' &&
    field?.externalMicroserviceId &&
    field?.externalModelId
  );
}

/**
 * Validates field type and returns standardized error if invalid
 * @param {string} fieldType - The field type to validate
 * @param {string} fieldName - Name of the field for error context
 * @returns {boolean} True if valid, throws error if invalid
 */
function validateFieldType(fieldType, fieldName) {
  const validTypes = [
    'String',
    'Int',
    'Boolean',
    'Json',
    'DateTime',
    'Date',
    'UUID',
    'Float',
    'Decimal',
    'URL',
    'IPAddress',
    'Enum',
    'Email',
    'Upload',
    'Phone',
    'Latitude',
    'Longitude',
    'Percentage',
    'Slug',
    'Vector',
  ];

  if (!validTypes.includes(fieldType)) {
    throw createStandardError(
      ERROR_TYPES.VALIDATION,
      `Invalid field type: ${fieldType}`,
      {
        severity: ERROR_SEVERITY.MEDIUM,
        context: 'field_type_validation',
        details: { fieldName, fieldType, validTypes },
      }
    );
  }

  return true;
}

/**
 * Validates foreign key configuration and returns standardized error if invalid
 * @param {Object} field - The field to validate
 * @param {string} fieldName - Name of the field for error context
 * @returns {boolean} True if valid, throws error if invalid
 */
function validateForeignKeyConfiguration(field, fieldName) {
  if (!field.isForeignKey) {
    return true; // Not a foreign key, no validation needed
  }

  if (field.dataType !== 'UUID') {
    throw createStandardError(
      ERROR_TYPES.VALIDATION,
      'Foreign key fields must have UUID data type',
      {
        severity: ERROR_SEVERITY.MEDIUM,
        context: 'foreign_key_validation',
        details: { fieldName, dataType: field.dataType },
      }
    );
  }

  if (field.foreignKeyTarget === 'Internal') {
    if (!field.foreignKeyModelId) {
      throw createStandardError(
        ERROR_TYPES.VALIDATION,
        'Internal foreign key missing foreignKeyModelId',
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'foreign_key_validation',
          details: { fieldName, foreignKeyTarget: field.foreignKeyTarget },
        }
      );
    }
  } else if (field.foreignKeyTarget === 'External') {
    const missingFields = [];
    if (!field.externalModelId) missingFields.push('externalModelId');
    if (!field.externalMicroserviceId) {
      missingFields.push('externalMicroserviceId');
    }

    if (missingFields.length > 0) {
      throw createStandardError(
        ERROR_TYPES.VALIDATION,
        'External foreign key missing required fields',
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'foreign_key_validation',
          details: {
            fieldName,
            missingFields,
            foreignKeyTarget: field.foreignKeyTarget,
          },
        }
      );
    }
  } else {
    throw createStandardError(
      ERROR_TYPES.VALIDATION,
      'Invalid foreign key target',
      {
        severity: ERROR_SEVERITY.MEDIUM,
        context: 'foreign_key_validation',
        details: { fieldName, foreignKeyTarget: field.foreignKeyTarget },
      }
    );
  }

  return true;
}

// Vector field configuration constants
const VECTOR_DISTANCE_METRICS = ['Cosine', 'L2', 'InnerProduct'];
const VECTOR_INDEX_TYPES = ['HNSW', 'IVFFlat', 'None'];
const VECTOR_DIMENSION_MIN = 1;
const VECTOR_DIMENSION_MAX = 16000;

/**
 * Validates vector field configuration
 * @param {Object} field - The field to validate
 * @param {string} fieldName - Name of the field for error context
 * @returns {boolean} True if valid, throws error if invalid
 */
function validateVectorConfiguration(field, fieldName) {
  if (field.dataType !== 'Vector') {
    return true; // Not a vector field, no validation needed
  }

  // Dimension is required for vector fields
  if (field.vectorDimension == null) {
    throw createStandardError(
      ERROR_TYPES.VALIDATION,
      `Vector field '${fieldName}' requires vectorDimension`,
      {
        severity: ERROR_SEVERITY.MEDIUM,
        context: 'vector_field_validation',
        details: { fieldName, code: 'VECTOR_DIMENSION_REQUIRED' },
      }
    );
  }

  // Dimension range validation
  if (
    field.vectorDimension < VECTOR_DIMENSION_MIN ||
    field.vectorDimension > VECTOR_DIMENSION_MAX
  ) {
    throw createStandardError(
      ERROR_TYPES.VALIDATION,
      `vectorDimension must be between ${VECTOR_DIMENSION_MIN} and ${VECTOR_DIMENSION_MAX}`,
      {
        severity: ERROR_SEVERITY.MEDIUM,
        context: 'vector_field_validation',
        details: {
          fieldName,
          provided: field.vectorDimension,
          min: VECTOR_DIMENSION_MIN,
          max: VECTOR_DIMENSION_MAX,
          code: 'VECTOR_DIMENSION_OUT_OF_RANGE',
        },
      }
    );
  }

  // Distance metric validation
  if (
    field.vectorDistanceMetric != null &&
    !VECTOR_DISTANCE_METRICS.includes(field.vectorDistanceMetric)
  ) {
    throw createStandardError(
      ERROR_TYPES.VALIDATION,
      `Invalid vectorDistanceMetric. Must be one of: ${VECTOR_DISTANCE_METRICS.join(', ')}`,
      {
        severity: ERROR_SEVERITY.MEDIUM,
        context: 'vector_field_validation',
        details: {
          fieldName,
          provided: field.vectorDistanceMetric,
          validValues: VECTOR_DISTANCE_METRICS,
        },
      }
    );
  }

  // Index type validation
  if (
    field.vectorIndexType != null &&
    !VECTOR_INDEX_TYPES.includes(field.vectorIndexType)
  ) {
    throw createStandardError(
      ERROR_TYPES.VALIDATION,
      `Invalid vectorIndexType. Must be one of: ${VECTOR_INDEX_TYPES.join(', ')}`,
      {
        severity: ERROR_SEVERITY.MEDIUM,
        context: 'vector_field_validation',
        details: {
          fieldName,
          provided: field.vectorIndexType,
          validValues: VECTOR_INDEX_TYPES,
        },
      }
    );
  }

  return true;
}

module.exports = {
  isExternalForeignKey,
  isInternalForeignKey,
  isStringType,
  isIntType,
  validateFieldType,
  validateForeignKeyConfiguration,
  validateVectorConfiguration,
  VECTOR_DISTANCE_METRICS,
  VECTOR_INDEX_TYPES,
  VECTOR_DIMENSION_MIN,
  VECTOR_DIMENSION_MAX,
};
