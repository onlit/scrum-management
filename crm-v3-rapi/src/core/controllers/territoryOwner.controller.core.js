/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing territoryOwner using Prisma.
 * It includes functions for retrieving all territoryOwner, creating a new territoryOwner, retrieving a single territoryOwner,
 * updating an existing territoryOwner, and deleting a territoryOwner.
 *
 * The `getAllTerritoryOwner` function retrieves a paginated list of territoryOwner based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createTerritoryOwner` function validates the request body using a Joi schema, generates a unique code
 * for the territoryOwner, and creates a new territoryOwner in the database with additional metadata.
 *
 * The `getTerritoryOwner` function retrieves a single territoryOwner based on the provided territoryOwner ID, with visibility
 * filters applied to ensure the territoryOwner is accessible to the requesting user.
 *
 * The `updateTerritoryOwner` function updates an existing territoryOwner in the database based on the provided territoryOwner ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteTerritoryOwner` function deletes a territoryOwner from the database based on the provided territoryOwner ID, with
 * visibility filters applied to ensure the territoryOwner is deletable by the requesting user.
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
  territoryOwnerCreate,
  territoryOwnerUpdate,
  territoryOwnerBulkVisibilityUpdate,
} = require('#core/schemas/territoryOwner.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('TerritoryOwner');
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
const MODEL_NAME_LITERAL = 'TerritoryOwner';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/territoryOwner.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateTerritoryOwnerVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'TerritoryOwner', 'update');

  logOperationStart('bulkUpdateTerritoryOwnerVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      territoryOwnerBulkVisibilityUpdate,
      body,
      req,
      'territory_owner_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_territory_owner_visibility_client_guard',
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
          context: 'bulk_update_territory_owner_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_territory_owner_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.territoryOwner.updateMany({
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
    logDatabaseSuccess('bulk_update_territory_owner_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateTerritoryOwnerVisibility', req, {
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
      operationName: 'bulk_update_territory_owner_visibility',
    });
    if (handled) return;
  }
}

async function getAllTerritoryOwner(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('TerritoryOwner');
  const context = createOperationContext(req, 'TerritoryOwner', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllTerritoryOwner', req, {
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
      'salesPersonId',
      'territoryId',
      'expiryDate',
    ];

    const include = {
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
    logDatabaseStart('get_all_territory_owner', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: territoryOwnerUpdate,
      filterFields,
      searchFields,
      model: 'territoryOwner',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_territory_owner', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    await batchHydrateRelationsInList(
      response,
      ['territory'],
      user?.accessToken,
    );

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        attachNestedDisplayValues(r, [
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
    logOperationSuccess('getAllTerritoryOwner', req, {
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
      operationName: 'get_all_territory_owner',
    });
    if (handled) return;
  }
}

async function createTerritoryOwner(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'TerritoryOwner', 'create');

  logOperationStart('createTerritoryOwner', req, {
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
    let schema = territoryOwnerCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'territory_owner_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = ['territoryId'];

    const include = {
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
    logDatabaseStart('create_territory_owner', req, {
      name: values.name,
      userId: user?.id,
    });

    const newTerritoryOwner = await prisma.territoryOwner.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_territory_owner', req, {
      id: newTerritoryOwner.id,
      code: newTerritoryOwner.code,
    });

    const [newTerritoryOwnerWithDetails] = await getDetailsFromAPI({
      results: [newTerritoryOwner],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newTerritoryOwnerWithDetails,
      ['territory'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newTerritoryOwnerWithDetails, [
      { relation: 'territory', model: 'Territory' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newTerritoryOwnerWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? { ...newTerritoryOwnerWithDetails, [DISPLAY_VALUE_PROP]: createdDv }
      : newTerritoryOwnerWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createTerritoryOwner', req, {
      id: newTerritoryOwner.id,
      code: newTerritoryOwner.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_territory_owner',
    });
    if (handled) return;
  }
}

async function getTerritoryOwner(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'TerritoryOwner', 'read');

  logOperationStart('getTerritoryOwner', req, {
    user: user?.id,
    territoryOwnerId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_territory_owner_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      territory: true,
    };

    // Log database operation start
    logDatabaseStart('get_territory_owner', req, {
      territoryOwnerId: params?.id,
      userId: user?.id,
    });

    const foundTerritoryOwner = await prisma.territoryOwner.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_territory_owner', req, {
      found: !!foundTerritoryOwner,
      territoryOwnerId: params?.id,
    });

    if (!foundTerritoryOwner) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'TerritoryOwner not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_territory_owner',
          details: { territoryOwnerId: params?.id },
        },
      );
      logOperationError('getTerritoryOwner', req, error);
      throw error;
    }

    const [foundTerritoryOwnerWithDetails] = await getDetailsFromAPI({
      results: [foundTerritoryOwner],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundTerritoryOwnerWithDetails,
      ['territory'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundTerritoryOwnerWithDetails, [
      { relation: 'territory', model: 'Territory' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundTerritoryOwnerWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? { ...foundTerritoryOwnerWithDetails, [DISPLAY_VALUE_PROP]: foundDv }
      : foundTerritoryOwnerWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getTerritoryOwner', req, {
      id: foundTerritoryOwner.id,
      code: foundTerritoryOwner.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_territory_owner',
    });
    if (handled) return;
  }
}

async function updateTerritoryOwner(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'TerritoryOwner', 'update');

  logOperationStart('updateTerritoryOwner', req, {
    territoryOwnerId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_territory_owner_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = territoryOwnerUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'territory_owner_update',
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
    logDatabaseStart('update_territory_owner', req, {
      territoryOwnerId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.territoryOwner.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'TerritoryOwner not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_territory_owner',
          details: { territoryOwnerId: params?.id },
        },
      );
      throw error;
    }

    const updatedTerritoryOwner = await prisma.territoryOwner.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
    });

    // Log database operation success
    logDatabaseSuccess('update_territory_owner', req, {
      id: updatedTerritoryOwner.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedTerritoryOwner,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedTerritoryOwner, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedTerritoryOwner;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateTerritoryOwner', req, {
      id: updatedTerritoryOwner.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_territory_owner',
    });
    if (handled) return;
  }
}

async function deleteTerritoryOwner(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'TerritoryOwner', 'delete');

  logOperationStart('deleteTerritoryOwner', req, {
    user: user?.id,
    territoryOwnerId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_territory_owner_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    // Log database operation start
    logDatabaseStart('delete_territory_owner', req, {
      territoryOwnerId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.territoryOwner.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_territory_owner', req, {
      deletedCount: result.count,
      territoryOwnerId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'TerritoryOwner not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_territory_owner',
          details: { territoryOwnerId: params?.id },
        },
      );
      logOperationError('deleteTerritoryOwner', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteTerritoryOwner', req, {
      deletedCount: result.count,
      territoryOwnerId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_territory_owner',
    });
    if (handled) return;
  }
}

async function getTerritoryOwnerBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for territoryOwner',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllTerritoryOwner,
  createTerritoryOwner,
  getTerritoryOwner,
  updateTerritoryOwner,
  deleteTerritoryOwner,
  getTerritoryOwnerBarChartData,
  bulkUpdateTerritoryOwnerVisibility,
};
