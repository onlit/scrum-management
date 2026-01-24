/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 09/10/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing prospectProduct using Prisma.
 * It includes functions for retrieving all prospectProduct, creating a new prospectProduct, retrieving a single prospectProduct,
 * updating an existing prospectProduct, and deleting a prospectProduct.
 *
 * The `getAllProspectProduct` function retrieves a paginated list of prospectProduct based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createProspectProduct` function validates the request body using a Joi schema, generates a unique code
 * for the prospectProduct, and creates a new prospectProduct in the database with additional metadata.
 *
 * The `getProspectProduct` function retrieves a single prospectProduct based on the provided prospectProduct ID, with visibility
 * filters applied to ensure the prospectProduct is accessible to the requesting user.
 *
 * The `updateProspectProduct` function updates an existing prospectProduct in the database based on the provided prospectProduct ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteProspectProduct` function deletes a prospectProduct from the database based on the provided prospectProduct ID, with
 * visibility filters applied to ensure the prospectProduct is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  prospectProductCreate,
  prospectProductUpdate,
} = require('#schemas/prospectProduct.schemas.js');
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

async function getAllProspectProduct(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllProspectProduct', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['tags', 'color'];
    const filterFields = [
      ...searchFields,
      'amount',
      'estimatedValue',
      'prospectId',
      'productVariantId',
    ];

    const include = {
      prospect: true,
    };

    // Log database operation start
    logDatabaseStart('get_all_prospect_product', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: prospectProductUpdate,
      filterFields,
      searchFields,
      model: 'prospectProduct',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values to all prospect products
    if (response?.results) {
      response.results = response.results.map((prospectProduct) => ({
        ...prospectProduct,
        [DISPLAY_VALUE_PROP]: computeDisplayValue(
          prospectProduct,
          'ProspectProduct'
        ),
      }));
    }

    // Log database operation success
    logDatabaseSuccess('get_all_prospect_product', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllProspectProduct', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllProspectProduct', req, error);
    throw handleDatabaseError(error, 'get_all_prospect_product');
  }
}

async function createProspectProduct(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createProspectProduct', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await prospectProductCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createProspectProduct', req, error);
        throw handleValidationError(error, 'prospect_product_creation');
      }
      logOperationError('createProspectProduct', req, error);
      throw error;
    }

    const modelRelationFields = ['prospectId', 'productVariantId'];

    const include = {
      prospect: true,
    };

    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.prospectId
          ? {
              model: 'prospect',
              fieldValues: { prospectId: values.prospectId },
            }
          : null,
        values?.productVariantId
          ? {
              model: 'productVariant',
              fieldValues: { productVariantId: values.productVariantId },
            }
          : null,
      ].filter(Boolean),
    });

    // Log database operation start
    logDatabaseStart('create_prospect_product', req, {
      prospectId: values.prospectId,
      userId: user?.id,
    });

    const newProspectProduct = await prisma.prospectProduct.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_prospect_product', req, {
      id: newProspectProduct.id,
    });

    const [newProspectProductWithDetails] = await getDetailsFromAPI({
      results: [newProspectProduct],
      token: user?.accessToken,
    });

    // Attach display value
    const prospectProductWithDisplayValue = {
      ...newProspectProductWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        newProspectProductWithDetails,
        'ProspectProduct'
      ),
    };

    // Log operation success
    logOperationSuccess('createProspectProduct', req, {
      id: newProspectProduct.id,
    });

    res.status(201).json(prospectProductWithDisplayValue);
  } catch (error) {
    logOperationError('createProspectProduct', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_prospect_product');
  }
}

async function getProspectProduct(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getProspectProduct', req, {
    user: user?.id,
    prospectProductId: params?.id,
  });

  try {
    const include = {
      prospect: true,
    };

    // Log database operation start
    logDatabaseStart('get_prospect_product', req, {
      prospectProductId: params?.id,
      userId: user?.id,
    });

    const foundProspectProduct = await prisma.prospectProduct.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_prospect_product', req, {
      found: !!foundProspectProduct,
      prospectProductId: params?.id,
    });

    if (!foundProspectProduct) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ProspectProduct not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_prospect_product',
          details: { prospectProductId: params?.id },
        }
      );
      logOperationError('getProspectProduct', req, error);
      throw error;
    }

    const [foundProspectProductWithDetails] = await getDetailsFromAPI({
      results: [foundProspectProduct],
      token: user?.accessToken,
    });

    // Attach display value
    const prospectProductWithDisplayValue = {
      ...foundProspectProductWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        foundProspectProductWithDetails,
        'ProspectProduct'
      ),
    };

    // Log operation success
    logOperationSuccess('getProspectProduct', req, {
      id: foundProspectProduct.id,
    });

    res.status(200).json(prospectProductWithDisplayValue);
  } catch (error) {
    logOperationError('getProspectProduct', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_prospect_product');
  }
}

async function updateProspectProduct(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateProspectProduct', req, {
    prospectProductId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await prospectProductUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateProspectProduct', req, error);
        throw handleValidationError(error, 'prospect_product_update');
      }
      logOperationError('updateProspectProduct', req, error);
      throw error;
    }

    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.prospectId
          ? {
              model: 'prospect',
              fieldValues: { prospectId: values.prospectId },
            }
          : null,
        values?.productVariantId
          ? {
              model: 'productVariant',
              fieldValues: { productVariantId: values.productVariantId },
            }
          : null,
      ].filter(Boolean),
    });

    // Log database operation start
    logDatabaseStart('update_prospect_product', req, {
      prospectProductId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.prospectProduct.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ProspectProduct not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_prospect_product',
          details: { prospectProductId: params?.id },
        }
      );
      logOperationError('updateProspectProduct', req, error);
      throw error;
    }

    // Fetch the updated record for response
    const updatedProspectProduct = await prisma.prospectProduct.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });

    // Attach display value
    const prospectProductWithDisplayValue = {
      ...updatedProspectProduct,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        updatedProspectProduct,
        'ProspectProduct'
      ),
    };

    // Log database operation success
    logDatabaseSuccess('update_prospect_product', req, {
      id: updatedProspectProduct.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateProspectProduct', req, {
      id: updatedProspectProduct.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(prospectProductWithDisplayValue);
  } catch (error) {
    logOperationError('updateProspectProduct', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_prospect_product');
  }
}

async function deleteProspectProduct(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteProspectProduct', req, {
    user: user?.id,
    prospectProductId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('delete_prospect_product', req, {
      prospectProductId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.prospectProduct.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_prospect_product', req, {
      deletedCount: result.count,
      prospectProductId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ProspectProduct not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_prospect_product',
          details: { prospectProductId: params?.id },
        }
      );
      logOperationError('deleteProspectProduct', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteProspectProduct', req, {
      deletedCount: result.count,
      prospectProductId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteProspectProduct', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_prospect_product');
  }
}

async function getProspectProductBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for prospectProduct',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllProspectProduct,
  createProspectProduct,
  getProspectProduct,
  updateProspectProduct,
  deleteProspectProduct,
  getProspectProductBarChartData,
};
