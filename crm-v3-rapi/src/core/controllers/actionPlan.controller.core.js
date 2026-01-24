/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing actionPlan using Prisma.
 * It includes functions for retrieving all actionPlan, creating a new actionPlan, retrieving a single actionPlan,
 * updating an existing actionPlan, and deleting a actionPlan.
 *
 * The `getAllActionPlan` function retrieves a paginated list of actionPlan based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createActionPlan` function validates the request body using a Joi schema, generates a unique code
 * for the actionPlan, and creates a new actionPlan in the database with additional metadata.
 *
 * The `getActionPlan` function retrieves a single actionPlan based on the provided actionPlan ID, with visibility
 * filters applied to ensure the actionPlan is accessible to the requesting user.
 *
 * The `updateActionPlan` function updates an existing actionPlan in the database based on the provided actionPlan ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteActionPlan` function deletes a actionPlan from the database based on the provided actionPlan ID, with
 * visibility filters applied to ensure the actionPlan is deletable by the requesting user.
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
  actionPlanCreate,
  actionPlanUpdate,
  actionPlanBulkVisibilityUpdate,
} = require('#core/schemas/actionPlan.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('ActionPlan');
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
const MODEL_NAME_LITERAL = 'ActionPlan';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/actionPlan.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateActionPlanVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'ActionPlan', 'update');

  logOperationStart('bulkUpdateActionPlanVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      actionPlanBulkVisibilityUpdate,
      body,
      req,
      'action_plan_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_action_plan_visibility_client_guard',
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
          context: 'bulk_update_action_plan_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_action_plan_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.actionPlan.updateMany({
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
    logDatabaseSuccess('bulk_update_action_plan_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateActionPlanVisibility', req, {
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
      operationName: 'bulk_update_action_plan_visibility',
    });
    if (handled) return;
  }
}

async function getAllActionPlan(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('ActionPlan');
  const context = createOperationContext(req, 'ActionPlan', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllActionPlan', req, {
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

    const searchFields = ['what', 'who'];
    const filterFields = [...searchFields, 'opportunityId', 'when'];

    const include = {
      opportunity: true,
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
    logDatabaseStart('get_all_action_plan', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: actionPlanUpdate,
      filterFields,
      searchFields,
      model: 'actionPlan',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_action_plan', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    await batchHydrateRelationsInList(
      response,
      ['opportunity'],
      user?.accessToken,
    );

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        attachNestedDisplayValues(r, [
          { relation: 'opportunity', model: 'Opportunity' },
        ]);
        const dv = computeDisplayValue(r, MODEL_NAME_LITERAL, displayOptions);
        return dv ? { ...r, [DISPLAY_VALUE_PROP]: dv } : r;
      });
    }

    // Lifecycle: afterList - transform response
    const afterListResult = await interceptor.afterList(response, context);
    const finalResponse = afterListResult.data;

    // Log operation success
    logOperationSuccess('getAllActionPlan', req, {
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
      operationName: 'get_all_action_plan',
    });
    if (handled) return;
  }
}

async function createActionPlan(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'ActionPlan', 'create');

  logOperationStart('createActionPlan', req, {
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
    let schema = actionPlanCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'action_plan_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = ['opportunityId'];

    const include = {
      opportunity: true,
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
    logDatabaseStart('create_action_plan', req, {
      name: values.name,
      userId: user?.id,
    });

    const newActionPlan = await prisma.actionPlan.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_action_plan', req, {
      id: newActionPlan.id,
      code: newActionPlan.code,
    });

    const [newActionPlanWithDetails] = await getDetailsFromAPI({
      results: [newActionPlan],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newActionPlanWithDetails,
      ['opportunity'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newActionPlanWithDetails, [
      { relation: 'opportunity', model: 'Opportunity' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newActionPlanWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? { ...newActionPlanWithDetails, [DISPLAY_VALUE_PROP]: createdDv }
      : newActionPlanWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createActionPlan', req, {
      id: newActionPlan.id,
      code: newActionPlan.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_action_plan',
    });
    if (handled) return;
  }
}

async function getActionPlan(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'ActionPlan', 'read');

  logOperationStart('getActionPlan', req, {
    user: user?.id,
    actionPlanId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_action_plan_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      opportunity: true,
    };

    // Log database operation start
    logDatabaseStart('get_action_plan', req, {
      actionPlanId: params?.id,
      userId: user?.id,
    });

    const foundActionPlan = await prisma.actionPlan.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_action_plan', req, {
      found: !!foundActionPlan,
      actionPlanId: params?.id,
    });

    if (!foundActionPlan) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ActionPlan not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_action_plan',
          details: { actionPlanId: params?.id },
        },
      );
      logOperationError('getActionPlan', req, error);
      throw error;
    }

    const [foundActionPlanWithDetails] = await getDetailsFromAPI({
      results: [foundActionPlan],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundActionPlanWithDetails,
      ['opportunity'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundActionPlanWithDetails, [
      { relation: 'opportunity', model: 'Opportunity' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundActionPlanWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? { ...foundActionPlanWithDetails, [DISPLAY_VALUE_PROP]: foundDv }
      : foundActionPlanWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getActionPlan', req, {
      id: foundActionPlan.id,
      code: foundActionPlan.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_action_plan',
    });
    if (handled) return;
  }
}

async function updateActionPlan(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'ActionPlan', 'update');

  logOperationStart('updateActionPlan', req, {
    actionPlanId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_action_plan_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = actionPlanUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'action_plan_update',
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
    logDatabaseStart('update_action_plan', req, {
      actionPlanId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.actionPlan.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ActionPlan not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_action_plan',
          details: { actionPlanId: params?.id },
        },
      );
      throw error;
    }

    const updatedActionPlan = await prisma.actionPlan.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
    });

    // Log database operation success
    logDatabaseSuccess('update_action_plan', req, {
      id: updatedActionPlan.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedActionPlan,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedActionPlan, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedActionPlan;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateActionPlan', req, {
      id: updatedActionPlan.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_action_plan',
    });
    if (handled) return;
  }
}

async function deleteActionPlan(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'ActionPlan', 'delete');

  logOperationStart('deleteActionPlan', req, {
    user: user?.id,
    actionPlanId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_action_plan_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    // Log database operation start
    logDatabaseStart('delete_action_plan', req, {
      actionPlanId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.actionPlan.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_action_plan', req, {
      deletedCount: result.count,
      actionPlanId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ActionPlan not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_action_plan',
          details: { actionPlanId: params?.id },
        },
      );
      logOperationError('deleteActionPlan', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteActionPlan', req, {
      deletedCount: result.count,
      actionPlanId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_action_plan',
    });
    if (handled) return;
  }
}

async function getActionPlanBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for actionPlan',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllActionPlan,
  createActionPlan,
  getActionPlan,
  updateActionPlan,
  deleteActionPlan,
  getActionPlanBarChartData,
  bulkUpdateActionPlanVisibility,
};
