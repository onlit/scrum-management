/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing pipelineStage using Prisma.
 * It includes functions for retrieving all pipelineStage, creating a new pipelineStage, retrieving a single pipelineStage,
 * updating an existing pipelineStage, and deleting a pipelineStage.
 *
 * The `getAllPipelineStage` function retrieves a paginated list of pipelineStage based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createPipelineStage` function validates the request body using a Joi schema, generates a unique code
 * for the pipelineStage, and creates a new pipelineStage in the database with additional metadata.
 *
 * The `getPipelineStage` function retrieves a single pipelineStage based on the provided pipelineStage ID, with visibility
 * filters applied to ensure the pipelineStage is accessible to the requesting user.
 *
 * The `updatePipelineStage` function updates an existing pipelineStage in the database based on the provided pipelineStage ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deletePipelineStage` function deletes a pipelineStage from the database based on the provided pipelineStage ID, with
 * visibility filters applied to ensure the pipelineStage is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  pipelineStageCreate,
  pipelineStageUpdate,
} = require('#schemas/pipelineStage.schemas.js');
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
  verifyForeignKeyAccessBatch,
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

async function getAllPipelineStage(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllPipelineStage', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = [
      'immediateNextAction',
      'description',
      'color',
      'stage',
    ];
    const filterFields = [
      ...searchFields,
      'parentPipelineStageId',
      'pipelineId',
      'order',
      'confidence',
      'rottingDays',
      'conversion',
    ];

    const include = {
      parentPipelineStage: true,
      pipeline: true,
    };

    // Log database operation start
    logDatabaseStart('get_all_pipeline_stage', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: pipelineStageUpdate,
      filterFields,
      searchFields,
      model: 'pipelineStage',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values to all pipeline stages
    if (response?.results) {
      response.results = response.results.map((pipelineStage) => ({
        ...pipelineStage,
        [DISPLAY_VALUE_PROP]: computeDisplayValue(
          pipelineStage,
          'PipelineStage'
        ),
      }));
    }

    // Log database operation success
    logDatabaseSuccess('get_all_pipeline_stage', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllPipelineStage', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllPipelineStage', req, error);
    throw handleDatabaseError(error, 'get_all_pipeline_stage');
  }
}

async function createPipelineStage(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createPipelineStage', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await pipelineStageCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createPipelineStage', req, error);
        throw handleValidationError(error, 'pipeline_stage_creation');
      }
      logOperationError('createPipelineStage', req, error);
      throw error;
    }

    const modelRelationFields = ['parentPipelineStageId', 'pipelineId'];

    const include = {
      parentPipelineStage: true,
      pipeline: true,
    };

    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        { model: 'pipeline', fieldValues: { pipelineId: values?.pipelineId } },
        {
          model: 'pipelineStage',
          fieldValues: { parentPipelineStageId: values?.parentPipelineStageId },
        },
      ],
    });

    // Enforce unique stage within a pipeline (soft-delete aware)
    if (values?.pipelineId && values?.stage) {
      const existing = await prisma.pipelineStage.findFirst({
        where: {
          pipelineId: values.pipelineId,
          stage: { equals: values.stage, mode: 'insensitive' },
          deleted: null,
          ...getVisibilityFilters(user),
        },
        select: { id: true },
      });
      if (existing) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'Stage must be unique within a pipeline.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'pipeline_stage_creation_uniqueness',
            details: { pipelineId: values.pipelineId, stage: values.stage },
          }
        );
        throw error;
      }
    }

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_pipeline_stage', req, {
      name: values.name,
      userId: user?.id,
    });

    const newPipelineStage = await prisma.pipelineStage.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_pipeline_stage', req, {
      id: newPipelineStage.id,
      code: newPipelineStage.code,
    });

    const [newPipelineStageWithDetails] = await getDetailsFromAPI({
      results: [newPipelineStage],
      token: user?.accessToken,
    });

    // Attach display value
    const pipelineStageWithDisplayValue = {
      ...newPipelineStageWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        newPipelineStageWithDetails,
        'PipelineStage'
      ),
    };

    // Log operation success
    logOperationSuccess('createPipelineStage', req, {
      id: newPipelineStage.id,
      code: newPipelineStage.code,
    });

    res.status(201).json(pipelineStageWithDisplayValue);
  } catch (error) {
    logOperationError('createPipelineStage', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_pipeline_stage');
  }
}

