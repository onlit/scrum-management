const Joi = require('joi');

const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const undeleteBase = visibilityCreate.keys({});

const undeleteCreate = undeleteBase.keys({
  ids: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .messages({
      'array.base': 'The `ids` field must be an array.',
      'array.min': 'At least one UUID must be provided.',
      'array.includesRequiredUnknowns':
        'All items in the `ids` array must be UUID strings.',
    })
    .required(),
});

module.exports = { undeleteCreate };
