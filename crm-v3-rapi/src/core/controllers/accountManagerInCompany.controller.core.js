/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
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
const { getRegistry } = require('#domain/interceptors/interceptor.registry.js');
const {
  createQueryBuilder,
  QueryBuilder,
} = require('#core/interfaces/query-builder.interface.js');
const {
  accountManagerInCompanyCreate,
  accountManagerInCompanyUpdate,
  accountManagerInCompanyBulkVisibilityUpdate,
} = require('#core/schemas/accountManagerInCompany.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('AccountManagerInCompany');
const { objectKeysToCamelCase } = require('#utils/generalUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/visibilityUtils.js');
const { getPaginatedList } = require('#utils/databaseUtils.js');
const { getDetailsFromAPI } = require('#utils/apiUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
  assertValidUuidParam,
} = require('#utils/traceUtils.js');
const {
  validateWithSchema,
  checkInterceptorHalt,
  handleControllerError,
  createOperationContext,
} = require('#utils/controllerUtils.js');
const {
  computeDisplayValue,
  DISPLAY_VALUE_PROP,
  attachNestedDisplayValues,
} = require('#utils/displayValueUtils.js');
const {
  batchHydrateRelationsInList,
  hydrateRelationsOnRecord,
} = require('#utils/nestedHydrationUtils.js');

// Model name literal used for display-value maps
const MODEL_NAME_LITERAL = 'AccountManagerInCompany';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/accountManagerInCompany.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateAccountManagerInCompanyVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(
    req,
    'AccountManagerInCompany',
    'update',
  );

  logOperationStart('bulkUpdateAccountManagerInCompanyVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      accountManagerInCompanyBulkVisibilityUpdate,
      body,
      req,
      'account_manager_in_company_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context:
            'bulk_update_account_manager_in_company_visibility_client_guard',
        },
      );
      throw error;
    }

    // Guard: only system administrators can perform this action
    if (
      !Array.isArray(user?.roleNames) ||
      !user.roleNames.includes('System Administrator')
    ) {
      const error = createErrorWithTrace(
        ERROR_TYPES.AUTHORIZATION,
        'Sorry, you do not have permissions to update visibility.',
        req,
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context:
            'bulk_update_account_manager_in_company_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_account_manager_in_company_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.accountManagerInCompany.updateMany({
      where: {
        id: { in: ids },
        deleted: null,
        ...getVisibilityFilters(user),
      },
      data: {
        ...visibilityValues,
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess(
      'bulk_update_account_manager_in_company_visibility',
      req,
      {
        updatedCount: result.count,
      },
    );

    // Log operation success
    logOperationSuccess('bulkUpdateAccountManagerInCompanyVisibility', req, {
      updatedCount: result.count,
    });

    res.status(200).json({
      updatedCount: result.count,
    });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      context,
      operationName: 'bulk_update_account_manager_in_company_visibility',
    });
    if (handled) return;
  }
}

async function getAllAccountManagerInCompany(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('AccountManagerInCompany');
  const context = createOperationContext(
    req,
    'AccountManagerInCompany',
    'list',
    { queryBuilder },
  );

  logOperationStart('getAllAccountManagerInCompany', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    // Lifecycle: beforeList - modify query builder or filters
    const beforeListResult = await interceptor.beforeList(
      queryBuilder,
      context,
    );
    if (checkInterceptorHalt(beforeListResult, res)) return;

    // Get modified query builder (interceptor can return new builder or plain query object)
    const modifiedBuilder =
      beforeListResult.data instanceof QueryBuilder
        ? beforeListResult.data
        : queryBuilder;

    // Extract any additional query modifications from the builder
    const builderQuery = modifiedBuilder.build();
    const modifiedQuery = { ...query, ...builderQuery };

    const searchFields = [];
    const filterFields = [
      ...searchFields,
      'companyId',
      'expiryDate',
      'accountManagerId',
    ];

    const include = {
      company: true,
    };

    // Build customWhere from domain filter handlers (for relation-based filters)
    const customWhere = {};
    const queryForDb = { ...modifiedQuery };
    for (const [field, handler] of Object.entries(domainFilterHandlers)) {
      if (queryForDb[field] !== undefined) {
        Object.assign(customWhere, handler(queryForDb[field]));
        delete queryForDb[field];
      }
    }

    // Log database operation start
    logDatabaseStart('get_all_account_manager_in_company', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: accountManagerInCompanyUpdate,
      filterFields,
      searchFields,
      model: 'accountManagerInCompany',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_account_manager_in_company', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    await batchHydrateRelationsInList(response, ['company'], user?.accessToken);

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        attachNestedDisplayValues(r, [
          { relation: 'company', model: 'Company' },
        ]);
        const dv = computeDisplayValue(r, MODEL_NAME_LITERAL, displayOptions);
        return dv ? { ...r, [DISPLAY_VALUE_PROP]: dv } : r;
      });
    }

    // Lifecycle: afterList - transform response
    const afterListResult = await interceptor.afterList(response, context);
    const finalResponse = afterListResult.data;

    // Log operation success
    logOperationSuccess('getAllAccountManagerInCompany', req, {
      count: finalResponse?.results?.length || 0,
      total: finalResponse?.totalCount || 0,
    });

    res.status(200).json(finalResponse);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_all_account_manager_in_company',
    });
    if (handled) return;
  }
}

