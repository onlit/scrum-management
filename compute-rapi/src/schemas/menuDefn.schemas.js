const Joi = require('joi');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const menuDefnBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  parentMenuId: Joi.string().uuid().optional().allow(null, 'null'),
});

const menuDefnCreate = menuDefnBase.keys({
  order: Joi.number().positive().required(),
  modelId: Joi.string().uuid().required(),
  microserviceId: Joi.string().uuid().required(),
});

const menuDefnUpdate = menuDefnBase.keys({
  order: Joi.number().positive().optional(),
  modelId: Joi.string().uuid().optional(),
  microserviceId: Joi.string().uuid().optional(),
});

module.exports = { menuDefnCreate, menuDefnUpdate };
