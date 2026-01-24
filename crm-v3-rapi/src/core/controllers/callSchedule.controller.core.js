/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing callSchedule using Prisma.
 * It includes functions for retrieving all callSchedule, creating a new callSchedule, retrieving a single callSchedule,
 * updating an existing callSchedule, and deleting a callSchedule.
 *
 * The `getAllCallSchedule` function retrieves a paginated list of callSchedule based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCallSchedule` function validates the request body using a Joi schema, generates a unique code
 * for the callSchedule, and creates a new callSchedule in the database with additional metadata.
 *
 * The `getCallSchedule` function retrieves a single callSchedule based on the provided callSchedule ID, with visibility
 * filters applied to ensure the callSchedule is accessible to the requesting user.
 *
 * The `updateCallSchedule` function updates an existing callSchedule in the database based on the provided callSchedule ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCallSchedule` function deletes a callSchedule from the database based on the provided callSchedule ID, with
 * visibility filters applied to ensure the callSchedule is deletable by the requesting user.
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
  callScheduleCreate,
  callScheduleUpdate,
  callScheduleBulkVisibilityUpdate,
} = require('#core/schemas/callSchedule.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('CallSchedule');
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
const MODEL_NAME_LITERAL = 'CallSchedule';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/callSchedule.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateCallScheduleVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'CallSchedule', 'update');

  logOperationStart('bulkUpdateCallScheduleVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      callScheduleBulkVisibilityUpdate,
      body,
      req,
      'call_schedule_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_call_schedule_visibility_client_guard',
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
          context: 'bulk_update_call_schedule_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_call_schedule_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.callSchedule.updateMany({
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
    logDatabaseSuccess('bulk_update_call_schedule_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateCallScheduleVisibility', req, {
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
      operationName: 'bulk_update_call_schedule_visibility',
    });
    if (handled) return;
  }
}

async function getAllCallSchedule(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('CallSchedule');
  const context = createOperationContext(req, 'CallSchedule', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllCallSchedule', req, {
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
      'callListPipelineStageId',
      'scheduleDatetime',
      'callListId',
      'personId',
    ];

    const include = {
      callListPipelineStage: true,
      callList: true,
      person: true,
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
    logDatabaseStart('get_all_call_schedule', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: callScheduleUpdate,
      filterFields,
      searchFields,
      model: 'callSchedule',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_call_schedule', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    await batchHydrateRelationsInList(
      response,
      ['callListPipelineStage', 'callList', 'person'],
      user?.accessToken,
    );

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        attachNestedDisplayValues(r, [
          { relation: 'callListPipelineStage', model: 'CallListPipelineStage' },
          { relation: 'callList', model: 'CallList' },
          { relation: 'person', model: 'Person' },
        ]);
        const dv = computeDisplayValue(r, MODEL_NAME_LITERAL, displayOptions);
        return dv ? { ...r, [DISPLAY_VALUE_PROP]: dv } : r;
      });
    }

    // Lifecycle: afterList - transform response
    const afterListResult = await interceptor.afterList(response, context);
    const finalResponse = afterListResult.data;

    // Log operation success
    logOperationSuccess('getAllCallSchedule', req, {
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
      operationName: 'get_all_call_schedule',
    });
    if (handled) return;
  }
}

