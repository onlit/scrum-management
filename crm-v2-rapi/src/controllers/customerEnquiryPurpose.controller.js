/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing customerEnquiryPurpose using Prisma.
 * It includes functions for retrieving all customerEnquiryPurpose, creating a new customerEnquiryPurpose, retrieving a single customerEnquiryPurpose,
 * updating an existing customerEnquiryPurpose, and deleting a customerEnquiryPurpose.
 *
 * The `getAllCustomerEnquiryPurpose` function retrieves a paginated list of customerEnquiryPurpose based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCustomerEnquiryPurpose` function validates the request body using a Joi schema, generates a unique code
 * for the customerEnquiryPurpose, and creates a new customerEnquiryPurpose in the database with additional metadata.
 *
 * The `getCustomerEnquiryPurpose` function retrieves a single customerEnquiryPurpose based on the provided customerEnquiryPurpose ID, with visibility
 * filters applied to ensure the customerEnquiryPurpose is accessible to the requesting user.
 *
 * The `updateCustomerEnquiryPurpose` function updates an existing customerEnquiryPurpose in the database based on the provided customerEnquiryPurpose ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCustomerEnquiryPurpose` function deletes a customerEnquiryPurpose from the database based on the provided customerEnquiryPurpose ID, with
 * visibility filters applied to ensure the customerEnquiryPurpose is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  customerEnquiryPurposeCreate,
  customerEnquiryPurposeUpdate,
} = require('#schemas/customerEnquiryPurpose.schemas.js');
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

async function getAllCustomerEnquiryPurpose(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllCustomerEnquiryPurpose', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['name', 'description', 'color'];
    const filterFields = [...searchFields];

    const include = {};

    // Log database operation start
    logDatabaseStart('get_all_customer_enquiry_purpose', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: customerEnquiryPurposeUpdate,
      filterFields,
      searchFields,
      model: 'customerEnquiryPurpose',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values to all customer enquiry purposes
    if (response?.results) {
      response.results = response.results.map((item) => ({
        ...item,
        [DISPLAY_VALUE_PROP]: computeDisplayValue(
          item,
          'CustomerEnquiryPurpose'
        ),
      }));
    }

    // Log database operation success
    logDatabaseSuccess('get_all_customer_enquiry_purpose', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllCustomerEnquiryPurpose', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllCustomerEnquiryPurpose', req, error);
    throw handleDatabaseError(error, 'get_all_customer_enquiry_purpose');
  }
}

async function createCustomerEnquiryPurpose(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createCustomerEnquiryPurpose', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await customerEnquiryPurposeCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createCustomerEnquiryPurpose', req, error);
        throw handleValidationError(error, 'customer_enquiry_purpose_creation');
      }
      logOperationError('createCustomerEnquiryPurpose', req, error);
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
    logDatabaseStart('create_customer_enquiry_purpose', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCustomerEnquiryPurpose =
      await prisma.customerEnquiryPurpose.create({
        data: buildCreateRecordPayload({
          user,
          validatedValues: values,
          requestBody: body,
          relations: modelRelationFields,
        }),
        include: Object.keys(include).length ? include : undefined,
      });

    // Log database operation success
    logDatabaseSuccess('create_customer_enquiry_purpose', req, {
      id: newCustomerEnquiryPurpose.id,
      code: newCustomerEnquiryPurpose.code,
    });

    const [newCustomerEnquiryPurposeWithDetails] = await getDetailsFromAPI({
      results: [newCustomerEnquiryPurpose],
      token: user?.accessToken,
    });

    // Attach display value
    const createdWithDisplayValue = {
      ...newCustomerEnquiryPurposeWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        newCustomerEnquiryPurposeWithDetails,
        'CustomerEnquiryPurpose'
      ),
    };

    // Log operation success
    logOperationSuccess('createCustomerEnquiryPurpose', req, {
      id: newCustomerEnquiryPurpose.id,
      code: newCustomerEnquiryPurpose.code,
    });

    res.status(201).json(createdWithDisplayValue);
  } catch (error) {
    logOperationError('createCustomerEnquiryPurpose', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_customer_enquiry_purpose');
  }
}

