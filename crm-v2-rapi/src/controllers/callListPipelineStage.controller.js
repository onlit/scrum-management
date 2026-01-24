/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing callListPipelineStage using Prisma.
 * It includes functions for retrieving all callListPipelineStage, creating a new callListPipelineStage, retrieving a single callListPipelineStage,
 * updating an existing callListPipelineStage, and deleting a callListPipelineStage.
 *
 * The `getAllCallListPipelineStage` function retrieves a paginated list of callListPipelineStage based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCallListPipelineStage` function validates the request body using a Joi schema, generates a unique code
 * for the callListPipelineStage, and creates a new callListPipelineStage in the database with additional metadata.
 *
 * The `getCallListPipelineStage` function retrieves a single callListPipelineStage based on the provided callListPipelineStage ID, with visibility
 * filters applied to ensure the callListPipelineStage is accessible to the requesting user.
 *
 * The `updateCallListPipelineStage` function updates an existing callListPipelineStage in the database based on the provided callListPipelineStage ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCallListPipelineStage` function deletes a callListPipelineStage from the database based on the provided callListPipelineStage ID, with
 * visibility filters applied to ensure the callListPipelineStage is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  callListPipelineStageCreate,
  callListPipelineStageUpdate,
} = require('#schemas/callListPipelineStage.schemas.js');
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
const { findWorkflowAndTrigger } = require('#utils/shared/automataUtils.js');
const { computeDisplayValue } = require('#utils/shared/displayValueUtils.js');

async function getAllCallListPipelineStage(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllCallListPipelineStage', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['color', 'name', 'description'];
    const filterFields = [
      ...searchFields,
      'order',
      'rottingDays',
      'callListPipelineId',
    ];

    const include = {
      callListPipeline: true,
    };

    // Log database operation start
    logDatabaseStart('get_all_call_list_pipeline_stage', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: callListPipelineStageUpdate,
      filterFields,
      searchFields,
      model: 'callListPipelineStage',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values
    if (response?.results) {
      response.results = response.results.map((stage) => ({
        ...stage,
        [DISPLAY_VALUE_PROP]: computeDisplayValue(
          stage,
          'CallListPipelineStage'
        ),
      }));
    }

    // Log database operation success
    logDatabaseSuccess('get_all_call_list_pipeline_stage', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllCallListPipelineStage', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllCallListPipelineStage', req, error);
    throw handleDatabaseError(error, 'get_all_call_list_pipeline_stage');
  }
}

async function createCallListPipelineStage(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createCallListPipelineStage', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await callListPipelineStageCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createCallListPipelineStage', req, error);
        throw handleValidationError(error, 'call_list_pipeline_stage_creation');
      }
      logOperationError('createCallListPipelineStage', req, error);
      throw error;
    }

    const modelRelationFields = ['callListPipelineId'];

    const include = {
      callListPipeline: true,
    };

    // Django parity: skip explicit FK validation and duplicate pre-checks here.

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_call_list_pipeline_stage', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCallListPipelineStage = await prisma.callListPipelineStage.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_call_list_pipeline_stage', req, {
      id: newCallListPipelineStage.id,
      code: newCallListPipelineStage.code,
    });

    const [newCallListPipelineStageWithDetails] = await getDetailsFromAPI({
      results: [newCallListPipelineStage],
      token: user?.accessToken,
    });

    // Attach display value
    const callListPipelineStageWithDisplayValue = {
      ...newCallListPipelineStageWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        newCallListPipelineStageWithDetails,
        'CallListPipelineStage'
      ),
    };

    // Log operation success
    logOperationSuccess('createCallListPipelineStage', req, {
      id: newCallListPipelineStage.id,
      code: newCallListPipelineStage.code,
    });

    res.status(201).json(callListPipelineStageWithDisplayValue);

    // Fire-and-forget workflow trigger for lower latency
    try {
      setImmediate(() => {
        findWorkflowAndTrigger(
          prisma,
          newCallListPipelineStage,
          'callListPipelineStage',
          user?.client?.id,
          {},
          user?.accessToken
        ).catch(() => {});
      });
    } catch (_e) {
      // best-effort
    }
  } catch (error) {
    logOperationError('createCallListPipelineStage', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_call_list_pipeline_stage');
  }
}

