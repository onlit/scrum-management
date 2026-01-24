/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing callSchedule using Prisma.
 * It includes functions for retrieving all callSchedule, creating a new callSchedule, retrieving a single callSchedule,
 * updating an existing callSchedule, and deleting a callSchedule.
 *
 * The `getAllCallSchedule` function retrieves a paginated list of callSchedule based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCallSchedule` function validates the request body using a Joi schema, generates a unique code
 * for the callSchedule, and creates a new callSchedule in the database with additional metadata.
 *
 * The `getCallSchedule` function retrieves a single callSchedule based on the provided callSchedule ID, with visibility
 * filters applied to ensure the callSchedule is accessible to the requesting user.
 *
 * The `updateCallSchedule` function updates an existing callSchedule in the database based on the provided callSchedule ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCallSchedule` function deletes a callSchedule from the database based on the provided callSchedule ID, with
 * visibility filters applied to ensure the callSchedule is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  callScheduleCreate,
  callScheduleUpdate,
} = require('#schemas/callSchedule.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const {
  ERROR_TYPES,
  ERROR_SEVERITY,
} = require('#configs/constants.js');
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
const {
  enrichRecordDisplayValues,
} = require('#utils/shared/displayValueUtils.js');

async function getAllCallSchedule(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllCallSchedule', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['color'];
    const filterFields = [
      ...searchFields,
      'callListPipelineStageId',
      'callListId',
      'scheduleDatetime',
      'personId',
    ];

    const include = {
      callListPipelineStage: true,
      callList: true,
      person: true,
    };

    // Log database operation start
    logDatabaseStart('get_all_call_schedule', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: callScheduleUpdate,
      filterFields,
      searchFields,
      model: 'callSchedule',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values
    if (response?.results) {
      response.results = response.results.map((cs) =>
        enrichRecordDisplayValues(cs, 'CallSchedule')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_call_schedule', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllCallSchedule', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllCallSchedule', req, error);
    throw handleDatabaseError(error, 'get_all_call_schedule');
  }
}

async function createCallSchedule(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createCallSchedule', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await callScheduleCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createCallSchedule', req, error);
        throw handleValidationError(error, 'call_schedule_creation');
      }
      logOperationError('createCallSchedule', req, error);
      throw error;
    }

    const modelRelationFields = [
      'callListPipelineStageId',
      'callListId',
      'personId',
    ];

    const include = {
      callListPipelineStage: true,
      callList: true,
      person: true,
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
    logDatabaseStart('create_call_schedule', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCallSchedule = await prisma.callSchedule.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_call_schedule', req, {
      id: newCallSchedule.id,
      code: newCallSchedule.code,
    });

    const [newCallScheduleWithDetails] = await getDetailsFromAPI({
      results: [newCallSchedule],
      token: user?.accessToken,
    });

    // Attach display value
    const callScheduleWithDisplayValue = enrichRecordDisplayValues(
      newCallScheduleWithDetails,
      'CallSchedule'
    );

    // Log operation success
    logOperationSuccess('createCallSchedule', req, {
      id: newCallSchedule.id,
      code: newCallSchedule.code,
    });

    res.status(201).json(callScheduleWithDisplayValue);
  } catch (error) {
    logOperationError('createCallSchedule', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_call_schedule');
  }
}

async function getCallSchedule(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getCallSchedule', req, {
    user: user?.id,
    callScheduleId: params?.id,
  });

  try {
    const include = {
      callListPipelineStage: true,
      callList: true,
      person: true,
    };

    // Log database operation start
    logDatabaseStart('get_call_schedule', req, {
      callScheduleId: params?.id,
      userId: user?.id,
    });

    const foundCallSchedule = await prisma.callSchedule.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_call_schedule', req, {
      found: !!foundCallSchedule,
      callScheduleId: params?.id,
    });

    if (!foundCallSchedule) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallSchedule not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_call_schedule',
          details: { callScheduleId: params?.id },
        }
      );
      logOperationError('getCallSchedule', req, error);
      throw error;
    }

    const [foundCallScheduleWithDetails] = await getDetailsFromAPI({
      results: [foundCallSchedule],
      token: user?.accessToken,
    });

    // Attach display value
    const callScheduleWithDisplayValue = enrichRecordDisplayValues(
      foundCallScheduleWithDetails,
      'CallSchedule'
    );

    // Log operation success
    logOperationSuccess('getCallSchedule', req, {
      id: foundCallSchedule.id,
      code: foundCallSchedule.code,
    });

    res.status(200).json(callScheduleWithDisplayValue);
  } catch (error) {
    logOperationError('getCallSchedule', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_call_schedule');
  }
}

async function updateCallSchedule(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateCallSchedule', req, {
    callScheduleId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await callScheduleUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateCallSchedule', req, error);
        throw handleValidationError(error, 'call_schedule_update');
      }
      logOperationError('updateCallSchedule', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Log database operation start
    logDatabaseStart('update_call_schedule', req, {
      callScheduleId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.callSchedule.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallSchedule not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_call_schedule',
          details: { callScheduleId: params?.id },
        }
      );
      throw error;
    }

    const include = {
      callListPipelineStage: true,
      callList: true,
      person: true,
    };

    const updatedCallSchedule = await prisma.callSchedule.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      include,
    });

    // Attach display value
    const callScheduleWithDisplayValue = enrichRecordDisplayValues(
      updatedCallSchedule,
      'CallSchedule'
    );

    // Log database operation success
    logDatabaseSuccess('update_call_schedule', req, {
      id: updatedCallSchedule.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateCallSchedule', req, {
      id: updatedCallSchedule.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(callScheduleWithDisplayValue);
  } catch (error) {
    logOperationError('updateCallSchedule', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_call_schedule');
  }
}

async function deleteCallSchedule(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteCallSchedule', req, {
    user: user?.id,
    callScheduleId: params?.id,
  });

  try {
    await prisma.callHistory.updateMany({
      where: {
        callScheduleId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_call_schedule', req, {
      callScheduleId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.callSchedule.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_call_schedule', req, {
      deletedCount: result.count,
      callScheduleId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallSchedule not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_call_schedule',
          details: { callScheduleId: params?.id },
        }
      );
      logOperationError('deleteCallSchedule', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteCallSchedule', req, {
      deletedCount: result.count,
      callScheduleId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteCallSchedule', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_call_schedule');
  }
}

async function getCallScheduleBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for callSchedule',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCallSchedule,
  createCallSchedule,
  getCallSchedule,
  updateCallSchedule,
  deleteCallSchedule,
  getCallScheduleBarChartData,
};