async function getCustomerEnquiryPurpose(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getCustomerEnquiryPurpose', req, {
    user: user?.id,
    customerEnquiryPurposeId: params?.id,
  });

  try {
    const include = {};

    // Log database operation start
    logDatabaseStart('get_customer_enquiry_purpose', req, {
      customerEnquiryPurposeId: params?.id,
      userId: user?.id,
    });

    const foundCustomerEnquiryPurpose =
      await prisma.customerEnquiryPurpose.findFirst({
        where: {
          id: params?.id,
          ...getVisibilityFilters(user),
        },
        include: Object.keys(include).length ? include : undefined,
      });

    // Log database operation success
    logDatabaseSuccess('get_customer_enquiry_purpose', req, {
      found: !!foundCustomerEnquiryPurpose,
      customerEnquiryPurposeId: params?.id,
    });

    if (!foundCustomerEnquiryPurpose) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CustomerEnquiryPurpose not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_customer_enquiry_purpose',
          details: { customerEnquiryPurposeId: params?.id },
        }
      );
      logOperationError('getCustomerEnquiryPurpose', req, error);
      throw error;
    }

    const [foundCustomerEnquiryPurposeWithDetails] = await getDetailsFromAPI({
      results: [foundCustomerEnquiryPurpose],
      token: user?.accessToken,
    });

    // Attach display value
    const itemWithDisplayValue = {
      ...foundCustomerEnquiryPurposeWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        foundCustomerEnquiryPurposeWithDetails,
        'CustomerEnquiryPurpose'
      ),
    };

    // Log operation success
    logOperationSuccess('getCustomerEnquiryPurpose', req, {
      id: foundCustomerEnquiryPurpose.id,
      code: foundCustomerEnquiryPurpose.code,
    });

    res.status(200).json(itemWithDisplayValue);
  } catch (error) {
    logOperationError('getCustomerEnquiryPurpose', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_customer_enquiry_purpose');
  }
}

async function updateCustomerEnquiryPurpose(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateCustomerEnquiryPurpose', req, {
    customerEnquiryPurposeId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await customerEnquiryPurposeUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateCustomerEnquiryPurpose', req, error);
        throw handleValidationError(error, 'customer_enquiry_purpose_update');
      }
      logOperationError('updateCustomerEnquiryPurpose', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Log database operation start
    logDatabaseStart('update_customer_enquiry_purpose', req, {
      customerEnquiryPurposeId: params?.id,
      updateFields: Object.keys(values),
    });

    // Guard: ensure record exists within visibility scope
    const currentCustomerEnquiryPurpose =
      await prisma.customerEnquiryPurpose.findFirst({
        where: { id: params?.id, ...getVisibilityFilters(user) },
        select: { id: true },
      });
    if (!currentCustomerEnquiryPurpose) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CustomerEnquiryPurpose not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_customer_enquiry_purpose',
          details: { customerEnquiryPurposeId: params?.id },
        }
      );
      logOperationError('updateCustomerEnquiryPurpose', req, error);
      throw error;
    }

    const updatedCustomerEnquiryPurpose =
      await prisma.customerEnquiryPurpose.update({
        where: { id: params?.id },
        data: {
          ...objectKeysToCamelCase(values),
          updatedBy: user?.id,
        },
      });

    // Log database operation success
    logDatabaseSuccess('update_customer_enquiry_purpose', req, {
      id: updatedCustomerEnquiryPurpose.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateCustomerEnquiryPurpose', req, {
      id: updatedCustomerEnquiryPurpose.id,
      updatedFields: Object.keys(values),
    });

    // Attach display value
    const updatedWithDisplayValue = {
      ...updatedCustomerEnquiryPurpose,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        updatedCustomerEnquiryPurpose,
        'CustomerEnquiryPurpose'
      ),
    };

    res.status(200).json(updatedWithDisplayValue);
  } catch (error) {
    logOperationError('updateCustomerEnquiryPurpose', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_customer_enquiry_purpose');
  }
}

async function deleteCustomerEnquiryPurpose(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteCustomerEnquiryPurpose', req, {
    user: user?.id,
    customerEnquiryPurposeId: params?.id,
  });

  try {
    await prisma.customerEnquiry.updateMany({
      where: { purposeId: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_customer_enquiry_purpose', req, {
      customerEnquiryPurposeId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.customerEnquiryPurpose.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_customer_enquiry_purpose', req, {
      deletedCount: result.count,
      customerEnquiryPurposeId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CustomerEnquiryPurpose not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_customer_enquiry_purpose',
          details: { customerEnquiryPurposeId: params?.id },
        }
      );
      logOperationError('deleteCustomerEnquiryPurpose', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteCustomerEnquiryPurpose', req, {
      deletedCount: result.count,
      customerEnquiryPurposeId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteCustomerEnquiryPurpose', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_customer_enquiry_purpose');
  }
}

async function getCustomerEnquiryPurposeBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for customerEnquiryPurpose',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCustomerEnquiryPurpose,
  createCustomerEnquiryPurpose,
  getCustomerEnquiryPurpose,
  updateCustomerEnquiryPurpose,
  deleteCustomerEnquiryPurpose,
  getCustomerEnquiryPurposeBarChartData,
};
