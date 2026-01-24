/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing targetActualHistory using Prisma.
 * It includes functions for retrieving all targetActualHistory, creating a new targetActualHistory, retrieving a single targetActualHistory,
 * updating an existing targetActualHistory, and deleting a targetActualHistory.
 *
 * The `getAllTargetActualHistory` function retrieves a paginated list of targetActualHistory based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createTargetActualHistory` function validates the request body using a Joi schema, generates a unique code
 * for the targetActualHistory, and creates a new targetActualHistory in the database with additional metadata.
 *
 * The `getTargetActualHistory` function retrieves a single targetActualHistory based on the provided targetActualHistory ID, with visibility
 * filters applied to ensure the targetActualHistory is accessible to the requesting user.
 *
 * The `updateTargetActualHistory` function updates an existing targetActualHistory in the database based on the provided targetActualHistory ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteTargetActualHistory` function deletes a targetActualHistory from the database based on the provided targetActualHistory ID, with
 * visibility filters applied to ensure the targetActualHistory is deletable by the requesting user.
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
  targetActualHistoryCreate,
  targetActualHistoryUpdate,
  targetActualHistoryBulkVisibilityUpdate,
} = require('#core/schemas/targetActualHistory.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('TargetActualHistory');
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
const MODEL_NAME_LITERAL = 'TargetActualHistory';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/targetActualHistory.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateTargetActualHistoryVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'TargetActualHistory', 'update');

  logOperationStart('bulkUpdateTargetActualHistoryVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      targetActualHistoryBulkVisibilityUpdate,
      body,
      req,
      'target_actual_history_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_target_actual_history_visibility_client_guard',
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
            'bulk_update_target_actual_history_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_target_actual_history_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.targetActualHistory.updateMany({
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
    logDatabaseSuccess('bulk_update_target_actual_history_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateTargetActualHistoryVisibility', req, {
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
      operationName: 'bulk_update_target_actual_history_visibility',
    });
    if (handled) return;
  }
}

async function getAllTargetActualHistory(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('TargetActualHistory');
  const context = createOperationContext(req, 'TargetActualHistory', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllTargetActualHistory', req, {
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
    const filterFields = [...searchFields, 'actuals', 'targetId'];

    const include = {
      target: true,
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
    logDatabaseStart('get_all_target_actual_history', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: targetActualHistoryUpdate,
      filterFields,
      searchFields,
      model: 'targetActualHistory',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_target_actual_history', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Process targets for batch details
    const targetRecords = response.results
      .filter((result) => result?.target)
      .map((result) => result.target);

    const targetsDetails = await getDetailsFromAPI({
      results: targetRecords,
      token: user?.accessToken,
    });

    // Merge details back into results
    response.results.forEach((result, index) => {
      if (result?.target && targetsDetails?.[index]) {
        result.target = {
          ...result.target,
          ...targetsDetails[index],
        };
      }
    });

    await batchHydrateRelationsInList(response, ['target'], user?.accessToken);

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        attachNestedDisplayValues(r, [
          { relation: 'target', model: 'SalesPersonTarget' },
        ]);
        const dv = computeDisplayValue(r, MODEL_NAME_LITERAL, displayOptions);
        return dv ? { ...r, [DISPLAY_VALUE_PROP]: dv } : r;
      });
    }

    // Lifecycle: afterList - transform response
    const afterListResult = await interceptor.afterList(response, context);
    const finalResponse = afterListResult.data;

    // Log operation success
    logOperationSuccess('getAllTargetActualHistory', req, {
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
      operationName: 'get_all_target_actual_history',
    });
    if (handled) return;
  }
}

