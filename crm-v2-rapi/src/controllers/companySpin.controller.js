/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing companySpin using Prisma.
 * It includes functions for retrieving all companySpin, creating a new companySpin, retrieving a single companySpin,
 * updating an existing companySpin, and deleting a companySpin.
 *
 * The `getAllCompanySpin` function retrieves a paginated list of companySpin based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCompanySpin` function validates the request body using a Joi schema, generates a unique code
 * for the companySpin, and creates a new companySpin in the database with additional metadata.
 *
 * The `getCompanySpin` function retrieves a single companySpin based on the provided companySpin ID, with visibility
 * filters applied to ensure the companySpin is accessible to the requesting user.
 *
 * The `updateCompanySpin` function updates an existing companySpin in the database based on the provided companySpin ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCompanySpin` function deletes a companySpin from the database based on the provided companySpin ID, with
 * visibility filters applied to ensure the companySpin is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  companySpinCreate,
  companySpinUpdate,
} = require('#schemas/companySpin.schemas.js');
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

async function getAllCompanySpin(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllCompanySpin', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = [
      'situation',
      'implication',
      'need',
      'notes',
      'color',
      'problem',
    ];
    const filterFields = [...searchFields, 'companyId', 'buyerInfluence'];

    const include = {
      company: true,
    };

    // Log database operation start
    logDatabaseStart('get_all_company_spin', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: companySpinUpdate,
      filterFields,
      searchFields,
      model: 'companySpin',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values (including nested relations)
    if (response?.results) {
      response.results = response.results.map((record) =>
        enrichRecordDisplayValues(record, 'CompanySpin')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_company_spin', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllCompanySpin', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllCompanySpin', req, error);
    throw handleDatabaseError(error, 'get_all_company_spin');
  }
}

async function createCompanySpin(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createCompanySpin', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await companySpinCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createCompanySpin', req, error);
        throw handleValidationError(error, 'company_spin_creation');
      }
      logOperationError('createCompanySpin', req, error);
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
    logDatabaseStart('create_company_spin', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCompanySpin = await prisma.companySpin.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_company_spin', req, {
      id: newCompanySpin.id,
      code: newCompanySpin.code,
    });

    const [newCompanySpinWithDetails] = await getDetailsFromAPI({
      results: [newCompanySpin],
      token: user?.accessToken,
    });

    // Attach display value
    const companySpinWithDisplayValue = enrichRecordDisplayValues(
      newCompanySpinWithDetails,
      'CompanySpin'
    );

    // Log operation success
    logOperationSuccess('createCompanySpin', req, {
      id: newCompanySpin.id,
      code: newCompanySpin.code,
    });

    res.status(201).json(companySpinWithDisplayValue);
  } catch (error) {
    logOperationError('createCompanySpin', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_company_spin');
  }
}

async function getCompanySpin(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getCompanySpin', req, {
    user: user?.id,
    companySpinId: params?.id,
  });

  try {
    const include = {
      company: true,
    };

    // Log database operation start
    logDatabaseStart('get_company_spin', req, {
      companySpinId: params?.id,
      userId: user?.id,
    });

    const foundCompanySpin = await prisma.companySpin.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_company_spin', req, {
      found: !!foundCompanySpin,
      companySpinId: params?.id,
    });

    if (!foundCompanySpin) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanySpin not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_company_spin',
          details: { companySpinId: params?.id },
        }
      );
      logOperationError('getCompanySpin', req, error);
      throw error;
    }

    const [foundCompanySpinWithDetails] = await getDetailsFromAPI({
      results: [foundCompanySpin],
      token: user?.accessToken,
    });

    // Attach display value
    const companySpinWithDisplayValue = enrichRecordDisplayValues(
      foundCompanySpinWithDetails,
      'CompanySpin'
    );

    // Log operation success
    logOperationSuccess('getCompanySpin', req, {
      id: foundCompanySpin.id,
      code: foundCompanySpin.code,
    });

    res.status(200).json(companySpinWithDisplayValue);
  } catch (error) {
    logOperationError('getCompanySpin', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_company_spin');
  }
}

async function updateCompanySpin(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateCompanySpin', req, {
    companySpinId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await companySpinUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateCompanySpin', req, error);
        throw handleValidationError(error, 'company_spin_update');
      }
      logOperationError('updateCompanySpin', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Log database operation start
    logDatabaseStart('update_company_spin', req, {
      companySpinId: params?.id,
      updateFields: Object.keys(values),
    });

    const updatedCompanySpin = await prisma.companySpin.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('update_company_spin', req, {
      id: updatedCompanySpin.id,
      updatedFields: Object.keys(values),
    });

    // Attach display value
    const companySpinWithDisplayValue = enrichRecordDisplayValues(
      updatedCompanySpin,
      'CompanySpin'
    );

    // Log operation success
    logOperationSuccess('updateCompanySpin', req, {
      id: updatedCompanySpin.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(companySpinWithDisplayValue);
  } catch (error) {
    logOperationError('updateCompanySpin', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_company_spin');
  }
}

async function deleteCompanySpin(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteCompanySpin', req, {
    user: user?.id,
    companySpinId: params?.id,
  });

  try {
    await prisma.opportunity.updateMany({
      where: {
        economicBuyerInfluenceId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    await prisma.opportunity.updateMany({
      where: {
        technicalBuyerInfluenceId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    await prisma.opportunity.updateMany({
      where: {
        userBuyerInfluenceId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_company_spin', req, {
      companySpinId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.companySpin.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_company_spin', req, {
      deletedCount: result.count,
      companySpinId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanySpin not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_company_spin',
          details: { companySpinId: params?.id },
        }
      );
      logOperationError('deleteCompanySpin', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteCompanySpin', req, {
      deletedCount: result.count,
      companySpinId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteCompanySpin', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_company_spin');
  }
}

async function getCompanySpinBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for companySpin',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCompanySpin,
  createCompanySpin,
  getCompanySpin,
  updateCompanySpin,
  deleteCompanySpin,
  getCompanySpinBarChartData,
};
