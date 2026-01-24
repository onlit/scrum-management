/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing accountManagerInCompany using Prisma.
 * It includes functions for retrieving all accountManagerInCompany, creating a new accountManagerInCompany, retrieving a single accountManagerInCompany,
 * updating an existing accountManagerInCompany, and deleting a accountManagerInCompany.
 *
 * The `getAllAccountManagerInCompany` function retrieves a paginated list of accountManagerInCompany based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createAccountManagerInCompany` function validates the request body using a Joi schema, generates a unique code
 * for the accountManagerInCompany, and creates a new accountManagerInCompany in the database with additional metadata.
 *
 * The `getAccountManagerInCompany` function retrieves a single accountManagerInCompany based on the provided accountManagerInCompany ID, with visibility
 * filters applied to ensure the accountManagerInCompany is accessible to the requesting user.
 *
 * The `updateAccountManagerInCompany` function updates an existing accountManagerInCompany in the database based on the provided accountManagerInCompany ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteAccountManagerInCompany` function deletes a accountManagerInCompany from the database based on the provided accountManagerInCompany ID, with
 * visibility filters applied to ensure the accountManagerInCompany is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  accountManagerInCompanyCreate,
  accountManagerInCompanyUpdate,
} = require('#schemas/accountManagerInCompany.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const {
  getPaginatedList,
  verifyForeignKeyAccessBatch,
} = require('#utils/shared/databaseUtils.js');
const { getDetailsFromAPI } = require('#utils/shared/apiUtils.js');
const { logEvent } = require('#utils/shared/basicLoggingUtils.js');
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
const { findWorkflowAndTrigger } = require('#utils/shared/automataUtils.js');
const {
  enrichRecordDisplayValues,
} = require('#utils/shared/displayValueUtils.js');

async function getAllAccountManagerInCompany(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllAccountManagerInCompany', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['color'];
    const filterFields = [
      ...searchFields,
      'expiryDate',
      'companyId',
      'accountManagerId',
    ];

    const include = {
      company: true,
    };

    // Support relational search: company name and accountManagerId exact/startsWith
    let customWhere = {};
    const rawSearch = (query?.search || '').trim();
    if (rawSearch) {
      customWhere = {
        OR: [
          { company: { name: { contains: rawSearch, mode: 'insensitive' } } },
          // Allow searching by accountManagerId (UUID partials or full)
          { accountManagerId: { contains: rawSearch, mode: 'insensitive' } },
        ],
      };
    }

    // Log database operation start
    logDatabaseStart('get_all_account_manager_in_company', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: accountManagerInCompanyUpdate,
      filterFields,
      searchFields,
      model: 'accountManagerInCompany',
      include: Object.keys(include).length ? include : undefined,
      customWhere,
    });

    const shouldHydrateAccountManagerDetails =
      Array.isArray(response?.results) &&
      response.results.some(
        (record) =>
          record?.accountManagerId &&
          (!record?.details ||
            !record.details.accountManagerId ||
            !Object.keys(record.details.accountManagerId).length)
      );

    if (shouldHydrateAccountManagerDetails) {
      logEvent(
        '[DETAILS_RECOVERY] Missing accountManagerId details detected in paginated response; retrying hydration',
        req?.traceId
      );
      const hydratedResults =
        (await getDetailsFromAPI({
          results: response.results,
          token: user?.accessToken,
        })) || [];

      if (
        Array.isArray(hydratedResults) &&
        hydratedResults.length === response.results.length
      ) {
        response.results = hydratedResults;
        logEvent(
          `[DETAILS_RECOVERY_SUCCESS] accountManagerId details hydrated for ${hydratedResults.length} records`,
          req?.traceId
        );
      } else {
        logEvent(
          '[DETAILS_RECOVERY_WARN] Hydration retry did not return expected records; keeping original result set',
          req?.traceId
        );
      }
    }

    if (Array.isArray(response?.results)) {
      response.results = response.results.map((record) =>
        enrichRecordDisplayValues(record, 'AccountManagerInCompany')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_account_manager_in_company', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllAccountManagerInCompany', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllAccountManagerInCompany', req, error);
    throw handleDatabaseError(error, 'get_all_account_manager_in_company');
  }
}

