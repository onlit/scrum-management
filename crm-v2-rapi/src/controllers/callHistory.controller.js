/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing callHistory using Prisma.
 * It includes functions for retrieving all callHistory, creating a new callHistory, retrieving a single callHistory,
 * updating an existing callHistory, and deleting a callHistory.
 *
 * The `getAllCallHistory` function retrieves a paginated list of callHistory based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCallHistory` function validates the request body using a Joi schema, generates a unique code
 * for the callHistory, and creates a new callHistory in the database with additional metadata.
 *
 * The `getCallHistory` function retrieves a single callHistory based on the provided callHistory ID, with visibility
 * filters applied to ensure the callHistory is accessible to the requesting user.
 *
 * The `updateCallHistory` function updates an existing callHistory in the database based on the provided callHistory ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCallHistory` function deletes a callHistory from the database based on the provided callHistory ID, with
 * visibility filters applied to ensure the callHistory is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  callHistoryCreate,
  callHistoryUpdate,
} = require('#schemas/callHistory.schemas.js');
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

async function getAllCallHistory(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllCallHistory', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['outcome', 'color'];
    const filterFields = [
      ...searchFields,
      'callScheduleId',
      'callListPipelineStageId',
    ];

    const include = {
      callSchedule: { include: { person: true } },
      callListPipelineStage: true,
    };

    // Log database operation start
    logDatabaseStart('get_all_call_history', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: callHistoryUpdate,
      filterFields,
      searchFields,
      model: 'callHistory',
      include: Object.keys(include).length ? include : undefined,
    });

    if (Array.isArray(response?.results)) {
      response.results = response.results.map((record) =>
        enrichRecordDisplayValues(record, 'CallHistory')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_call_history', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllCallHistory', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllCallHistory', req, error);
    throw handleDatabaseError(error, 'get_all_call_history');
  }
}

async function createCallHistory(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createCallHistory', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await callHistoryCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createCallHistory', req, error);
        throw handleValidationError(error, 'call_history_creation');
      }
      logOperationError('createCallHistory', req, error);
      throw error;
    }

    const modelRelationFields = ['callScheduleId', 'callListPipelineStageId'];

    const include = {
      callSchedule: { include: { person: true } },
      callListPipelineStage: true,
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
    logDatabaseStart('create_call_history', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCallHistory = await prisma.callHistory.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_call_history', req, {
      id: newCallHistory.id,
      code: newCallHistory.code,
    });

    const [newCallHistoryWithDetails] = await getDetailsFromAPI({
      results: [newCallHistory],
      token: user?.accessToken,
    });

    // Log operation success
    logOperationSuccess('createCallHistory', req, {
      id: newCallHistory.id,
      code: newCallHistory.code,
    });

    const callHistoryWithDisplayValue = enrichRecordDisplayValues(
      newCallHistoryWithDetails,
      'CallHistory'
    );

    res.status(201).json(callHistoryWithDisplayValue);
  } catch (error) {
    logOperationError('createCallHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_call_history');
  }
}

async function getCallHistory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getCallHistory', req, {
    user: user?.id,
    callHistoryId: params?.id,
  });

  try {
    const include = {
      callSchedule: { include: { person: true } },
      callListPipelineStage: true,
    };

    // Log database operation start
    logDatabaseStart('get_call_history', req, {
      callHistoryId: params?.id,
      userId: user?.id,
    });

    const foundCallHistory = await prisma.callHistory.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_call_history', req, {
      found: !!foundCallHistory,
      callHistoryId: params?.id,
    });

    if (!foundCallHistory) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallHistory not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_call_history',
          details: { callHistoryId: params?.id },
        }
      );
      logOperationError('getCallHistory', req, error);
      throw error;
    }

    const [foundCallHistoryWithDetails] = await getDetailsFromAPI({
      results: [foundCallHistory],
      token: user?.accessToken,
    });

    // Log operation success
    logOperationSuccess('getCallHistory', req, {
      id: foundCallHistory.id,
      code: foundCallHistory.code,
    });

    const callHistoryWithDisplayValue = enrichRecordDisplayValues(
      foundCallHistoryWithDetails,
      'CallHistory'
    );

    res.status(200).json(callHistoryWithDisplayValue);
  } catch (error) {
    logOperationError('getCallHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_call_history');
  }
}

async function updateCallHistory(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateCallHistory', req, {
    callHistoryId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await callHistoryUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateCallHistory', req, error);
        throw handleValidationError(error, 'call_history_update');
      }
      logOperationError('updateCallHistory', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Log database operation start
    logDatabaseStart('update_call_history', req, {
      callHistoryId: params?.id,
      updateFields: Object.keys(values),
    });

    // Guard: ensure record exists within visibility scope
    const currentCallHistory = await prisma.callHistory.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: { id: true },
    });
    if (!currentCallHistory) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallHistory not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_call_history',
          details: { callHistoryId: params?.id },
        }
      );
      logOperationError('updateCallHistory', req, error);
      throw error;
    }

    const updatedCallHistory = await prisma.callHistory.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('update_call_history', req, {
      id: updatedCallHistory.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateCallHistory', req, {
      id: updatedCallHistory.id,
      updatedFields: Object.keys(values),
    });

    const callHistoryWithDisplayValue = enrichRecordDisplayValues(
      updatedCallHistory,
      'CallHistory'
    );

    res.status(200).json(callHistoryWithDisplayValue);
  } catch (error) {
    logOperationError('updateCallHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_call_history');
  }
}

async function deleteCallHistory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteCallHistory', req, {
    user: user?.id,
    callHistoryId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('delete_call_history', req, {
      callHistoryId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.callHistory.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_call_history', req, {
      deletedCount: result.count,
      callHistoryId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallHistory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_call_history',
          details: { callHistoryId: params?.id },
        }
      );
      logOperationError('deleteCallHistory', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteCallHistory', req, {
      deletedCount: result.count,
      callHistoryId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteCallHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_call_history');
  }
}

async function getCallHistoryBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for callHistory',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCallHistory,
  createCallHistory,
  getCallHistory,
  updateCallHistory,
  deleteCallHistory,
  getCallHistoryBarChartData,
};
