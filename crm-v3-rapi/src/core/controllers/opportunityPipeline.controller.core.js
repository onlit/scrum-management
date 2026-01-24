/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing opportunityPipeline using Prisma.
 * It includes functions for retrieving all opportunityPipeline, creating a new opportunityPipeline, retrieving a single opportunityPipeline,
 * updating an existing opportunityPipeline, and deleting a opportunityPipeline.
 *
 * The `getAllOpportunityPipeline` function retrieves a paginated list of opportunityPipeline based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createOpportunityPipeline` function validates the request body using a Joi schema, generates a unique code
 * for the opportunityPipeline, and creates a new opportunityPipeline in the database with additional metadata.
 *
 * The `getOpportunityPipeline` function retrieves a single opportunityPipeline based on the provided opportunityPipeline ID, with visibility
 * filters applied to ensure the opportunityPipeline is accessible to the requesting user.
 *
 * The `updateOpportunityPipeline` function updates an existing opportunityPipeline in the database based on the provided opportunityPipeline ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteOpportunityPipeline` function deletes a opportunityPipeline from the database based on the provided opportunityPipeline ID, with
 * visibility filters applied to ensure the opportunityPipeline is deletable by the requesting user.
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
  opportunityPipelineCreate,
  opportunityPipelineUpdate,
  opportunityPipelineBulkVisibilityUpdate,
} = require('#core/schemas/opportunityPipeline.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('OpportunityPipeline');
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
const MODEL_NAME_LITERAL = 'OpportunityPipeline';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/opportunityPipeline.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateOpportunityPipelineVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'OpportunityPipeline', 'update');

  logOperationStart('bulkUpdateOpportunityPipelineVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      opportunityPipelineBulkVisibilityUpdate,
      body,
      req,
      'opportunity_pipeline_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_opportunity_pipeline_visibility_client_guard',
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
            'bulk_update_opportunity_pipeline_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_opportunity_pipeline_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.opportunityPipeline.updateMany({
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
    logDatabaseSuccess('bulk_update_opportunity_pipeline_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateOpportunityPipelineVisibility', req, {
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
      operationName: 'bulk_update_opportunity_pipeline_visibility',
    });
    if (handled) return;
  }
}

async function getAllOpportunityPipeline(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('OpportunityPipeline');
  const context = createOperationContext(req, 'OpportunityPipeline', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllOpportunityPipeline', req, {
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

    const searchFields = ['description', 'name'];
    const filterFields = [...searchFields];

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
    logDatabaseStart('get_all_opportunity_pipeline', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: opportunityPipelineUpdate,
      filterFields,
      searchFields,
      model: 'opportunityPipeline',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_opportunity_pipeline', req, {
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
    logOperationSuccess('getAllOpportunityPipeline', req, {
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
      operationName: 'get_all_opportunity_pipeline',
    });
    if (handled) return;
  }
}

async function createOpportunityPipeline(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'OpportunityPipeline', 'create');

  logOperationStart('createOpportunityPipeline', req, {
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
    let schema = opportunityPipelineCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'opportunity_pipeline_creation',
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
    logDatabaseStart('create_opportunity_pipeline', req, {
      name: values.name,
      userId: user?.id,
    });

    const newOpportunityPipeline = await prisma.opportunityPipeline.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_opportunity_pipeline', req, {
      id: newOpportunityPipeline.id,
      code: newOpportunityPipeline.code,
    });

    const [newOpportunityPipelineWithDetails] = await getDetailsFromAPI({
      results: [newOpportunityPipeline],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newOpportunityPipelineWithDetails,
      [],
      user?.accessToken,
    );

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newOpportunityPipelineWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? {
          ...newOpportunityPipelineWithDetails,
          [DISPLAY_VALUE_PROP]: createdDv,
        }
      : newOpportunityPipelineWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createOpportunityPipeline', req, {
      id: newOpportunityPipeline.id,
      code: newOpportunityPipeline.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_opportunity_pipeline',
    });
    if (handled) return;
  }
}

