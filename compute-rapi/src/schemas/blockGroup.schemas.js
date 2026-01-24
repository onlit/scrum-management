const Joi = require('joi');

const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const blockGroupBase = visibilityCreate.keys({
  order: Joi.number(),
  id: Joi.string().uuid().allow(''),
  description: Joi.string().allow(null, ''),
  tags: Joi.string().allow(null, ''),
});

const blockGroupCreate = blockGroupBase.keys({
  name: Joi.string().max(200).required(),
});

const blockGroupUpdate = blockGroupBase.keys({
  name: Joi.string().max(200).optional(),
});

module.exports = { blockGroupCreate, blockGroupUpdate };
