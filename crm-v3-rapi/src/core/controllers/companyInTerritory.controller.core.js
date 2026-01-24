/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing companyInTerritory using Prisma.
 * It includes functions for retrieving all companyInTerritory, creating a new companyInTerritory, retrieving a single companyInTerritory,
 * updating an existing companyInTerritory, and deleting a companyInTerritory.
 *
 * The `getAllCompanyInTerritory` function retrieves a paginated list of companyInTerritory based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCompanyInTerritory` function validates the request body using a Joi schema, generates a unique code
 * for the companyInTerritory, and creates a new companyInTerritory in the database with additional metadata.
 *
 * The `getCompanyInTerritory` function retrieves a single companyInTerritory based on the provided companyInTerritory ID, with visibility
 * filters applied to ensure the companyInTerritory is accessible to the requesting user.
 *
 * The `updateCompanyInTerritory` function updates an existing companyInTerritory in the database based on the provided companyInTerritory ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCompanyInTerritory` function deletes a companyInTerritory from the database based on the provided companyInTerritory ID, with
 * visibility filters applied to ensure the companyInTerritory is deletable by the requesting user.
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
  companyInTerritoryCreate,
  companyInTerritoryUpdate,
  companyInTerritoryBulkVisibilityUpdate,
} = require('#core/schemas/companyInTerritory.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('CompanyInTerritory');
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
const MODEL_NAME_LITERAL = 'CompanyInTerritory';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/companyInTerritory.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateCompanyInTerritoryVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'CompanyInTerritory', 'update');

  logOperationStart('bulkUpdateCompanyInTerritoryVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      companyInTerritoryBulkVisibilityUpdate,
      body,
      req,
      'company_in_territory_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_company_in_territory_visibility_client_guard',
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
            'bulk_update_company_in_territory_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_company_in_territory_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.companyInTerritory.updateMany({
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
    logDatabaseSuccess('bulk_update_company_in_territory_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateCompanyInTerritoryVisibility', req, {
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
      operationName: 'bulk_update_company_in_territory_visibility',
    });
    if (handled) return;
  }
}

async function getAllCompanyInTerritory(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('CompanyInTerritory');
  const context = createOperationContext(req, 'CompanyInTerritory', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllCompanyInTerritory', req, {
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
      'territoryId',
      'expiryDate',
    ];

    const include = {
      company: true,
      territory: true,
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
    logDatabaseStart('get_all_company_in_territory', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: companyInTerritoryUpdate,
      filterFields,
      searchFields,
      model: 'companyInTerritory',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_company_in_territory', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    await batchHydrateRelationsInList(
      response,
      ['company', 'territory'],
      user?.accessToken,
    );

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        attachNestedDisplayValues(r, [
          { relation: 'company', model: 'Company' },
          { relation: 'territory', model: 'Territory' },
        ]);
        const dv = computeDisplayValue(r, MODEL_NAME_LITERAL, displayOptions);
        return dv ? { ...r, [DISPLAY_VALUE_PROP]: dv } : r;
      });
    }

    // Lifecycle: afterList - transform response
    const afterListResult = await interceptor.afterList(response, context);
    const finalResponse = afterListResult.data;

    // Log operation success
    logOperationSuccess('getAllCompanyInTerritory', req, {
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
      operationName: 'get_all_company_in_territory',
    });
    if (handled) return;
  }
}

