/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing opportunity using Prisma.
 * It includes functions for retrieving all opportunity, creating a new opportunity, retrieving a single opportunity,
 * updating an existing opportunity, and deleting a opportunity.
 *
 * The `getAllOpportunity` function retrieves a paginated list of opportunity based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createOpportunity` function validates the request body using a Joi schema, generates a unique code
 * for the opportunity, and creates a new opportunity in the database with additional metadata.
 *
 * The `getOpportunity` function retrieves a single opportunity based on the provided opportunity ID, with visibility
 * filters applied to ensure the opportunity is accessible to the requesting user.
 *
 * The `updateOpportunity` function updates an existing opportunity in the database based on the provided opportunity ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteOpportunity` function deletes a opportunity from the database based on the provided opportunity ID, with
 * visibility filters applied to ensure the opportunity is deletable by the requesting user.
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
  opportunityCreate,
  opportunityUpdate,
  opportunityBulkVisibilityUpdate,
} = require('#core/schemas/opportunity.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('Opportunity');
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
const MODEL_NAME_LITERAL = 'Opportunity';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/opportunity.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateOpportunityVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'Opportunity', 'update');

  logOperationStart('bulkUpdateOpportunityVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      opportunityBulkVisibilityUpdate,
      body,
      req,
      'opportunity_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_opportunity_visibility_client_guard',
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
          context: 'bulk_update_opportunity_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_opportunity_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.opportunity.updateMany({
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
    logDatabaseSuccess('bulk_update_opportunity_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateOpportunityVisibility', req, {
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
      operationName: 'bulk_update_opportunity_visibility',
    });
    if (handled) return;
  }
}

async function getAllOpportunity(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('Opportunity');
  const context = createOperationContext(req, 'Opportunity', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllOpportunity', req, {
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

    const searchFields = ['dataSource', 'notes', 'name', 'description'];
    const filterFields = [
      ...searchFields,
      'companyId',
      'personId',
      'companyContactId',
      'actualValue',
      'probability',
      'ownerId',
      'salesPersonId',
      'channelId',
      'sentiment',
      'economicBuyerInfluenceId',
      'technicalBuyerInfluenceId',
      'customerPriority',
      'pipelineId',
      'estimatedValue',
      'userBuyerInfluenceId',
      'estimatedCloseDate',
      'categoryId',
      'statusId',
      'statusAssignedDate',
    ];

    const include = {
      company: true,
      person: true,
      companyContact: { include: { person: true } },
      channel: true,
      economicBuyerInfluence: true,
      technicalBuyerInfluence: true,
      pipeline: true,
      userBuyerInfluence: true,
      category: true,
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
    logDatabaseStart('get_all_opportunity', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: opportunityUpdate,
      filterFields,
      searchFields,
      model: 'opportunity',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_opportunity', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    await batchHydrateRelationsInList(
      response,
      [
        'company',
        'person',
        'companyContact',
        'channel',
        'economicBuyerInfluence',
        'technicalBuyerInfluence',
        'pipeline',
        'userBuyerInfluence',
        'category',
        'status',
      ],
      user?.accessToken,
    );

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        attachNestedDisplayValues(r, [
          { relation: 'company', model: 'Company' },
          { relation: 'person', model: 'Person' },
          { relation: 'companyContact', model: 'CompanyContact' },
          { relation: 'channel', model: 'Channel' },
          { relation: 'economicBuyerInfluence', model: 'CompanySpin' },
          { relation: 'technicalBuyerInfluence', model: 'CompanySpin' },
          { relation: 'pipeline', model: 'OpportunityPipeline' },
          { relation: 'userBuyerInfluence', model: 'CompanySpin' },
          { relation: 'category', model: 'OpportunityCategory' },
          { relation: 'status', model: 'PipelineStage' },
        ]);
        const dv = computeDisplayValue(r, MODEL_NAME_LITERAL, displayOptions);
        return dv ? { ...r, [DISPLAY_VALUE_PROP]: dv } : r;
      });
    }

    // Lifecycle: afterList - transform response
    const afterListResult = await interceptor.afterList(response, context);
    const finalResponse = afterListResult.data;

    // Log operation success
    logOperationSuccess('getAllOpportunity', req, {
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
      operationName: 'get_all_opportunity',
    });
    if (handled) return;
  }
}