async function createTargetActualHistory(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'TargetActualHistory', 'create');

  logOperationStart('createTargetActualHistory', req, {
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
    let schema = targetActualHistoryCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'target_actual_history_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = ['targetId'];

    const include = {
      target: true,
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
    logDatabaseStart('create_target_actual_history', req, {
      name: values.name,
      userId: user?.id,
    });

    const newTargetActualHistory = await prisma.targetActualHistory.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_target_actual_history', req, {
      id: newTargetActualHistory.id,
      code: newTargetActualHistory.code,
    });

    if (newTargetActualHistory?.target) {
      [newTargetActualHistory.target] = await getDetailsFromAPI({
        results: [newTargetActualHistory.target],
        token: user?.accessToken,
      });
    }

    const [newTargetActualHistoryWithDetails] = await getDetailsFromAPI({
      results: [newTargetActualHistory],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newTargetActualHistoryWithDetails,
      ['target'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newTargetActualHistoryWithDetails, [
      { relation: 'target', model: 'SalesPersonTarget' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newTargetActualHistoryWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? {
          ...newTargetActualHistoryWithDetails,
          [DISPLAY_VALUE_PROP]: createdDv,
        }
      : newTargetActualHistoryWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createTargetActualHistory', req, {
      id: newTargetActualHistory.id,
      code: newTargetActualHistory.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_target_actual_history',
    });
    if (handled) return;
  }
}

async function getTargetActualHistory(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'TargetActualHistory', 'read');

  logOperationStart('getTargetActualHistory', req, {
    user: user?.id,
    targetActualHistoryId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_target_actual_history_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      target: true,
    };

    // Log database operation start
    logDatabaseStart('get_target_actual_history', req, {
      targetActualHistoryId: params?.id,
      userId: user?.id,
    });

    const foundTargetActualHistory = await prisma.targetActualHistory.findFirst(
      {
        where: {
          id: params?.id,
          ...getVisibilityFilters(user),
        },
        include: Object.keys(include).length ? include : undefined,
      },
    );

    // Log database operation success
    logDatabaseSuccess('get_target_actual_history', req, {
      found: !!foundTargetActualHistory,
      targetActualHistoryId: params?.id,
    });

    if (!foundTargetActualHistory) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'TargetActualHistory not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_target_actual_history',
          details: { targetActualHistoryId: params?.id },
        },
      );
      logOperationError('getTargetActualHistory', req, error);
      throw error;
    }

    if (foundTargetActualHistory?.target) {
      [foundTargetActualHistory.target] = await getDetailsFromAPI({
        results: [foundTargetActualHistory.target],
        token: user?.accessToken,
      });
    }

    const [foundTargetActualHistoryWithDetails] = await getDetailsFromAPI({
      results: [foundTargetActualHistory],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundTargetActualHistoryWithDetails,
      ['target'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundTargetActualHistoryWithDetails, [
      { relation: 'target', model: 'SalesPersonTarget' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundTargetActualHistoryWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? {
          ...foundTargetActualHistoryWithDetails,
          [DISPLAY_VALUE_PROP]: foundDv,
        }
      : foundTargetActualHistoryWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getTargetActualHistory', req, {
      id: foundTargetActualHistory.id,
      code: foundTargetActualHistory.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_target_actual_history',
    });
    if (handled) return;
  }
}

async function updateTargetActualHistory(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'TargetActualHistory', 'update');

  logOperationStart('updateTargetActualHistory', req, {
    targetActualHistoryId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_target_actual_history_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = targetActualHistoryUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'target_actual_history_update',
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
    logDatabaseStart('update_target_actual_history', req, {
      targetActualHistoryId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.targetActualHistory.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'TargetActualHistory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_target_actual_history',
          details: { targetActualHistoryId: params?.id },
        },
      );
      throw error;
    }

    const updatedTargetActualHistory =
      await prisma.targetActualHistory.findFirst({
        where: { id: params?.id, client: user?.client?.id, deleted: null },
      });

    // Log database operation success
    logDatabaseSuccess('update_target_actual_history', req, {
      id: updatedTargetActualHistory.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedTargetActualHistory,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedTargetActualHistory, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedTargetActualHistory;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateTargetActualHistory', req, {
      id: updatedTargetActualHistory.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_target_actual_history',
    });
    if (handled) return;
  }
}

async function deleteTargetActualHistory(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'TargetActualHistory', 'delete');

  logOperationStart('deleteTargetActualHistory', req, {
    user: user?.id,
    targetActualHistoryId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_target_actual_history_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    // Log database operation start
    logDatabaseStart('delete_target_actual_history', req, {
      targetActualHistoryId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.targetActualHistory.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_target_actual_history', req, {
      deletedCount: result.count,
      targetActualHistoryId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'TargetActualHistory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_target_actual_history',
          details: { targetActualHistoryId: params?.id },
        },
      );
      logOperationError('deleteTargetActualHistory', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteTargetActualHistory', req, {
      deletedCount: result.count,
      targetActualHistoryId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_target_actual_history',
    });
    if (handled) return;
  }
}

async function getTargetActualHistoryBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for targetActualHistory',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllTargetActualHistory,
  createTargetActualHistory,
  getTargetActualHistory,
  updateTargetActualHistory,
  deleteTargetActualHistory,
  getTargetActualHistoryBarChartData,
  bulkUpdateTargetActualHistoryVisibility,
};
