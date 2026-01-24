const Joi = require('joi');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const textDirectionEnum = ['LTR', 'RTL'];

const languageBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  tags: Joi.string().allow(null, ''),
  isPrimary: Joi.boolean().falsy(''),
});

const languageCreate = languageBase.keys({
  code: Joi.string().required().trim(),
  name: Joi.string().required().trim(),
  direction: Joi.string().valid(...textDirectionEnum),
});

const languageUpdate = languageBase.keys({
  code: Joi.string().trim().optional(),
  name: Joi.string().trim().optional(),
  direction: Joi.string()
    .valid(...textDirectionEnum)
    .optional(),
});

module.exports = { languageCreate, languageUpdate };
