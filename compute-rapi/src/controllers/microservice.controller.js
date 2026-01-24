/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing microservices in a database using Prisma.
 * It includes functions for retrieving all microservices, creating a new microservice, retrieving
 * a single microservice, updating an existing microservice, and deleting a microservice.
 *
 * The `getAllMicroservices` function retrieves a paginated list of microservices based on query
 * parameters such as search fields, with support for user-specific visibility filters.
 *
 * The `createMicroservice` function validates the request body using a Joi schema and creates a new
 * microservice in the database with additional metadata.
 *
 * The `getMicroservice` function retrieves a single microservice based on the provided microservice ID,
 * with visibility filters applied to ensure the microservice is accessible to the requesting user.
 *
 * The `updateMicroservice` function updates an existing microservice in the database based on the provided
 * microservice ID and request body.
 *
 * The `deleteMicroservice` function deletes a microservice from the database based on the provided microservice
 * ID, with visibility filters applied to ensure the microservice is deletable by the requesting user.
 *
 *
 * REVISION 1:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 20/02/2024
 * REVISION REASON: Add Standard File Header Comments
 *
 *
 * REVISION 2:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 21/02/2024
 * REVISION REASON: Convert ESM to CJS
 */
const _ = require('lodash');
const prisma = require('#configs/prisma.js');
const {
  microserviceCreate,
  microserviceUpdate,
} = require('#schemas/microservice.schemas.js');
const {
  objectKeysToCamelCase,
  compareVersions,
} = require('#utils/shared/generalUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/shared/traceUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const { getPaginatedList } = require('#utils/shared/databaseUtils.js');
const {
  hasComputeAdminAccess,
} = require('#utils/api/microserviceValidationUtils.js');

const getAllMicroservices = async (req, res) => {
  const { user, query } = req;

  logOperationStart('getAllMicroservices', req, { user: user.id, query });

  const searchFields = ['name', 'description', 'tags'];
  const filterFields = [...searchFields, 'deploymentState'];

  try {
    logDatabaseStart('get_paginated_microservices', req, {
      searchFields,
      filterFields,
    });
    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: microserviceUpdate,
      filterFields,
      searchFields,
      model: 'microservice',
    });

    logDatabaseSuccess('get_paginated_microservices', req, {
      count: response.data?.length,
    });
    logOperationSuccess('getAllMicroservices', req, {
      count: response.data?.length,
    });
    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllMicroservices', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Failed to fetch microservices',
      req,
      {
        context: 'get_all_microservices',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }
};

