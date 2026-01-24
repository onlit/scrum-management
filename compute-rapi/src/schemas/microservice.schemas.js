const Joi = require('joi');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const DEPLOYMENT_STATES = ['Development', 'Production'];

const microserviceBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  description: Joi.string().allow(null, ''),
  label: Joi.string().max(200).allow(null, ''),
  deploymentState: Joi.string()
    .valid(...DEPLOYMENT_STATES)
    .allow(null, ''),
  tags: Joi.string().allow(null, ''),
});

const microserviceCreate = microserviceBase.keys({
  name: Joi.string().max(200).required(),
  version: Joi.string()
    .pattern(/^[0-9]+\.[0-9]+\.[0-9]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Must be a valid semantic version (e.g., 1.0.0)',
    }),
  createdBy: Joi.string().uuid().optional(),
  client: Joi.string().uuid().optional(),
});

const microserviceUpdate = microserviceBase.keys({
  name: Joi.string().max(200).optional(),
  version: Joi.string()
    .pattern(/^[0-9]+\.[0-9]+\.[0-9]+$/)
    .optional()
    .messages({
      'string.pattern.base': 'Must be a valid semantic version (e.g., 1.0.0)',
    }),
});

module.exports = { microserviceCreate, microserviceUpdate };
