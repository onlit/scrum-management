/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing targetActualHistory using Prisma.
 * It includes functions for retrieving all targetActualHistory, creating a new targetActualHistory, retrieving a single targetActualHistory,
 * updating an existing targetActualHistory, and deleting a targetActualHistory.
 *
 * The `getAllTargetActualHistory` function retrieves a paginated list of targetActualHistory based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createTargetActualHistory` function validates the request body using a Joi schema, generates a unique code
 * for the targetActualHistory, and creates a new targetActualHistory in the database with additional metadata.
 *
 * The `getTargetActualHistory` function retrieves a single targetActualHistory based on the provided targetActualHistory ID, with visibility
 * filters applied to ensure the targetActualHistory is accessible to the requesting user.
 *
 * The `updateTargetActualHistory` function updates an existing targetActualHistory in the database based on the provided targetActualHistory ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteTargetActualHistory` function deletes a targetActualHistory from the database based on the provided targetActualHistory ID, with
 * visibility filters applied to ensure the targetActualHistory is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  targetActualHistoryCreate,
  targetActualHistoryUpdate,
} = require('#schemas/targetActualHistory.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const {
  ERROR_TYPES,
  ERROR_SEVERITY,
  DISPLAY_VALUE_PROP,
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
const { computeDisplayValue } = require('#utils/shared/displayValueUtils.js');

async function getAllTargetActualHistory(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllTargetActualHistory', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['color'];
    const filterFields = [...searchFields, 'targetId', 'actuals'];

    const include = {
      target: true,
    };

    // Log database operation start
    logDatabaseStart('get_all_target_actual_history', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: targetActualHistoryUpdate,
      filterFields,
      searchFields,
      model: 'targetActualHistory',
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_target_actual_history', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllTargetActualHistory', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Process targets for batch details
    const targetRecords = response.results
      .filter((result) => result?.target)
      .map((result) => result.target);

    const targetsDetails = await getDetailsFromAPI({
      results: targetRecords,
      token: user?.accessToken,
    });

    // Merge details back into results
    response.results.forEach((result, index) => {
      if (result?.target && targetsDetails?.[index]) {
        result.target = {
          ...result.target,
          ...targetsDetails[index],
        };
      }
    });

    // Attach display values to all target actual history records
    if (response?.results) {
      response.results = response.results.map((targetActualHistory) => ({
        ...targetActualHistory,
        [DISPLAY_VALUE_PROP]: computeDisplayValue(
          targetActualHistory,
          'TargetActualHistory'
        ),
      }));
    }

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllTargetActualHistory', req, error);
    throw handleDatabaseError(error, 'get_all_target_actual_history');
  }
}

async function createTargetActualHistory(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createTargetActualHistory', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await targetActualHistoryCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createTargetActualHistory', req, error);
        throw handleValidationError(error, 'target_actual_history_creation');
      }
      logOperationError('createTargetActualHistory', req, error);
      throw error;
    }

    const modelRelationFields = ['targetId'];

    const include = {
      target: true,
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
    logDatabaseStart('create_target_actual_history', req, {
      name: values.name,
      userId: user?.id,
    });

    const newTargetActualHistory = await prisma.targetActualHistory.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_target_actual_history', req, {
      id: newTargetActualHistory.id,
      code: newTargetActualHistory.code,
    });

    if (newTargetActualHistory?.target) {
      [newTargetActualHistory.target] = await getDetailsFromAPI({
        results: [newTargetActualHistory.target],
        token: user?.accessToken,
      });
    }

    const [newTargetActualHistoryWithDetails] = await getDetailsFromAPI({
      results: [newTargetActualHistory],
      token: user?.accessToken,
    });

    // Attach display value
    const targetActualHistoryWithDisplayValue = {
      ...newTargetActualHistoryWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        newTargetActualHistoryWithDetails,
        'TargetActualHistory'
      ),
    };

    // Log operation success
    logOperationSuccess('createTargetActualHistory', req, {
      id: newTargetActualHistory.id,
      code: newTargetActualHistory.code,
    });

    res.status(201).json(targetActualHistoryWithDisplayValue);
  } catch (error) {
    logOperationError('createTargetActualHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_target_actual_history');
  }
}

