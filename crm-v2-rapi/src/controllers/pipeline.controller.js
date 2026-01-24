/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing pipeline using Prisma.
 * It includes functions for retrieving all pipeline, creating a new pipeline, retrieving a single pipeline,
 * updating an existing pipeline, and deleting a pipeline.
 *
 * The `getAllPipeline` function retrieves a paginated list of pipeline based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createPipeline` function validates the request body using a Joi schema, generates a unique code
 * for the pipeline, and creates a new pipeline in the database with additional metadata.
 *
 * The `getPipeline` function retrieves a single pipeline based on the provided pipeline ID, with visibility
 * filters applied to ensure the pipeline is accessible to the requesting user.
 *
 * The `updatePipeline` function updates an existing pipeline in the database based on the provided pipeline ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deletePipeline` function deletes a pipeline from the database based on the provided pipeline ID, with
 * visibility filters applied to ensure the pipeline is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  pipelineCreate,
  pipelineUpdate,
} = require('#schemas/pipeline.schemas.js');
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

async function getAllPipeline(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllPipeline', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['color', 'description', 'name'];
    const filterFields = [...searchFields];

    const include = {
      pipelinePipelineStagePipeline: {
        where: { deleted: null },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      },
    };

    // Log database operation start
    logDatabaseStart('get_all_pipeline', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: pipelineUpdate,
      filterFields,
      searchFields,
      model: 'pipeline',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values to all pipelines
    if (response?.results) {
      response.results = response.results.map((pipeline) => ({
        ...pipeline,
        [DISPLAY_VALUE_PROP]: computeDisplayValue(pipeline, 'Pipeline'),
      }));
    }

    // Log database operation success
    logDatabaseSuccess('get_all_pipeline', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllPipeline', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllPipeline', req, error);
    throw handleDatabaseError(error, 'get_all_pipeline');
  }
}

async function createPipeline(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createPipeline', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await pipelineCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createPipeline', req, error);
        throw handleValidationError(error, 'pipeline_creation');
      }
      logOperationError('createPipeline', req, error);
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

    // Controller-level uniqueness: name must be unique (case-insensitive) within tenant among non-deleted
    try {
      const existingByName = await prisma.pipeline.findFirst({
        where: {
          client: user?.client?.id,
          deleted: null,
          name: { equals: values.name, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (existingByName) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'A pipeline with this name already exists for your account.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'create_pipeline_duplicate_check',
            details: { name: values.name },
          }
        );
        throw error;
      }
    } catch (_e) {
      // best-effort; continue if check fails
    }

    // Log database operation start
    logDatabaseStart('create_pipeline', req, {
      name: values.name,
      userId: user?.id,
    });

    const newPipeline = await prisma.pipeline.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_pipeline', req, {
      id: newPipeline.id,
      code: newPipeline.code,
    });

    const [newPipelineWithDetails] = await getDetailsFromAPI({
      results: [newPipeline],
      token: user?.accessToken,
    });

    // Attach display value
    const pipelineWithDisplayValue = {
      ...newPipelineWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        newPipelineWithDetails,
        'Pipeline'
      ),
    };

    // Log operation success
    logOperationSuccess('createPipeline', req, {
      id: newPipeline.id,
      code: newPipeline.code,
    });

    res.status(201).json(pipelineWithDisplayValue);

    // No workflow triggers for parity with Django implementation
  } catch (error) {
    logOperationError('createPipeline', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_pipeline');
  }
}

async function getPipeline(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getPipeline', req, {
    user: user?.id,
    pipelineId: params?.id,
  });

  try {
    const include = {};

    // Log database operation start
    logDatabaseStart('get_pipeline', req, {
      pipelineId: params?.id,
      userId: user?.id,
    });

    const foundPipeline = await prisma.pipeline.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_pipeline', req, {
      found: !!foundPipeline,
      pipelineId: params?.id,
    });

    if (!foundPipeline) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Pipeline not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_pipeline',
          details: { pipelineId: params?.id },
        }
      );
      logOperationError('getPipeline', req, error);
      throw error;
    }

    const [foundPipelineWithDetails] = await getDetailsFromAPI({
      results: [foundPipeline],
      token: user?.accessToken,
    });

    // Attach display value
    const pipelineWithDisplayValue = {
      ...foundPipelineWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        foundPipelineWithDetails,
        'Pipeline'
      ),
    };

    // Log operation success
    logOperationSuccess('getPipeline', req, {
      id: foundPipeline.id,
      code: foundPipeline.code,
    });

    res.status(200).json(pipelineWithDisplayValue);
  } catch (error) {
    logOperationError('getPipeline', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_pipeline');
  }
}

async function updatePipeline(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updatePipeline', req, {
    pipelineId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await pipelineUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updatePipeline', req, error);
        throw handleValidationError(error, 'pipeline_update');
      }
      logOperationError('updatePipeline', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Controller-level uniqueness on update: name must remain unique in tenant
    try {
      if (values?.name) {
        const dupe = await prisma.pipeline.findFirst({
          where: {
            id: { not: params?.id },
            client: user?.client?.id,
            deleted: null,
            name: { equals: values.name, mode: 'insensitive' },
          },
          select: { id: true },
        });
        if (dupe) {
          const error = createErrorWithTrace(
            ERROR_TYPES.VALIDATION,
            'A pipeline with this name already exists for your account.',
            req,
            {
              severity: ERROR_SEVERITY.LOW,
              context: 'update_pipeline_duplicate_check',
              details: { name: values.name },
            }
          );
          throw error;
        }
      }
    } catch (_e) {
      // best-effort; continue if check fails
    }

    // Guard: ensure record exists in visibility scope
    const current = await prisma.pipeline.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: { id: true },
    });
    if (!current) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Pipeline not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_pipeline',
          details: { pipelineId: params?.id },
        }
      );
      logOperationError('updatePipeline', req, error);
      throw error;
    }

    // Log database operation start
    logDatabaseStart('update_pipeline', req, {
      pipelineId: params?.id,
      updateFields: Object.keys(values),
    });

    const updated = await prisma.pipeline.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('update_pipeline', req, {
      updatedCount: 1,
      updatedFields: Object.keys(values),
    });

    // Fetch updated entity to return latest state
    const updatedPipeline = await prisma.pipeline.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      include: {
        pipelinePipelineStagePipeline: {
          where: { deleted: null },
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
        },
      },
    });

    // Attach display value
    const pipelineWithDisplayValue = {
      ...updatedPipeline,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(updatedPipeline, 'Pipeline'),
    };

    // Log operation success
    logOperationSuccess('updatePipeline', req, {
      id: updatedPipeline.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(pipelineWithDisplayValue);
  } catch (error) {
    logOperationError('updatePipeline', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_pipeline');
  }
}

async function deletePipeline(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deletePipeline', req, {
    user: user?.id,
    pipelineId: params?.id,
  });

  try {
    await prisma.salesPersonTarget.updateMany({
      where: {
        pipelineId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.opportunity.updateMany({
      where: {
        pipelineId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.pipelineStage.updateMany({
      where: {
        pipelineId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_pipeline', req, {
      pipelineId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.pipeline.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_pipeline', req, {
      deletedCount: result.count,
      pipelineId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Pipeline not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_pipeline',
          details: { pipelineId: params?.id },
        }
      );
      logOperationError('deletePipeline', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deletePipeline', req, {
      deletedCount: result.count,
      pipelineId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deletePipeline', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_pipeline');
  }
}

async function getPipelineBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for pipeline',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllPipeline,
  createPipeline,
  getPipeline,
  updatePipeline,
  deletePipeline,
  getPipelineBarChartData,
};
