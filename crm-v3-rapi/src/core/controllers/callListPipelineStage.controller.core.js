/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing callListPipelineStage using Prisma.
 * It includes functions for retrieving all callListPipelineStage, creating a new callListPipelineStage, retrieving a single callListPipelineStage,
 * updating an existing callListPipelineStage, and deleting a callListPipelineStage.
 *
 * The `getAllCallListPipelineStage` function retrieves a paginated list of callListPipelineStage based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCallListPipelineStage` function validates the request body using a Joi schema, generates a unique code
 * for the callListPipelineStage, and creates a new callListPipelineStage in the database with additional metadata.
 *
 * The `getCallListPipelineStage` function retrieves a single callListPipelineStage based on the provided callListPipelineStage ID, with visibility
 * filters applied to ensure the callListPipelineStage is accessible to the requesting user.
 *
 * The `updateCallListPipelineStage` function updates an existing callListPipelineStage in the database based on the provided callListPipelineStage ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCallListPipelineStage` function deletes a callListPipelineStage from the database based on the provided callListPipelineStage ID, with
 * visibility filters applied to ensure the callListPipelineStage is deletable by the requesting user.
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
  callListPipelineStageCreate,
  callListPipelineStageUpdate,
  callListPipelineStageBulkVisibilityUpdate,
} = require('#core/schemas/callListPipelineStage.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('CallListPipelineStage');
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
const MODEL_NAME_LITERAL = 'CallListPipelineStage';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/callListPipelineStage.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateCallListPipelineStageVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(
    req,
    'CallListPipelineStage',
    'update',
  );

  logOperationStart('bulkUpdateCallListPipelineStageVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      callListPipelineStageBulkVisibilityUpdate,
      body,
      req,
      'call_list_pipeline_stage_bulk_visibility_update',
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
            'bulk_update_call_list_pipeline_stage_visibility_client_guard',
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
            'bulk_update_call_list_pipeline_stage_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_call_list_pipeline_stage_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.callListPipelineStage.updateMany({
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
    logDatabaseSuccess('bulk_update_call_list_pipeline_stage_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateCallListPipelineStageVisibility', req, {
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
      operationName: 'bulk_update_call_list_pipeline_stage_visibility',
    });
    if (handled) return;
  }
}

async function getAllCallListPipelineStage(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('CallListPipelineStage');
  const context = createOperationContext(req, 'CallListPipelineStage', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllCallListPipelineStage', req, {
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
    const filterFields = [
      ...searchFields,
      'order',
      'rottingDays',
      'callListPipelineId',
    ];

    const include = {
      callListPipeline: true,
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
    logDatabaseStart('get_all_call_list_pipeline_stage', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: callListPipelineStageUpdate,
      filterFields,
      searchFields,
      model: 'callListPipelineStage',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_call_list_pipeline_stage', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    await batchHydrateRelationsInList(
      response,
      ['callListPipeline'],
      user?.accessToken,
    );

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        attachNestedDisplayValues(r, [
          { relation: 'callListPipeline', model: 'CallListPipeline' },
        ]);
        const dv = computeDisplayValue(r, MODEL_NAME_LITERAL, displayOptions);
        return dv ? { ...r, [DISPLAY_VALUE_PROP]: dv } : r;
      });
    }

    // Lifecycle: afterList - transform response
    const afterListResult = await interceptor.afterList(response, context);
    const finalResponse = afterListResult.data;

    // Log operation success
    logOperationSuccess('getAllCallListPipelineStage', req, {
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
      operationName: 'get_all_call_list_pipeline_stage',
    });
    if (handled) return;
  }
}