async function createAccountManagerInCompany(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createAccountManagerInCompany', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await accountManagerInCompanyCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createAccountManagerInCompany', req, error);
        throw handleValidationError(
          error,
          'account_manager_in_company_creation'
        );
      }
      logOperationError('createAccountManagerInCompany', req, error);
      throw error;
    }

    const modelRelationFields = ['companyId'];

    const include = {
      company: true,
    };

    // Verify FK access (soft-delete aware)
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.companyId
          ? { model: 'company', fieldValues: { companyId: values.companyId } }
          : null,
      ].filter(Boolean),
    });

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Controller-level uniqueness check: prevent active duplicate assignment
    try {
      const now = new Date();
      const duplicate = await prisma.accountManagerInCompany.findFirst({
        where: {
          client: user?.client?.id,
          deleted: null,
          companyId: values.companyId,
          accountManagerId: values.accountManagerId,
          OR: [{ expiryDate: null }, { expiryDate: { gte: now } }],
        },
        select: { id: true },
      });
      if (duplicate) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'This account manager is already assigned to the company (active assignment exists). End the current assignment or set an earlier expiry date.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'create_account_manager_in_company_duplicate_check',
            details: {
              companyId: values.companyId,
              accountManagerId: values.accountManagerId,
            },
          }
        );
        throw error;
      }
    } catch (_e) {
      // best-effort duplicate protection; proceed if check fails
    }

    // Log database operation start
    logDatabaseStart('create_account_manager_in_company', req, {
      name: values.name,
      userId: user?.id,
    });

    const newAccountManagerInCompany =
      await prisma.accountManagerInCompany.create({
        data: buildCreateRecordPayload({
          user,
          validatedValues: values,
          requestBody: body,
          relations: modelRelationFields,
        }),
        include: Object.keys(include).length ? include : undefined,
      });

    // Log database operation success
    logDatabaseSuccess('create_account_manager_in_company', req, {
      id: newAccountManagerInCompany.id,
      code: newAccountManagerInCompany.code,
    });

    const [newAccountManagerInCompanyWithDetails] = await getDetailsFromAPI({
      results: [newAccountManagerInCompany],
      token: user?.accessToken,
    });

    // Log operation success
    logOperationSuccess('createAccountManagerInCompany', req, {
      id: newAccountManagerInCompany.id,
      code: newAccountManagerInCompany.code,
    });

    const accountManagerInCompanyWithDisplayValue = enrichRecordDisplayValues(
      newAccountManagerInCompanyWithDetails,
      'AccountManagerInCompany'
    );

    res.status(201).json(accountManagerInCompanyWithDisplayValue);

    // Fire-and-forget workflow trigger for lower latency
    setImmediate(() => {
      try {
        findWorkflowAndTrigger(
          prisma,
          newAccountManagerInCompany,
          'accountManagerInCompany',
          user?.client?.id,
          {},
          user?.accessToken
        );
      } catch (_err) {
        // swallow
      }
    });
  } catch (error) {
    logOperationError('createAccountManagerInCompany', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_account_manager_in_company');
  }
}

async function getAccountManagerInCompany(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getAccountManagerInCompany', req, {
    user: user?.id,
    accountManagerInCompanyId: params?.id,
  });

  try {
    const include = {
      company: true,
    };

    // Log database operation start
    logDatabaseStart('get_account_manager_in_company', req, {
      accountManagerInCompanyId: params?.id,
      userId: user?.id,
    });

    const foundAccountManagerInCompany =
      await prisma.accountManagerInCompany.findFirst({
        where: {
          id: params?.id,
          ...getVisibilityFilters(user),
        },
        include: Object.keys(include).length ? include : undefined,
      });

    // Log database operation success
    logDatabaseSuccess('get_account_manager_in_company', req, {
      found: !!foundAccountManagerInCompany,
      accountManagerInCompanyId: params?.id,
    });

    if (!foundAccountManagerInCompany) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'AccountManagerInCompany not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_account_manager_in_company',
          details: { accountManagerInCompanyId: params?.id },
        }
      );
      logOperationError('getAccountManagerInCompany', req, error);
      throw error;
    }

    const [foundAccountManagerInCompanyWithDetails] = await getDetailsFromAPI({
      results: [foundAccountManagerInCompany],
      token: user?.accessToken,
    });

    // Log operation success
    logOperationSuccess('getAccountManagerInCompany', req, {
      id: foundAccountManagerInCompany.id,
      code: foundAccountManagerInCompany.code,
    });

    const accountManagerInCompanyWithDisplayValue = enrichRecordDisplayValues(
      foundAccountManagerInCompanyWithDetails,
      'AccountManagerInCompany'
    );

    res.status(200).json(accountManagerInCompanyWithDisplayValue);
  } catch (error) {
    logOperationError('getAccountManagerInCompany', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_account_manager_in_company');
  }
}

