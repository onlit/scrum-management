const Joi = require('joi');

const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const computeMicroserviceBase = visibilityCreate.keys({});

const computeMicroserviceCreate = computeMicroserviceBase.keys({
  microserviceId: Joi.string().uuid().required(),
  generateApi: Joi.boolean().default(true),
  generateFrontend: Joi.boolean().default(true),
  generateDevOps: Joi.boolean().default(true),
  // Migration options - used when retrying after migration issues
  confirmMigrationIssues: Joi.boolean().default(false),
  applyAutoFixes: Joi.boolean().default(false),
  confirmDangerousChanges: Joi.boolean().default(false),
});

const computeMicroserviceValidate = computeMicroserviceBase.keys({
  microserviceId: Joi.string().uuid().required(),
});

const computeMicroservicePrismaSchema = computeMicroserviceBase.keys({
  microserviceId: Joi.string().uuid().required(),
});

const computeMicroserviceModelsFieldsCompact = computeMicroserviceBase.keys({
  microserviceId: Joi.string().uuid().required(),
  excludeFieldMeta: Joi.boolean().default(false),
  // Internal request fields (required when request is internal)
  client: Joi.string().uuid().optional(),
  createdBy: Joi.string().uuid().optional(),
});

const computeMicroserviceAutofix = computeMicroserviceBase.keys({
  microserviceId: Joi.string().uuid().required(),
});

module.exports = {
  computeMicroserviceCreate,
  computeMicroserviceValidate,
  computeMicroservicePrismaSchema,
  computeMicroserviceModelsFieldsCompact,
  computeMicroserviceAutofix,
};