async function createCallListPipelineStage(req, res) {
  const { user, body } = req;
  const context = createOperationContext(
    req,
    'CallListPipelineStage',
    'create',
  );

  logOperationStart('createCallListPipelineStage', req, {
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
    let schema = callListPipelineStageCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'call_list_pipeline_stage_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = ['callListPipelineId'];

    const include = {
      callListPipeline: true,
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
    logDatabaseStart('create_call_list_pipeline_stage', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCallListPipelineStage = await prisma.callListPipelineStage.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_call_list_pipeline_stage', req, {
      id: newCallListPipelineStage.id,
      code: newCallListPipelineStage.code,
    });

    const [newCallListPipelineStageWithDetails] = await getDetailsFromAPI({
      results: [newCallListPipelineStage],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newCallListPipelineStageWithDetails,
      ['callListPipeline'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newCallListPipelineStageWithDetails, [
      { relation: 'callListPipeline', model: 'CallListPipeline' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newCallListPipelineStageWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? {
          ...newCallListPipelineStageWithDetails,
          [DISPLAY_VALUE_PROP]: createdDv,
        }
      : newCallListPipelineStageWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createCallListPipelineStage', req, {
      id: newCallListPipelineStage.id,
      code: newCallListPipelineStage.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_call_list_pipeline_stage',
    });
    if (handled) return;
  }
}

async function getCallListPipelineStage(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'CallListPipelineStage', 'read');

  logOperationStart('getCallListPipelineStage', req, {
    user: user?.id,
    callListPipelineStageId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_call_list_pipeline_stage_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      callListPipeline: true,
    };

    // Log database operation start
    logDatabaseStart('get_call_list_pipeline_stage', req, {
      callListPipelineStageId: params?.id,
      userId: user?.id,
    });

    const foundCallListPipelineStage =
      await prisma.callListPipelineStage.findFirst({
        where: {
          id: params?.id,
          ...getVisibilityFilters(user),
        },
        include: Object.keys(include).length ? include : undefined,
      });

    // Log database operation success
    logDatabaseSuccess('get_call_list_pipeline_stage', req, {
      found: !!foundCallListPipelineStage,
      callListPipelineStageId: params?.id,
    });

    if (!foundCallListPipelineStage) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallListPipelineStage not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_call_list_pipeline_stage',
          details: { callListPipelineStageId: params?.id },
        },
      );
      logOperationError('getCallListPipelineStage', req, error);
      throw error;
    }

    const [foundCallListPipelineStageWithDetails] = await getDetailsFromAPI({
      results: [foundCallListPipelineStage],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundCallListPipelineStageWithDetails,
      ['callListPipeline'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundCallListPipelineStageWithDetails, [
      { relation: 'callListPipeline', model: 'CallListPipeline' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundCallListPipelineStageWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? {
          ...foundCallListPipelineStageWithDetails,
          [DISPLAY_VALUE_PROP]: foundDv,
        }
      : foundCallListPipelineStageWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getCallListPipelineStage', req, {
      id: foundCallListPipelineStage.id,
      code: foundCallListPipelineStage.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_call_list_pipeline_stage',
    });
    if (handled) return;
  }
}

async function updateCallListPipelineStage(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(
    req,
    'CallListPipelineStage',
    'update',
  );

  logOperationStart('updateCallListPipelineStage', req, {
    callListPipelineStageId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(
      params?.id,
      req,
      'update_call_list_pipeline_stage_param',
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
    let schema = callListPipelineStageUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'call_list_pipeline_stage_update',
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
    logDatabaseStart('update_call_list_pipeline_stage', req, {
      callListPipelineStageId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.callListPipelineStage.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallListPipelineStage not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_call_list_pipeline_stage',
          details: { callListPipelineStageId: params?.id },
        },
      );
      throw error;
    }

    const updatedCallListPipelineStage =
      await prisma.callListPipelineStage.findFirst({
        where: { id: params?.id, client: user?.client?.id, deleted: null },
      });

    // Log database operation success
    logDatabaseSuccess('update_call_list_pipeline_stage', req, {
      id: updatedCallListPipelineStage.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedCallListPipelineStage,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedCallListPipelineStage, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedCallListPipelineStage;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateCallListPipelineStage', req, {
      id: updatedCallListPipelineStage.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_call_list_pipeline_stage',
    });
    if (handled) return;
  }
}

async function deleteCallListPipelineStage(req, res) {
  const { params, user } = req;
  const context = createOperationContext(
    req,
    'CallListPipelineStage',
    'delete',
  );

  logOperationStart('deleteCallListPipelineStage', req, {
    user: user?.id,
    callListPipelineStageId: params?.id,
  });

  try {
    assertValidUuidParam(
      params?.id,
      req,
      'delete_call_list_pipeline_stage_param',
    );

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    await prisma.callSchedule.updateMany({
      where: {
        callListPipelineStageId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.callHistory.updateMany({
      where: {
        callListPipelineStageId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_call_list_pipeline_stage', req, {
      callListPipelineStageId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.callListPipelineStage.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_call_list_pipeline_stage', req, {
      deletedCount: result.count,
      callListPipelineStageId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CallListPipelineStage not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_call_list_pipeline_stage',
          details: { callListPipelineStageId: params?.id },
        },
      );
      logOperationError('deleteCallListPipelineStage', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteCallListPipelineStage', req, {
      deletedCount: result.count,
      callListPipelineStageId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_call_list_pipeline_stage',
    });
    if (handled) return;
  }
}

async function getCallListPipelineStageBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for callListPipelineStage',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCallListPipelineStage,
  createCallListPipelineStage,
  getCallListPipelineStage,
  updateCallListPipelineStage,
  deleteCallListPipelineStage,
  getCallListPipelineStageBarChartData,
  bulkUpdateCallListPipelineStageVisibility,
};
