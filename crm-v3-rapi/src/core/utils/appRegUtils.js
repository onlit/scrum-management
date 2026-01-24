/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
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
const { getMicroserviceRegisterURL, getSystemV2RegistryURL } = require('#configs/routes.js');
const { get: getSchemaRegistry } = require('#core/utils/schemaRegistry.js');
const { logEvent } = require('#utils/basicLoggingUtils.js');
const { createStandardError } = require('#utils/errorHandlingUtils.js');
const {
  convertModelNameToSlug,
  toCamelCase,
  toStartCase,
} = require('#utils/stringUtils.js');

dotenv.config();

/**
 * Map Prisma relation metadata to registry cardinality format.
 * @param {Object} field - Prisma DMMF field object
 * @returns {string|null} Cardinality string or null if not a relation
 */
function mapRelationCardinality(field) {
  if (!field.relationName) return null;

  const hasRelationFromFields = field.relationFromFields?.length > 0;

  if (!hasRelationFromFields && field.isList) {
    return 'one-to-many';
  }
  if (hasRelationFromFields && !field.isList) {
    return 'many-to-one';
  }
  if (!hasRelationFromFields && !field.isList) {
    return 'one-to-one';
  }
  return 'many-to-many';
}

/**
 * Build field metadata from Prisma DMMF field.
 * @param {Object} field - Prisma DMMF field object
 * @returns {Object} Field metadata for registry payload
 */
function buildFieldMetadata(field) {
  const isRelation = !!field.relationName;
  return {
    name: field.name,
    label: toStartCase(field.name),
    description: null,
    type: field.type,
    isRelation,
    relationCardinality: mapRelationCardinality(field),
    relationNote: isRelation
      ? `${field.isList ? 'Has many' : 'Belongs to'} ${field.type}`
      : null,
  };
}

/**
 * Build REST capabilities from schemaRegistry for a resource.
 * @param {string} basePath - Base API path (e.g., '/api/v1/events')
 * @returns {Array} Array of capability objects
 */
function buildCapabilities(basePath) {
  const capabilities = [];
  const idPath = `${basePath}/:id`;

  // Check base path (list/create operations)
  const baseEntry = getSchemaRegistry(basePath);
  if (baseEntry?.methods) {
    for (const method of Object.keys(baseEntry.methods)) {
      const key = method === 'GET' ? 'list' : method === 'POST' ? 'create' : method.toLowerCase();
      capabilities.push({
        kind: 'restRoute',
        key,
        spec: {
          method,
          pathTemplate: basePath,
          pathParams: [],
        },
      });
    }
  }

  // Check ID path (read/update/delete operations)
  const idEntry = getSchemaRegistry(idPath);
  if (idEntry?.methods) {
    const keyMap = { GET: 'read', PUT: 'update', PATCH: 'patch', DELETE: 'delete' };
    for (const method of Object.keys(idEntry.methods)) {
      capabilities.push({
        kind: 'restRoute',
        key: keyMap[method] || method.toLowerCase(),
        spec: {
          method,
          pathTemplate: basePath.replace(/\/api\/v1/, '/api/v1') + '/{id}',
          pathParams: ['id'],
        },
      });
    }
  }

  return capabilities;
}

/**
 * Build complete system-v2 registration payload.
 * Registers ALL Prisma models, including those without routes.
 * Models without routes get empty capabilities array but are still registered
 * so their FQNs can be resolved for relation fields.
 * @returns {Object} Registration payload conforming to registry.schema.js
 */
