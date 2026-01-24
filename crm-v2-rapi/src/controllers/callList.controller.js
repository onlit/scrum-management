/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing callList using Prisma.
 * It includes functions for retrieving all callList, creating a new callList, retrieving a single callList,
 * updating an existing callList, and deleting a callList.
 *
 * The `getAllCallList` function retrieves a paginated list of callList based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCallList` function validates the request body using a Joi schema, generates a unique code
 * for the callList, and creates a new callList in the database with additional metadata.
 *
 * The `getCallList` function retrieves a single callList based on the provided callList ID, with visibility
 * filters applied to ensure the callList is accessible to the requesting user.
 *
 * The `updateCallList` function updates an existing callList in the database based on the provided callList ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCallList` function deletes a callList from the database based on the provided callList ID, with
 * visibility filters applied to ensure the callList is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  callListCreate,
  callListUpdate,
} = require('#schemas/callList.schemas.js');
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

async function getAllCallList(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllCallList', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['color', 'name', 'description'];
    const filterFields = [...searchFields, 'callListPipelineId'];

    const include = {
      callListPipeline: true,
    };

    // Log database operation start
    logDatabaseStart('get_all_call_list', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: callListUpdate,
      filterFields,
      searchFields,
      model: 'callList',
      include: Object.keys(include).length ? include : undefined,
    });

    if (Array.isArray(response?.results)) {
      response.results = response.results.map((callList) =>
        enrichRecordDisplayValues(callList, 'CallList')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_call_list', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllCallList', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllCallList', req, error);
    throw handleDatabaseError(error, 'get_all_call_list');
  }
}

async function createCallList(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createCallList', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await callListCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createCallList', req, error);
        throw handleValidationError(error, 'call_list_creation');
      }
      logOperationError('createCallList', req, error);
      throw error;
    }

    const modelRelationFields = ['callListPipelineId'];

    const include = {
      callListPipeline: true,
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
    logDatabaseStart('create_call_list', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCallList = await prisma.callList.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_call_list', req, {
      id: newCallList.id,
      code: newCallList.code,
    });

    const [newCallListWithDetails] = await getDetailsFromAPI({
      results: [newCallList],
      token: user?.accessToken,
    });

    // Log operation success
    logOperationSuccess('createCallList', req, {
      id: newCallList.id,
      code: newCallList.code,
    });

    const callListWithDisplayValue = enrichRecordDisplayValues(
      newCallListWithDetails,
      'CallList'
    );

    res.status(201).json(callListWithDisplayValue);
  } catch (error) {
    logOperationError('createCallList', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_call_list');
  }
}

async function getCallList(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getCallList', req, {
    user: user?.id,
    callListId: params?.id,
  });

  try {
    const include = {
      callListPipeline: true,
    };

    // Log database operation start
    logDatabaseStart('get_call_list', req, {
      callListId: params?.id,
      userId: user?.id,
    });

    const foundCallList = await prisma.callList.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_call_list', req, {
      found: !!foundCallList,
      callListId: params?.id,
    });

    if (!foundCallList) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallList not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_call_list',
          details: { callListId: params?.id },
        }
      );
      logOperationError('getCallList', req, error);
      throw error;
    }

    const [foundCallListWithDetails] = await getDetailsFromAPI({
      results: [foundCallList],
      token: user?.accessToken,
    });

    // Log operation success
    logOperationSuccess('getCallList', req, {
      id: foundCallList.id,
      code: foundCallList.code,
    });

    const callListWithDisplayValue = enrichRecordDisplayValues(
      foundCallListWithDetails,
      'CallList'
    );

    res.status(200).json(callListWithDisplayValue);
  } catch (error) {
    logOperationError('getCallList', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_call_list');
  }
}

async function updateCallList(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateCallList', req, {
    callListId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await callListUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateCallList', req, error);
        throw handleValidationError(error, 'call_list_update');
      }
      logOperationError('updateCallList', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Soft-delete aware fetch for current record to ensure visibility
    const current = await prisma.callList.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: { id: true, client: true },
    });
    if (!current) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallList not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'call_list_update_fetch',
          details: { callListId: params?.id },
        }
      );
      throw error;
    }

    // Log database operation start
    logDatabaseStart('update_call_list', req, {
      callListId: params?.id,
      updateFields: Object.keys(values),
    });

    const updatedCallList = await prisma.callList.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
      include: {
        callListPipeline: true,
      },
    });

    // Log database operation success
    logDatabaseSuccess('update_call_list', req, {
      id: updatedCallList.id,
      updatedFields: Object.keys(values),
    });

    // Attach display value
    const callListWithDisplayValue = enrichRecordDisplayValues(
      updatedCallList,
      'CallList'
    );

    // Log operation success
    logOperationSuccess('updateCallList', req, {
      id: updatedCallList.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(callListWithDisplayValue);
  } catch (error) {
    logOperationError('updateCallList', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_call_list');
  }
}

async function deleteCallList(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteCallList', req, {
    user: user?.id,
    callListId: params?.id,
  });

  try {
    await prisma.callSchedule.updateMany({
      where: {
        callListId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_call_list', req, {
      callListId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.callList.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_call_list', req, {
      deletedCount: result.count,
      callListId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallList not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_call_list',
          details: { callListId: params?.id },
        }
      );
      logOperationError('deleteCallList', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteCallList', req, {
      deletedCount: result.count,
      callListId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteCallList', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_call_list');
  }
}

async function getCallListBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for callList',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCallList,
  createCallList,
  getCallList,
  updateCallList,
  deleteCallList,
  getCallListBarChartData,
};
