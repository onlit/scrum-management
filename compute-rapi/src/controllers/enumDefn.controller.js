/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing enum definitions in a database using Prisma.
 * It includes functions for retrieving all enum definitions, creating a new enum definition,
 * creating multiple enum definitions in batch, retrieving a single enum definition, updating an
 * existing enum definition, and deleting an enum definition.
 *
 * The `getAllEnumDefns` function retrieves a paginated list of enum definitions based on query
 * parameters such as search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createEnumDefn` function validates the request body using a Joi schema and creates a new enum
 * definition in the database with additional metadata.
 *
 * The `createEnumDefnsBatch` function validates the request body for multiple enum definitions in batch,
 * creates each enum definition along with its associated enum values, and executes all queries within a
 * transaction to ensure atomicity.
 *
 * The `getEnumDefn` function retrieves a single enum definition based on the provided enum definition ID,
 * with visibility filters applied to ensure the enum definition is accessible to the requesting user.
 *
 * The `updateEnumDefn` function updates an existing enum definition in the database based on the provided
 * enum definition ID and request body.
 *
 * The `deleteEnumDefn` function deletes an enum definition from the database based on the provided enum
 * definition ID, along with its associated enum values, with visibility filters applied to ensure the
 * enum definition is deletable by the requesting user.
 *
 *
 * REVISION 1:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 20/02/2024
 * REVISION REASON: Add Standard File Header Comments
 *
 * REVISION 2:
 * REVISED BY: AI Assistant
 * REVISION DATE: 2025-01-27
 * REVISION REASON: Implement standardized error handling and trace ID conventions
 */

const prisma = require('#configs/prisma.js');
const {
  enumDefnCreate,
  enumDefnBatchCreate,
  enumDefnUpdate,
} = require('#schemas/enumDefn.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const {
  handleDatabaseError,
  handleValidationError,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/shared/traceUtils.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
  parseAndAssignVisibilityAttributes,
} = require('#utils/shared/visibilityUtils.js');
const { getPaginatedList } = require('#utils/shared/databaseUtils.js');

async function getAllEnumDefns(req, res) {
  const { user, query } = req;

  logOperationStart('getAllEnumDefns', req, {
    user: user?.id,
    queryKeys: Object.keys(query),
  });

  try {
    const searchFields = ['name', 'description', 'tags'];
    const filterFields = [...searchFields, 'microserviceId'];

    logDatabaseStart('get_paginated_enum_defns', req, {
      searchFields,
      filterFields,
      user: user?.id,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: enumDefnUpdate,
      filterFields,
      searchFields,
      model: 'enumDefn',
    });

    logDatabaseSuccess('get_paginated_enum_defns', req, {
      count: response?.data?.length || 0,
      total: response?.pagination?.total || 0,
    });

    logOperationSuccess('getAllEnumDefns', req, {
      count: response?.data?.length || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllEnumDefns', req, error);

    if (error.isJoi) {
      throw handleValidationError(error, 'enum_defn_list_validation');
    }
    throw handleDatabaseError(error, 'get_paginated_enum_defns');
  }
}

async function createEnumDefn(req, res) {
  const { user, body } = req;

  logOperationStart('createEnumDefn', req, {
    user: user?.id,
    bodyKeys: Object.keys(body),
  });

  try {
    let values;
    try {
      values = await enumDefnCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createEnumDefn', req, error);
        throw handleValidationError(error, 'enum_defn_creation_validation');
      }
      throw error;
    }

    logDatabaseStart('create_enum_defn', req, {
      name: values?.name,
      microserviceId: values?.microserviceId,
    });

    const enumDefn = await prisma.enumDefn.create({
      data: buildCreateRecordPayload({
        validatedValues: values,
        requestBody: body,
        user,
      }),
    });

    logDatabaseSuccess('create_enum_defn', req, { id: enumDefn.id });

    logOperationSuccess('createEnumDefn', req, { id: enumDefn.id });

    res.status(201).json(enumDefn);
  } catch (error) {
    logOperationError('createEnumDefn', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }
    throw handleDatabaseError(error, 'create_enum_defn');
  }
}

async function createEnumDefnsBatch(req, res) {
  const { user, body } = req;

  logOperationStart('createEnumDefnsBatch', req, {
    user: user?.id,
    batchSize: body?.length || 0,
  });

  try {
    let values;
    try {
      values = await enumDefnBatchCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createEnumDefnsBatch', req, error);
        throw handleValidationError(
          error,
          'enum_defn_batch_creation_validation'
        );
      }
      throw error;
    }

    logDatabaseStart('create_enum_defns_batch', req, {
      batchSize: values?.length || 0,
    });

    const queries = values.map((enumDefn) => {
      return prisma.enumDefn.create({
        data: {
          id: enumDefn?.id,
          name: enumDefn?.name,
          microserviceId: enumDefn?.microserviceId,
          ...parseAndAssignVisibilityAttributes({ body: enumDefn, user }),
          enumValues: {
            create: enumDefn?.values?.map((value) => ({
              id: value?.id,
              ...parseAndAssignVisibilityAttributes({ body: value, user }),
              value: value?.value,
              label: value?.label,
            })),
          },
        },
      });
    });

    const result = await prisma.$transaction(queries);

    logDatabaseSuccess('create_enum_defns_batch', req, {
      createdCount: result?.length || 0,
    });

    logOperationSuccess('createEnumDefnsBatch', req, {
      createdCount: result?.length || 0,
    });

    res.status(201).json(result);
  } catch (error) {
    logOperationError('createEnumDefnsBatch', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }
    throw handleDatabaseError(error, 'create_enum_defns_batch');
  }
}

async function getEnumDefn(req, res) {
  const { params, user } = req;

  logOperationStart('getEnumDefn', req, {
    user: user?.id,
    enumDefnId: params?.id,
  });

  try {
    logDatabaseStart('get_enum_defn', req, {
      enumDefnId: params?.id,
      user: user?.id,
    });

    const enumDefn = await prisma.enumDefn.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
    });

    if (!enumDefn) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'EnumDefn not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_enum_defn',
          details: { enumDefnId: params?.id },
        }
      );
      logOperationError('getEnumDefn', req, error);
      throw error;
    }

    logDatabaseSuccess('get_enum_defn', req, { id: enumDefn.id });

    logOperationSuccess('getEnumDefn', req, { id: enumDefn.id });

    res.status(200).json(enumDefn);
  } catch (error) {
    logOperationError('getEnumDefn', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }
    throw handleDatabaseError(error, 'get_enum_defn');
  }
}

async function updateEnumDefn(req, res) {
  const { params, body } = req;

  logOperationStart('updateEnumDefn', req, {
    enumDefnId: params?.id,
    bodyKeys: Object.keys(body),
  });

  try {
    let values;
    try {
      values = await enumDefnUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateEnumDefn', req, error);
        throw handleValidationError(error, 'enum_defn_update_validation');
      }
      throw error;
    }

    logDatabaseStart('update_enum_defn', req, {
      enumDefnId: params?.id,
      updateFields: Object.keys(values),
    });

    const updated = await prisma.enumDefn.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
      },
    });

    logDatabaseSuccess('update_enum_defn', req, { id: updated.id });

    logOperationSuccess('updateEnumDefn', req, { id: updated.id });

    res.status(200).json(updated);
  } catch (error) {
    logOperationError('updateEnumDefn', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }
    throw handleDatabaseError(error, 'update_enum_defn');
  }
}

async function deleteEnumDefn(req, res) {
  const { params, user } = req;

  logOperationStart('deleteEnumDefn', req, {
    user: user?.id,
    enumDefnId: params?.id,
  });

  try {
    logDatabaseStart('delete_enum_defn', req, {
      enumDefnId: params?.id,
      user: user?.id,
    });

    await prisma.enumDefn.deleteMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });

    await prisma.enumValue.deleteMany({
      where: { enumDefnId: params?.id, ...getVisibilityFilters(user) },
    });

    logDatabaseSuccess('delete_enum_defn', req, {
      deletedEnumDefnId: params?.id,
    });

    logOperationSuccess('deleteEnumDefn', req, {
      deletedEnumDefnId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteEnumDefn', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }
    throw handleDatabaseError(error, 'delete_enum_defn');
  }
}

module.exports = {
  getAllEnumDefns,
  createEnumDefn,
  createEnumDefnsBatch,
  getEnumDefn,
  updateEnumDefn,
  deleteEnumDefn,
};