function buildSystemV2Payload() {
  const models = Prisma.dmmf.datamodel.models;

  const resources = models
    .map((model) => {
      const slug = convertModelNameToSlug(model.name);
      const basePath = `/api/v1/${slug}`;

      const capabilities = buildCapabilities(basePath);

      // Register ALL models, even those without routes.
      // This ensures FQNs can be resolved for relation fields pointing to
      // lookup tables or other models that may not have CRUD endpoints.
      return {
        name: toCamelCase(model.name),
        label: model.name,
        description: null,
        aliases: [],
        fields: model.fields.map(buildFieldMetadata),
        capabilities,
      };
    });

  return {
    app: {
      name: MS_NAME,
      description: `Microservice responsible for managing ${MS_NAME}-related resources.`,
      tags: null,
      sandboxDomainUrl: 'https://sandbox.crm-v3.pullstream.com',
      stagingDomainUrl: 'https://crm-v3.staging.pullstream.com',
      productionDomainUrl: 'https://crm-v3.pullstream.com',
      backendEnvName: null,
      frontendEnvName: null,
      isNode: true,
      isCompute: true,
    },
    resources,
  };
}

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
        isCompute: true,
        microserviceSlug: 'crm-v3',
        description: `Microservice responsible for managing ${MS_NAME}-related tasks.`,
        sandboxDomainUrl: 'https://sandbox.crm-v3.pullstream.com',
        stagingDomainUrl: 'https://crm-v3.staging.pullstream.com',
        productionDomainUrl: 'https://crm-v3.pullstream.com',
      },
      models: Prisma.dmmf.datamodel.models.map(
        ({ name: modelName, fields }) => ({
          name: toCamelCase(modelName),
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

/**
 * Register app and resources with System V2 registry.
 * Called during startup after routes are loaded.
 * Fails silently with logging - does not block startup.
 */
async function registerWithSystemV2() {
  try {
    if (process.env.IS_LOCAL) {
      logEvent('[SYSTEM_V2_REGISTRATION_SKIPPED]: Local environment detected');
      return;
    }

    if (!Array.isArray(Prisma?.dmmf?.datamodel?.models)) {
      logEvent('[SYSTEM_V2_REGISTRATION_WARNING]: No Prisma models found. Registration skipped.');
      return;
    }

    if (!MS_NAME) {
      logEvent('[SYSTEM_V2_REGISTRATION_WARNING]: MS_NAME not defined. Registration skipped.');
      return;
    }

    const payload = buildSystemV2Payload();

    logEvent('[SYSTEM_V2_REGISTRATION_START]: Preparing payload');

    const url = getSystemV2RegistryURL();
    logEvent(
      `[SYSTEM_V2_REGISTRATION_REQUEST]: POST ${url} | resources: ${payload.resources.length}`
    );

    const response = await axios.post(url, payload);

    // Handle both async (202) and sync (200) response formats
    if (response.status === 202) {
      // Async: job was queued
      logEvent(
        `[SYSTEM_V2_REGISTRATION_QUEUED]: jobId=${response.data.jobId}, position=${response.data.position}`
      );
    } else {
      // Sync: registration completed immediately
      logEvent(
        `[SYSTEM_V2_REGISTRATION_SUCCESS]: registered_at=${response.data.registeredAt}, resources=${response.data.resourcesRegistered}`
      );
    }
  } catch (error) {
    const url = (() => {
      try {
        return getSystemV2RegistryURL();
      } catch {
        return 'unknown-url';
      }
    })();

    const status = error?.response?.status;
    const responseData = error?.response?.data;

    const standardizedError = createStandardError(
      ERROR_TYPES.SERVICE_UNAVAILABLE,
      'System V2 registration failed',
      {
        severity: ERROR_SEVERITY.HIGH,
        context: 'system_v2_registration',
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

    logEvent(`[SYSTEM_V2_REGISTRATION_ERROR]: ${standardizedError.message}`);

    try {
      const debugInfo = {
        type: standardizedError.type,
        severity: standardizedError.severity,
        context: standardizedError.context,
        statusCode: standardizedError.statusCode,
        details: standardizedError.details,
        axiosCode: error?.code,
        isAxiosError: !!error?.isAxiosError,
        resourcesCount: (() => {
          try {
            return buildSystemV2Payload().resources.length;
          } catch {
            return 0;
          }
        })(),
      };

      logEvent(
        `[SYSTEM_V2_REGISTRATION_ERROR_DEBUG]: ${JSON.stringify(debugInfo).slice(0, 4000)}`
      );
    } catch {
      // Ignore logging errors
    }
  }
}

module.exports = { registerMicroservice, registerWithSystemV2 };
