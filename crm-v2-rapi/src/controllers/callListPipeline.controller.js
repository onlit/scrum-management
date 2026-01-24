/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing callListPipeline using Prisma.
 * It includes functions for retrieving all callListPipeline, creating a new callListPipeline, retrieving a single callListPipeline,
 * updating an existing callListPipeline, and deleting a callListPipeline.
 *
 * The `getAllCallListPipeline` function retrieves a paginated list of callListPipeline based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCallListPipeline` function validates the request body using a Joi schema, generates a unique code
 * for the callListPipeline, and creates a new callListPipeline in the database with additional metadata.
 *
 * The `getCallListPipeline` function retrieves a single callListPipeline based on the provided callListPipeline ID, with visibility
 * filters applied to ensure the callListPipeline is accessible to the requesting user.
 *
 * The `updateCallListPipeline` function updates an existing callListPipeline in the database based on the provided callListPipeline ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCallListPipeline` function deletes a callListPipeline from the database based on the provided callListPipeline ID, with
 * visibility filters applied to ensure the callListPipeline is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  callListPipelineCreate,
  callListPipelineUpdate,
} = require('#schemas/callListPipeline.schemas.js');
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

async function getAllCallListPipeline(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllCallListPipeline', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['color', 'description', 'name'];
    const filterFields = [...searchFields];

    const include = {};

    // Log database operation start
    logDatabaseStart('get_all_call_list_pipeline', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: callListPipelineUpdate,
      filterFields,
      searchFields,
      model: 'callListPipeline',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values
    if (response?.results) {
      response.results = response.results.map((pipeline) => ({
        ...pipeline,
        [DISPLAY_VALUE_PROP]: computeDisplayValue(pipeline, 'CallListPipeline'),
      }));
    }

    // Log database operation success
    logDatabaseSuccess('get_all_call_list_pipeline', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllCallListPipeline', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllCallListPipeline', req, error);
    throw handleDatabaseError(error, 'get_all_call_list_pipeline');
  }
}

async function createCallListPipeline(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createCallListPipeline', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await callListPipelineCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createCallListPipeline', req, error);
        throw handleValidationError(error, 'call_list_pipeline_creation');
      }
      logOperationError('createCallListPipeline', req, error);
      throw error;
    }

    const modelRelationFields = [];

    const include = {};

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_call_list_pipeline', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCallListPipeline = await prisma.callListPipeline.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_call_list_pipeline', req, {
      id: newCallListPipeline.id,
      code: newCallListPipeline.code,
    });

    const [newCallListPipelineWithDetails] = await getDetailsFromAPI({
      results: [newCallListPipeline],
      token: user?.accessToken,
    });

    // Attach display value
    const callListPipelineWithDisplayValue = {
      ...newCallListPipelineWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        newCallListPipelineWithDetails,
        'CallListPipeline'
      ),
    };

    // Log operation success
    logOperationSuccess('createCallListPipeline', req, {
      id: newCallListPipeline.id,
      code: newCallListPipeline.code,
    });

    res.status(201).json(callListPipelineWithDisplayValue);
  } catch (error) {
    logOperationError('createCallListPipeline', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_call_list_pipeline');
  }
}

async function getCallListPipeline(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getCallListPipeline', req, {
    user: user?.id,
    callListPipelineId: params?.id,
  });

  try {
    const include = {};

    // Log database operation start
    logDatabaseStart('get_call_list_pipeline', req, {
      callListPipelineId: params?.id,
      userId: user?.id,
    });

    const foundCallListPipeline = await prisma.callListPipeline.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_call_list_pipeline', req, {
      found: !!foundCallListPipeline,
      callListPipelineId: params?.id,
    });

    if (!foundCallListPipeline) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallListPipeline not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_call_list_pipeline',
          details: { callListPipelineId: params?.id },
        }
      );
      logOperationError('getCallListPipeline', req, error);
      throw error;
    }

    const [foundCallListPipelineWithDetails] = await getDetailsFromAPI({
      results: [foundCallListPipeline],
      token: user?.accessToken,
    });

    // Attach display value
    const callListPipelineWithDisplayValue = {
      ...foundCallListPipelineWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        foundCallListPipelineWithDetails,
        'CallListPipeline'
      ),
    };

    // Log operation success
    logOperationSuccess('getCallListPipeline', req, {
      id: foundCallListPipeline.id,
      code: foundCallListPipeline.code,
    });

    res.status(200).json(callListPipelineWithDisplayValue);
  } catch (error) {
    logOperationError('getCallListPipeline', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_call_list_pipeline');
  }
}

async function updateCallListPipeline(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateCallListPipeline', req, {
    callListPipelineId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await callListPipelineUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateCallListPipeline', req, error);
        throw handleValidationError(error, 'call_list_pipeline_update');
      }
      logOperationError('updateCallListPipeline', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Log database operation start
    logDatabaseStart('update_call_list_pipeline', req, {
      callListPipelineId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.callListPipeline.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallListPipeline not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_call_list_pipeline',
          details: { callListPipelineId: params?.id },
        }
      );
      throw error;
    }

    const updatedCallListPipeline = await prisma.callListPipeline.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
    });

    // Log database operation success
    logDatabaseSuccess('update_call_list_pipeline', req, {
      id: updatedCallListPipeline.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateCallListPipeline', req, {
      id: updatedCallListPipeline.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(updatedCallListPipeline);
  } catch (error) {
    logOperationError('updateCallListPipeline', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_call_list_pipeline');
  }
}

async function deleteCallListPipeline(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteCallListPipeline', req, {
    user: user?.id,
    callListPipelineId: params?.id,
  });

  try {
    await prisma.callList.updateMany({
      where: {
        callListPipelineId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.callListPipelineStage.updateMany({
      where: {
        callListPipelineId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_call_list_pipeline', req, {
      callListPipelineId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.callListPipeline.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_call_list_pipeline', req, {
      deletedCount: result.count,
      callListPipelineId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallListPipeline not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_call_list_pipeline',
          details: { callListPipelineId: params?.id },
        }
      );
      logOperationError('deleteCallListPipeline', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteCallListPipeline', req, {
      deletedCount: result.count,
      callListPipelineId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteCallListPipeline', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_call_list_pipeline');
  }
}

async function getCallListPipelineBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for callListPipeline',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCallListPipeline,
  createCallListPipeline,
  getCallListPipeline,
  updateCallListPipeline,
  deleteCallListPipeline,
  getCallListPipelineBarChartData,
};
