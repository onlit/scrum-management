/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
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
const { getRegistry } = require('#domain/interceptors/interceptor.registry.js');
const {
  createQueryBuilder,
  QueryBuilder,
} = require('#core/interfaces/query-builder.interface.js');
const {
  companySpinCreate,
  companySpinUpdate,
  companySpinBulkVisibilityUpdate,
} = require('#core/schemas/companySpin.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('CompanySpin');
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
const MODEL_NAME_LITERAL = 'CompanySpin';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/companySpin.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateCompanySpinVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'CompanySpin', 'update');

  logOperationStart('bulkUpdateCompanySpinVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      companySpinBulkVisibilityUpdate,
      body,
      req,
      'company_spin_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_company_spin_visibility_client_guard',
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
          context: 'bulk_update_company_spin_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_company_spin_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.companySpin.updateMany({
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
    logDatabaseSuccess('bulk_update_company_spin_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateCompanySpinVisibility', req, {
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
      operationName: 'bulk_update_company_spin_visibility',
    });
    if (handled) return;
  }
}

async function getAllCompanySpin(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('CompanySpin');
  const context = createOperationContext(req, 'CompanySpin', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllCompanySpin', req, {
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

    const searchFields = [
      'situation',
      'implication',
      'need',
      'notes',
      'problem',
    ];
    const filterFields = [...searchFields, 'companyId', 'buyerInfluence'];

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
    logDatabaseStart('get_all_company_spin', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: companySpinUpdate,
      filterFields,
      searchFields,
      model: 'companySpin',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_company_spin', req, {
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
    logOperationSuccess('getAllCompanySpin', req, {
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
      operationName: 'get_all_company_spin',
    });
    if (handled) return;
  }
}

async function createCompanySpin(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'CompanySpin', 'create');

  logOperationStart('createCompanySpin', req, {
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
    let schema = companySpinCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'company_spin_creation',
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

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newCompanySpinWithDetails,
      ['company'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newCompanySpinWithDetails, [
      { relation: 'company', model: 'Company' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newCompanySpinWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? { ...newCompanySpinWithDetails, [DISPLAY_VALUE_PROP]: createdDv }
      : newCompanySpinWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createCompanySpin', req, {
      id: newCompanySpin.id,
      code: newCompanySpin.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_company_spin',
    });
    if (handled) return;
  }
}

async function getCompanySpin(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'CompanySpin', 'read');

  logOperationStart('getCompanySpin', req, {
    user: user?.id,
    companySpinId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_company_spin_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

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
        },
      );
      logOperationError('getCompanySpin', req, error);
      throw error;
    }

    const [foundCompanySpinWithDetails] = await getDetailsFromAPI({
      results: [foundCompanySpin],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundCompanySpinWithDetails,
      ['company'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundCompanySpinWithDetails, [
      { relation: 'company', model: 'Company' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundCompanySpinWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? { ...foundCompanySpinWithDetails, [DISPLAY_VALUE_PROP]: foundDv }
      : foundCompanySpinWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getCompanySpin', req, {
      id: foundCompanySpin.id,
      code: foundCompanySpin.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_company_spin',
    });
    if (handled) return;
  }
}

async function updateCompanySpin(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'CompanySpin', 'update');

  logOperationStart('updateCompanySpin', req, {
    companySpinId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_company_spin_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = companySpinUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'company_spin_update',
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
    logDatabaseStart('update_company_spin', req, {
      companySpinId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.companySpin.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanySpin not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_company_spin',
          details: { companySpinId: params?.id },
        },
      );
      throw error;
    }

    const updatedCompanySpin = await prisma.companySpin.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
    });

    // Log database operation success
    logDatabaseSuccess('update_company_spin', req, {
      id: updatedCompanySpin.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedCompanySpin,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedCompanySpin, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedCompanySpin;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateCompanySpin', req, {
      id: updatedCompanySpin.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_company_spin',
    });
    if (handled) return;
  }
}

async function deleteCompanySpin(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'CompanySpin', 'delete');

  logOperationStart('deleteCompanySpin', req, {
    user: user?.id,
    companySpinId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_company_spin_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    await prisma.opportunity.updateMany({
      where: {
        economicBuyerInfluenceId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
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
        deleted: new Date().toISOString(),
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
        deleted: new Date().toISOString(),
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
        deleted: new Date().toISOString(),
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
        },
      );
      logOperationError('deleteCompanySpin', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteCompanySpin', req, {
      deletedCount: result.count,
      companySpinId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_company_spin',
    });
    if (handled) return;
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
  bulkUpdateCompanySpinVisibility,
};
