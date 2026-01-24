const Joi = require('joi');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const bulkDetailBase = visibilityCreate.keys({
  data: Joi.array().items(
    Joi.object({
      field_name: Joi.string().required(),
      model: Joi.string().required(),
      get_path: Joi.string().allow(null, ''),
      set_path: Joi.string().allow(null, ''),
      inner_field: Joi.boolean().default(false),
      ids: Joi.array().items(Joi.string().uuid()).required(),
    })
  ),
});

module.exports = { bulkDetailBase };
