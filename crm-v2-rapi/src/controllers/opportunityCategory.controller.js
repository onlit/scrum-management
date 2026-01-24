/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 09/10/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing opportunityCategory using Prisma.
 * It includes functions for retrieving all opportunityCategory, creating a new opportunityCategory, retrieving a single opportunityCategory,
 * updating an existing opportunityCategory, and deleting a opportunityCategory.
 *
 * The `getAllOpportunityCategory` function retrieves a paginated list of opportunityCategory based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createOpportunityCategory` function validates the request body using a Joi schema, generates a unique code
 * for the opportunityCategory, and creates a new opportunityCategory in the database with additional metadata.
 *
 * The `getOpportunityCategory` function retrieves a single opportunityCategory based on the provided opportunityCategory ID, with visibility
 * filters applied to ensure the opportunityCategory is accessible to the requesting user.
 *
 * The `updateOpportunityCategory` function updates an existing opportunityCategory in the database based on the provided opportunityCategory ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteOpportunityCategory` function deletes a opportunityCategory from the database based on the provided opportunityCategory ID, with
 * visibility filters applied to ensure the opportunityCategory is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  opportunityCategoryCreate,
  opportunityCategoryUpdate,
} = require('#schemas/opportunityCategory.schemas.js');
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

async function getAllOpportunityCategory(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllOpportunityCategory', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['name', 'description', 'tags', 'color'];
    const filterFields = [...searchFields];

    const include = {};

    // Log database operation start
    logDatabaseStart('get_all_opportunity_category', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: opportunityCategoryUpdate,
      filterFields,
      searchFields,
      model: 'opportunityCategory',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values to all opportunity category records
    if (response?.results) {
      response.results = response.results.map((record) => ({
        ...record,
        [DISPLAY_VALUE_PROP]: computeDisplayValue(
          record,
          'OpportunityCategory'
        ),
      }));
    }

    // Log database operation success
    logDatabaseSuccess('get_all_opportunity_category', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllOpportunityCategory', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllOpportunityCategory', req, error);
    throw handleDatabaseError(error, 'get_all_opportunity_category');
  }
}

async function createOpportunityCategory(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createOpportunityCategory', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await opportunityCategoryCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createOpportunityCategory', req, error);
        throw handleValidationError(error, 'opportunity_category_creation');
      }
      logOperationError('createOpportunityCategory', req, error);
      throw error;
    }

    const modelRelationFields = [];

    const include = {};

    // Log database operation start
    logDatabaseStart('create_opportunity_category', req, {
      name: values.name,
      userId: user?.id,
    });

    const newOpportunityCategory = await prisma.opportunityCategory.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_opportunity_category', req, {
      id: newOpportunityCategory.id,
    });

    const [newOpportunityCategoryWithDetails] = await getDetailsFromAPI({
      results: [newOpportunityCategory],
      token: user?.accessToken,
    });

    // Attach display value
    const opportunityCategoryWithDisplayValue = {
      ...newOpportunityCategoryWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        newOpportunityCategoryWithDetails,
        'OpportunityCategory'
      ),
    };

    // Log operation success
    logOperationSuccess('createOpportunityCategory', req, {
      id: newOpportunityCategory.id,
    });

    res.status(201).json(opportunityCategoryWithDisplayValue);
  } catch (error) {
    logOperationError('createOpportunityCategory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_opportunity_category');
  }
}

async function getOpportunityCategory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getOpportunityCategory', req, {
    user: user?.id,
    opportunityCategoryId: params?.id,
  });

  try {
    const include = {};

    // Log database operation start
    logDatabaseStart('get_opportunity_category', req, {
      opportunityCategoryId: params?.id,
      userId: user?.id,
    });

    const foundOpportunityCategory = await prisma.opportunityCategory.findFirst(
      {
        where: {
          id: params?.id,
          ...getVisibilityFilters(user),
        },
        include: Object.keys(include).length ? include : undefined,
      }
    );

    // Log database operation success
    logDatabaseSuccess('get_opportunity_category', req, {
      found: !!foundOpportunityCategory,
      opportunityCategoryId: params?.id,
    });

    if (!foundOpportunityCategory) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityCategory not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_opportunity_category',
          details: { opportunityCategoryId: params?.id },
        }
      );
      logOperationError('getOpportunityCategory', req, error);
      throw error;
    }

    const [foundOpportunityCategoryWithDetails] = await getDetailsFromAPI({
      results: [foundOpportunityCategory],
      token: user?.accessToken,
    });

    // Attach display value
    const opportunityCategoryWithDisplayValue = {
      ...foundOpportunityCategoryWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        foundOpportunityCategoryWithDetails,
        'OpportunityCategory'
      ),
    };

    // Log operation success
    logOperationSuccess('getOpportunityCategory', req, {
      id: foundOpportunityCategory.id,
    });

    res.status(200).json(opportunityCategoryWithDisplayValue);
  } catch (error) {
    logOperationError('getOpportunityCategory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_opportunity_category');
  }
}

async function updateOpportunityCategory(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateOpportunityCategory', req, {
    opportunityCategoryId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await opportunityCategoryUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateOpportunityCategory', req, error);
        throw handleValidationError(error, 'opportunity_category_update');
      }
      logOperationError('updateOpportunityCategory', req, error);
      throw error;
    }

    // Log database operation start
    logDatabaseStart('update_opportunity_category', req, {
      opportunityCategoryId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.opportunityCategory.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityCategory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_opportunity_category',
          details: { opportunityCategoryId: params?.id },
        }
      );
      logOperationError('updateOpportunityCategory', req, error);
      throw error;
    }

    // Fetch the updated record for response
    const updatedOpportunityCategory =
      await prisma.opportunityCategory.findFirst({
        where: { id: params?.id, ...getVisibilityFilters(user) },
      });

    // Attach display value
    const opportunityCategoryWithDisplayValue = {
      ...updatedOpportunityCategory,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        updatedOpportunityCategory,
        'OpportunityCategory'
      ),
    };

    // Log database operation success
    logDatabaseSuccess('update_opportunity_category', req, {
      id: updatedOpportunityCategory.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateOpportunityCategory', req, {
      id: updatedOpportunityCategory.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(opportunityCategoryWithDisplayValue);
  } catch (error) {
    logOperationError('updateOpportunityCategory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_opportunity_category');
  }
}

async function deleteOpportunityCategory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteOpportunityCategory', req, {
    user: user?.id,
    opportunityCategoryId: params?.id,
  });

  try {
    // Cascade delete related records first
    await prisma.opportunity.updateMany({
      where: { categoryId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_opportunity_category', req, {
      opportunityCategoryId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.opportunityCategory.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_opportunity_category', req, {
      deletedCount: result.count,
      opportunityCategoryId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityCategory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_opportunity_category',
          details: { opportunityCategoryId: params?.id },
        }
      );
      logOperationError('deleteOpportunityCategory', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteOpportunityCategory', req, {
      deletedCount: result.count,
      opportunityCategoryId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteOpportunityCategory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_opportunity_category');
  }
}

async function getOpportunityCategoryBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for opportunityCategory',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllOpportunityCategory,
  createOpportunityCategory,
  getOpportunityCategory,
  updateOpportunityCategory,
  deleteOpportunityCategory,
  getOpportunityCategoryBarChartData,
};