async function createOpportunity(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'Opportunity', 'create');

  logOperationStart('createOpportunity', req, {
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
    let schema = opportunityCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'opportunity_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = [
      'companyId',
      'personId',
      'companyContactId',
      'channelId',
      'economicBuyerInfluenceId',
      'technicalBuyerInfluenceId',
      'pipelineId',
      'userBuyerInfluenceId',
      'categoryId',
      'statusId',
    ];

    const include = {
      company: true,
      person: true,
      companyContact: { include: { person: true } },
      channel: true,
      economicBuyerInfluence: true,
      technicalBuyerInfluence: true,
      pipeline: true,
      userBuyerInfluence: true,
      category: true,
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
    logDatabaseStart('create_opportunity', req, {
      name: values.name,
      userId: user?.id,
    });

    const newOpportunity = await prisma.opportunity.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_opportunity', req, {
      id: newOpportunity.id,
      code: newOpportunity.code,
    });

    const [newOpportunityWithDetails] = await getDetailsFromAPI({
      results: [newOpportunity],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newOpportunityWithDetails,
      [
        'company',
        'person',
        'companyContact',
        'channel',
        'economicBuyerInfluence',
        'technicalBuyerInfluence',
        'pipeline',
        'userBuyerInfluence',
        'category',
        'status',
      ],
      user?.accessToken,
    );

    attachNestedDisplayValues(newOpportunityWithDetails, [
      { relation: 'company', model: 'Company' },
      { relation: 'person', model: 'Person' },
      { relation: 'companyContact', model: 'CompanyContact' },
      { relation: 'channel', model: 'Channel' },
      { relation: 'economicBuyerInfluence', model: 'CompanySpin' },
      { relation: 'technicalBuyerInfluence', model: 'CompanySpin' },
      { relation: 'pipeline', model: 'OpportunityPipeline' },
      { relation: 'userBuyerInfluence', model: 'CompanySpin' },
      { relation: 'category', model: 'OpportunityCategory' },
      { relation: 'status', model: 'PipelineStage' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newOpportunityWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? { ...newOpportunityWithDetails, [DISPLAY_VALUE_PROP]: createdDv }
      : newOpportunityWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createOpportunity', req, {
      id: newOpportunity.id,
      code: newOpportunity.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_opportunity',
    });
    if (handled) return;
  }
}

async function getOpportunity(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'Opportunity', 'read');

  logOperationStart('getOpportunity', req, {
    user: user?.id,
    opportunityId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_opportunity_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      company: true,
      person: true,
      companyContact: { include: { person: true } },
      channel: true,
      economicBuyerInfluence: true,
      technicalBuyerInfluence: true,
      pipeline: true,
      userBuyerInfluence: true,
      category: true,
      status: true,
    };

    // Log database operation start
    logDatabaseStart('get_opportunity', req, {
      opportunityId: params?.id,
      userId: user?.id,
    });

    const foundOpportunity = await prisma.opportunity.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_opportunity', req, {
      found: !!foundOpportunity,
      opportunityId: params?.id,
    });

    if (!foundOpportunity) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Opportunity not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_opportunity',
          details: { opportunityId: params?.id },
        },
      );
      logOperationError('getOpportunity', req, error);
      throw error;
    }

    const [foundOpportunityWithDetails] = await getDetailsFromAPI({
      results: [foundOpportunity],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundOpportunityWithDetails,
      [
        'company',
        'person',
        'companyContact',
        'channel',
        'economicBuyerInfluence',
        'technicalBuyerInfluence',
        'pipeline',
        'userBuyerInfluence',
        'category',
        'status',
      ],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundOpportunityWithDetails, [
      { relation: 'company', model: 'Company' },
      { relation: 'person', model: 'Person' },
      { relation: 'companyContact', model: 'CompanyContact' },
      { relation: 'channel', model: 'Channel' },
      { relation: 'economicBuyerInfluence', model: 'CompanySpin' },
      { relation: 'technicalBuyerInfluence', model: 'CompanySpin' },
      { relation: 'pipeline', model: 'OpportunityPipeline' },
      { relation: 'userBuyerInfluence', model: 'CompanySpin' },
      { relation: 'category', model: 'OpportunityCategory' },
      { relation: 'status', model: 'PipelineStage' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundOpportunityWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? { ...foundOpportunityWithDetails, [DISPLAY_VALUE_PROP]: foundDv }
      : foundOpportunityWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getOpportunity', req, {
      id: foundOpportunity.id,
      code: foundOpportunity.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_opportunity',
    });
    if (handled) return;
  }
}

async function updateOpportunity(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'Opportunity', 'update');

  logOperationStart('updateOpportunity', req, {
    opportunityId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_opportunity_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = opportunityUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'opportunity_update',
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
    logDatabaseStart('update_opportunity', req, {
      opportunityId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.opportunity.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Opportunity not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_opportunity',
          details: { opportunityId: params?.id },
        },
      );
      throw error;
    }

    const updatedOpportunity = await prisma.opportunity.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
    });

    // Log database operation success
    logDatabaseSuccess('update_opportunity', req, {
      id: updatedOpportunity.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedOpportunity,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedOpportunity, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedOpportunity;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateOpportunity', req, {
      id: updatedOpportunity.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_opportunity',
    });
    if (handled) return;
  }
}

async function deleteOpportunity(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'Opportunity', 'delete');

  logOperationStart('deleteOpportunity', req, {
    user: user?.id,
    opportunityId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_opportunity_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    await prisma.client.updateMany({
      where: {
        opportunityId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.opportunityInfluencer.updateMany({
      where: {
        opportunityId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.actionPlan.updateMany({
      where: {
        opportunityId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.dataNeeded.updateMany({
      where: {
        opportunityId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.opportunityProduct.updateMany({
      where: {
        opportunityId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.opportunityHistory.updateMany({
      where: {
        opportunityId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_opportunity', req, {
      opportunityId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.opportunity.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_opportunity', req, {
      deletedCount: result.count,
      opportunityId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Opportunity not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_opportunity',
          details: { opportunityId: params?.id },
        },
      );
      logOperationError('deleteOpportunity', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteOpportunity', req, {
      deletedCount: result.count,
      opportunityId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_opportunity',
    });
    if (handled) return;
  }
}

async function getOpportunityBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for opportunity',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllOpportunity,
  createOpportunity,
  getOpportunity,
  updateOpportunity,
  deleteOpportunity,
  getOpportunityBarChartData,
  bulkUpdateOpportunityVisibility,
};
