const Joi = require('joi');

const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const statusTypes = ['Error', 'Success'];

const instanceBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  tags: Joi.string().allow(null, ''),
});

const instanceCreate = instanceBase.keys({
  microserviceId: Joi.string().uuid().required(),
  status: Joi.string()
    .valid(...statusTypes)
    .required(),
});

const instanceUpdate = instanceBase.keys({
  microserviceId: Joi.string().uuid().optional(),
  status: Joi.string()
    .valid(...statusTypes)
    .optional(),
});

module.exports = { instanceCreate, instanceUpdate };
