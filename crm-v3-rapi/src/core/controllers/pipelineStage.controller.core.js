/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing pipelineStage using Prisma.
 * It includes functions for retrieving all pipelineStage, creating a new pipelineStage, retrieving a single pipelineStage,
 * updating an existing pipelineStage, and deleting a pipelineStage.
 *
 * The `getAllPipelineStage` function retrieves a paginated list of pipelineStage based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createPipelineStage` function validates the request body using a Joi schema, generates a unique code
 * for the pipelineStage, and creates a new pipelineStage in the database with additional metadata.
 *
 * The `getPipelineStage` function retrieves a single pipelineStage based on the provided pipelineStage ID, with visibility
 * filters applied to ensure the pipelineStage is accessible to the requesting user.
 *
 * The `updatePipelineStage` function updates an existing pipelineStage in the database based on the provided pipelineStage ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deletePipelineStage` function deletes a pipelineStage from the database based on the provided pipelineStage ID, with
 * visibility filters applied to ensure the pipelineStage is deletable by the requesting user.
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
  pipelineStageCreate,
  pipelineStageUpdate,
  pipelineStageBulkVisibilityUpdate,
} = require('#core/schemas/pipelineStage.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('PipelineStage');
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
const MODEL_NAME_LITERAL = 'PipelineStage';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/pipelineStage.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdatePipelineStageVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'PipelineStage', 'update');

  logOperationStart('bulkUpdatePipelineStageVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      pipelineStageBulkVisibilityUpdate,
      body,
      req,
      'pipeline_stage_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_pipeline_stage_visibility_client_guard',
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
          context: 'bulk_update_pipeline_stage_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_pipeline_stage_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.pipelineStage.updateMany({
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
    logDatabaseSuccess('bulk_update_pipeline_stage_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdatePipelineStageVisibility', req, {
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
      operationName: 'bulk_update_pipeline_stage_visibility',
    });
    if (handled) return;
  }
}

async function getAllPipelineStage(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('PipelineStage');
  const context = createOperationContext(req, 'PipelineStage', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllPipelineStage', req, {
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

    const searchFields = ['stage', 'description', 'immediateNextAction'];
    const filterFields = [
      ...searchFields,
      'conversion',
      'confidence',
      'rottingDays',
      'pipelineId',
      'parentPipelineStageId',
      'order',
    ];

    const include = {
      pipeline: true,
      parentPipelineStage: true,
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
    logDatabaseStart('get_all_pipeline_stage', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: pipelineStageUpdate,
      filterFields,
      searchFields,
      model: 'pipelineStage',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_pipeline_stage', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    await batchHydrateRelationsInList(
      response,
      ['pipeline', 'parentPipelineStage'],
      user?.accessToken,
    );

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        attachNestedDisplayValues(r, [
          { relation: 'pipeline', model: 'OpportunityPipeline' },
          { relation: 'parentPipelineStage', model: 'PipelineStage' },
        ]);
        const dv = computeDisplayValue(r, MODEL_NAME_LITERAL, displayOptions);
        return dv ? { ...r, [DISPLAY_VALUE_PROP]: dv } : r;
      });
    }

    // Lifecycle: afterList - transform response
    const afterListResult = await interceptor.afterList(response, context);
    const finalResponse = afterListResult.data;

    // Log operation success
    logOperationSuccess('getAllPipelineStage', req, {
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
      operationName: 'get_all_pipeline_stage',
    });
    if (handled) return;
  }
}

