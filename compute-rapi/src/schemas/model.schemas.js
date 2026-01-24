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

const modelBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(null, ''),
  order: Joi.number().optional().allow(null),
  slug: Joi.string()
    .trim()
    .max(200)
    .lowercase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .optional()
    .allow(null, '')
    .messages({
      'string.pattern.base':
        'Slug must be lowercase kebab-case (e.g., "persons", "bank-accounts")',
    }),
  description: Joi.string().trim().allow(null, ''),
  helpfulHint: Joi.string().trim().allow(null, ''),
  labelTranslationCode: translationCodeValidator,
  helpfulHintTranslationCode: translationCodeValidator,
  useFormFlow: Joi.boolean().falsy(''),
  displayValueId: Joi.string().uuid().optional().allow(null),
  displayValueTemplate: Joi.string().trim().allow(null, ''),
  systemMenuId: Joi.string().uuid().optional().allow(null),
  addToDashboard: Joi.boolean().falsy(''),
  lookup: Joi.boolean().falsy(''),
  showAutomataSelector: Joi.boolean().falsy(''),

  dashboardStageFieldId: Joi.string().uuid().optional().allow(null),
  tags: Joi.string().allow(null, ''),
});

const modelCreateWithoutMicroserviceId = modelBase.keys({
  name: Joi.string()
    .max(200)
    .regex(/^[A-Z]\S*$/)
    .required()
    .messages({
      'string.pattern.base':
        'must start with a capital letter and should not contain spaces.',
    }),
  label: Joi.string().trim().max(200).required(),
});

const modelCreate = modelCreateWithoutMicroserviceId.keys({
  description: Joi.string().trim().allow(null, ''),
  microserviceId: Joi.string().uuid().required(),
});

const modelBatchCreate = Joi.array().items(
  modelCreate.keys({
    fields: Joi.array().items(
      Joi.object({
        id: Joi.string().uuid().allow(''),
        label: Joi.string().trim().max(200).required(),
        name: Joi.string()
          .trim()
          .max(200)
          .invalid(...RESERVED_FIELD_NAMES)
          .required(),
        dataType: Joi.string()
          .trim()
          .valid(...MODEL_FIELD_TYPES)
          .required(),
        defaultValue: Joi.string().allow(null, '').optional(),
        isForeignKey: Joi.boolean().falsy(''),
        isOptional: Joi.boolean().falsy(''),
        isUnique: Joi.boolean().falsy(''),
        foreignKeyModelId: Joi.string().trim().uuid().allow(''),
        enumDefnId: Joi.string().trim().uuid().allow(''),
        order: Joi.number().optional().allow(''),
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
        tags: Joi.string().trim().allow(null, ''),
        description: Joi.string().trim().allow(null, ''),
        helpfulHint: Joi.string().trim().allow(null, ''),
        showInTable: Joi.boolean().falsy(''),
        showInDetailCard: Joi.boolean().falsy(''),
        externalIsOptional: Joi.boolean().falsy(''),
        isEditable: Joi.boolean().falsy(''),
        isIndex: Joi.boolean().falsy(''),
        isClickableLink: Joi.boolean().falsy(''),
        isMultiline: Joi.boolean().falsy(''),
        foreignKeyTarget: Joi.optional().valid(...FOREIGN_KEY_TARGETS),
        foreignKeyType: Joi.optional().valid(...FOREIGN_KEY_TYPES),
        externalMicroserviceId: Joi.string().trim().uuid().allow(''),
        externalModelId: Joi.string().trim().uuid().allow(''),
        systemMenuId: Joi.string().trim().uuid().allow(''),
        onDelete: Joi.string().when('isForeignKey', {
          is: true,
          then: Joi.required().valid(...DELETE_BEHAVIORS),
          otherwise: Joi.optional().allow(null, ''),
        }),
      })
    ),
  })
);

const modelBatchCreateWithMeta = Joi.object({
  createdBy: Joi.string().uuid().optional(),
  client: Joi.string().uuid().optional(),
  microserviceId: Joi.string().uuid().required(),
  models: Joi.array().items(modelCreateWithoutMicroserviceId),
});

const modelUpdate = modelBase.keys({
  name: Joi.string().max(200).optional(),
  microserviceId: Joi.string().uuid().optional(),
  label: Joi.string().trim().max(200).optional(),
});

module.exports = {
  modelCreate,
  modelBatchCreate,
  modelBatchCreateWithMeta,
  modelUpdate,
};