async function getPipelineStage(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getPipelineStage', req, {
    user: user?.id,
    pipelineStageId: params?.id,
  });

  try {
    const include = {
      parentPipelineStage: true,
      pipeline: true,
    };

    // Log database operation start
    logDatabaseStart('get_pipeline_stage', req, {
      pipelineStageId: params?.id,
      userId: user?.id,
    });

    const foundPipelineStage = await prisma.pipelineStage.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_pipeline_stage', req, {
      found: !!foundPipelineStage,
      pipelineStageId: params?.id,
    });

    if (!foundPipelineStage) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PipelineStage not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_pipeline_stage',
          details: { pipelineStageId: params?.id },
        }
      );
      logOperationError('getPipelineStage', req, error);
      throw error;
    }

    const [foundPipelineStageWithDetails] = await getDetailsFromAPI({
      results: [foundPipelineStage],
      token: user?.accessToken,
    });

    // Attach display value
    const pipelineStageWithDisplayValue = {
      ...foundPipelineStageWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        foundPipelineStageWithDetails,
        'PipelineStage'
      ),
    };

    // Log operation success
    logOperationSuccess('getPipelineStage', req, {
      id: foundPipelineStage.id,
      code: foundPipelineStage.code,
    });

    res.status(200).json(pipelineStageWithDisplayValue);
  } catch (error) {
    logOperationError('getPipelineStage', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_pipeline_stage');
  }
}

async function updatePipelineStage(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updatePipelineStage', req, {
    pipelineStageId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await pipelineStageUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updatePipelineStage', req, error);
        throw handleValidationError(error, 'pipeline_stage_update');
      }
      logOperationError('updatePipelineStage', req, error);
      throw error;
    }

    // Validate only if provided in payload
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        body?.pipelineId
          ? { model: 'pipeline', fieldValues: { pipelineId: body?.pipelineId } }
          : null,
        body?.parentPipelineStageId
          ? {
              model: 'pipelineStage',
              fieldValues: {
                parentPipelineStageId: body?.parentPipelineStageId,
              },
            }
          : null,
      ].filter(Boolean),
    });

    // Enforce unique stage within a pipeline on update (if provided)
    const targetPipelineId = body?.pipelineId;
    const targetStage = body?.stage;
    if (targetPipelineId && targetStage) {
      const existing = await prisma.pipelineStage.findFirst({
        where: {
          id: { not: params?.id },
          pipelineId: targetPipelineId,
          stage: { equals: targetStage, mode: 'insensitive' },
          deleted: null,
          ...getVisibilityFilters(user),
        },
        select: { id: true },
      });
      if (existing) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'Stage must be unique within a pipeline.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'pipeline_stage_update_uniqueness',
            details: { pipelineId: targetPipelineId, stage: targetStage },
          }
        );
        throw error;
      }
    }

    // Guard: ensure record exists in visibility scope
    const current = await prisma.pipelineStage.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: { id: true },
    });
    if (!current) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PipelineStage not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_pipeline_stage',
          details: { pipelineStageId: params?.id },
        }
      );
      logOperationError('updatePipelineStage', req, error);
      throw error;
    }

    // Log database operation start
    logDatabaseStart('update_pipeline_stage', req, {
      pipelineStageId: params?.id,
      updateFields: Object.keys(values),
    });

    await prisma.pipelineStage.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('update_pipeline_stage', req, {
      updatedCount: 1,
      updatedFields: Object.keys(values),
    });

    // Fetch updated entity to return latest state
    const updatedPipelineStage = await prisma.pipelineStage.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });

    // Attach display value
    const pipelineStageWithDisplayValue = {
      ...updatedPipelineStage,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        updatedPipelineStage,
        'PipelineStage'
      ),
    };

    // Log operation success
    logOperationSuccess('updatePipelineStage', req, {
      id: updatedPipelineStage.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(pipelineStageWithDisplayValue);
  } catch (error) {
    logOperationError('updatePipelineStage', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_pipeline_stage');
  }
}

async function deletePipelineStage(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deletePipelineStage', req, {
    user: user?.id,
    pipelineStageId: params?.id,
  });

  try {
    await prisma.salesPersonTarget.updateMany({
      where: {
        pipelineStageId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.opportunity.updateMany({
      where: { statusId: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.pipelineStage.updateMany({
      where: {
        parentPipelineStageId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_pipeline_stage', req, {
      pipelineStageId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.pipelineStage.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_pipeline_stage', req, {
      deletedCount: result.count,
      pipelineStageId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PipelineStage not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_pipeline_stage',
          details: { pipelineStageId: params?.id },
        }
      );
      logOperationError('deletePipelineStage', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deletePipelineStage', req, {
      deletedCount: result.count,
      pipelineStageId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deletePipelineStage', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_pipeline_stage');
  }
}

async function getPipelineStageBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for pipelineStage',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllPipelineStage,
  createPipelineStage,
  getPipelineStage,
  updatePipelineStage,
  deletePipelineStage,
  getPipelineStageBarChartData,
};
