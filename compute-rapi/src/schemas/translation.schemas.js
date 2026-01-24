const Joi = require('joi');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const translationCodeValidator = Joi.string()
  .allow(null, '')
  .max(8)
  .custom((value, helpers) => {
    if (value === null || value === '') {
      return value; // Allow empty or null for auto-generation
    }

    // Format should be XXXX-XXX
    const codeRegex = /^[A-Z0-9]{4}-[A-Z0-9]{3}$/;
    if (!codeRegex.test(value)) {
      return helpers.error('string.pattern.base', { pattern: 'XXXX-XXX' });
    }

    return value;
  }, 'translation code format validation')
  .messages({
    'string.pattern.base':
      'Translation code must be in the format XXXX-XXX with uppercase letters and numbers only',
  });

const translationBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  tags: Joi.string().allow(null, ''),
  translationCode: translationCodeValidator,
});

// For creating new translations
const translationCreate = translationBase.keys({
  value: Joi.string().required(),
  namespace: Joi.string().required(),
  languageId: Joi.string().uuid().required(),
});

// For updating existing translations
const translationUpdate = translationBase.keys({
  translationCode: translationCodeValidator,
  value: Joi.string().optional(),
  namespace: Joi.string().optional(),
  languageId: Joi.string().uuid().optional(),
});

module.exports = {
  translationCreate,
  translationUpdate,
  translationCodeValidator,
};
