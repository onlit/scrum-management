/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing enum values in a database using Prisma.
 * It includes functions for retrieving all enum values, creating a new enum value, retrieving
 * a single enum value, updating an existing enum value, and deleting an enum value.
 *
 * The `getAllEnumValues` function retrieves a paginated list of enum values based on query
 * parameters such as search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createEnumValue` function validates the request body using a Joi schema and creates a new
 * enum value in the database with additional metadata.
 *
 * The `getEnumValue` function retrieves a single enum value based on the provided enum value ID,
 * with visibility filters applied to ensure the enum value is accessible to the requesting user.
 *
 * The `updateEnumValue` function updates an existing enum value in the database based on the provided
 * enum value ID and request body.
 *
 * The `deleteEnumValue` function deletes an enum value from the database based on the provided enum
 * value ID, with visibility filters applied to ensure the enum value is deletable by the requesting user.
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
  enumValueCreate,
  enumValueUpdate,
} = require('#schemas/enumValue.schemas.js');
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
} = require('#utils/shared/visibilityUtils.js');
const { getPaginatedList } = require('#utils/shared/databaseUtils.js');

async function getAllEnumValues(req, res) {
  const { user, query } = req;

  logOperationStart('getAllEnumValues', req, {
    user: user?.id,
    queryKeys: Object.keys(query),
  });

  try {
    const searchFields = ['value', 'description', 'tags'];
    const filterFields = [...searchFields, 'enumDefnId'];

    logDatabaseStart('get_paginated_enum_values', req, {
      searchFields,
      filterFields,
      user: user?.id,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: enumValueUpdate,
      filterFields,
      searchFields,
      model: 'enumValue',
    });

    logDatabaseSuccess('get_paginated_enum_values', req, {
      count: response?.data?.length || 0,
      total: response?.pagination?.total || 0,
    });

    logOperationSuccess('getAllEnumValues', req, {
      count: response?.data?.length || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllEnumValues', req, error);

    if (error.isJoi) {
      throw handleValidationError(error, 'enum_value_list_validation');
    }
    throw handleDatabaseError(error, 'get_paginated_enum_values');
  }
}

async function createEnumValue(req, res) {
  const { user, body } = req;

  logOperationStart('createEnumValue', req, {
    user: user?.id,
    bodyKeys: Object.keys(body),
  });

  try {
    let values;
    try {
      values = await enumValueCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createEnumValue', req, error);
        throw handleValidationError(error, 'enum_value_creation_validation');
      }
      throw error;
    }

    logDatabaseStart('create_enum_value', req, {
      value: values?.value,
      enumDefnId: values?.enumDefnId,
    });

    const enumValue = await prisma.enumValue.create({
      data: buildCreateRecordPayload({
        validatedValues: values,
        requestBody: body,
        user,
      }),
    });

    logDatabaseSuccess('create_enum_value', req, { id: enumValue.id });

    logOperationSuccess('createEnumValue', req, { id: enumValue.id });

    res.status(201).json(enumValue);
  } catch (error) {
    logOperationError('createEnumValue', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }
    throw handleDatabaseError(error, 'create_enum_value');
  }
}

async function getEnumValue(req, res) {
  const { params, user } = req;

  logOperationStart('getEnumValue', req, {
    user: user?.id,
    enumValueId: params?.id,
  });

  try {
    logDatabaseStart('get_enum_value', req, {
      enumValueId: params?.id,
      user: user?.id,
    });

    const enumValue = await prisma.enumValue.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
    });

    if (!enumValue) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'EnumValue not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_enum_value',
          details: { enumValueId: params?.id },
        }
      );
      logOperationError('getEnumValue', req, error);
      throw error;
    }

    logDatabaseSuccess('get_enum_value', req, { id: enumValue.id });

    logOperationSuccess('getEnumValue', req, { id: enumValue.id });

    res.status(200).json(enumValue);
  } catch (error) {
    logOperationError('getEnumValue', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }
    throw handleDatabaseError(error, 'get_enum_value');
  }
}

async function updateEnumValue(req, res) {
  const { params, body } = req;

  logOperationStart('updateEnumValue', req, {
    enumValueId: params?.id,
    bodyKeys: Object.keys(body),
  });

  try {
    let values;
    try {
      values = await enumValueUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateEnumValue', req, error);
        throw handleValidationError(error, 'enum_value_update_validation');
      }
      throw error;
    }

    logDatabaseStart('update_enum_value', req, {
      enumValueId: params?.id,
      updateFields: Object.keys(values),
    });

    const updated = await prisma.enumValue.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
      },
    });

    logDatabaseSuccess('update_enum_value', req, { id: updated.id });

    logOperationSuccess('updateEnumValue', req, { id: updated.id });

    res.status(200).json(updated);
  } catch (error) {
    logOperationError('updateEnumValue', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }
    throw handleDatabaseError(error, 'update_enum_value');
  }
}

async function deleteEnumValue(req, res) {
  const { params, user } = req;

  logOperationStart('deleteEnumValue', req, {
    user: user?.id,
    enumValueId: params?.id,
  });

  try {
    logDatabaseStart('delete_enum_value', req, {
      enumValueId: params?.id,
      user: user?.id,
    });

    await prisma.enumValue.deleteMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });

    logDatabaseSuccess('delete_enum_value', req, {
      deletedEnumValueId: params?.id,
    });

    logOperationSuccess('deleteEnumValue', req, {
      deletedEnumValueId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteEnumValue', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }
    throw handleDatabaseError(error, 'delete_enum_value');
  }
}

module.exports = {
  getAllEnumValues,
  createEnumValue,
  getEnumValue,
  updateEnumValue,
  deleteEnumValue,
};