async function getOpportunityPipeline(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'OpportunityPipeline', 'read');

  logOperationStart('getOpportunityPipeline', req, {
    user: user?.id,
    opportunityPipelineId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_opportunity_pipeline_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {};

    // Log database operation start
    logDatabaseStart('get_opportunity_pipeline', req, {
      opportunityPipelineId: params?.id,
      userId: user?.id,
    });

    const foundOpportunityPipeline = await prisma.opportunityPipeline.findFirst(
      {
        where: {
          id: params?.id,
          ...getVisibilityFilters(user),
        },
        include: Object.keys(include).length ? include : undefined,
      },
    );

    // Log database operation success
    logDatabaseSuccess('get_opportunity_pipeline', req, {
      found: !!foundOpportunityPipeline,
      opportunityPipelineId: params?.id,
    });

    if (!foundOpportunityPipeline) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityPipeline not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_opportunity_pipeline',
          details: { opportunityPipelineId: params?.id },
        },
      );
      logOperationError('getOpportunityPipeline', req, error);
      throw error;
    }

    const [foundOpportunityPipelineWithDetails] = await getDetailsFromAPI({
      results: [foundOpportunityPipeline],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundOpportunityPipelineWithDetails,
      [],
      user?.accessToken,
    );

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundOpportunityPipelineWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? {
          ...foundOpportunityPipelineWithDetails,
          [DISPLAY_VALUE_PROP]: foundDv,
        }
      : foundOpportunityPipelineWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getOpportunityPipeline', req, {
      id: foundOpportunityPipeline.id,
      code: foundOpportunityPipeline.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_opportunity_pipeline',
    });
    if (handled) return;
  }
}

async function updateOpportunityPipeline(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'OpportunityPipeline', 'update');

  logOperationStart('updateOpportunityPipeline', req, {
    opportunityPipelineId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_opportunity_pipeline_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = opportunityPipelineUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'opportunity_pipeline_update',
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
    logDatabaseStart('update_opportunity_pipeline', req, {
      opportunityPipelineId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.opportunityPipeline.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityPipeline not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_opportunity_pipeline',
          details: { opportunityPipelineId: params?.id },
        },
      );
      throw error;
    }

    const updatedOpportunityPipeline =
      await prisma.opportunityPipeline.findFirst({
        where: { id: params?.id, client: user?.client?.id, deleted: null },
      });

    // Log database operation success
    logDatabaseSuccess('update_opportunity_pipeline', req, {
      id: updatedOpportunityPipeline.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedOpportunityPipeline,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedOpportunityPipeline, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedOpportunityPipeline;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateOpportunityPipeline', req, {
      id: updatedOpportunityPipeline.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_opportunity_pipeline',
    });
    if (handled) return;
  }
}

async function deleteOpportunityPipeline(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'OpportunityPipeline', 'delete');

  logOperationStart('deleteOpportunityPipeline', req, {
    user: user?.id,
    opportunityPipelineId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_opportunity_pipeline_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    await prisma.salesPersonTarget.updateMany({
      where: {
        pipelineId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.opportunity.updateMany({
      where: {
        pipelineId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.pipelineStage.updateMany({
      where: {
        pipelineId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_opportunity_pipeline', req, {
      opportunityPipelineId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.opportunityPipeline.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_opportunity_pipeline', req, {
      deletedCount: result.count,
      opportunityPipelineId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityPipeline not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_opportunity_pipeline',
          details: { opportunityPipelineId: params?.id },
        },
      );
      logOperationError('deleteOpportunityPipeline', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteOpportunityPipeline', req, {
      deletedCount: result.count,
      opportunityPipelineId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_opportunity_pipeline',
    });
    if (handled) return;
  }
}

async function getOpportunityPipelineBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for opportunityPipeline',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllOpportunityPipeline,
  createOpportunityPipeline,
  getOpportunityPipeline,
  updateOpportunityPipeline,
  deleteOpportunityPipeline,
  getOpportunityPipelineBarChartData,
  bulkUpdateOpportunityPipelineVisibility,
};
