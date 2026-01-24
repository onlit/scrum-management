/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing clientHistory using Prisma.
 * It includes functions for retrieving all clientHistory, creating a new clientHistory, retrieving a single clientHistory,
 * updating an existing clientHistory, and deleting a clientHistory.
 *
 * The `getAllClientHistory` function retrieves a paginated list of clientHistory based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createClientHistory` function validates the request body using a Joi schema, generates a unique code
 * for the clientHistory, and creates a new clientHistory in the database with additional metadata.
 *
 * The `getClientHistory` function retrieves a single clientHistory based on the provided clientHistory ID, with visibility
 * filters applied to ensure the clientHistory is accessible to the requesting user.
 *
 * The `updateClientHistory` function updates an existing clientHistory in the database based on the provided clientHistory ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteClientHistory` function deletes a clientHistory from the database based on the provided clientHistory ID, with
 * visibility filters applied to ensure the clientHistory is deletable by the requesting user.
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
  clientHistoryCreate,
  clientHistoryUpdate,
  clientHistoryBulkVisibilityUpdate,
} = require('#core/schemas/clientHistory.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('ClientHistory');
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
const MODEL_NAME_LITERAL = 'ClientHistory';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/clientHistory.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateClientHistoryVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'ClientHistory', 'update');

  logOperationStart('bulkUpdateClientHistoryVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      clientHistoryBulkVisibilityUpdate,
      body,
      req,
      'client_history_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_client_history_visibility_client_guard',
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
          context: 'bulk_update_client_history_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_client_history_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.clientHistory.updateMany({
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
    logDatabaseSuccess('bulk_update_client_history_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateClientHistoryVisibility', req, {
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
      operationName: 'bulk_update_client_history_visibility',
    });
    if (handled) return;
  }
}

async function getAllClientHistory(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('ClientHistory');
  const context = createOperationContext(req, 'ClientHistory', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllClientHistory', req, {
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

    const searchFields = ['url'];
    const filterFields = [...searchFields, 'clientRefId'];

    const include = {
      clientRef: { include: { companyContact: { include: { person: true } } } },
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
    logDatabaseStart('get_all_client_history', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: clientHistoryUpdate,
      filterFields,
      searchFields,
      model: 'clientHistory',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_client_history', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    await batchHydrateRelationsInList(
      response,
      ['clientRef'],
      user?.accessToken,
    );

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        attachNestedDisplayValues(r, [
          { relation: 'clientRef', model: 'Client' },
        ]);
        const dv = computeDisplayValue(r, MODEL_NAME_LITERAL, displayOptions);
        return dv ? { ...r, [DISPLAY_VALUE_PROP]: dv } : r;
      });
    }

    // Lifecycle: afterList - transform response
    const afterListResult = await interceptor.afterList(response, context);
    const finalResponse = afterListResult.data;

    // Log operation success
    logOperationSuccess('getAllClientHistory', req, {
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
      operationName: 'get_all_client_history',
    });
    if (handled) return;
  }
}

async function createClientHistory(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'ClientHistory', 'create');

  logOperationStart('createClientHistory', req, {
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
    let schema = clientHistoryCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'client_history_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = ['clientRefId'];

    const include = {
      clientRef: { include: { companyContact: { include: { person: true } } } },
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
    logDatabaseStart('create_client_history', req, {
      name: values.name,
      userId: user?.id,
    });

    const newClientHistory = await prisma.clientHistory.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_client_history', req, {
      id: newClientHistory.id,
      code: newClientHistory.code,
    });

    const [newClientHistoryWithDetails] = await getDetailsFromAPI({
      results: [newClientHistory],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newClientHistoryWithDetails,
      ['clientRef'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newClientHistoryWithDetails, [
      { relation: 'clientRef', model: 'Client' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newClientHistoryWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? { ...newClientHistoryWithDetails, [DISPLAY_VALUE_PROP]: createdDv }
      : newClientHistoryWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createClientHistory', req, {
      id: newClientHistory.id,
      code: newClientHistory.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_client_history',
    });
    if (handled) return;
  }
}

async function getClientHistory(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'ClientHistory', 'read');

  logOperationStart('getClientHistory', req, {
    user: user?.id,
    clientHistoryId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_client_history_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      clientRef: { include: { companyContact: { include: { person: true } } } },
    };

    // Log database operation start
    logDatabaseStart('get_client_history', req, {
      clientHistoryId: params?.id,
      userId: user?.id,
    });

    const foundClientHistory = await prisma.clientHistory.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_client_history', req, {
      found: !!foundClientHistory,
      clientHistoryId: params?.id,
    });

    if (!foundClientHistory) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ClientHistory not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_client_history',
          details: { clientHistoryId: params?.id },
        },
      );
      logOperationError('getClientHistory', req, error);
      throw error;
    }

    const [foundClientHistoryWithDetails] = await getDetailsFromAPI({
      results: [foundClientHistory],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundClientHistoryWithDetails,
      ['clientRef'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundClientHistoryWithDetails, [
      { relation: 'clientRef', model: 'Client' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundClientHistoryWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? { ...foundClientHistoryWithDetails, [DISPLAY_VALUE_PROP]: foundDv }
      : foundClientHistoryWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getClientHistory', req, {
      id: foundClientHistory.id,
      code: foundClientHistory.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_client_history',
    });
    if (handled) return;
  }
}

async function updateClientHistory(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'ClientHistory', 'update');

  logOperationStart('updateClientHistory', req, {
    clientHistoryId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_client_history_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = clientHistoryUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'client_history_update',
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
    logDatabaseStart('update_client_history', req, {
      clientHistoryId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.clientHistory.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ClientHistory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_client_history',
          details: { clientHistoryId: params?.id },
        },
      );
      throw error;
    }

    const updatedClientHistory = await prisma.clientHistory.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
    });

    // Log database operation success
    logDatabaseSuccess('update_client_history', req, {
      id: updatedClientHistory.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedClientHistory,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedClientHistory, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedClientHistory;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateClientHistory', req, {
      id: updatedClientHistory.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_client_history',
    });
    if (handled) return;
  }
}

async function deleteClientHistory(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'ClientHistory', 'delete');

  logOperationStart('deleteClientHistory', req, {
    user: user?.id,
    clientHistoryId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_client_history_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    // Log database operation start
    logDatabaseStart('delete_client_history', req, {
      clientHistoryId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.clientHistory.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_client_history', req, {
      deletedCount: result.count,
      clientHistoryId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ClientHistory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_client_history',
          details: { clientHistoryId: params?.id },
        },
      );
      logOperationError('deleteClientHistory', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteClientHistory', req, {
      deletedCount: result.count,
      clientHistoryId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_client_history',
    });
    if (handled) return;
  }
}

async function getClientHistoryBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for clientHistory',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllClientHistory,
  createClientHistory,
  getClientHistory,
  updateClientHistory,
  deleteClientHistory,
  getClientHistoryBarChartData,
  bulkUpdateClientHistoryVisibility,
};
