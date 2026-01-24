/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing salesPersonTarget using Prisma.
 * It includes functions for retrieving all salesPersonTarget, creating a new salesPersonTarget, retrieving a single salesPersonTarget,
 * updating an existing salesPersonTarget, and deleting a salesPersonTarget.
 *
 * The `getAllSalesPersonTarget` function retrieves a paginated list of salesPersonTarget based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createSalesPersonTarget` function validates the request body using a Joi schema, generates a unique code
 * for the salesPersonTarget, and creates a new salesPersonTarget in the database with additional metadata.
 *
 * The `getSalesPersonTarget` function retrieves a single salesPersonTarget based on the provided salesPersonTarget ID, with visibility
 * filters applied to ensure the salesPersonTarget is accessible to the requesting user.
 *
 * The `updateSalesPersonTarget` function updates an existing salesPersonTarget in the database based on the provided salesPersonTarget ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteSalesPersonTarget` function deletes a salesPersonTarget from the database based on the provided salesPersonTarget ID, with
 * visibility filters applied to ensure the salesPersonTarget is deletable by the requesting user.
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
  salesPersonTargetCreate,
  salesPersonTargetUpdate,
  salesPersonTargetBulkVisibilityUpdate,
} = require('#core/schemas/salesPersonTarget.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('SalesPersonTarget');
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
const MODEL_NAME_LITERAL = 'SalesPersonTarget';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/salesPersonTarget.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateSalesPersonTargetVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'SalesPersonTarget', 'update');

  logOperationStart('bulkUpdateSalesPersonTargetVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      salesPersonTargetBulkVisibilityUpdate,
      body,
      req,
      'sales_person_target_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_sales_person_target_visibility_client_guard',
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
            'bulk_update_sales_person_target_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_sales_person_target_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.salesPersonTarget.updateMany({
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
    logDatabaseSuccess('bulk_update_sales_person_target_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateSalesPersonTargetVisibility', req, {
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
      operationName: 'bulk_update_sales_person_target_visibility',
    });
    if (handled) return;
  }
}

async function getAllSalesPersonTarget(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('SalesPersonTarget');
  const context = createOperationContext(req, 'SalesPersonTarget', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllSalesPersonTarget', req, {
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

    const searchFields = ['notes'];
    const filterFields = [
      ...searchFields,
      'pipelineId',
      'targetUnit',
      'target',
      'expiryDate',
      'pipelineStageId',
      'salesPersonId',
    ];

    const include = {
      pipeline: true,
      pipelineStage: true,
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
    logDatabaseStart('get_all_sales_person_target', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: salesPersonTargetUpdate,
      filterFields,
      searchFields,
      model: 'salesPersonTarget',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_sales_person_target', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    await batchHydrateRelationsInList(
      response,
      ['pipeline', 'pipelineStage'],
      user?.accessToken,
    );

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        attachNestedDisplayValues(r, [
          { relation: 'pipeline', model: 'OpportunityPipeline' },
          { relation: 'pipelineStage', model: 'PipelineStage' },
        ]);
        const dv = computeDisplayValue(r, MODEL_NAME_LITERAL, displayOptions);
        return dv ? { ...r, [DISPLAY_VALUE_PROP]: dv } : r;
      });
    }

    // Lifecycle: afterList - transform response
    const afterListResult = await interceptor.afterList(response, context);
    const finalResponse = afterListResult.data;

    // Log operation success
    logOperationSuccess('getAllSalesPersonTarget', req, {
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
      operationName: 'get_all_sales_person_target',
    });
    if (handled) return;
  }
}

