/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing customerEnquiryStatus using Prisma.
 * It includes functions for retrieving all customerEnquiryStatus, creating a new customerEnquiryStatus, retrieving a single customerEnquiryStatus,
 * updating an existing customerEnquiryStatus, and deleting a customerEnquiryStatus.
 *
 * The `getAllCustomerEnquiryStatus` function retrieves a paginated list of customerEnquiryStatus based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCustomerEnquiryStatus` function validates the request body using a Joi schema, generates a unique code
 * for the customerEnquiryStatus, and creates a new customerEnquiryStatus in the database with additional metadata.
 *
 * The `getCustomerEnquiryStatus` function retrieves a single customerEnquiryStatus based on the provided customerEnquiryStatus ID, with visibility
 * filters applied to ensure the customerEnquiryStatus is accessible to the requesting user.
 *
 * The `updateCustomerEnquiryStatus` function updates an existing customerEnquiryStatus in the database based on the provided customerEnquiryStatus ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCustomerEnquiryStatus` function deletes a customerEnquiryStatus from the database based on the provided customerEnquiryStatus ID, with
 * visibility filters applied to ensure the customerEnquiryStatus is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  customerEnquiryStatusCreate,
  customerEnquiryStatusUpdate,
} = require('#schemas/customerEnquiryStatus.schemas.js');
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

async function getAllCustomerEnquiryStatus(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllCustomerEnquiryStatus', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['color', 'name', 'description'];
    const filterFields = [...searchFields];

    const include = {};

    // Log database operation start
    logDatabaseStart('get_all_customer_enquiry_status', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: customerEnquiryStatusUpdate,
      filterFields,
      searchFields,
      model: 'customerEnquiryStatus',
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_customer_enquiry_status', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllCustomerEnquiryStatus', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllCustomerEnquiryStatus', req, error);
    throw handleDatabaseError(error, 'get_all_customer_enquiry_status');
  }
}

async function createCustomerEnquiryStatus(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createCustomerEnquiryStatus', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await customerEnquiryStatusCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createCustomerEnquiryStatus', req, error);
        throw handleValidationError(error, 'customer_enquiry_status_creation');
      }
      logOperationError('createCustomerEnquiryStatus', req, error);
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
    logDatabaseStart('create_customer_enquiry_status', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCustomerEnquiryStatus = await prisma.customerEnquiryStatus.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_customer_enquiry_status', req, {
      id: newCustomerEnquiryStatus.id,
      code: newCustomerEnquiryStatus.code,
    });

    const [newCustomerEnquiryStatusWithDetails] = await getDetailsFromAPI({
      results: [newCustomerEnquiryStatus],
      token: user?.accessToken,
    });

    // Log operation success
    logOperationSuccess('createCustomerEnquiryStatus', req, {
      id: newCustomerEnquiryStatus.id,
      code: newCustomerEnquiryStatus.code,
    });

    res.status(201).json(newCustomerEnquiryStatusWithDetails);
  } catch (error) {
    logOperationError('createCustomerEnquiryStatus', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_customer_enquiry_status');
  }
}

async function getCustomerEnquiryStatus(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getCustomerEnquiryStatus', req, {
    user: user?.id,
    customerEnquiryStatusId: params?.id,
  });

  try {
    const include = {};

    // Log database operation start
    logDatabaseStart('get_customer_enquiry_status', req, {
      customerEnquiryStatusId: params?.id,
      userId: user?.id,
    });

    const foundCustomerEnquiryStatus =
      await prisma.customerEnquiryStatus.findFirst({
        where: {
          id: params?.id,
          ...getVisibilityFilters(user),
        },
        include: Object.keys(include).length ? include : undefined,
      });

    // Log database operation success
    logDatabaseSuccess('get_customer_enquiry_status', req, {
      found: !!foundCustomerEnquiryStatus,
      customerEnquiryStatusId: params?.id,
    });

    if (!foundCustomerEnquiryStatus) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CustomerEnquiryStatus not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_customer_enquiry_status',
          details: { customerEnquiryStatusId: params?.id },
        }
      );
      logOperationError('getCustomerEnquiryStatus', req, error);
      throw error;
    }

    const [foundCustomerEnquiryStatusWithDetails] = await getDetailsFromAPI({
      results: [foundCustomerEnquiryStatus],
      token: user?.accessToken,
    });

    // Log operation success
    logOperationSuccess('getCustomerEnquiryStatus', req, {
      id: foundCustomerEnquiryStatus.id,
      code: foundCustomerEnquiryStatus.code,
    });

    res.status(200).json(foundCustomerEnquiryStatusWithDetails);
  } catch (error) {
    logOperationError('getCustomerEnquiryStatus', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_customer_enquiry_status');
  }
}

async function updateCustomerEnquiryStatus(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateCustomerEnquiryStatus', req, {
    customerEnquiryStatusId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await customerEnquiryStatusUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateCustomerEnquiryStatus', req, error);
        throw handleValidationError(error, 'customer_enquiry_status_update');
      }
      logOperationError('updateCustomerEnquiryStatus', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Log database operation start
    logDatabaseStart('update_customer_enquiry_status', req, {
      customerEnquiryStatusId: params?.id,
      updateFields: Object.keys(values),
    });

    // Guard: ensure record exists within visibility scope
    const currentCustomerEnquiryStatus =
      await prisma.customerEnquiryStatus.findFirst({
        where: { id: params?.id, ...getVisibilityFilters(user) },
        select: { id: true },
      });
    if (!currentCustomerEnquiryStatus) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CustomerEnquiryStatus not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_customer_enquiry_status',
          details: { customerEnquiryStatusId: params?.id },
        }
      );
      logOperationError('updateCustomerEnquiryStatus', req, error);
      throw error;
    }

    const updatedCustomerEnquiryStatus =
      await prisma.customerEnquiryStatus.update({
        where: { id: params?.id },
        data: {
          ...objectKeysToCamelCase(values),
          updatedBy: user?.id,
        },
      });

    // Log database operation success
    logDatabaseSuccess('update_customer_enquiry_status', req, {
      id: updatedCustomerEnquiryStatus.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateCustomerEnquiryStatus', req, {
      id: updatedCustomerEnquiryStatus.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(updatedCustomerEnquiryStatus);
  } catch (error) {
    logOperationError('updateCustomerEnquiryStatus', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_customer_enquiry_status');
  }
}

async function deleteCustomerEnquiryStatus(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteCustomerEnquiryStatus', req, {
    user: user?.id,
    customerEnquiryStatusId: params?.id,
  });

  try {
    await prisma.customerEnquiry.updateMany({
      where: { statusId: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_customer_enquiry_status', req, {
      customerEnquiryStatusId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.customerEnquiryStatus.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_customer_enquiry_status', req, {
      deletedCount: result.count,
      customerEnquiryStatusId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CustomerEnquiryStatus not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_customer_enquiry_status',
          details: { customerEnquiryStatusId: params?.id },
        }
      );
      logOperationError('deleteCustomerEnquiryStatus', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteCustomerEnquiryStatus', req, {
      deletedCount: result.count,
      customerEnquiryStatusId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteCustomerEnquiryStatus', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_customer_enquiry_status');
  }
}

async function getCustomerEnquiryStatusBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for customerEnquiryStatus',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCustomerEnquiryStatus,
  createCustomerEnquiryStatus,
  getCustomerEnquiryStatus,
  updateCustomerEnquiryStatus,
  deleteCustomerEnquiryStatus,
  getCustomerEnquiryStatusBarChartData,
};
