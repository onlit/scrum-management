/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 09/10/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing prospectPipeline using Prisma.
 * It includes functions for retrieving all prospectPipeline, creating a new prospectPipeline, retrieving a single prospectPipeline,
 * updating an existing prospectPipeline, and deleting a prospectPipeline.
 *
 * The `getAllProspectPipeline` function retrieves a paginated list of prospectPipeline based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createProspectPipeline` function validates the request body using a Joi schema, generates a unique code
 * for the prospectPipeline, and creates a new prospectPipeline in the database with additional metadata.
 *
 * The `getProspectPipeline` function retrieves a single prospectPipeline based on the provided prospectPipeline ID, with visibility
 * filters applied to ensure the prospectPipeline is accessible to the requesting user.
 *
 * The `updateProspectPipeline` function updates an existing prospectPipeline in the database based on the provided prospectPipeline ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteProspectPipeline` function deletes a prospectPipeline from the database based on the provided prospectPipeline ID, with
 * visibility filters applied to ensure the prospectPipeline is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  prospectPipelineCreate,
  prospectPipelineUpdate,
} = require('#schemas/prospectPipeline.schemas.js');
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
const { getPaginatedList } = require('#utils/shared/databaseUtils.js');
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

async function getAllProspectPipeline(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllProspectPipeline', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['description', 'name', 'tags', 'color'];
    const filterFields = [...searchFields];

    const include = {
      stages: true,
    };

    // Log database operation start
    logDatabaseStart('get_all_prospect_pipeline', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: prospectPipelineUpdate,
      filterFields,
      searchFields,
      model: 'prospectPipeline',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values to all prospect pipelines
    if (response?.results) {
      response.results = response.results.map((prospectPipeline) => ({
        ...prospectPipeline,
        [DISPLAY_VALUE_PROP]: computeDisplayValue(
          prospectPipeline,
          'ProspectPipeline'
        ),
      }));
    }

    // Log database operation success
    logDatabaseSuccess('get_all_prospect_pipeline', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllProspectPipeline', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllProspectPipeline', req, error);
    throw handleDatabaseError(error, 'get_all_prospect_pipeline');
  }
}

async function createProspectPipeline(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createProspectPipeline', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await prospectPipelineCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createProspectPipeline', req, error);
        throw handleValidationError(error, 'prospect_pipeline_creation');
      }
      logOperationError('createProspectPipeline', req, error);
      throw error;
    }

    const modelRelationFields = [];

    const include = {
      stages: true,
    };

    // Log database operation start
    logDatabaseStart('create_prospect_pipeline', req, {
      name: values.name,
      userId: user?.id,
    });

    const newProspectPipeline = await prisma.prospectPipeline.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_prospect_pipeline', req, {
      id: newProspectPipeline.id,
    });

    const [newProspectPipelineWithDetails] = await getDetailsFromAPI({
      results: [newProspectPipeline],
      token: user?.accessToken,
    });

    // Attach display value
    const prospectPipelineWithDisplayValue = {
      ...newProspectPipelineWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        newProspectPipelineWithDetails,
        'ProspectPipeline'
      ),
    };

    // Log operation success
    logOperationSuccess('createProspectPipeline', req, {
      id: newProspectPipeline.id,
    });

    res.status(201).json(prospectPipelineWithDisplayValue);
  } catch (error) {
    logOperationError('createProspectPipeline', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_prospect_pipeline');
  }
}

async function getProspectPipeline(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getProspectPipeline', req, {
    user: user?.id,
    prospectPipelineId: params?.id,
  });

  try {
    const include = {
      stages: true,
    };

    // Log database operation start
    logDatabaseStart('get_prospect_pipeline', req, {
      prospectPipelineId: params?.id,
      userId: user?.id,
    });

    const foundProspectPipeline = await prisma.prospectPipeline.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_prospect_pipeline', req, {
      found: !!foundProspectPipeline,
      prospectPipelineId: params?.id,
    });

    if (!foundProspectPipeline) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ProspectPipeline not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_prospect_pipeline',
          details: { prospectPipelineId: params?.id },
        }
      );
      logOperationError('getProspectPipeline', req, error);
      throw error;
    }

    const [foundProspectPipelineWithDetails] = await getDetailsFromAPI({
      results: [foundProspectPipeline],
      token: user?.accessToken,
    });

    // Attach display value
    const prospectPipelineWithDisplayValue = {
      ...foundProspectPipelineWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        foundProspectPipelineWithDetails,
        'ProspectPipeline'
      ),
    };

    // Log operation success
    logOperationSuccess('getProspectPipeline', req, {
      id: foundProspectPipeline.id,
    });

    res.status(200).json(prospectPipelineWithDisplayValue);
  } catch (error) {
    logOperationError('getProspectPipeline', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_prospect_pipeline');
  }
}

async function updateProspectPipeline(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateProspectPipeline', req, {
    prospectPipelineId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await prospectPipelineUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateProspectPipeline', req, error);
        throw handleValidationError(error, 'prospect_pipeline_update');
      }
      logOperationError('updateProspectPipeline', req, error);
      throw error;
    }

    // Log database operation start
    logDatabaseStart('update_prospect_pipeline', req, {
      prospectPipelineId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.prospectPipeline.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ProspectPipeline not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_prospect_pipeline',
          details: { prospectPipelineId: params?.id },
        }
      );
      logOperationError('updateProspectPipeline', req, error);
      throw error;
    }

    // Fetch the updated record for response
    const updatedProspectPipeline = await prisma.prospectPipeline.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });

    // Attach display value
    const prospectPipelineWithDisplayValue = {
      ...updatedProspectPipeline,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        updatedProspectPipeline,
        'ProspectPipeline'
      ),
    };

    // Log database operation success
    logDatabaseSuccess('update_prospect_pipeline', req, {
      id: updatedProspectPipeline.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateProspectPipeline', req, {
      id: updatedProspectPipeline.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(prospectPipelineWithDisplayValue);
  } catch (error) {
    logOperationError('updateProspectPipeline', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_prospect_pipeline');
  }
}

async function deleteProspectPipeline(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteProspectPipeline', req, {
    user: user?.id,
    prospectPipelineId: params?.id,
  });

  try {
    // Cascade delete related records first
    await prisma.prospectPipelineStage.updateMany({
      where: { pipelineId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_prospect_pipeline', req, {
      prospectPipelineId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.prospectPipeline.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_prospect_pipeline', req, {
      deletedCount: result.count,
      prospectPipelineId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ProspectPipeline not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_prospect_pipeline',
          details: { prospectPipelineId: params?.id },
        }
      );
      logOperationError('deleteProspectPipeline', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteProspectPipeline', req, {
      deletedCount: result.count,
      prospectPipelineId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteProspectPipeline', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_prospect_pipeline');
  }
}

async function getProspectPipelineBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for prospectPipeline',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllProspectPipeline,
  createProspectPipeline,
  getProspectPipeline,
  updateProspectPipeline,
  deleteProspectPipeline,
  getProspectPipelineBarChartData,
};
