/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 24/10/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file is responsible for microservice registration tasks. It includes functions to register the microservice and its models with a central service, ensuring that the service's existence and its data models are known to other parts of the system. It also handles conditional logic based on the environment and error logging.
 *
 *
 */
const _ = require('lodash');
const axios = require('axios');
const dotenv = require('dotenv');
const { Prisma } = require('@prisma/client');
const {
  MS_NAME,
  ERROR_TYPES,
  ERROR_SEVERITY,
} = require('#configs/constants.js');
const { getMicroserviceRegisterURL } = require('#configs/routes.js');
const { logEvent } = require('#utils/shared/basicLoggingUtils.js');
const { createStandardError } = require('#utils/shared/errorHandlingUtils.js');
const { convertModelNameToSlug } = require('#utils/shared/generalUtils.js');

dotenv.config();

async function registerMicroservice() {
  try {
    if (process.env.IS_LOCAL) {
      logEvent(
        '[MICROSERVICE_REGISTRATION_SKIPPED]: Local environment detected'
      );
      return;
    }

    if (!Array.isArray(Prisma?.dmmf?.datamodel?.models)) {
      logEvent(
        '[MICROSERVICE_REGISTRATION_WARNING]: No models found in Prisma datamodel. Registration skipped.'
      );
      return;
    }

    if (!MS_NAME) {
      logEvent(
        '[MICROSERVICE_REGISTRATION_WARNING]: MS_NAME is not defined. Registration skipped.'
      );
      return;
    }

    const payload = {
      microservice: {
        name: MS_NAME,
        isNode: true,
        microserviceSlug: 'crm-v2',
        description:
          `Microservice responsible for managing ${MS_NAME}-related tasks.`,
        sandboxDomainUrl: 'https://sandbox.crm-v2.pullstream.com',
        stagingDomainUrl: 'https://crm-v2.staging.pullstream.com',
        productionDomainUrl: 'https://crm-v2.pullstream.com',
      },
      models: Prisma.dmmf.datamodel.models.map(
        ({ name: modelName, fields }) => ({
          name: _.camelCase(modelName),
          label: modelName,
          basePath: convertModelNameToSlug(modelName),
          fields: fields.map(({ name: fieldName, type }) => ({
            name: fieldName,
            type,
          })),
        })
      ),
    };

    // Structured logging for registration lifecycle
    logEvent('[MICROSERVICE_REGISTRATION_START]: Preparing payload');

    const url = getMicroserviceRegisterURL();
    logEvent(
      `[MICROSERVICE_REGISTRATION_REQUEST]: POST ${url} | models: ${payload.models.length}`
    );

    await axios.post(url, payload);
    logEvent(
      '[MICROSERVICE_REGISTRATION_SUCCESS]: Microservice registered successfully'
    );
  } catch (error) {
    // Create standardized error object for observability; don't throw during startup
    const url = (() => {
      try {
        return getMicroserviceRegisterURL();
      } catch {
        return 'unknown-url';
      }
    })();

    const status = error?.response?.status;
    const responseData = error?.response?.data;

    const standardizedError = createStandardError(
      ERROR_TYPES.SERVICE_UNAVAILABLE,
      'Microservice registration failed',
      {
        severity: ERROR_SEVERITY.HIGH,
        context: 'microservice_registration',
        details: {
          url,
          status,
          response:
            typeof responseData === 'object'
              ? JSON.stringify(responseData).slice(0, 1000)
              : responseData,
        },
        originalError: error,
      }
    );

    logEvent(`[MICROSERVICE_REGISTRATION_ERROR]: ${standardizedError.message}`);

    // Log structured debug details to aid troubleshooting (kept concise and sanitized)
    try {
      const modelsCount = Array.isArray(Prisma?.dmmf?.datamodel?.models)
        ? Prisma.dmmf.datamodel.models.length
        : 0;

      const debugInfo = {
        type: standardizedError.type,
        severity: standardizedError.severity,
        context: standardizedError.context,
        statusCode: standardizedError.statusCode,
        details: standardizedError.details,
        originalError: standardizedError.originalError,
        axiosCode: error?.code,
        isAxiosError: !!error?.isAxiosError,
        method: 'POST',
        modelsCount,
      };

      logEvent(
        `[MICROSERVICE_REGISTRATION_ERROR_DEBUG]: ${JSON.stringify(
          debugInfo
        ).slice(0, 4000)}`
      );
    } catch (e) {
      // no-op logging failure
    }
  }
}

module.exports = { registerMicroservice };
