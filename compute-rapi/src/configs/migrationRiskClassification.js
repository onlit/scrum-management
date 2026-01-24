/**
 * Migration Risk Classification Configuration
 *
 * Defines type compatibility matrices and risk categories for
 * migration issue analysis during Prisma schema regeneration.
 *
 * @module configs/migrationRiskClassification
 */

/**
 * String-based types that all map to Prisma 'String' type.
 * Conversions between any of these types are safe (no data loss).
 * Note: Text is excluded here because Text → String may cause truncation.
 */
const STRING_BASED_TYPES = ['String', 'Phone', 'URL', 'Slug', 'Email', 'IPAddress'];

/**
 * Vector field change types for specific risk classification
 */
const VECTOR_CHANGE_TYPES = {
  DIMENSION_INCREASE: 'vector_dimension_increase',
  DIMENSION_DECREASE: 'vector_dimension_decrease',
  INDEX_TYPE_CHANGE: 'vector_index_type_change',
  DISTANCE_METRIC_CHANGE: 'vector_distance_metric_change',
  INDEX_CONFIG_CHANGE: 'vector_index_config_change',
};

/**
 * Type conversions that are always safe (no data loss possible)
 *
 * String-based types (String, Phone, URL, Slug, Email, IPAddress) are
 * interchangeable because they all map to Prisma 'String' - they just
 * have different application-level validation rules.
 *
 * Note: Text is handled separately because Text → String may truncate.
 */
const SAFE_CONVERSIONS = {
  Int: ['BigInt', 'Decimal', 'Float', 'String'],
  // All string-based types can safely convert to each other
  String: [...STRING_BASED_TYPES.filter((t) => t !== 'String'), 'Text'],
  Phone: STRING_BASED_TYPES.filter((t) => t !== 'Phone'),
  URL: STRING_BASED_TYPES.filter((t) => t !== 'URL'),
  Slug: STRING_BASED_TYPES.filter((t) => t !== 'Slug'),
  Email: STRING_BASED_TYPES.filter((t) => t !== 'Email'),
  IPAddress: STRING_BASED_TYPES.filter((t) => t !== 'IPAddress'),
  // Text can safely convert to any string-based type (widening)
  Text: STRING_BASED_TYPES,
  Float: ['Decimal', 'String'],
  Boolean: ['String'],
};

/**
 * Type conversions that may cause data issues (precision loss, overflow, truncation)
 */
const WARNING_CONVERSIONS = {
  Decimal: ['Float'], // Precision loss
  BigInt: ['Int'], // Overflow possible
  Text: ['String'], // Truncation possible
};

/**
 * Vector-specific type conversions
 * Vector fields are not compatible with other types - conversion is always blocking
 */
const VECTOR_CONVERSIONS = {
  // Vector cannot safely convert to any other type
  safe: [],
  // Vector dimension decrease may cause data loss (truncation of dimensions)
  warning: [VECTOR_CHANGE_TYPES.DIMENSION_INCREASE],
  // These changes are blocking or require careful handling
  blocking: [VECTOR_CHANGE_TYPES.DIMENSION_DECREASE],
  // These require confirmation but are generally safe with index rebuild
  confirm: [
    VECTOR_CHANGE_TYPES.INDEX_TYPE_CHANGE,
    VECTOR_CHANGE_TYPES.DISTANCE_METRIC_CHANGE,
    VECTOR_CHANGE_TYPES.INDEX_CONFIG_CHANGE,
  ],
};

/**
 * Risk classification categories for schema changes
 */
const RISK_CLASSIFICATION = {
  AUTO_FIXABLE: ['new_required_field'],
  CONFIRM_TO_PROCEED: [
    'type_change_widening',
    'string_length_reduction',
    'index_changes',
    // Vector changes that require confirmation but are safe with index rebuild
    VECTOR_CHANGE_TYPES.INDEX_TYPE_CHANGE,
    VECTOR_CHANGE_TYPES.DISTANCE_METRIC_CHANGE,
    VECTOR_CHANGE_TYPES.INDEX_CONFIG_CHANGE,
    VECTOR_CHANGE_TYPES.DIMENSION_INCREASE, // Adding dimensions is relatively safe
  ],
  BLOCKING: [
    'drop_table',
    'drop_column',
    'type_change_narrowing',
    'type_change_incompatible',
    'optional_to_required',
    // Vector-specific blocking changes
    VECTOR_CHANGE_TYPES.DIMENSION_DECREASE, // Removing dimensions causes data loss
    'vector_to_non_vector', // Cannot convert vector to other types
    'non_vector_to_vector', // Cannot convert other types to vector
  ],
};

/**
 * Check if a type conversion is safe
 * @param {string} fromType - Source data type
 * @param {string} toType - Target data type
 * @returns {boolean} True if conversion is safe
 */
function isConversionSafe(fromType, toType) {
  if (fromType === toType) return true;
  const safeTargets = SAFE_CONVERSIONS[fromType] || [];
  return safeTargets.includes(toType);
}

