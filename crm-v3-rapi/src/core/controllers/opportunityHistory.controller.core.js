/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing opportunityHistory using Prisma.
 * It includes functions for retrieving all opportunityHistory, creating a new opportunityHistory, retrieving a single opportunityHistory,
 * updating an existing opportunityHistory, and deleting a opportunityHistory.
 *
 * The `getAllOpportunityHistory` function retrieves a paginated list of opportunityHistory based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createOpportunityHistory` function validates the request body using a Joi schema, generates a unique code
 * for the opportunityHistory, and creates a new opportunityHistory in the database with additional metadata.
 *
 * The `getOpportunityHistory` function retrieves a single opportunityHistory based on the provided opportunityHistory ID, with visibility
 * filters applied to ensure the opportunityHistory is accessible to the requesting user.
 *
 * The `updateOpportunityHistory` function updates an existing opportunityHistory in the database based on the provided opportunityHistory ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteOpportunityHistory` function deletes a opportunityHistory from the database based on the provided opportunityHistory ID, with
 * visibility filters applied to ensure the opportunityHistory is deletable by the requesting user.
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
  opportunityHistoryCreate,
  opportunityHistoryUpdate,
  opportunityHistoryBulkVisibilityUpdate,
} = require('#core/schemas/opportunityHistory.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('OpportunityHistory');
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
const MODEL_NAME_LITERAL = 'OpportunityHistory';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/opportunityHistory.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateOpportunityHistoryVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'OpportunityHistory', 'update');

  logOperationStart('bulkUpdateOpportunityHistoryVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      opportunityHistoryBulkVisibilityUpdate,
      body,
      req,
      'opportunity_history_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_opportunity_history_visibility_client_guard',
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
            'bulk_update_opportunity_history_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_opportunity_history_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.opportunityHistory.updateMany({
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
    logDatabaseSuccess('bulk_update_opportunity_history_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateOpportunityHistoryVisibility', req, {
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
      operationName: 'bulk_update_opportunity_history_visibility',
    });
    if (handled) return;
  }
}

async function getAllOpportunityHistory(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('OpportunityHistory');
  const context = createOperationContext(req, 'OpportunityHistory', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllOpportunityHistory', req, {
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

    const searchFields = ['notes', 'url'];
    const filterFields = [...searchFields, 'opportunityId'];

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
    logDatabaseStart('get_all_opportunity_history', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: opportunityHistoryUpdate,
      filterFields,
      searchFields,
      model: 'opportunityHistory',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_opportunity_history', req, {
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
    logOperationSuccess('getAllOpportunityHistory', req, {
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
      operationName: 'get_all_opportunity_history',
    });
    if (handled) return;
  }
}

async function createOpportunityHistory(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'OpportunityHistory', 'create');

  logOperationStart('createOpportunityHistory', req, {
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
    let schema = opportunityHistoryCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'opportunity_history_creation',
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
    logDatabaseStart('create_opportunity_history', req, {
      name: values.name,
      userId: user?.id,
    });

    const newOpportunityHistory = await prisma.opportunityHistory.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_opportunity_history', req, {
      id: newOpportunityHistory.id,
      code: newOpportunityHistory.code,
    });

    const [newOpportunityHistoryWithDetails] = await getDetailsFromAPI({
      results: [newOpportunityHistory],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newOpportunityHistoryWithDetails,
      ['opportunity'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newOpportunityHistoryWithDetails, [
      { relation: 'opportunity', model: 'Opportunity' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newOpportunityHistoryWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? { ...newOpportunityHistoryWithDetails, [DISPLAY_VALUE_PROP]: createdDv }
      : newOpportunityHistoryWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createOpportunityHistory', req, {
      id: newOpportunityHistory.id,
      code: newOpportunityHistory.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_opportunity_history',
    });
    if (handled) return;
  }
}

async function getOpportunityHistory(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'OpportunityHistory', 'read');

  logOperationStart('getOpportunityHistory', req, {
    user: user?.id,
    opportunityHistoryId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_opportunity_history_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      opportunity: true,
    };

    // Log database operation start
    logDatabaseStart('get_opportunity_history', req, {
      opportunityHistoryId: params?.id,
      userId: user?.id,
    });

    const foundOpportunityHistory = await prisma.opportunityHistory.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_opportunity_history', req, {
      found: !!foundOpportunityHistory,
      opportunityHistoryId: params?.id,
    });

    if (!foundOpportunityHistory) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityHistory not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_opportunity_history',
          details: { opportunityHistoryId: params?.id },
        },
      );
      logOperationError('getOpportunityHistory', req, error);
      throw error;
    }

    const [foundOpportunityHistoryWithDetails] = await getDetailsFromAPI({
      results: [foundOpportunityHistory],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundOpportunityHistoryWithDetails,
      ['opportunity'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundOpportunityHistoryWithDetails, [
      { relation: 'opportunity', model: 'Opportunity' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundOpportunityHistoryWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? { ...foundOpportunityHistoryWithDetails, [DISPLAY_VALUE_PROP]: foundDv }
      : foundOpportunityHistoryWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getOpportunityHistory', req, {
      id: foundOpportunityHistory.id,
      code: foundOpportunityHistory.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_opportunity_history',
    });
    if (handled) return;
  }
}

async function updateOpportunityHistory(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'OpportunityHistory', 'update');

  logOperationStart('updateOpportunityHistory', req, {
    opportunityHistoryId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_opportunity_history_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = opportunityHistoryUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'opportunity_history_update',
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
    logDatabaseStart('update_opportunity_history', req, {
      opportunityHistoryId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.opportunityHistory.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityHistory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_opportunity_history',
          details: { opportunityHistoryId: params?.id },
        },
      );
      throw error;
    }

    const updatedOpportunityHistory = await prisma.opportunityHistory.findFirst(
      {
        where: { id: params?.id, client: user?.client?.id, deleted: null },
      },
    );

    // Log database operation success
    logDatabaseSuccess('update_opportunity_history', req, {
      id: updatedOpportunityHistory.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedOpportunityHistory,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedOpportunityHistory, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedOpportunityHistory;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateOpportunityHistory', req, {
      id: updatedOpportunityHistory.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_opportunity_history',
    });
    if (handled) return;
  }
}

async function deleteOpportunityHistory(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'OpportunityHistory', 'delete');

  logOperationStart('deleteOpportunityHistory', req, {
    user: user?.id,
    opportunityHistoryId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_opportunity_history_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    // Log database operation start
    logDatabaseStart('delete_opportunity_history', req, {
      opportunityHistoryId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.opportunityHistory.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_opportunity_history', req, {
      deletedCount: result.count,
      opportunityHistoryId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityHistory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_opportunity_history',
          details: { opportunityHistoryId: params?.id },
        },
      );
      logOperationError('deleteOpportunityHistory', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteOpportunityHistory', req, {
      deletedCount: result.count,
      opportunityHistoryId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_opportunity_history',
    });
    if (handled) return;
  }
}

async function getOpportunityHistoryBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for opportunityHistory',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllOpportunityHistory,
  createOpportunityHistory,
  getOpportunityHistory,
  updateOpportunityHistory,
  deleteOpportunityHistory,
  getOpportunityHistoryBarChartData,
  bulkUpdateOpportunityHistoryVisibility,
};