const createMicroservice = async (req, res) => {
  const { user, body } = req;

  logOperationStart('createMicroservice', req, {
    user: user.id,
    bodyKeys: Object.keys(body),
  });

  let values;
  let createdBy;
  let client;
  try {
    ({ createdBy, client, ...values } = await microserviceCreate.validateAsync(
      body,
      {
        abortEarly: false,
        stripUnknown: true,
      }
    ));
  } catch (error) {
    if (error.isJoi) {
      logOperationError('createMicroservice', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'microservice_creation',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('createMicroservice', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'microservice_creation',
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
    });
  }

  const isInternal = !user.isAuthenticated && user.internalRequest;

  if (isInternal) {
    if (!createdBy || !client) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'For internal requests, both client and createdBy fields are required.',
        req,
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'internal_request_validation',
        }
      );
      logOperationError('createMicroservice', req, error);
      throw error;
    }

    user.client = { id: client };
    user.id = createdBy;
  }

  // Only compute admins can set deploymentState explicitly
  if (_.has(values, 'deploymentState') && !hasComputeAdminAccess(user)) {
    const error = createErrorWithTrace(
      ERROR_TYPES.AUTHORIZATION,
      'Only compute admins can set deploymentState.',
      req,
      {
        severity: ERROR_SEVERITY.MEDIUM,
        context: 'microservice_creation',
        details: { attemptedDeploymentState: values.deploymentState },
      }
    );
    logOperationError('createMicroservice', req, error);
    throw error;
  }

  const finalName = values.name;
  let finalVersion = values.version;

  if (isInternal) {
    // Check for existing microservices with the *original requested name*
    let existingServicesWithSameName;
    try {
      logDatabaseStart('check_existing_microservices', req, {
        name: values.name,
      });
      existingServicesWithSameName = await prisma.microservice.findMany({
        where: {
          name: values.name,
        },
      });
      logDatabaseSuccess('check_existing_microservices', req, {
        found: existingServicesWithSameName.length,
      });
    } catch (error) {
      logOperationError('createMicroservice', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.INTERNAL,
        'Failed to check existing microservices',
        req,
        {
          context: 'existing_microservices_check',
          severity: ERROR_SEVERITY.HIGH,
          originalError: error,
        }
      );
    }

    if (existingServicesWithSameName.length > 0) {
      existingServicesWithSameName.sort((a, b) =>
        compareVersions(b.version, a.version)
      );
      const mostRecentService = existingServicesWithSameName[0];
      const mostRecentVersionStr = mostRecentService.version;

      const versionParts = mostRecentVersionStr.split('.').map(Number);
      const newMajorVersion = versionParts[0] + 1;

      finalVersion = `${newMajorVersion}.0.0`;

      logOperationStart('version_increment', req, {
        originalName: values.name,
        mostRecentVersion: mostRecentVersionStr,
        newVersion: finalVersion,
      });
    }
  }

  // Uniqueness check for the *final* name and version
  let found;
  try {
    logDatabaseStart('uniqueness_check', req, { finalName, finalVersion });
    found = await prisma.microservice.findFirst({
      where: {
        name: finalName,
        version: finalVersion,
      },
    });
    logDatabaseSuccess('uniqueness_check', req, { found: !!found });
  } catch (error) {
    logOperationError('createMicroservice', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Failed uniqueness check',
      req,
      {
        context: 'microservice_uniqueness_check',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (found) {
    const error = createErrorWithTrace(
      ERROR_TYPES.CONFLICT,
      `A microservice with name "${finalName}" and version "${finalVersion}" already exists.`,
      req,
      {
        severity: ERROR_SEVERITY.LOW,
        context: 'microservice_creation',
        details: { name: finalName, version: finalVersion },
      }
    );
    logOperationError('createMicroservice', req, error);
    throw error;
  }

  const createPayload = {
    ...values,
    name: finalName, // Override with final name
    version: finalVersion, // Override with final version
  };

  let microservice;
  try {
    logDatabaseStart('create_microservice', req, { finalName, finalVersion });
    microservice = await prisma.microservice.create({
      data: buildCreateRecordPayload({
        validatedValues: createPayload,
        requestBody: body,
        user,
      }),
    });
    logDatabaseSuccess('create_microservice', req, { id: microservice.id });
    logOperationSuccess('createMicroservice', req, {
      id: microservice.id,
      name: microservice.name,
    });
    res.status(201).json(microservice);
  } catch (error) {
    logOperationError('createMicroservice', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Failed to create microservice',
      req,
      {
        context: 'microservice_creation',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }
};

const getMicroservice = async (req, res) => {
  const { params, user } = req;

  logOperationStart('getMicroservice', req, {
    microserviceId: params?.id,
    user: user.id,
  });

  let microservice;
  try {
    logDatabaseStart('find_microservice', req, { microserviceId: params?.id });
    microservice = await prisma.microservice.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
    });
  } catch (error) {
    logOperationError('getMicroservice', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Failed to find microservice',
      req,
      {
        context: 'get_microservice',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!microservice) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Microservice not found',
      req,
      {
        severity: ERROR_SEVERITY.LOW,
        context: 'get_microservice',
        details: { microserviceId: params?.id },
      }
    );
    logOperationError('getMicroservice', req, error);
    throw error;
  }

  logOperationSuccess('getMicroservice', req, {
    id: microservice.id,
    name: microservice.name,
  });
  res.status(200).json(microservice);
};

const updateMicroservice = async (req, res) => {
  const { params, body } = req;

  logOperationStart('updateMicroservice', req, {
    microserviceId: params?.id,
    bodyKeys: Object.keys(body),
  });

  let values;
  try {
    values = await microserviceUpdate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('updateMicroservice', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'microservice_update',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('updateMicroservice', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'microservice_update',
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
    });
  }

  // Prevent renaming if the microservice has been generated and there are instance logs
  if (_.has(values, 'name')) {
    let current;
    try {
      logDatabaseStart('get_current_microservice_name', req, {
        microserviceId: params?.id,
      });
      current = await prisma.microservice.findUnique({
        where: { id: params?.id },
        select: { name: true },
      });
      logDatabaseSuccess('get_current_microservice_name', req, {
        found: !!current,
      });
    } catch (error) {
      logOperationError('updateMicroservice', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.INTERNAL,
        'Failed to read current microservice',
        req,
        {
          context: 'microservice_update_get_current',
          severity: ERROR_SEVERITY.HIGH,
          originalError: error,
        }
      );
    }

    // Only enforce if the name is actually changing
    if (current && current.name !== values.name) {
      let instanceLogsCount = 0;
      try {
        logDatabaseStart('count_instance_logs_for_microservice', req, {
          microserviceId: params?.id,
        });
        instanceLogsCount = await prisma.instanceLog.count({
          where: {
            instance: {
              microserviceId: params?.id,
            },
          },
        });
        logDatabaseSuccess('count_instance_logs_for_microservice', req, {
          count: instanceLogsCount,
        });
      } catch (error) {
        logOperationError('updateMicroservice', req, error);
        throw createErrorWithTrace(
          ERROR_TYPES.INTERNAL,
          'Failed to verify instance logs',
          req,
          {
            context: 'microservice_update_check_logs',
            severity: ERROR_SEVERITY.HIGH,
            originalError: error,
          }
        );
      }

      if (instanceLogsCount > 0) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'Cannot update name after generation when instance logs exist.',
          req,
          {
            severity: ERROR_SEVERITY.MEDIUM,
            context: 'microservice_update_name_restricted',
            details: { microserviceId: params?.id },
          }
        );
        logOperationError('updateMicroservice', req, error);
        throw error;
      }
    }
  }

  let updated;
  try {
    // Only compute admins can change deploymentState on update
    if (_.has(values, 'deploymentState') && !hasComputeAdminAccess(req.user)) {
      const error = createErrorWithTrace(
        ERROR_TYPES.AUTHORIZATION,
        'Only compute admins can change deploymentState.',
        req,
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'microservice_update',
          details: { attemptedDeploymentState: values.deploymentState },
        }
      );
      logOperationError('updateMicroservice', req, error);
      throw error;
    }

    logDatabaseStart('update_microservice', req, {
      microserviceId: params?.id,
      values,
    });
    updated = await prisma.microservice.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
      },
    });
  } catch (error) {
    logOperationError('updateMicroservice', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Failed to update microservice',
      req,
      {
        context: 'microservice_update',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logDatabaseSuccess('update_microservice', req, { id: updated.id });
  logOperationSuccess('updateMicroservice', req, {
    id: updated.id,
    name: updated.name,
  });
  res.status(200).json(updated);
};

const deleteMicroservice = async (req, res) => {
  const { params, user } = req;

  logOperationStart('deleteMicroservice', req, {
    microserviceId: params?.id,
    user: user.id,
  });

  try {
    logDatabaseStart('delete_microservice', req, {
      microserviceId: params?.id,
    });
    await prisma.microservice.deleteMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });
  } catch (error) {
    logOperationError('deleteMicroservice', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Failed to delete microservice',
      req,
      {
        context: 'microservice_deletion',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logDatabaseSuccess('delete_microservice', req, { deletedId: params?.id });
  logOperationSuccess('deleteMicroservice', req, { deletedId: params?.id });
  res.status(200).json({ deleted: params?.id });
};

module.exports = {
  getAllMicroservices,
  createMicroservice,
  getMicroservice,
  updateMicroservice,
  deleteMicroservice,
};
