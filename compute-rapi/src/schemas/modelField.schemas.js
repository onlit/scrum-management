const Joi = require('joi');

const { visibilityCreate } = require('#schemas/visibility.schemas.js');
const {
  MODEL_FIELD_TYPES,
  RESERVED_FIELD_NAMES,
  DELETE_BEHAVIORS,
  FOREIGN_KEY_TARGETS,
  FOREIGN_KEY_TYPES,
} = require('#configs/constants.js');
const { translationCodeValidator } = require('./translation.schemas.js');
const {
  VECTOR_DISTANCE_METRICS,
  VECTOR_INDEX_TYPES,
  VECTOR_DIMENSION_MIN,
  VECTOR_DIMENSION_MAX,
} = require('#utils/api/fieldTypeValidationUtils.js');

const modelFieldBase = visibilityCreate
  .keys({
    id: Joi.string().trim().uuid().allow(''),
    order: Joi.number().optional().allow(null),
    minLength: Joi.number()
      .integer()
      .min(0)
      .optional()
      .empty('')
      .default(null)
      .allow(null),
    maxLength: Joi.number()
      .integer()
      .positive()
      .optional()
      .empty('')
      .default(null)
      .allow(null),
    tags: Joi.string().allow(null, ''),
    label: Joi.string().allow(null, ''),
    labelTranslationCode: translationCodeValidator,
    helpfulHintTranslationCode: translationCodeValidator,
    description: Joi.string().allow(null, ''),
    helpfulHint: Joi.string().trim().allow(null, ''),
    isForeignKey: Joi.boolean().falsy(''),
    showInTable: Joi.boolean().falsy(''),
    showInCreateForm: Joi.boolean().falsy(''),
    showInDetailCard: Joi.boolean().falsy(''),
    externalIsOptional: Joi.boolean().falsy(''),
    isEditable: Joi.boolean().falsy(''),
    isOptional: Joi.boolean().falsy(''),
    isUnique: Joi.boolean().falsy(''),
    isIndex: Joi.boolean().falsy(''),
    isClickableLink: Joi.boolean().falsy(''),
    isMultiline: Joi.boolean().falsy(''),
    foreignKeyModelId: Joi.string().trim().uuid().allow(null, ''),
    foreignKeyTarget: Joi.optional().valid(...FOREIGN_KEY_TARGETS),
    foreignKeyType: Joi.optional().valid(...FOREIGN_KEY_TYPES),
    externalMicroserviceId: Joi.string().trim().uuid().allow(null, ''),
    externalModelId: Joi.string().trim().uuid().allow(null, ''),
    enumDefnId: Joi.string().trim().uuid().allow(null, ''),
    // New dependency fields: only valid when isForeignKey is true
    dependsOnFieldId: Joi.alternatives().conditional('isForeignKey', {
      is: true,
      then: Joi.string().trim().uuid().allow(null, ''),
      otherwise: Joi.optional().allow(null, ''),
    }),
    // For batch create convenience; resolved server-side to an ID in a second pass
    dependsOnFieldName: Joi.alternatives().conditional('isForeignKey', {
      is: true,
      then: Joi.string().trim().allow(null, ''),
      otherwise: Joi.optional().allow(null, ''),
    }),
    onDelete: Joi.string().when('isForeignKey', {
      is: true,
      then: Joi.valid(...DELETE_BEHAVIORS).default('Cascade'),
      otherwise: Joi.optional().allow(null, ''),
    }),
    // Vector field configuration (only applicable when dataType = Vector)
    vectorDimension: Joi.alternatives().conditional('dataType', {
      is: 'Vector',
      then: Joi.number()
        .integer()
        .min(VECTOR_DIMENSION_MIN)
        .max(VECTOR_DIMENSION_MAX)
        .required()
        .messages({
          'number.base': 'vectorDimension must be a number',
          'number.min': `vectorDimension must be at least ${VECTOR_DIMENSION_MIN}`,
          'number.max': `vectorDimension cannot exceed ${VECTOR_DIMENSION_MAX}`,
          'any.required': 'vectorDimension is required for Vector fields',
        }),
      otherwise: Joi.number().integer().optional().allow(null),
    }),
    vectorDistanceMetric: Joi.alternatives().conditional('dataType', {
      is: 'Vector',
      then: Joi.string()
        .valid(...VECTOR_DISTANCE_METRICS)
        .default('Cosine')
        .messages({
          'any.only': `vectorDistanceMetric must be one of: ${VECTOR_DISTANCE_METRICS.join(', ')}`,
        }),
      otherwise: Joi.string().optional().allow(null, ''),
    }),
    vectorIndexType: Joi.alternatives().conditional('dataType', {
      is: 'Vector',
      then: Joi.string()
        .valid(...VECTOR_INDEX_TYPES)
        .default('HNSW')
        .messages({
          'any.only': `vectorIndexType must be one of: ${VECTOR_INDEX_TYPES.join(', ')}`,
        }),
      otherwise: Joi.string().optional().allow(null, ''),
    }),
    // Advanced vector index configuration (only applicable when dataType = Vector)
    vectorIndexConfigs: Joi.alternatives().conditional('dataType', {
      is: 'Vector',
      then: Joi.array()
        .items(
          Joi.object({
            // HNSW parameters
            hnswM: Joi.number()
              .integer()
              .min(2)
              .max(100)
              .default(16)
              .messages({
                'number.min': 'hnswM must be at least 2',
                'number.max': 'hnswM cannot exceed 100',
              }),
            hnswEfConstruct: Joi.number()
              .integer()
              .min(4)
              .max(1000)
              .default(64)
              .messages({
                'number.min': 'hnswEfConstruct must be at least 4',
                'number.max': 'hnswEfConstruct cannot exceed 1000',
              }),
            // IVFFlat parameters
            ivfLists: Joi.number()
              .integer()
              .min(1)
              .max(10000)
              .default(100)
              .messages({
                'number.min': 'ivfLists must be at least 1',
                'number.max': 'ivfLists cannot exceed 10000',
              }),
          })
        )
        .max(1) // Only one config per field
        .optional()
        .messages({
          'array.max': 'Only one vectorIndexConfig is allowed per field',
        }),
      otherwise: Joi.array().optional().allow(null),
    }),
  })
  .custom((obj, helpers) => {
    // Ensure both minLength and maxLength are defined for comparison
    if (
      typeof obj.minLength !== 'undefined' &&
      typeof obj.maxLength !== 'undefined' &&
      obj.minLength !== null &&
      obj.maxLength !== null &&
      obj.minLength !== '' &&
      obj.maxLength !== ''
    ) {
      // Check if minLength is greater than maxLength
      if (obj.minLength > obj.maxLength) {
        // This creates a custom error message if the condition fails
        return helpers.error(
          'any.invalid',
          'minLength must be less than maxLength'
        );
      }
    }
    // Return the validated object if the conditions are met
    return obj;
  }, 'Min and Max Length Validation');

