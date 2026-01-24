const _ = require('lodash');
const axios = require('axios');
const dotenv = require('dotenv');
const { Prisma } = require('@prisma/client');
const { MS_NAME } = require('#configs/constants.js');
const { toCamelCase } = require('#utils/shared/stringUtils.js');
const {
  getMicroservicesURL,
  getRegisterModelsURL,
} = require('#configs/routes.js');
const { logEvent } = require('#utils/shared/loggingUtils.js');

dotenv.config();

async function registerMicroservice() {
  try {
    if (process.env.IS_LOCAL) return;
    await axios.post(getMicroservicesURL(), { name: MS_NAME });
    logEvent(`Microservice registered with the name: ${MS_NAME}`);
  } catch (error) {
    logEvent(
      `Failed to register microservice: ${error?.response?.data ?? error?.message}`
    );
    // Optionally, throw standardized error if this should be fatal:
    // throw createStandardError(ERROR_TYPES.INTERNAL, 'Failed to register microservice', { severity: ERROR_SEVERITY.MEDIUM, context: 'register_microservice', originalError: error });
  }
}

async function registerModels() {
  try {
    if (
      process.env.IS_LOCAL ||
      !Array.isArray(Prisma?.dmmf?.datamodel?.models)
    ) {
      return;
    }
    const payload = Prisma.dmmf.datamodel.models.map(
      ({ name: modelName, fields }) => ({
        label: modelName,
        name: toCamelCase(modelName),
        fields: fields.map(({ name: fieldName, type }) => ({
          name: fieldName,
          type,
        })),
      })
    );
    await axios.post(getRegisterModelsURL({ query: `${MS_NAME}/` }), payload);
    logEvent('Models registered');
  } catch (error) {
    logEvent(
      `Failed to register models: ${error?.response?.data ?? error?.message}`
    );
    // Optionally, throw standardized error if this should be fatal:
    // throw createStandardError(ERROR_TYPES.INTERNAL, 'Failed to register models', { severity: ERROR_SEVERITY.MEDIUM, context: 'register_models', originalError: error });
  }
}

module.exports = { registerMicroservice, registerModels };
