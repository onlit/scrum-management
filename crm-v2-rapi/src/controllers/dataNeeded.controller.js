/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing dataNeeded using Prisma.
 * It includes functions for retrieving all dataNeeded, creating a new dataNeeded, retrieving a single dataNeeded,
 * updating an existing dataNeeded, and deleting a dataNeeded.
 *
 * The `getAllDataNeeded` function retrieves a paginated list of dataNeeded based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createDataNeeded` function validates the request body using a Joi schema, generates a unique code
 * for the dataNeeded, and creates a new dataNeeded in the database with additional metadata.
 *
 * The `getDataNeeded` function retrieves a single dataNeeded based on the provided dataNeeded ID, with visibility
 * filters applied to ensure the dataNeeded is accessible to the requesting user.
 *
 * The `updateDataNeeded` function updates an existing dataNeeded in the database based on the provided dataNeeded ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteDataNeeded` function deletes a dataNeeded from the database based on the provided dataNeeded ID, with
 * visibility filters applied to ensure the dataNeeded is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  dataNeededCreate,
  dataNeededUpdate,
} = require('#schemas/dataNeeded.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const {
  getPaginatedList,
  // verifyForeignKeyAccessBatch,
} = require('#utils/shared/databaseUtils.js');
const { getDetailsFromAPI } = require('#utils/shared/apiUtils.js');
const {
  enrichRecordDisplayValues,
} = require('#utils/shared/displayValueUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/shared/traceUtils.js');
const {
  handleDatabaseError,
  handleValidationError,
} = require('#utils/shared/errorHandlingUtils.js');

async function getAllDataNeeded(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllDataNeeded', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['whoFrom', 'infoNeeded', 'notes', 'color'];
    const filterFields = [...searchFields, 'opportunityId'];

    const include = {
      opportunity: true,
    };

    // Log database operation start
    logDatabaseStart('get_all_data_needed', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: dataNeededUpdate,
      filterFields,
      searchFields,
      model: 'dataNeeded',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values to all records
    if (response?.results) {
      response.results = response.results.map((record) =>
        enrichRecordDisplayValues(record, 'DataNeeded')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_data_needed', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllDataNeeded', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllDataNeeded', req, error);
    throw handleDatabaseError(error, 'get_all_data_needed');
  }
}

async function createDataNeeded(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createDataNeeded', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await dataNeededCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createDataNeeded', req, error);
        throw handleValidationError(error, 'data_needed_creation');
      }
      logOperationError('createDataNeeded', req, error);
      throw error;
    }

    const modelRelationFields = ['opportunityId'];

    const include = {
      opportunity: true,
    };

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_data_needed', req, {
      name: values.name,
      userId: user?.id,
    });

    const newDataNeeded = await prisma.dataNeeded.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_data_needed', req, {
      id: newDataNeeded.id,
      code: newDataNeeded.code,
    });

    const [newDataNeededWithDetails] = await getDetailsFromAPI({
      results: [newDataNeeded],
      token: user?.accessToken,
    });

    // Attach display value (including nested relations)
    const newDataNeededWithDisplay = enrichRecordDisplayValues(
      newDataNeededWithDetails,
      'DataNeeded'
    );

    // Log operation success
    logOperationSuccess('createDataNeeded', req, {
      id: newDataNeeded.id,
      code: newDataNeeded.code,
    });

    res.status(201).json(newDataNeededWithDisplay);
  } catch (error) {
    logOperationError('createDataNeeded', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_data_needed');
  }
}

async function getDataNeeded(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getDataNeeded', req, {
    user: user?.id,
    dataNeededId: params?.id,
  });

  try {
    const include = {
      opportunity: true,
    };

    // Log database operation start
    logDatabaseStart('get_data_needed', req, {
      dataNeededId: params?.id,
      userId: user?.id,
    });

    const foundDataNeeded = await prisma.dataNeeded.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_data_needed', req, {
      found: !!foundDataNeeded,
      dataNeededId: params?.id,
    });

    if (!foundDataNeeded) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'DataNeeded not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_data_needed',
          details: { dataNeededId: params?.id },
        }
      );
      logOperationError('getDataNeeded', req, error);
      throw error;
    }

    const [foundDataNeededWithDetails] = await getDetailsFromAPI({
      results: [foundDataNeeded],
      token: user?.accessToken,
    });

    // Attach display value (including nested relations)
    const dataNeededWithDisplay = enrichRecordDisplayValues(
      foundDataNeededWithDetails,
      'DataNeeded'
    );

    // Log operation success
    logOperationSuccess('getDataNeeded', req, {
      id: foundDataNeeded.id,
      code: foundDataNeeded.code,
    });

    res.status(200).json(dataNeededWithDisplay);
  } catch (error) {
    logOperationError('getDataNeeded', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_data_needed');
  }
}

async function updateDataNeeded(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateDataNeeded', req, {
    dataNeededId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await dataNeededUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateDataNeeded', req, error);
        throw handleValidationError(error, 'data_needed_update');
      }
      logOperationError('updateDataNeeded', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Soft-delete aware fetch for current record to ensure visibility
    const current = await prisma.dataNeeded.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: { id: true, client: true },
    });
    if (!current) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'DataNeeded not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'data_needed_update_fetch',
          details: { dataNeededId: params?.id },
        }
      );
      throw error;
    }

    // Log database operation start
    logDatabaseStart('update_data_needed', req, {
      dataNeededId: params?.id,
      updateFields: Object.keys(values),
    });

    const updatedDataNeeded = await prisma.dataNeeded.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('update_data_needed', req, {
      id: updatedDataNeeded.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateDataNeeded', req, {
      id: updatedDataNeeded.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(updatedDataNeeded);
  } catch (error) {
    logOperationError('updateDataNeeded', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_data_needed');
  }
}

async function deleteDataNeeded(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteDataNeeded', req, {
    user: user?.id,
    dataNeededId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('delete_data_needed', req, {
      dataNeededId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.dataNeeded.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_data_needed', req, {
      deletedCount: result.count,
      dataNeededId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'DataNeeded not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_data_needed',
          details: { dataNeededId: params?.id },
        }
      );
      logOperationError('deleteDataNeeded', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteDataNeeded', req, {
      deletedCount: result.count,
      dataNeededId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteDataNeeded', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_data_needed');
  }
}

async function getDataNeededBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for dataNeeded',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllDataNeeded,
  createDataNeeded,
  getDataNeeded,
  updateDataNeeded,
  deleteDataNeeded,
  getDataNeededBarChartData,
};