async function createAccountManagerInCompany(req, res) {
  const { user, body } = req;
  const context = createOperationContext(
    req,
    'AccountManagerInCompany',
    'create',
  );

  logOperationStart('createAccountManagerInCompany', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = accountManagerInCompanyCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'account_manager_in_company_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = ['companyId'];

    const include = {
      company: true,
    };

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // @gen:ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Lifecycle: beforeCreate - pre-database logic
    const beforeCreateResult = await interceptor.beforeCreate(values, context);
    if (checkInterceptorHalt(beforeCreateResult, res)) return;
    values = beforeCreateResult.data;

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

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newAccountManagerInCompanyWithDetails,
      ['company'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newAccountManagerInCompanyWithDetails, [
      { relation: 'company', model: 'Company' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newAccountManagerInCompanyWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? {
          ...newAccountManagerInCompanyWithDetails,
          [DISPLAY_VALUE_PROP]: createdDv,
        }
      : newAccountManagerInCompanyWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createAccountManagerInCompany', req, {
      id: newAccountManagerInCompany.id,
      code: newAccountManagerInCompany.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_account_manager_in_company',
    });
    if (handled) return;
  }
}

async function getAccountManagerInCompany(req, res) {
  const { params, user } = req;
  const context = createOperationContext(
    req,
    'AccountManagerInCompany',
    'read',
  );

  logOperationStart('getAccountManagerInCompany', req, {
    user: user?.id,
    accountManagerInCompanyId: params?.id,
  });

  try {
    assertValidUuidParam(
      params?.id,
      req,
      'get_account_manager_in_company_param',
    );

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

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
        },
      );
      logOperationError('getAccountManagerInCompany', req, error);
      throw error;
    }

    const [foundAccountManagerInCompanyWithDetails] = await getDetailsFromAPI({
      results: [foundAccountManagerInCompany],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundAccountManagerInCompanyWithDetails,
      ['company'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundAccountManagerInCompanyWithDetails, [
      { relation: 'company', model: 'Company' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundAccountManagerInCompanyWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? {
          ...foundAccountManagerInCompanyWithDetails,
          [DISPLAY_VALUE_PROP]: foundDv,
        }
      : foundAccountManagerInCompanyWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getAccountManagerInCompany', req, {
      id: foundAccountManagerInCompany.id,
      code: foundAccountManagerInCompany.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_account_manager_in_company',
    });
    if (handled) return;
  }
}

async function updateAccountManagerInCompany(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(
    req,
    'AccountManagerInCompany',
    'update',
  );

  logOperationStart('updateAccountManagerInCompany', req, {
    accountManagerInCompanyId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(
      params?.id,
      req,
      'update_account_manager_in_company_param',
    );

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = accountManagerInCompanyUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'account_manager_in_company_update',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // @gen:ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Lifecycle: beforeUpdate - pre-database logic
    const beforeUpdateResult = await interceptor.beforeUpdate(values, context);
    if (checkInterceptorHalt(beforeUpdateResult, res)) return;
    values = beforeUpdateResult.data;

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
        },
      );
      throw error;
    }

    const updatedAccountManagerInCompany =
      await prisma.accountManagerInCompany.findFirst({
        where: { id: params?.id, client: user?.client?.id, deleted: null },
      });

    // Log database operation success
    logDatabaseSuccess('update_account_manager_in_company', req, {
      id: updatedAccountManagerInCompany.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedAccountManagerInCompany,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedAccountManagerInCompany, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedAccountManagerInCompany;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateAccountManagerInCompany', req, {
      id: updatedAccountManagerInCompany.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_account_manager_in_company',
    });
    if (handled) return;
  }
}

async function deleteAccountManagerInCompany(req, res) {
  const { params, user } = req;
  const context = createOperationContext(
    req,
    'AccountManagerInCompany',
    'delete',
  );

  logOperationStart('deleteAccountManagerInCompany', req, {
    user: user?.id,
    accountManagerInCompanyId: params?.id,
  });

  try {
    assertValidUuidParam(
      params?.id,
      req,
      'delete_account_manager_in_company_param',
    );

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    // Log database operation start
    logDatabaseStart('delete_account_manager_in_company', req, {
      accountManagerInCompanyId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.accountManagerInCompany.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
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
        },
      );
      logOperationError('deleteAccountManagerInCompany', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteAccountManagerInCompany', req, {
      deletedCount: result.count,
      accountManagerInCompanyId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_account_manager_in_company',
    });
    if (handled) return;
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
  bulkUpdateAccountManagerInCompanyVisibility,
};