async function getTargetActualHistory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getTargetActualHistory', req, {
    user: user?.id,
    targetActualHistoryId: params?.id,
  });

  try {
    const include = {
      target: true,
    };

    // Log database operation start
    logDatabaseStart('get_target_actual_history', req, {
      targetActualHistoryId: params?.id,
      userId: user?.id,
    });

    const foundTargetActualHistory = await prisma.targetActualHistory.findFirst(
      {
        where: {
          id: params?.id,
          ...getVisibilityFilters(user),
        },
        include: Object.keys(include).length ? include : undefined,
      }
    );

    // Log database operation success
    logDatabaseSuccess('get_target_actual_history', req, {
      found: !!foundTargetActualHistory,
      targetActualHistoryId: params?.id,
    });

    if (!foundTargetActualHistory) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'TargetActualHistory not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_target_actual_history',
          details: { targetActualHistoryId: params?.id },
        }
      );
      logOperationError('getTargetActualHistory', req, error);
      throw error;
    }

    if (foundTargetActualHistory?.target) {
      [foundTargetActualHistory.target] = await getDetailsFromAPI({
        results: [foundTargetActualHistory.target],
        token: user?.accessToken,
      });
    }

    const [foundTargetActualHistoryWithDetails] = await getDetailsFromAPI({
      results: [foundTargetActualHistory],
      token: user?.accessToken,
    });

    // Attach display value
    const targetActualHistoryWithDisplayValue = {
      ...foundTargetActualHistoryWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        foundTargetActualHistoryWithDetails,
        'TargetActualHistory'
      ),
    };

    // Log operation success
    logOperationSuccess('getTargetActualHistory', req, {
      id: foundTargetActualHistory.id,
      code: foundTargetActualHistory.code,
    });

    res.status(200).json(targetActualHistoryWithDisplayValue);
  } catch (error) {
    logOperationError('getTargetActualHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_target_actual_history');
  }
}

async function updateTargetActualHistory(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateTargetActualHistory', req, {
    targetActualHistoryId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await targetActualHistoryUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateTargetActualHistory', req, error);
        throw handleValidationError(error, 'target_actual_history_update');
      }
      logOperationError('updateTargetActualHistory', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Log database operation start
    logDatabaseStart('update_target_actual_history', req, {
      targetActualHistoryId: params?.id,
      updateFields: Object.keys(values),
    });

    // Guard: ensure record exists within visibility scope
    const currentTargetActualHistory =
      await prisma.targetActualHistory.findFirst({
        where: { id: params?.id, ...getVisibilityFilters(user) },
        select: { id: true },
      });
    if (!currentTargetActualHistory) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'TargetActualHistory not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_target_actual_history',
          details: { targetActualHistoryId: params?.id },
        }
      );
      logOperationError('updateTargetActualHistory', req, error);
      throw error;
    }

    const updatedTargetActualHistory = await prisma.targetActualHistory.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('update_target_actual_history', req, {
      id: updatedTargetActualHistory.id,
      updatedFields: Object.keys(values),
    });

    // Attach display value
    const targetActualHistoryWithDisplayValue = {
      ...updatedTargetActualHistory,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        updatedTargetActualHistory,
        'TargetActualHistory'
      ),
    };

    // Log operation success
    logOperationSuccess('updateTargetActualHistory', req, {
      id: updatedTargetActualHistory.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(targetActualHistoryWithDisplayValue);
  } catch (error) {
    logOperationError('updateTargetActualHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_target_actual_history');
  }
}

async function deleteTargetActualHistory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteTargetActualHistory', req, {
    user: user?.id,
    targetActualHistoryId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('delete_target_actual_history', req, {
      targetActualHistoryId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.targetActualHistory.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_target_actual_history', req, {
      deletedCount: result.count,
      targetActualHistoryId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'TargetActualHistory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_target_actual_history',
          details: { targetActualHistoryId: params?.id },
        }
      );
      logOperationError('deleteTargetActualHistory', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteTargetActualHistory', req, {
      deletedCount: result.count,
      targetActualHistoryId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteTargetActualHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_target_actual_history');
  }
}

async function getTargetActualHistoryBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for targetActualHistory',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllTargetActualHistory,
  createTargetActualHistory,
  getTargetActualHistory,
  updateTargetActualHistory,
  deleteTargetActualHistory,
  getTargetActualHistoryBarChartData,
};
