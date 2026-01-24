/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing prospect using Prisma.
 * It includes functions for retrieving all prospect, creating a new prospect, retrieving a single prospect,
 * updating an existing prospect, and deleting a prospect.
 *
 * The `getAllProspect` function retrieves a paginated list of prospect based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createProspect` function validates the request body using a Joi schema, generates a unique code
 * for the prospect, and creates a new prospect in the database with additional metadata.
 *
 * The `getProspect` function retrieves a single prospect based on the provided prospect ID, with visibility
 * filters applied to ensure the prospect is accessible to the requesting user.
 *
 * The `updateProspect` function updates an existing prospect in the database based on the provided prospect ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteProspect` function deletes a prospect from the database based on the provided prospect ID, with
 * visibility filters applied to ensure the prospect is deletable by the requesting user.
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
  prospectCreate,
  prospectUpdate,
  prospectBulkVisibilityUpdate,
} = require('#core/schemas/prospect.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('Prospect');
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
const MODEL_NAME_LITERAL = 'Prospect';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/prospect.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateProspectVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'Prospect', 'update');

  logOperationStart('bulkUpdateProspectVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      prospectBulkVisibilityUpdate,
      body,
      req,
      'prospect_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_prospect_visibility_client_guard',
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
          context: 'bulk_update_prospect_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_prospect_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.prospect.updateMany({
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
    logDatabaseSuccess('bulk_update_prospect_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateProspectVisibility', req, {
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
      operationName: 'bulk_update_prospect_visibility',
    });
    if (handled) return;
  }
}

async function getAllProspect(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('Prospect');
  const context = createOperationContext(req, 'Prospect', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllProspect', req, {
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

    const searchFields = ['interestSummary'];
    const filterFields = [
      ...searchFields,
      'disqualificationReason',
      'sourceCampaign',
      'ownerId',
      'categoryId',
      'personId',
      'qualificationScore',
      'temperature',
      'prospectPipelineId',
      'statusId',
    ];

    const include = {
      category: true,
      person: true,
      prospectPipeline: true,
      status: true,
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
    logDatabaseStart('get_all_prospect', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: prospectUpdate,
      filterFields,
      searchFields,
      model: 'prospect',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_prospect', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    await batchHydrateRelationsInList(
      response,
      ['category', 'person', 'prospectPipeline', 'status'],
      user?.accessToken,
    );

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        attachNestedDisplayValues(r, [
          { relation: 'category', model: 'ProspectCategory' },
          { relation: 'person', model: 'Person' },
          { relation: 'prospectPipeline', model: 'ProspectPipeline' },
          { relation: 'status', model: 'ProspectPipelineStage' },
        ]);
        const dv = computeDisplayValue(r, MODEL_NAME_LITERAL, displayOptions);
        return dv ? { ...r, [DISPLAY_VALUE_PROP]: dv } : r;
      });
    }

    // Lifecycle: afterList - transform response
    const afterListResult = await interceptor.afterList(response, context);
    const finalResponse = afterListResult.data;

    // Log operation success
    logOperationSuccess('getAllProspect', req, {
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
      operationName: 'get_all_prospect',
    });
    if (handled) return;
  }
}

async function createProspect(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'Prospect', 'create');

  logOperationStart('createProspect', req, {
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
    let schema = prospectCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'prospect_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = [
      'categoryId',
      'personId',
      'prospectPipelineId',
      'statusId',
    ];

    const include = {
      category: true,
      person: true,
      prospectPipeline: true,
      status: true,
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
    logDatabaseStart('create_prospect', req, {
      name: values.name,
      userId: user?.id,
    });

    const newProspect = await prisma.prospect.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_prospect', req, {
      id: newProspect.id,
      code: newProspect.code,
    });

    const [newProspectWithDetails] = await getDetailsFromAPI({
      results: [newProspect],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newProspectWithDetails,
      ['category', 'person', 'prospectPipeline', 'status'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newProspectWithDetails, [
      { relation: 'category', model: 'ProspectCategory' },
      { relation: 'person', model: 'Person' },
      { relation: 'prospectPipeline', model: 'ProspectPipeline' },
      { relation: 'status', model: 'ProspectPipelineStage' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newProspectWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? { ...newProspectWithDetails, [DISPLAY_VALUE_PROP]: createdDv }
      : newProspectWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createProspect', req, {
      id: newProspect.id,
      code: newProspect.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_prospect',
    });
    if (handled) return;
  }
}

async function getProspect(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'Prospect', 'read');

  logOperationStart('getProspect', req, {
    user: user?.id,
    prospectId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_prospect_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      category: true,
      person: true,
      prospectPipeline: true,
      status: true,
    };

    // Log database operation start
    logDatabaseStart('get_prospect', req, {
      prospectId: params?.id,
      userId: user?.id,
    });

    const foundProspect = await prisma.prospect.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_prospect', req, {
      found: !!foundProspect,
      prospectId: params?.id,
    });

    if (!foundProspect) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Prospect not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_prospect',
          details: { prospectId: params?.id },
        },
      );
      logOperationError('getProspect', req, error);
      throw error;
    }

    const [foundProspectWithDetails] = await getDetailsFromAPI({
      results: [foundProspect],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundProspectWithDetails,
      ['category', 'person', 'prospectPipeline', 'status'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundProspectWithDetails, [
      { relation: 'category', model: 'ProspectCategory' },
      { relation: 'person', model: 'Person' },
      { relation: 'prospectPipeline', model: 'ProspectPipeline' },
      { relation: 'status', model: 'ProspectPipelineStage' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundProspectWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? { ...foundProspectWithDetails, [DISPLAY_VALUE_PROP]: foundDv }
      : foundProspectWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getProspect', req, {
      id: foundProspect.id,
      code: foundProspect.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_prospect',
    });
    if (handled) return;
  }
}

async function updateProspect(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'Prospect', 'update');

  logOperationStart('updateProspect', req, {
    prospectId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_prospect_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = prospectUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(schema, data, req, 'prospect_update');

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
    logDatabaseStart('update_prospect', req, {
      prospectId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.prospect.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Prospect not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_prospect',
          details: { prospectId: params?.id },
        },
      );
      throw error;
    }

    const updatedProspect = await prisma.prospect.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
    });

    // Log database operation success
    logDatabaseSuccess('update_prospect', req, {
      id: updatedProspect.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedProspect,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedProspect, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedProspect;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateProspect', req, {
      id: updatedProspect.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_prospect',
    });
    if (handled) return;
  }
}

async function deleteProspect(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'Prospect', 'delete');

  logOperationStart('deleteProspect', req, {
    user: user?.id,
    prospectId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_prospect_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    await prisma.prospectProduct.updateMany({
      where: {
        prospectId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_prospect', req, {
      prospectId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.prospect.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_prospect', req, {
      deletedCount: result.count,
      prospectId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Prospect not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_prospect',
          details: { prospectId: params?.id },
        },
      );
      logOperationError('deleteProspect', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteProspect', req, {
      deletedCount: result.count,
      prospectId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_prospect',
    });
    if (handled) return;
  }
}

async function getProspectBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for prospect',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllProspect,
  createProspect,
  getProspect,
  updateProspect,
  deleteProspect,
  getProspectBarChartData,
  bulkUpdateProspectVisibility,
};