async function createSalesPersonTarget(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'SalesPersonTarget', 'create');

  logOperationStart('createSalesPersonTarget', req, {
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
    let schema = salesPersonTargetCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'sales_person_target_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = ['pipelineId', 'pipelineStageId'];

    const include = {
      pipeline: true,
      pipelineStage: true,
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
    logDatabaseStart('create_sales_person_target', req, {
      name: values.name,
      userId: user?.id,
    });

    const newSalesPersonTarget = await prisma.salesPersonTarget.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_sales_person_target', req, {
      id: newSalesPersonTarget.id,
      code: newSalesPersonTarget.code,
    });

    const [newSalesPersonTargetWithDetails] = await getDetailsFromAPI({
      results: [newSalesPersonTarget],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newSalesPersonTargetWithDetails,
      ['pipeline', 'pipelineStage'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newSalesPersonTargetWithDetails, [
      { relation: 'pipeline', model: 'OpportunityPipeline' },
      { relation: 'pipelineStage', model: 'PipelineStage' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newSalesPersonTargetWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? { ...newSalesPersonTargetWithDetails, [DISPLAY_VALUE_PROP]: createdDv }
      : newSalesPersonTargetWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createSalesPersonTarget', req, {
      id: newSalesPersonTarget.id,
      code: newSalesPersonTarget.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_sales_person_target',
    });
    if (handled) return;
  }
}

async function getSalesPersonTarget(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'SalesPersonTarget', 'read');

  logOperationStart('getSalesPersonTarget', req, {
    user: user?.id,
    salesPersonTargetId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_sales_person_target_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      pipeline: true,
      pipelineStage: true,
    };

    // Log database operation start
    logDatabaseStart('get_sales_person_target', req, {
      salesPersonTargetId: params?.id,
      userId: user?.id,
    });

    const foundSalesPersonTarget = await prisma.salesPersonTarget.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_sales_person_target', req, {
      found: !!foundSalesPersonTarget,
      salesPersonTargetId: params?.id,
    });

    if (!foundSalesPersonTarget) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'SalesPersonTarget not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_sales_person_target',
          details: { salesPersonTargetId: params?.id },
        },
      );
      logOperationError('getSalesPersonTarget', req, error);
      throw error;
    }

    const [foundSalesPersonTargetWithDetails] = await getDetailsFromAPI({
      results: [foundSalesPersonTarget],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundSalesPersonTargetWithDetails,
      ['pipeline', 'pipelineStage'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundSalesPersonTargetWithDetails, [
      { relation: 'pipeline', model: 'OpportunityPipeline' },
      { relation: 'pipelineStage', model: 'PipelineStage' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundSalesPersonTargetWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? { ...foundSalesPersonTargetWithDetails, [DISPLAY_VALUE_PROP]: foundDv }
      : foundSalesPersonTargetWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getSalesPersonTarget', req, {
      id: foundSalesPersonTarget.id,
      code: foundSalesPersonTarget.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_sales_person_target',
    });
    if (handled) return;
  }
}

async function updateSalesPersonTarget(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'SalesPersonTarget', 'update');

  logOperationStart('updateSalesPersonTarget', req, {
    salesPersonTargetId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_sales_person_target_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = salesPersonTargetUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'sales_person_target_update',
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
    logDatabaseStart('update_sales_person_target', req, {
      salesPersonTargetId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.salesPersonTarget.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'SalesPersonTarget not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_sales_person_target',
          details: { salesPersonTargetId: params?.id },
        },
      );
      throw error;
    }

    const updatedSalesPersonTarget = await prisma.salesPersonTarget.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
    });

    // Log database operation success
    logDatabaseSuccess('update_sales_person_target', req, {
      id: updatedSalesPersonTarget.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedSalesPersonTarget,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedSalesPersonTarget, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedSalesPersonTarget;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateSalesPersonTarget', req, {
      id: updatedSalesPersonTarget.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_sales_person_target',
    });
    if (handled) return;
  }
}

async function deleteSalesPersonTarget(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'SalesPersonTarget', 'delete');

  logOperationStart('deleteSalesPersonTarget', req, {
    user: user?.id,
    salesPersonTargetId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_sales_person_target_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    await prisma.targetActualHistory.updateMany({
      where: { targetId: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_sales_person_target', req, {
      salesPersonTargetId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.salesPersonTarget.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_sales_person_target', req, {
      deletedCount: result.count,
      salesPersonTargetId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'SalesPersonTarget not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_sales_person_target',
          details: { salesPersonTargetId: params?.id },
        },
      );
      logOperationError('deleteSalesPersonTarget', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteSalesPersonTarget', req, {
      deletedCount: result.count,
      salesPersonTargetId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_sales_person_target',
    });
    if (handled) return;
  }
}

async function getSalesPersonTargetBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for salesPersonTarget',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllSalesPersonTarget,
  createSalesPersonTarget,
  getSalesPersonTarget,
  updateSalesPersonTarget,
  deleteSalesPersonTarget,
  getSalesPersonTargetBarChartData,
  bulkUpdateSalesPersonTargetVisibility,
};