async function createCallSchedule(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'CallSchedule', 'create');

  logOperationStart('createCallSchedule', req, {
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
    let schema = callScheduleCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'call_schedule_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = [
      'callListPipelineStageId',
      'callListId',
      'personId',
    ];

    const include = {
      callListPipelineStage: true,
      callList: true,
      person: true,
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
    logDatabaseStart('create_call_schedule', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCallSchedule = await prisma.callSchedule.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_call_schedule', req, {
      id: newCallSchedule.id,
      code: newCallSchedule.code,
    });

    const [newCallScheduleWithDetails] = await getDetailsFromAPI({
      results: [newCallSchedule],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newCallScheduleWithDetails,
      ['callListPipelineStage', 'callList', 'person'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newCallScheduleWithDetails, [
      { relation: 'callListPipelineStage', model: 'CallListPipelineStage' },
      { relation: 'callList', model: 'CallList' },
      { relation: 'person', model: 'Person' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newCallScheduleWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? { ...newCallScheduleWithDetails, [DISPLAY_VALUE_PROP]: createdDv }
      : newCallScheduleWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createCallSchedule', req, {
      id: newCallSchedule.id,
      code: newCallSchedule.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_call_schedule',
    });
    if (handled) return;
  }
}

async function getCallSchedule(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'CallSchedule', 'read');

  logOperationStart('getCallSchedule', req, {
    user: user?.id,
    callScheduleId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_call_schedule_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      callListPipelineStage: true,
      callList: true,
      person: true,
    };

    // Log database operation start
    logDatabaseStart('get_call_schedule', req, {
      callScheduleId: params?.id,
      userId: user?.id,
    });

    const foundCallSchedule = await prisma.callSchedule.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_call_schedule', req, {
      found: !!foundCallSchedule,
      callScheduleId: params?.id,
    });

    if (!foundCallSchedule) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallSchedule not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_call_schedule',
          details: { callScheduleId: params?.id },
        },
      );
      logOperationError('getCallSchedule', req, error);
      throw error;
    }

    const [foundCallScheduleWithDetails] = await getDetailsFromAPI({
      results: [foundCallSchedule],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundCallScheduleWithDetails,
      ['callListPipelineStage', 'callList', 'person'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundCallScheduleWithDetails, [
      { relation: 'callListPipelineStage', model: 'CallListPipelineStage' },
      { relation: 'callList', model: 'CallList' },
      { relation: 'person', model: 'Person' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundCallScheduleWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? { ...foundCallScheduleWithDetails, [DISPLAY_VALUE_PROP]: foundDv }
      : foundCallScheduleWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getCallSchedule', req, {
      id: foundCallSchedule.id,
      code: foundCallSchedule.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_call_schedule',
    });
    if (handled) return;
  }
}

async function updateCallSchedule(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'CallSchedule', 'update');

  logOperationStart('updateCallSchedule', req, {
    callScheduleId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_call_schedule_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = callScheduleUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'call_schedule_update',
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
    logDatabaseStart('update_call_schedule', req, {
      callScheduleId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.callSchedule.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallSchedule not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_call_schedule',
          details: { callScheduleId: params?.id },
        },
      );
      throw error;
    }

    const updatedCallSchedule = await prisma.callSchedule.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
    });

    // Log database operation success
    logDatabaseSuccess('update_call_schedule', req, {
      id: updatedCallSchedule.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedCallSchedule,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedCallSchedule, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedCallSchedule;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateCallSchedule', req, {
      id: updatedCallSchedule.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_call_schedule',
    });
    if (handled) return;
  }
}

async function deleteCallSchedule(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'CallSchedule', 'delete');

  logOperationStart('deleteCallSchedule', req, {
    user: user?.id,
    callScheduleId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_call_schedule_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    await prisma.callHistory.updateMany({
      where: {
        callScheduleId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_call_schedule', req, {
      callScheduleId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.callSchedule.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_call_schedule', req, {
      deletedCount: result.count,
      callScheduleId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallSchedule not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_call_schedule',
          details: { callScheduleId: params?.id },
        },
      );
      logOperationError('deleteCallSchedule', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteCallSchedule', req, {
      deletedCount: result.count,
      callScheduleId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_call_schedule',
    });
    if (handled) return;
  }
}

async function getCallScheduleBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for callSchedule',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCallSchedule,
  createCallSchedule,
  getCallSchedule,
  updateCallSchedule,
  deleteCallSchedule,
  getCallScheduleBarChartData,
  bulkUpdateCallScheduleVisibility,
};
