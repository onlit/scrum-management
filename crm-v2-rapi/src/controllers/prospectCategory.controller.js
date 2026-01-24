/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 09/10/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing prospectCategory using Prisma.
 * It includes functions for retrieving all prospectCategory, creating a new prospectCategory, retrieving a single prospectCategory,
 * updating an existing prospectCategory, and deleting a prospectCategory.
 *
 * The `getAllProspectCategory` function retrieves a paginated list of prospectCategory based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createProspectCategory` function validates the request body using a Joi schema, generates a unique code
 * for the prospectCategory, and creates a new prospectCategory in the database with additional metadata.
 *
 * The `getProspectCategory` function retrieves a single prospectCategory based on the provided prospectCategory ID, with visibility
 * filters applied to ensure the prospectCategory is accessible to the requesting user.
 *
 * The `updateProspectCategory` function updates an existing prospectCategory in the database based on the provided prospectCategory ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteProspectCategory` function deletes a prospectCategory from the database based on the provided prospectCategory ID, with
 * visibility filters applied to ensure the prospectCategory is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  prospectCategoryCreate,
  prospectCategoryUpdate,
} = require('#schemas/prospectCategory.schemas.js');
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

async function getAllProspectCategory(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllProspectCategory', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['name', 'description', 'tags', 'color'];
    const filterFields = [...searchFields];

    const include = {};

    // Log database operation start
    logDatabaseStart('get_all_prospect_category', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: prospectCategoryUpdate,
      filterFields,
      searchFields,
      model: 'prospectCategory',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values to all prospect categories
    if (response?.results) {
      response.results = response.results.map((prospectCategory) => ({
        ...prospectCategory,
        [DISPLAY_VALUE_PROP]: computeDisplayValue(
          prospectCategory,
          'ProspectCategory'
        ),
      }));
    }

    // Log database operation success
    logDatabaseSuccess('get_all_prospect_category', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllProspectCategory', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllProspectCategory', req, error);
    throw handleDatabaseError(error, 'get_all_prospect_category');
  }
}

async function createProspectCategory(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createProspectCategory', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await prospectCategoryCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createProspectCategory', req, error);
        throw handleValidationError(error, 'prospect_category_creation');
      }
      logOperationError('createProspectCategory', req, error);
      throw error;
    }

    const modelRelationFields = [];

    const include = {};

    // Log database operation start
    logDatabaseStart('create_prospect_category', req, {
      name: values.name,
      userId: user?.id,
    });

    const newProspectCategory = await prisma.prospectCategory.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_prospect_category', req, {
      id: newProspectCategory.id,
    });

    const [newProspectCategoryWithDetails] = await getDetailsFromAPI({
      results: [newProspectCategory],
      token: user?.accessToken,
    });

    // Attach display value
    const prospectCategoryWithDisplayValue = {
      ...newProspectCategoryWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        newProspectCategoryWithDetails,
        'ProspectCategory'
      ),
    };

    // Log operation success
    logOperationSuccess('createProspectCategory', req, {
      id: newProspectCategory.id,
    });

    res.status(201).json(prospectCategoryWithDisplayValue);
  } catch (error) {
    logOperationError('createProspectCategory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_prospect_category');
  }
}

async function getProspectCategory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getProspectCategory', req, {
    user: user?.id,
    prospectCategoryId: params?.id,
  });

  try {
    const include = {};

    // Log database operation start
    logDatabaseStart('get_prospect_category', req, {
      prospectCategoryId: params?.id,
      userId: user?.id,
    });

    const foundProspectCategory = await prisma.prospectCategory.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_prospect_category', req, {
      found: !!foundProspectCategory,
      prospectCategoryId: params?.id,
    });

    if (!foundProspectCategory) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ProspectCategory not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_prospect_category',
          details: { prospectCategoryId: params?.id },
        }
      );
      logOperationError('getProspectCategory', req, error);
      throw error;
    }

    const [foundProspectCategoryWithDetails] = await getDetailsFromAPI({
      results: [foundProspectCategory],
      token: user?.accessToken,
    });

    // Attach display value
    const prospectCategoryWithDisplayValue = {
      ...foundProspectCategoryWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        foundProspectCategoryWithDetails,
        'ProspectCategory'
      ),
    };

    // Log operation success
    logOperationSuccess('getProspectCategory', req, {
      id: foundProspectCategory.id,
    });

    res.status(200).json(prospectCategoryWithDisplayValue);
  } catch (error) {
    logOperationError('getProspectCategory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_prospect_category');
  }
}

async function updateProspectCategory(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateProspectCategory', req, {
    prospectCategoryId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await prospectCategoryUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateProspectCategory', req, error);
        throw handleValidationError(error, 'prospect_category_update');
      }
      logOperationError('updateProspectCategory', req, error);
      throw error;
    }

    // Log database operation start
    logDatabaseStart('update_prospect_category', req, {
      prospectCategoryId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.prospectCategory.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ProspectCategory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_prospect_category',
          details: { prospectCategoryId: params?.id },
        }
      );
      logOperationError('updateProspectCategory', req, error);
      throw error;
    }

    // Fetch the updated record for response
    const updatedProspectCategory = await prisma.prospectCategory.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });

    // Attach display value
    const prospectCategoryWithDisplayValue = {
      ...updatedProspectCategory,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        updatedProspectCategory,
        'ProspectCategory'
      ),
    };

    // Log database operation success
    logDatabaseSuccess('update_prospect_category', req, {
      id: updatedProspectCategory.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateProspectCategory', req, {
      id: updatedProspectCategory.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(prospectCategoryWithDisplayValue);
  } catch (error) {
    logOperationError('updateProspectCategory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_prospect_category');
  }
}

async function deleteProspectCategory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteProspectCategory', req, {
    user: user?.id,
    prospectCategoryId: params?.id,
  });

  try {
    // Cascade delete related records first
    await prisma.prospect.updateMany({
      where: { categoryId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_prospect_category', req, {
      prospectCategoryId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.prospectCategory.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_prospect_category', req, {
      deletedCount: result.count,
      prospectCategoryId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ProspectCategory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_prospect_category',
          details: { prospectCategoryId: params?.id },
        }
      );
      logOperationError('deleteProspectCategory', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteProspectCategory', req, {
      deletedCount: result.count,
      prospectCategoryId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteProspectCategory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_prospect_category');
  }
}

async function getProspectCategoryBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for prospectCategory',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllProspectCategory,
  createProspectCategory,
  getProspectCategory,
  updateProspectCategory,
  deleteProspectCategory,
  getProspectCategoryBarChartData,
};