async function createPipelineStage(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'PipelineStage', 'create');

  logOperationStart('createPipelineStage', req, {
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
    let schema = pipelineStageCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'pipeline_stage_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = ['pipelineId', 'parentPipelineStageId'];

    const include = {
      pipeline: true,
      parentPipelineStage: true,
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
    logDatabaseStart('create_pipeline_stage', req, {
      name: values.name,
      userId: user?.id,
    });

    const newPipelineStage = await prisma.pipelineStage.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_pipeline_stage', req, {
      id: newPipelineStage.id,
      code: newPipelineStage.code,
    });

    const [newPipelineStageWithDetails] = await getDetailsFromAPI({
      results: [newPipelineStage],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newPipelineStageWithDetails,
      ['pipeline', 'parentPipelineStage'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newPipelineStageWithDetails, [
      { relation: 'pipeline', model: 'OpportunityPipeline' },
      { relation: 'parentPipelineStage', model: 'PipelineStage' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newPipelineStageWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? { ...newPipelineStageWithDetails, [DISPLAY_VALUE_PROP]: createdDv }
      : newPipelineStageWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createPipelineStage', req, {
      id: newPipelineStage.id,
      code: newPipelineStage.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_pipeline_stage',
    });
    if (handled) return;
  }
}

async function getPipelineStage(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'PipelineStage', 'read');

  logOperationStart('getPipelineStage', req, {
    user: user?.id,
    pipelineStageId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_pipeline_stage_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      pipeline: true,
      parentPipelineStage: true,
    };

    // Log database operation start
    logDatabaseStart('get_pipeline_stage', req, {
      pipelineStageId: params?.id,
      userId: user?.id,
    });

    const foundPipelineStage = await prisma.pipelineStage.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_pipeline_stage', req, {
      found: !!foundPipelineStage,
      pipelineStageId: params?.id,
    });

    if (!foundPipelineStage) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PipelineStage not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_pipeline_stage',
          details: { pipelineStageId: params?.id },
        },
      );
      logOperationError('getPipelineStage', req, error);
      throw error;
    }

    const [foundPipelineStageWithDetails] = await getDetailsFromAPI({
      results: [foundPipelineStage],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundPipelineStageWithDetails,
      ['pipeline', 'parentPipelineStage'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundPipelineStageWithDetails, [
      { relation: 'pipeline', model: 'OpportunityPipeline' },
      { relation: 'parentPipelineStage', model: 'PipelineStage' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundPipelineStageWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? { ...foundPipelineStageWithDetails, [DISPLAY_VALUE_PROP]: foundDv }
      : foundPipelineStageWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getPipelineStage', req, {
      id: foundPipelineStage.id,
      code: foundPipelineStage.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_pipeline_stage',
    });
    if (handled) return;
  }
}

async function updatePipelineStage(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'PipelineStage', 'update');

  logOperationStart('updatePipelineStage', req, {
    pipelineStageId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_pipeline_stage_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = pipelineStageUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'pipeline_stage_update',
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
    logDatabaseStart('update_pipeline_stage', req, {
      pipelineStageId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.pipelineStage.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PipelineStage not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_pipeline_stage',
          details: { pipelineStageId: params?.id },
        },
      );
      throw error;
    }

    const updatedPipelineStage = await prisma.pipelineStage.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
    });

    // Log database operation success
    logDatabaseSuccess('update_pipeline_stage', req, {
      id: updatedPipelineStage.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedPipelineStage,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedPipelineStage, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedPipelineStage;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updatePipelineStage', req, {
      id: updatedPipelineStage.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_pipeline_stage',
    });
    if (handled) return;
  }
}

async function deletePipelineStage(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'PipelineStage', 'delete');

  logOperationStart('deletePipelineStage', req, {
    user: user?.id,
    pipelineStageId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_pipeline_stage_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    await prisma.salesPersonTarget.updateMany({
      where: {
        pipelineStageId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.opportunity.updateMany({
      where: { statusId: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.pipelineStage.updateMany({
      where: {
        parentPipelineStageId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_pipeline_stage', req, {
      pipelineStageId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.pipelineStage.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_pipeline_stage', req, {
      deletedCount: result.count,
      pipelineStageId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PipelineStage not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_pipeline_stage',
          details: { pipelineStageId: params?.id },
        },
      );
      logOperationError('deletePipelineStage', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deletePipelineStage', req, {
      deletedCount: result.count,
      pipelineStageId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_pipeline_stage',
    });
    if (handled) return;
  }
}

async function getPipelineStageBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for pipelineStage',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllPipelineStage,
  createPipelineStage,
  getPipelineStage,
  updatePipelineStage,
  deletePipelineStage,
  getPipelineStageBarChartData,
  bulkUpdatePipelineStageVisibility,
};
