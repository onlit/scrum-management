const Joi = require('joi');

const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const statusTypes = ['Error', 'Success'];

const instanceLogBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  message: Joi.string().allow(null, ''),
  tags: Joi.string().allow(null, ''),
});

const instanceLogCreate = instanceLogBase.keys({
  blockId: Joi.string().uuid().required(),
  instanceId: Joi.string().uuid().required(),
  status: Joi.string()
    .valid(...statusTypes)
    .required(),
});

const instanceLogUpdate = instanceLogBase.keys({
  blockId: Joi.string().uuid().optional(),
  instanceId: Joi.string().uuid().optional(),
  status: Joi.string()
    .valid(...statusTypes)
    .optional(),
});

module.exports = { instanceLogCreate, instanceLogUpdate };