/**
 * Get the risk level for a type conversion
 * @param {string} fromType - Source data type
 * @param {string} toType - Target data type
 * @returns {'safe'|'warning'|'blocking'} Risk level
 */
function getConversionRisk(fromType, toType) {
  if (fromType === toType) return 'safe';
  if (isConversionSafe(fromType, toType)) return 'safe';

  const warningTargets = WARNING_CONVERSIONS[fromType] || [];
  if (warningTargets.includes(toType)) return 'warning';

  return 'blocking';
}

/**
 * Classify a change type into risk category
 * @param {string} changeType - Type of schema change
 * @returns {'AUTO_FIXABLE'|'CONFIRM_TO_PROCEED'|'BLOCKING'|null} Category or null
 */
function classifyChange(changeType) {
  for (const [category, changes] of Object.entries(RISK_CLASSIFICATION)) {
    if (changes.includes(changeType)) {
      return category;
    }
  }
  return null;
}

/**
 * Get the risk level for a vector field change
 * @param {Object} change - Change details
 * @param {string} change.type - Type of vector change (from VECTOR_CHANGE_TYPES)
 * @param {number} [change.oldDimension] - Previous dimension (for dimension changes)
 * @param {number} [change.newDimension] - New dimension (for dimension changes)
 * @returns {'safe'|'warning'|'confirm'|'blocking'} Risk level
 */
function getVectorChangeRisk(change) {
  // Converting between vector and non-vector types is always blocking
  if (change.type === 'vector_to_non_vector' || change.type === 'non_vector_to_vector') {
    return 'blocking';
  }

  // Dimension changes
  if (change.type === VECTOR_CHANGE_TYPES.DIMENSION_INCREASE) {
    // Increasing dimensions is a warning - may require re-embedding
    return 'warning';
  }
  if (change.type === VECTOR_CHANGE_TYPES.DIMENSION_DECREASE) {
    // Decreasing dimensions is blocking - data loss
    return 'blocking';
  }

  // Index and metric changes require confirmation
  if (VECTOR_CONVERSIONS.confirm.includes(change.type)) {
    return 'confirm';
  }

  return 'safe';
}

/**
 * Analyze vector field changes between old and new field definitions
 * @param {Object} oldField - Previous field definition
 * @param {Object} newField - New field definition
 * @returns {Array} Array of change objects with type and risk
 */
function analyzeVectorFieldChanges(oldField, newField) {
  const changes = [];

  // Type conversion checks
  if (oldField.dataType === 'Vector' && newField.dataType !== 'Vector') {
    changes.push({
      type: 'vector_to_non_vector',
      risk: 'blocking',
      message: 'Cannot convert Vector field to non-Vector type',
    });
    return changes;
  }

  if (oldField.dataType !== 'Vector' && newField.dataType === 'Vector') {
    changes.push({
      type: 'non_vector_to_vector',
      risk: 'blocking',
      message: 'Cannot convert non-Vector field to Vector type',
    });
    return changes;
  }

  // Both are Vector fields - check for parameter changes
  if (oldField.dataType === 'Vector' && newField.dataType === 'Vector') {
    // Dimension changes
    if (oldField.vectorDimension !== newField.vectorDimension) {
      const type =
        newField.vectorDimension > oldField.vectorDimension
          ? VECTOR_CHANGE_TYPES.DIMENSION_INCREASE
          : VECTOR_CHANGE_TYPES.DIMENSION_DECREASE;

      changes.push({
        type,
        risk: getVectorChangeRisk({ type }),
        oldValue: oldField.vectorDimension,
        newValue: newField.vectorDimension,
        message:
          type === VECTOR_CHANGE_TYPES.DIMENSION_DECREASE
            ? 'Decreasing vector dimension will cause data loss'
            : 'Increasing vector dimension may require re-embedding existing data',
      });
    }

    // Distance metric changes
    if (oldField.vectorDistanceMetric !== newField.vectorDistanceMetric) {
      changes.push({
        type: VECTOR_CHANGE_TYPES.DISTANCE_METRIC_CHANGE,
        risk: 'confirm',
        oldValue: oldField.vectorDistanceMetric,
        newValue: newField.vectorDistanceMetric,
        message: 'Distance metric change requires index rebuild',
      });
    }

    // Index type changes
    if (oldField.vectorIndexType !== newField.vectorIndexType) {
      changes.push({
        type: VECTOR_CHANGE_TYPES.INDEX_TYPE_CHANGE,
        risk: 'confirm',
        oldValue: oldField.vectorIndexType,
        newValue: newField.vectorIndexType,
        message: 'Index type change requires index rebuild',
      });
    }
  }

  return changes;
}

module.exports = {
  SAFE_CONVERSIONS,
  WARNING_CONVERSIONS,
  VECTOR_CONVERSIONS,
  VECTOR_CHANGE_TYPES,
  RISK_CLASSIFICATION,
  isConversionSafe,
  getConversionRisk,
  classifyChange,
  getVectorChangeRisk,
  analyzeVectorFieldChanges,
};