async function getCallListPipelineStage(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getCallListPipelineStage', req, {
    user: user?.id,
    callListPipelineStageId: params?.id,
  });

  try {
    const include = {
      callListPipeline: true,
    };

    // Log database operation start
    logDatabaseStart('get_call_list_pipeline_stage', req, {
      callListPipelineStageId: params?.id,
      userId: user?.id,
    });

    const foundCallListPipelineStage =
      await prisma.callListPipelineStage.findFirst({
        where: {
          id: params?.id,
          ...getVisibilityFilters(user),
        },
        include: Object.keys(include).length ? include : undefined,
      });

    // Log database operation success
    logDatabaseSuccess('get_call_list_pipeline_stage', req, {
      found: !!foundCallListPipelineStage,
      callListPipelineStageId: params?.id,
    });

    if (!foundCallListPipelineStage) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallListPipelineStage not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_call_list_pipeline_stage',
          details: { callListPipelineStageId: params?.id },
        }
      );
      logOperationError('getCallListPipelineStage', req, error);
      throw error;
    }

    const [foundCallListPipelineStageWithDetails] = await getDetailsFromAPI({
      results: [foundCallListPipelineStage],
      token: user?.accessToken,
    });

    // Attach display value
    const callListPipelineStageWithDisplayValue = {
      ...foundCallListPipelineStageWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        foundCallListPipelineStageWithDetails,
        'CallListPipelineStage'
      ),
    };

    // Log operation success
    logOperationSuccess('getCallListPipelineStage', req, {
      id: foundCallListPipelineStage.id,
      code: foundCallListPipelineStage.code,
    });

    res.status(200).json(callListPipelineStageWithDisplayValue);
  } catch (error) {
    logOperationError('getCallListPipelineStage', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_call_list_pipeline_stage');
  }
}

async function updateCallListPipelineStage(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateCallListPipelineStage', req, {
    callListPipelineStageId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await callListPipelineStageUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateCallListPipelineStage', req, error);
        throw handleValidationError(error, 'call_list_pipeline_stage_update');
      }
      logOperationError('updateCallListPipelineStage', req, error);
      throw error;
    }

    // Django parity: skip explicit FK validation and duplicate pre-checks here.

    // Log database operation start
    logDatabaseStart('update_call_list_pipeline_stage', req, {
      callListPipelineStageId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.callListPipelineStage.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallListPipelineStage not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_call_list_pipeline_stage',
          details: { callListPipelineStageId: params?.id },
        }
      );
      throw error;
    }

    const updatedCallListPipelineStage =
      await prisma.callListPipelineStage.findFirst({
        where: { id: params?.id, client: user?.client?.id, deleted: null },
      });

    // Log database operation success
    logDatabaseSuccess('update_call_list_pipeline_stage', req, {
      id: updatedCallListPipelineStage.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateCallListPipelineStage', req, {
      id: updatedCallListPipelineStage.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(updatedCallListPipelineStage);

    // Fire-and-forget workflow trigger for lower latency
    try {
      setImmediate(() => {
        findWorkflowAndTrigger(
          prisma,
          updatedCallListPipelineStage,
          'callListPipelineStage',
          user?.client?.id,
          {},
          user?.accessToken
        ).catch(() => {});
      });
    } catch (_e) {
      // best-effort
    }
  } catch (error) {
    logOperationError('updateCallListPipelineStage', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_call_list_pipeline_stage');
  }
}

async function deleteCallListPipelineStage(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteCallListPipelineStage', req, {
    user: user?.id,
    callListPipelineStageId: params?.id,
  });

  try {
    await prisma.callSchedule.updateMany({
      where: {
        callListPipelineStageId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.callHistory.updateMany({
      where: {
        callListPipelineStageId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_call_list_pipeline_stage', req, {
      callListPipelineStageId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.callListPipelineStage.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_call_list_pipeline_stage', req, {
      deletedCount: result.count,
      callListPipelineStageId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallListPipelineStage not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_call_list_pipeline_stage',
          details: { callListPipelineStageId: params?.id },
        }
      );
      logOperationError('deleteCallListPipelineStage', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteCallListPipelineStage', req, {
      deletedCount: result.count,
      callListPipelineStageId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteCallListPipelineStage', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_call_list_pipeline_stage');
  }
}

async function getCallListPipelineStageBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for callListPipelineStage',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCallListPipelineStage,
  createCallListPipelineStage,
  getCallListPipelineStage,
  updateCallListPipelineStage,
  deleteCallListPipelineStage,
  getCallListPipelineStageBarChartData,
};
