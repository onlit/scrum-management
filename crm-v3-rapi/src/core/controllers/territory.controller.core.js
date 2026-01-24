/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing territory using Prisma.
 * It includes functions for retrieving all territory, creating a new territory, retrieving a single territory,
 * updating an existing territory, and deleting a territory.
 *
 * The `getAllTerritory` function retrieves a paginated list of territory based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createTerritory` function validates the request body using a Joi schema, generates a unique code
 * for the territory, and creates a new territory in the database with additional metadata.
 *
 * The `getTerritory` function retrieves a single territory based on the provided territory ID, with visibility
 * filters applied to ensure the territory is accessible to the requesting user.
 *
 * The `updateTerritory` function updates an existing territory in the database based on the provided territory ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteTerritory` function deletes a territory from the database based on the provided territory ID, with
 * visibility filters applied to ensure the territory is deletable by the requesting user.
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
  territoryCreate,
  territoryUpdate,
  territoryBulkVisibilityUpdate,
} = require('#core/schemas/territory.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('Territory');
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
} = require('#utils/displayValueUtils.js');
const {
  batchHydrateRelationsInList,
  hydrateRelationsOnRecord,
} = require('#utils/nestedHydrationUtils.js');

// Model name literal used for display-value maps
const MODEL_NAME_LITERAL = 'Territory';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/territory.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateTerritoryVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'Territory', 'update');

  logOperationStart('bulkUpdateTerritoryVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      territoryBulkVisibilityUpdate,
      body,
      req,
      'territory_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_territory_visibility_client_guard',
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
          context: 'bulk_update_territory_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_territory_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.territory.updateMany({
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
    logDatabaseSuccess('bulk_update_territory_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateTerritoryVisibility', req, {
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
      operationName: 'bulk_update_territory_visibility',
    });
    if (handled) return;
  }
}

async function getAllTerritory(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('Territory');
  const context = createOperationContext(req, 'Territory', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllTerritory', req, {
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

    const searchFields = ['name', 'description'];
    const filterFields = [...searchFields, 'expiryDate'];

    const include = {};

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
    logDatabaseStart('get_all_territory', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: territoryUpdate,
      filterFields,
      searchFields,
      model: 'territory',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_territory', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    await batchHydrateRelationsInList(response, [], user?.accessToken);

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        const dv = computeDisplayValue(r, MODEL_NAME_LITERAL, displayOptions);
        return dv ? { ...r, [DISPLAY_VALUE_PROP]: dv } : r;
      });
    }

    // Lifecycle: afterList - transform response
    const afterListResult = await interceptor.afterList(response, context);
    const finalResponse = afterListResult.data;

    // Log operation success
    logOperationSuccess('getAllTerritory', req, {
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
      operationName: 'get_all_territory',
    });
    if (handled) return;
  }
}

async function createTerritory(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'Territory', 'create');

  logOperationStart('createTerritory', req, {
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
    let schema = territoryCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'territory_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = [];

    const include = {};

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
    logDatabaseStart('create_territory', req, {
      name: values.name,
      userId: user?.id,
    });

    const newTerritory = await prisma.territory.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_territory', req, {
      id: newTerritory.id,
      code: newTerritory.code,
    });

    const [newTerritoryWithDetails] = await getDetailsFromAPI({
      results: [newTerritory],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newTerritoryWithDetails,
      [],
      user?.accessToken,
    );

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newTerritoryWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? { ...newTerritoryWithDetails, [DISPLAY_VALUE_PROP]: createdDv }
      : newTerritoryWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createTerritory', req, {
      id: newTerritory.id,
      code: newTerritory.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_territory',
    });
    if (handled) return;
  }
}

async function getTerritory(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'Territory', 'read');

  logOperationStart('getTerritory', req, {
    user: user?.id,
    territoryId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_territory_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {};

    // Log database operation start
    logDatabaseStart('get_territory', req, {
      territoryId: params?.id,
      userId: user?.id,
    });

    const foundTerritory = await prisma.territory.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_territory', req, {
      found: !!foundTerritory,
      territoryId: params?.id,
    });

    if (!foundTerritory) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Territory not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_territory',
          details: { territoryId: params?.id },
        },
      );
      logOperationError('getTerritory', req, error);
      throw error;
    }

    const [foundTerritoryWithDetails] = await getDetailsFromAPI({
      results: [foundTerritory],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundTerritoryWithDetails,
      [],
      user?.accessToken,
    );

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundTerritoryWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? { ...foundTerritoryWithDetails, [DISPLAY_VALUE_PROP]: foundDv }
      : foundTerritoryWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getTerritory', req, {
      id: foundTerritory.id,
      code: foundTerritory.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_territory',
    });
    if (handled) return;
  }
}

async function updateTerritory(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'Territory', 'update');

  logOperationStart('updateTerritory', req, {
    territoryId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_territory_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = territoryUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'territory_update',
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
    logDatabaseStart('update_territory', req, {
      territoryId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.territory.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Territory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_territory',
          details: { territoryId: params?.id },
        },
      );
      throw error;
    }

    const updatedTerritory = await prisma.territory.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
    });

    // Log database operation success
    logDatabaseSuccess('update_territory', req, {
      id: updatedTerritory.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedTerritory,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedTerritory, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedTerritory;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateTerritory', req, {
      id: updatedTerritory.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_territory',
    });
    if (handled) return;
  }
}

async function deleteTerritory(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'Territory', 'delete');

  logOperationStart('deleteTerritory', req, {
    user: user?.id,
    territoryId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_territory_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    await prisma.territoryOwner.updateMany({
      where: {
        territoryId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.companyInTerritory.updateMany({
      where: {
        territoryId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_territory', req, {
      territoryId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.territory.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_territory', req, {
      deletedCount: result.count,
      territoryId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Territory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_territory',
          details: { territoryId: params?.id },
        },
      );
      logOperationError('deleteTerritory', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteTerritory', req, {
      deletedCount: result.count,
      territoryId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_territory',
    });
    if (handled) return;
  }
}

async function getTerritoryBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for territory',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllTerritory,
  createTerritory,
  getTerritory,
  updateTerritory,
  deleteTerritory,
  getTerritoryBarChartData,
  bulkUpdateTerritoryVisibility,
};
