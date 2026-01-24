/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing companyHistory using Prisma.
 * It includes functions for retrieving all companyHistory, creating a new companyHistory, retrieving a single companyHistory,
 * updating an existing companyHistory, and deleting a companyHistory.
 *
 * The `getAllCompanyHistory` function retrieves a paginated list of companyHistory based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCompanyHistory` function validates the request body using a Joi schema, generates a unique code
 * for the companyHistory, and creates a new companyHistory in the database with additional metadata.
 *
 * The `getCompanyHistory` function retrieves a single companyHistory based on the provided companyHistory ID, with visibility
 * filters applied to ensure the companyHistory is accessible to the requesting user.
 *
 * The `updateCompanyHistory` function updates an existing companyHistory in the database based on the provided companyHistory ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCompanyHistory` function deletes a companyHistory from the database based on the provided companyHistory ID, with
 * visibility filters applied to ensure the companyHistory is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  companyHistoryCreate,
  companyHistoryUpdate,
} = require('#schemas/companyHistory.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
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
const {
  enrichRecordDisplayValues,
} = require('#utils/shared/displayValueUtils.js');

async function getAllCompanyHistory(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllCompanyHistory', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['history', 'color', 'notes'];
    const filterFields = [...searchFields, 'companyId'];

    const include = {
      company: true,
    };

    // Log database operation start
    logDatabaseStart('get_all_company_history', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: companyHistoryUpdate,
      filterFields,
      searchFields,
      model: 'companyHistory',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values (including nested relations)
    if (response?.results) {
      response.results = response.results.map((record) =>
        enrichRecordDisplayValues(record, 'CompanyHistory')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_company_history', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllCompanyHistory', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllCompanyHistory', req, error);
    throw handleDatabaseError(error, 'get_all_company_history');
  }
}

async function createCompanyHistory(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createCompanyHistory', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await companyHistoryCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createCompanyHistory', req, error);
        throw handleValidationError(error, 'company_history_creation');
      }
      logOperationError('createCompanyHistory', req, error);
      throw error;
    }

    const modelRelationFields = ['companyId'];

    const include = {
      company: true,
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
    logDatabaseStart('create_company_history', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCompanyHistory = await prisma.companyHistory.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_company_history', req, {
      id: newCompanyHistory.id,
      code: newCompanyHistory.code,
    });

    const [newCompanyHistoryWithDetails] = await getDetailsFromAPI({
      results: [newCompanyHistory],
      token: user?.accessToken,
    });

    // Attach display value
    const companyHistoryWithDisplayValue = enrichRecordDisplayValues(
      newCompanyHistoryWithDetails,
      'CompanyHistory'
    );

    // Log operation success
    logOperationSuccess('createCompanyHistory', req, {
      id: newCompanyHistory.id,
      code: newCompanyHistory.code,
    });

    res.status(201).json(companyHistoryWithDisplayValue);
  } catch (error) {
    logOperationError('createCompanyHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_company_history');
  }
}

async function getCompanyHistory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getCompanyHistory', req, {
    user: user?.id,
    companyHistoryId: params?.id,
  });

  try {
    const include = {
      company: true,
    };

    // Log database operation start
    logDatabaseStart('get_company_history', req, {
      companyHistoryId: params?.id,
      userId: user?.id,
    });

    const foundCompanyHistory = await prisma.companyHistory.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_company_history', req, {
      found: !!foundCompanyHistory,
      companyHistoryId: params?.id,
    });

    if (!foundCompanyHistory) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanyHistory not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_company_history',
          details: { companyHistoryId: params?.id },
        }
      );
      logOperationError('getCompanyHistory', req, error);
      throw error;
    }

    const [foundCompanyHistoryWithDetails] = await getDetailsFromAPI({
      results: [foundCompanyHistory],
      token: user?.accessToken,
    });

    // Attach display value
    const companyHistoryWithDisplayValue = enrichRecordDisplayValues(
      foundCompanyHistoryWithDetails,
      'CompanyHistory'
    );

    // Log operation success
    logOperationSuccess('getCompanyHistory', req, {
      id: foundCompanyHistory.id,
      code: foundCompanyHistory.code,
    });

    res.status(200).json(companyHistoryWithDisplayValue);
  } catch (error) {
    logOperationError('getCompanyHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_company_history');
  }
}

async function updateCompanyHistory(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateCompanyHistory', req, {
    companyHistoryId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await companyHistoryUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateCompanyHistory', req, error);
        throw handleValidationError(error, 'company_history_update');
      }
      logOperationError('updateCompanyHistory', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Guard: ensure visibility before update
    const current = await prisma.companyHistory.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: { id: true },
    });
    if (!current) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanyHistory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_company_history',
          details: { companyHistoryId: params?.id },
        }
      );
      logOperationError('updateCompanyHistory', req, error);
      throw error;
    }

    // Log database operation start
    logDatabaseStart('update_company_history', req, {
      companyHistoryId: params?.id,
      updateFields: Object.keys(values),
    });

    const updatedCompanyHistory = await prisma.companyHistory.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('update_company_history', req, {
      id: updatedCompanyHistory.id,
      updatedFields: Object.keys(values),
    });

    // Attach display value
    const companyHistoryWithDisplayValue = enrichRecordDisplayValues(
      updatedCompanyHistory,
      'CompanyHistory'
    );

    // Log operation success
    logOperationSuccess('updateCompanyHistory', req, {
      id: updatedCompanyHistory.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(companyHistoryWithDisplayValue);
  } catch (error) {
    logOperationError('updateCompanyHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_company_history');
  }
}

async function deleteCompanyHistory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteCompanyHistory', req, {
    user: user?.id,
    companyHistoryId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('delete_company_history', req, {
      companyHistoryId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.companyHistory.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_company_history', req, {
      deletedCount: result.count,
      companyHistoryId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanyHistory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_company_history',
          details: { companyHistoryId: params?.id },
        }
      );
      logOperationError('deleteCompanyHistory', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteCompanyHistory', req, {
      deletedCount: result.count,
      companyHistoryId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteCompanyHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_company_history');
  }
}

async function getCompanyHistoryBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for companyHistory',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCompanyHistory,
  createCompanyHistory,
  getCompanyHistory,
  updateCompanyHistory,
  deleteCompanyHistory,
  getCompanyHistoryBarChartData,
};