async function createCompanyInTerritory(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'CompanyInTerritory', 'create');

  logOperationStart('createCompanyInTerritory', req, {
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
    let schema = companyInTerritoryCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'company_in_territory_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = ['companyId', 'territoryId'];

    const include = {
      company: true,
      territory: true,
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
    logDatabaseStart('create_company_in_territory', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCompanyInTerritory = await prisma.companyInTerritory.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_company_in_territory', req, {
      id: newCompanyInTerritory.id,
      code: newCompanyInTerritory.code,
    });

    const [newCompanyInTerritoryWithDetails] = await getDetailsFromAPI({
      results: [newCompanyInTerritory],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newCompanyInTerritoryWithDetails,
      ['company', 'territory'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newCompanyInTerritoryWithDetails, [
      { relation: 'company', model: 'Company' },
      { relation: 'territory', model: 'Territory' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newCompanyInTerritoryWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? { ...newCompanyInTerritoryWithDetails, [DISPLAY_VALUE_PROP]: createdDv }
      : newCompanyInTerritoryWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createCompanyInTerritory', req, {
      id: newCompanyInTerritory.id,
      code: newCompanyInTerritory.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_company_in_territory',
    });
    if (handled) return;
  }
}

async function getCompanyInTerritory(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'CompanyInTerritory', 'read');

  logOperationStart('getCompanyInTerritory', req, {
    user: user?.id,
    companyInTerritoryId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_company_in_territory_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      company: true,
      territory: true,
    };

    // Log database operation start
    logDatabaseStart('get_company_in_territory', req, {
      companyInTerritoryId: params?.id,
      userId: user?.id,
    });

    const foundCompanyInTerritory = await prisma.companyInTerritory.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_company_in_territory', req, {
      found: !!foundCompanyInTerritory,
      companyInTerritoryId: params?.id,
    });

    if (!foundCompanyInTerritory) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanyInTerritory not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_company_in_territory',
          details: { companyInTerritoryId: params?.id },
        },
      );
      logOperationError('getCompanyInTerritory', req, error);
      throw error;
    }

    const [foundCompanyInTerritoryWithDetails] = await getDetailsFromAPI({
      results: [foundCompanyInTerritory],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundCompanyInTerritoryWithDetails,
      ['company', 'territory'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundCompanyInTerritoryWithDetails, [
      { relation: 'company', model: 'Company' },
      { relation: 'territory', model: 'Territory' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundCompanyInTerritoryWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? { ...foundCompanyInTerritoryWithDetails, [DISPLAY_VALUE_PROP]: foundDv }
      : foundCompanyInTerritoryWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getCompanyInTerritory', req, {
      id: foundCompanyInTerritory.id,
      code: foundCompanyInTerritory.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_company_in_territory',
    });
    if (handled) return;
  }
}

async function updateCompanyInTerritory(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'CompanyInTerritory', 'update');

  logOperationStart('updateCompanyInTerritory', req, {
    companyInTerritoryId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_company_in_territory_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = companyInTerritoryUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'company_in_territory_update',
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
    logDatabaseStart('update_company_in_territory', req, {
      companyInTerritoryId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.companyInTerritory.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanyInTerritory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_company_in_territory',
          details: { companyInTerritoryId: params?.id },
        },
      );
      throw error;
    }

    const updatedCompanyInTerritory = await prisma.companyInTerritory.findFirst(
      {
        where: { id: params?.id, client: user?.client?.id, deleted: null },
      },
    );

    // Log database operation success
    logDatabaseSuccess('update_company_in_territory', req, {
      id: updatedCompanyInTerritory.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedCompanyInTerritory,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedCompanyInTerritory, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedCompanyInTerritory;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateCompanyInTerritory', req, {
      id: updatedCompanyInTerritory.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_company_in_territory',
    });
    if (handled) return;
  }
}

async function deleteCompanyInTerritory(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'CompanyInTerritory', 'delete');

  logOperationStart('deleteCompanyInTerritory', req, {
    user: user?.id,
    companyInTerritoryId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_company_in_territory_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    // Log database operation start
    logDatabaseStart('delete_company_in_territory', req, {
      companyInTerritoryId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.companyInTerritory.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_company_in_territory', req, {
      deletedCount: result.count,
      companyInTerritoryId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanyInTerritory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_company_in_territory',
          details: { companyInTerritoryId: params?.id },
        },
      );
      logOperationError('deleteCompanyInTerritory', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteCompanyInTerritory', req, {
      deletedCount: result.count,
      companyInTerritoryId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_company_in_territory',
    });
    if (handled) return;
  }
}

async function getCompanyInTerritoryBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for companyInTerritory',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCompanyInTerritory,
  createCompanyInTerritory,
  getCompanyInTerritory,
  updateCompanyInTerritory,
  deleteCompanyInTerritory,
  getCompanyInTerritoryBarChartData,
  bulkUpdateCompanyInTerritoryVisibility,
};
