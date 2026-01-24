const Joi = require('joi');

const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const enumValueBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  description: Joi.string().allow(null, ''),
  tags: Joi.string().allow(null, ''),
});

const enumValueCreate = enumValueBase.keys({
  value: Joi.string()
    .max(200)
    .regex(/^[A-Z]\S*$/)
    .required()
    .messages({
      'string.pattern.base':
        'Must start with a capital letter, cannot contain spaces, and numbers are not allowed.',
    }),
  label: Joi.string()
    .max(200)
    .regex(/^[A-Za-z0-9 .,;:()\-'&]+$/)
    .required()
    .messages({
      'string.pattern.base':
        'Label can contain letters, numbers, spaces, and common punctuation (.,;:()-\'&) only.',
    }),
  enumDefnId: Joi.string().uuid().required(),
});

const enumValueUpdate = enumValueBase.keys({
  value: Joi.string()
    .max(200)
    .regex(/^[A-Z]\S*$/)
    .optional()
    .messages({
      'string.pattern.base':
        'Must start with a capital letter, cannot contain spaces, and numbers are not allowed.',
    }),
  label: Joi.string()
    .max(200)
    .regex(/^[A-Za-z0-9 .,;:()\-'&]+$/)
    .optional()
    .messages({
      'string.pattern.base':
        'Label can contain letters, numbers, spaces, and common punctuation (.,;:()-\'&) only.',
    }),
  enumDefnId: Joi.string().uuid().optional(),
});

module.exports = { enumValueCreate, enumValueUpdate };
