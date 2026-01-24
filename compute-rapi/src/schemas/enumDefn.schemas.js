const Joi = require('joi');

const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const enumDefnBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  description: Joi.string().allow(null, ''),
  tags: Joi.string().allow(null, ''),
});

const enumDefnCreate = enumDefnBase.keys({
  name: Joi.string()
    .max(200)
    .regex(/^[A-Z]\S*$/)
    .required()
    .messages({
      'string.pattern.base':
        'must start with a capital letter and should not contain spaces.',
    }),
  microserviceId: Joi.string().uuid().required(),
});

const enumDefnBatchCreate = Joi.array().items(
  enumDefnCreate.keys({
    values: Joi.array().items(
      Joi.object({
        id: Joi.string().uuid().allow(''),
        label: Joi.string().required(),
        value: Joi.string()
          .pattern(/^[^\s]*$/) // Regex to disallow spaces
          .max(200)
          .required()
          .messages({
            'string.pattern.base': 'Value cannot contain spaces.',
          }),
      })
    ),
  })
);

const enumDefnUpdate = enumDefnBase.keys({
  name: Joi.string().max(200).optional(),
  microserviceId: Joi.string().uuid().optional(),
});

module.exports = { enumDefnCreate, enumDefnBatchCreate, enumDefnUpdate };