// Data types that are disallowed for field creation/updates
const DISALLOWED_DATA_TYPES = ['StringArray', 'IntArray', 'Json'];

const modelFieldCreateWithoutModelId = modelFieldBase.keys({
  name: Joi.string()
    .trim()
    .max(200)
    .pattern(/^[a-z]/, 'first-letter-lowercase')
    .invalid(...RESERVED_FIELD_NAMES)
    .required()
    .messages({
      'string.pattern.name': 'must start with a lowercase letter.',
      'string.invalid': 'cannot be one of the reserved field names.',
    }),
  dataType: Joi.string()
    .trim()
    .valid(...MODEL_FIELD_TYPES)
    .invalid(...DISALLOWED_DATA_TYPES)
    .required()
    .messages({
      'any.invalid': 'StringArray, IntArray, and Json data types are not allowed',
    }),
});

const modelFieldCreate = modelFieldCreateWithoutModelId.keys({
  modelId: Joi.string().uuid().required(),
});

const modelFieldUpdate = modelFieldBase.keys({
  name: Joi.string()
    .trim()
    .max(200)
    .pattern(/^[a-z]/, 'first-letter-lowercase')
    .invalid(...RESERVED_FIELD_NAMES)
    .optional()
    .messages({
      'string.pattern.name': 'must start with a lowercase letter.',
      'string.invalid': 'cannot be one of the reserved field names.',
    }),
  modelId: Joi.string().uuid().optional(),
  dataType: Joi.string()
    .trim()
    .valid(...MODEL_FIELD_TYPES)
    .invalid(...DISALLOWED_DATA_TYPES)
    .optional()
    .messages({
      'any.invalid': 'StringArray, IntArray, and Json data types are not allowed',
    }),
});

const modelFieldBatchCreateItem = modelFieldCreateWithoutModelId.keys({
  foreignKeyModel: Joi.string().trim().optional().allow(''),
  foreignKeyModelId: Joi.string().optional().trim().uuid().allow(''),
  // Optional dependsOn reference by name or id in batch create
  dependsOnFieldName: Joi.string().trim().optional().allow(''),
  dependsOnFieldId: Joi.string().optional().trim().uuid().allow(''),
  // Optional flag to auto-set this field as the model's display value
  isDisplayValue: Joi.boolean().default(false),
});

const modelFieldBatchCreateWithMeta = Joi.object({
  createdBy: Joi.string().uuid().optional(),
  client: Joi.string().uuid().optional(),
  modelId: Joi.string().uuid().required(),
  modelFields: Joi.array().items(modelFieldBatchCreateItem.required()),
}).custom((value, helpers) => {
  // Validate only one field can have isDisplayValue: true
  const displayValueFields = (value.modelFields || []).filter(
    (f) => f.isDisplayValue === true
  );
  if (displayValueFields.length > 1) {
    return helpers.error('any.custom', {
      message: 'Only one field can have isDisplayValue set to true',
    });
  }
  return value;
});

// Batch update
const modelFieldBatchUpdateItem = modelFieldUpdate.keys({
  id: Joi.string().uuid().required(),
});

const modelFieldBatchUpdateWithMeta = Joi.object({
  createdBy: Joi.string().uuid().optional(),
  client: Joi.string().uuid().optional(),
  modelFields: Joi.array().items(modelFieldBatchUpdateItem.required()),
});

module.exports = {
  modelFieldCreate,
  modelFieldUpdate,
  modelFieldBatchCreateWithMeta,
  modelFieldBatchUpdateItem,
  modelFieldBatchUpdateWithMeta,
};
