/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 09/10/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing prospectPipelineStage using Prisma.
 * It includes functions for retrieving all prospectPipelineStage, creating a new prospectPipelineStage, retrieving a single prospectPipelineStage,
 * updating an existing prospectPipelineStage, and deleting a prospectPipelineStage.
 *
 * The `getAllProspectPipelineStage` function retrieves a paginated list of prospectPipelineStage based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createProspectPipelineStage` function validates the request body using a Joi schema, generates a unique code
 * for the prospectPipelineStage, and creates a new prospectPipelineStage in the database with additional metadata.
 *
 * The `getProspectPipelineStage` function retrieves a single prospectPipelineStage based on the provided prospectPipelineStage ID, with visibility
 * filters applied to ensure the prospectPipelineStage is accessible to the requesting user.
 *
 * The `updateProspectPipelineStage` function updates an existing prospectPipelineStage in the database based on the provided prospectPipelineStage ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteProspectPipelineStage` function deletes a prospectPipelineStage from the database based on the provided prospectPipelineStage ID, with
 * visibility filters applied to ensure the prospectPipelineStage is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  prospectPipelineStageCreate,
  prospectPipelineStageUpdate,
} = require('#schemas/prospectPipelineStage.schemas.js');
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

async function getAllProspectPipelineStage(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllProspectPipelineStage', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = [
      'immediateNextAction',
      'description',
      'stage',
      'tags',
    ];
    const filterFields = [
      ...searchFields,
      'parentPipelineStageId',
      'pipelineId',
      'order',
      'confidence',
      'color',
      'rottingDays',
      'conversion',
    ];

    const include = {
      parent: true,
      pipeline: true,
    };

    // Log database operation start
    logDatabaseStart('get_all_prospect_pipeline_stage', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: prospectPipelineStageUpdate,
      filterFields,
      searchFields,
      model: 'prospectPipelineStage',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values to all prospect pipeline stages
    if (response?.results) {
      response.results = response.results.map((prospectPipelineStage) => ({
        ...prospectPipelineStage,
        [DISPLAY_VALUE_PROP]: computeDisplayValue(
          prospectPipelineStage,
          'ProspectPipelineStage'
        ),
      }));
    }

    // Log database operation success
    logDatabaseSuccess('get_all_prospect_pipeline_stage', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllProspectPipelineStage', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllProspectPipelineStage', req, error);
    throw handleDatabaseError(error, 'get_all_prospect_pipeline_stage');
  }
}

async function createProspectPipelineStage(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createProspectPipelineStage', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await prospectPipelineStageCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createProspectPipelineStage', req, error);
        throw handleValidationError(error, 'prospect_pipeline_stage_creation');
      }
      logOperationError('createProspectPipelineStage', req, error);
      throw error;
    }

    const modelRelationFields = ['parentPipelineStageId', 'pipelineId'];

    const include = {
      parent: true,
      pipeline: true,
    };

    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.parentPipelineStageId
          ? {
              model: 'prospectPipelineStage',
              fieldValues: {
                parentPipelineStageId: values.parentPipelineStageId,
              },
            }
          : null,
        values?.pipelineId
          ? {
              model: 'prospectPipeline',
              fieldValues: { pipelineId: values.pipelineId },
            }
          : null,
      ].filter(Boolean),
    });

    // Log database operation start
    logDatabaseStart('create_prospect_pipeline_stage', req, {
      stage: values.stage,
      userId: user?.id,
    });

    const createPayload = buildCreateRecordPayload({
      user,
      validatedValues: values,
      requestBody: body,
      relations: modelRelationFields,
    });

    if (createPayload.parentPipelineStage) {
      createPayload.parent = createPayload.parentPipelineStage;
      delete createPayload.parentPipelineStage;
    }

    const newProspectPipelineStage = await prisma.prospectPipelineStage.create({
      data: createPayload,
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_prospect_pipeline_stage', req, {
      id: newProspectPipelineStage.id,
    });

    const [newProspectPipelineStageWithDetails] = await getDetailsFromAPI({
      results: [newProspectPipelineStage],
      token: user?.accessToken,
    });

    // Attach display value
    const prospectPipelineStageWithDisplayValue = {
      ...newProspectPipelineStageWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        newProspectPipelineStageWithDetails,
        'ProspectPipelineStage'
      ),
    };

    // Log operation success
    logOperationSuccess('createProspectPipelineStage', req, {
      id: newProspectPipelineStage.id,
    });

    res.status(201).json(prospectPipelineStageWithDisplayValue);
  } catch (error) {
    logOperationError('createProspectPipelineStage', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_prospect_pipeline_stage');
  }
}