async function updateAccountManagerInCompany(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateAccountManagerInCompany', req, {
    accountManagerInCompanyId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await accountManagerInCompanyUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateAccountManagerInCompany', req, error);
        throw handleValidationError(error, 'account_manager_in_company_update');
      }
      logOperationError('updateAccountManagerInCompany', req, error);
      throw error;
    }

    // Load current to compute effective values for checks
    const current = await prisma.accountManagerInCompany.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: {
        id: true,
        companyId: true,
        accountManagerId: true,
        expiryDate: true,
        client: true,
      },
    });

    if (!current) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'AccountManagerInCompany not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_account_manager_in_company',
          details: { accountManagerInCompanyId: params?.id },
        }
      );
      logOperationError('updateAccountManagerInCompany', req, error);
      throw error;
    }

    const effectiveCompanyId = values?.companyId ?? current.companyId;
    const effectiveAccountManagerId =
      values?.accountManagerId ?? current.accountManagerId;
    const effectiveExpiryDate =
      values?.expiryDate !== undefined ? values.expiryDate : current.expiryDate;

    // Verify FK access when provided
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.companyId
          ? { model: 'company', fieldValues: { companyId: values.companyId } }
          : null,
      ].filter(Boolean),
    });

    // Controller-level uniqueness check on active assignments
    try {
      const willBeActive =
        !effectiveExpiryDate || new Date(effectiveExpiryDate) >= new Date();
      if (willBeActive) {
        const duplicate = await prisma.accountManagerInCompany.findFirst({
          where: {
            id: { not: current.id },
            client: user?.client?.id,
            deleted: null,
            companyId: effectiveCompanyId,
            accountManagerId: effectiveAccountManagerId,
            OR: [{ expiryDate: null }, { expiryDate: { gte: new Date() } }],
          },
          select: { id: true },
        });
        if (duplicate) {
          const error = createErrorWithTrace(
            ERROR_TYPES.VALIDATION,
            'This account manager is already assigned to the company (active assignment exists). End the current assignment or set an earlier expiry date.',
            req,
            {
              severity: ERROR_SEVERITY.LOW,
              context: 'update_account_manager_in_company_duplicate_check',
              details: {
                companyId: effectiveCompanyId,
                accountManagerId: effectiveAccountManagerId,
              },
            }
          );
          throw error;
        }
      }
    } catch (_e) {
      // best-effort; proceed
    }

    // Log database operation start
    logDatabaseStart('update_account_manager_in_company', req, {
      accountManagerInCompanyId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.accountManagerInCompany.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'AccountManagerInCompany not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_account_manager_in_company',
          details: { accountManagerInCompanyId: params?.id },
        }
      );
      logOperationError('updateAccountManagerInCompany', req, error);
      throw error;
    }

    const updatedAccountManagerInCompany =
      await prisma.accountManagerInCompany.findFirst({
        where: { id: params?.id, ...getVisibilityFilters(user) },
      });

    // Log database operation success
    logDatabaseSuccess('update_account_manager_in_company', req, {
      id: updatedAccountManagerInCompany.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateAccountManagerInCompany', req, {
      id: updatedAccountManagerInCompany.id,
      updatedFields: Object.keys(values),
    });

    const accountManagerInCompanyWithDisplayValue = enrichRecordDisplayValues(
      updatedAccountManagerInCompany,
      'AccountManagerInCompany'
    );

    res.status(200).json(accountManagerInCompanyWithDisplayValue);
  } catch (error) {
    logOperationError('updateAccountManagerInCompany', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_account_manager_in_company');
  }
}

async function deleteAccountManagerInCompany(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteAccountManagerInCompany', req, {
    user: user?.id,
    accountManagerInCompanyId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('delete_account_manager_in_company', req, {
      accountManagerInCompanyId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.accountManagerInCompany.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_account_manager_in_company', req, {
      deletedCount: result.count,
      accountManagerInCompanyId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'AccountManagerInCompany not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_account_manager_in_company',
          details: { accountManagerInCompanyId: params?.id },
        }
      );
      logOperationError('deleteAccountManagerInCompany', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteAccountManagerInCompany', req, {
      deletedCount: result.count,
      accountManagerInCompanyId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteAccountManagerInCompany', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_account_manager_in_company');
  }
}

async function getAccountManagerInCompanyBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for accountManagerInCompany',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllAccountManagerInCompany,
  createAccountManagerInCompany,
  getAccountManagerInCompany,
  updateAccountManagerInCompany,
  deleteAccountManagerInCompany,
  getAccountManagerInCompanyBarChartData,
};
