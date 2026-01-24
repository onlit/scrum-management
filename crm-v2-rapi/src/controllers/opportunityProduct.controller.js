/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing opportunityProduct using Prisma.
 * It includes functions for retrieving all opportunityProduct, creating a new opportunityProduct, retrieving a single opportunityProduct,
 * updating an existing opportunityProduct, and deleting a opportunityProduct.
 *
 * The `getAllOpportunityProduct` function retrieves a paginated list of opportunityProduct based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createOpportunityProduct` function validates the request body using a Joi schema, generates a unique code
 * for the opportunityProduct, and creates a new opportunityProduct in the database with additional metadata.
 *
 * The `getOpportunityProduct` function retrieves a single opportunityProduct based on the provided opportunityProduct ID, with visibility
 * filters applied to ensure the opportunityProduct is accessible to the requesting user.
 *
 * The `updateOpportunityProduct` function updates an existing opportunityProduct in the database based on the provided opportunityProduct ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteOpportunityProduct` function deletes a opportunityProduct from the database based on the provided opportunityProduct ID, with
 * visibility filters applied to ensure the opportunityProduct is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  opportunityProductCreate,
  opportunityProductUpdate,
} = require('#schemas/opportunityProduct.schemas.js');
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

async function getAllOpportunityProduct(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllOpportunityProduct', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['color'];
    const filterFields = [
      ...searchFields,
      'amount',
      'estimatedValue',
      'opportunityId',
      'productVariant',
    ];

    const include = {
      opportunity: true,
    };

    // Log database operation start
    logDatabaseStart('get_all_opportunity_product', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: opportunityProductUpdate,
      filterFields,
      searchFields,
      model: 'opportunityProduct',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values to all opportunity product records
    if (response?.results) {
      response.results = response.results.map((record) => ({
        ...record,
        [DISPLAY_VALUE_PROP]: computeDisplayValue(record, 'OpportunityProduct'),
      }));
    }

    // Log database operation success
    logDatabaseSuccess('get_all_opportunity_product', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllOpportunityProduct', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllOpportunityProduct', req, error);
    throw handleDatabaseError(error, 'get_all_opportunity_product');
  }
}

async function createOpportunityProduct(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createOpportunityProduct', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await opportunityProductCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createOpportunityProduct', req, error);
        throw handleValidationError(error, 'opportunity_product_creation');
      }
      logOperationError('createOpportunityProduct', req, error);
      throw error;
    }

    const modelRelationFields = ['opportunityId'];

    const include = {
      opportunity: true,
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
    logDatabaseStart('create_opportunity_product', req, {
      name: values.name,
      userId: user?.id,
    });

    const newOpportunityProduct = await prisma.opportunityProduct.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_opportunity_product', req, {
      id: newOpportunityProduct.id,
      code: newOpportunityProduct.code,
    });

    const [newOpportunityProductWithDetails] = await getDetailsFromAPI({
      results: [newOpportunityProduct],
      token: user?.accessToken,
    });

    // Attach display value
    const opportunityProductWithDisplayValue = {
      ...newOpportunityProductWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        newOpportunityProductWithDetails,
        'OpportunityProduct'
      ),
    };

    // Log operation success
    logOperationSuccess('createOpportunityProduct', req, {
      id: newOpportunityProduct.id,
      code: newOpportunityProduct.code,
    });

    res.status(201).json(opportunityProductWithDisplayValue);
  } catch (error) {
    logOperationError('createOpportunityProduct', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_opportunity_product');
  }
}

async function getOpportunityProduct(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getOpportunityProduct', req, {
    user: user?.id,
    opportunityProductId: params?.id,
  });

  try {
    const include = {
      opportunity: true,
    };

    // Log database operation start
    logDatabaseStart('get_opportunity_product', req, {
      opportunityProductId: params?.id,
      userId: user?.id,
    });

    const foundOpportunityProduct = await prisma.opportunityProduct.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_opportunity_product', req, {
      found: !!foundOpportunityProduct,
      opportunityProductId: params?.id,
    });

    if (!foundOpportunityProduct) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityProduct not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_opportunity_product',
          details: { opportunityProductId: params?.id },
        }
      );
      logOperationError('getOpportunityProduct', req, error);
      throw error;
    }

    const [foundOpportunityProductWithDetails] = await getDetailsFromAPI({
      results: [foundOpportunityProduct],
      token: user?.accessToken,
    });

    // Attach display value
    const opportunityProductWithDisplayValue = {
      ...foundOpportunityProductWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        foundOpportunityProductWithDetails,
        'OpportunityProduct'
      ),
    };

    // Log operation success
    logOperationSuccess('getOpportunityProduct', req, {
      id: foundOpportunityProduct.id,
      code: foundOpportunityProduct.code,
    });

    res.status(200).json(opportunityProductWithDisplayValue);
  } catch (error) {
    logOperationError('getOpportunityProduct', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_opportunity_product');
  }
}

async function updateOpportunityProduct(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateOpportunityProduct', req, {
    opportunityProductId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await opportunityProductUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateOpportunityProduct', req, error);
        throw handleValidationError(error, 'opportunity_product_update');
      }
      logOperationError('updateOpportunityProduct', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Log database operation start
    logDatabaseStart('update_opportunity_product', req, {
      opportunityProductId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.opportunityProduct.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityProduct not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_opportunity_product',
          details: { opportunityProductId: params?.id },
        }
      );
      throw error;
    }

    const updatedOpportunityProduct = await prisma.opportunityProduct.findFirst(
      {
        where: { id: params?.id, client: user?.client?.id, deleted: null },
      }
    );

    // Attach display value
    const opportunityProductWithDisplayValue = {
      ...updatedOpportunityProduct,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        updatedOpportunityProduct,
        'OpportunityProduct'
      ),
    };

    // Log database operation success
    logDatabaseSuccess('update_opportunity_product', req, {
      id: updatedOpportunityProduct.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateOpportunityProduct', req, {
      id: updatedOpportunityProduct.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(opportunityProductWithDisplayValue);
  } catch (error) {
    logOperationError('updateOpportunityProduct', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_opportunity_product');
  }
}

async function deleteOpportunityProduct(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteOpportunityProduct', req, {
    user: user?.id,
    opportunityProductId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('delete_opportunity_product', req, {
      opportunityProductId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.opportunityProduct.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_opportunity_product', req, {
      deletedCount: result.count,
      opportunityProductId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityProduct not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_opportunity_product',
          details: { opportunityProductId: params?.id },
        }
      );
      logOperationError('deleteOpportunityProduct', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteOpportunityProduct', req, {
      deletedCount: result.count,
      opportunityProductId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteOpportunityProduct', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_opportunity_product');
  }
}

async function getOpportunityProductBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for opportunityProduct',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllOpportunityProduct,
  createOpportunityProduct,
  getOpportunityProduct,
  updateOpportunityProduct,
  deleteOpportunityProduct,
  getOpportunityProductBarChartData,
};