async function getProspectPipelineStage(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getProspectPipelineStage', req, {
    user: user?.id,
    prospectPipelineStageId: params?.id,
  });

  try {
    const include = {
      parent: true,
      pipeline: true,
    };

    // Log database operation start
    logDatabaseStart('get_prospect_pipeline_stage', req, {
      prospectPipelineStageId: params?.id,
      userId: user?.id,
    });

    const foundProspectPipelineStage =
      await prisma.prospectPipelineStage.findFirst({
        where: {
          id: params?.id,
          ...getVisibilityFilters(user),
        },
        include: Object.keys(include).length ? include : undefined,
      });

    // Log database operation success
    logDatabaseSuccess('get_prospect_pipeline_stage', req, {
      found: !!foundProspectPipelineStage,
      prospectPipelineStageId: params?.id,
    });

    if (!foundProspectPipelineStage) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ProspectPipelineStage not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_prospect_pipeline_stage',
          details: { prospectPipelineStageId: params?.id },
        }
      );
      logOperationError('getProspectPipelineStage', req, error);
      throw error;
    }

    const [foundProspectPipelineStageWithDetails] = await getDetailsFromAPI({
      results: [foundProspectPipelineStage],
      token: user?.accessToken,
    });

    // Attach display value
    const prospectPipelineStageWithDisplayValue = {
      ...foundProspectPipelineStageWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        foundProspectPipelineStageWithDetails,
        'ProspectPipelineStage'
      ),
    };

    // Log operation success
    logOperationSuccess('getProspectPipelineStage', req, {
      id: foundProspectPipelineStage.id,
    });

    res.status(200).json(prospectPipelineStageWithDisplayValue);
  } catch (error) {
    logOperationError('getProspectPipelineStage', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_prospect_pipeline_stage');
  }
}

async function updateProspectPipelineStage(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateProspectPipelineStage', req, {
    prospectPipelineStageId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await prospectPipelineStageUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateProspectPipelineStage', req, error);
        throw handleValidationError(error, 'prospect_pipeline_stage_update');
      }
      logOperationError('updateProspectPipelineStage', req, error);
      throw error;
    }

    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.parentPipelineStageId
          ? {
              model: 'prospectPipelineStage',
              fieldValues: {
                parentPipelineStageId: values.parentPipelineStageId,
              },
            }
          : null,
        values?.pipelineId
          ? {
              model: 'prospectPipeline',
              fieldValues: { pipelineId: values.pipelineId },
            }
          : null,
      ].filter(Boolean),
    });

    // Log database operation start
    logDatabaseStart('update_prospect_pipeline_stage', req, {
      prospectPipelineStageId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.prospectPipelineStage.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ProspectPipelineStage not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_prospect_pipeline_stage',
          details: { prospectPipelineStageId: params?.id },
        }
      );
      logOperationError('updateProspectPipelineStage', req, error);
      throw error;
    }

    // Fetch the updated record for response
    const updatedProspectPipelineStage =
      await prisma.prospectPipelineStage.findFirst({
        where: { id: params?.id, ...getVisibilityFilters(user) },
      });

    // Attach display value
    const prospectPipelineStageWithDisplayValue = {
      ...updatedProspectPipelineStage,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        updatedProspectPipelineStage,
        'ProspectPipelineStage'
      ),
    };

    // Log database operation success
    logDatabaseSuccess('update_prospect_pipeline_stage', req, {
      id: updatedProspectPipelineStage.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateProspectPipelineStage', req, {
      id: updatedProspectPipelineStage.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(prospectPipelineStageWithDisplayValue);
  } catch (error) {
    logOperationError('updateProspectPipelineStage', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_prospect_pipeline_stage');
  }
}

async function deleteProspectPipelineStage(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteProspectPipelineStage', req, {
    user: user?.id,
    prospectPipelineStageId: params?.id,
  });

  try {
    // Cascade delete related records first
    await prisma.prospectPipelineStage.updateMany({
      where: {
        parentPipelineStageId: params?.id,
        ...getVisibilityFilters(user),
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.prospect.updateMany({
      where: { statusId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_prospect_pipeline_stage', req, {
      prospectPipelineStageId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.prospectPipelineStage.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_prospect_pipeline_stage', req, {
      deletedCount: result.count,
      prospectPipelineStageId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ProspectPipelineStage not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_prospect_pipeline_stage',
          details: { prospectPipelineStageId: params?.id },
        }
      );
      logOperationError('deleteProspectPipelineStage', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteProspectPipelineStage', req, {
      deletedCount: result.count,
      prospectPipelineStageId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteProspectPipelineStage', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_prospect_pipeline_stage');
  }
}

async function getProspectPipelineStageBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for prospectPipelineStage',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllProspectPipelineStage,
  createProspectPipelineStage,
  getProspectPipelineStage,
  updateProspectPipelineStage,
  deleteProspectPipelineStage,
  getProspectPipelineStageBarChartData,
};
