/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing opportunityInfluencer using Prisma.
 * It includes functions for retrieving all opportunityInfluencer, creating a new opportunityInfluencer, retrieving a single opportunityInfluencer,
 * updating an existing opportunityInfluencer, and deleting a opportunityInfluencer.
 *
 * The `getAllOpportunityInfluencer` function retrieves a paginated list of opportunityInfluencer based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createOpportunityInfluencer` function validates the request body using a Joi schema, generates a unique code
 * for the opportunityInfluencer, and creates a new opportunityInfluencer in the database with additional metadata.
 *
 * The `getOpportunityInfluencer` function retrieves a single opportunityInfluencer based on the provided opportunityInfluencer ID, with visibility
 * filters applied to ensure the opportunityInfluencer is accessible to the requesting user.
 *
 * The `updateOpportunityInfluencer` function updates an existing opportunityInfluencer in the database based on the provided opportunityInfluencer ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteOpportunityInfluencer` function deletes a opportunityInfluencer from the database based on the provided opportunityInfluencer ID, with
 * visibility filters applied to ensure the opportunityInfluencer is deletable by the requesting user.
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
  opportunityInfluencerCreate,
  opportunityInfluencerUpdate,
  opportunityInfluencerBulkVisibilityUpdate,
} = require('#core/schemas/opportunityInfluencer.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('OpportunityInfluencer');
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
const MODEL_NAME_LITERAL = 'OpportunityInfluencer';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/opportunityInfluencer.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateOpportunityInfluencerVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(
    req,
    'OpportunityInfluencer',
    'update',
  );

  logOperationStart('bulkUpdateOpportunityInfluencerVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      opportunityInfluencerBulkVisibilityUpdate,
      body,
      req,
      'opportunity_influencer_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_opportunity_influencer_visibility_client_guard',
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
            'bulk_update_opportunity_influencer_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_opportunity_influencer_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.opportunityInfluencer.updateMany({
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
    logDatabaseSuccess('bulk_update_opportunity_influencer_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateOpportunityInfluencerVisibility', req, {
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
      operationName: 'bulk_update_opportunity_influencer_visibility',
    });
    if (handled) return;
  }
}

async function getAllOpportunityInfluencer(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('OpportunityInfluencer');
  const context = createOperationContext(req, 'OpportunityInfluencer', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllOpportunityInfluencer', req, {
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

    const searchFields = ['role', 'desireForCompany', 'desireForSelf'];
    const filterFields = [
      ...searchFields,
      'companyContactId',
      'opportunityId',
      'rating',
    ];

    const include = {
      companyContact: { include: { person: true } },
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
    logDatabaseStart('get_all_opportunity_influencer', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: opportunityInfluencerUpdate,
      filterFields,
      searchFields,
      model: 'opportunityInfluencer',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_opportunity_influencer', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    await batchHydrateRelationsInList(
      response,
      ['companyContact', 'opportunity'],
      user?.accessToken,
    );

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        attachNestedDisplayValues(r, [
          { relation: 'companyContact', model: 'CompanyContact' },
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
    logOperationSuccess('getAllOpportunityInfluencer', req, {
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
      operationName: 'get_all_opportunity_influencer',
    });
    if (handled) return;
  }
}

async function createOpportunityInfluencer(req, res) {
  const { user, body } = req;
  const context = createOperationContext(
    req,
    'OpportunityInfluencer',
    'create',
  );

  logOperationStart('createOpportunityInfluencer', req, {
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
    let schema = opportunityInfluencerCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'opportunity_influencer_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = ['companyContactId', 'opportunityId'];

    const include = {
      companyContact: { include: { person: true } },
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
    logDatabaseStart('create_opportunity_influencer', req, {
      name: values.name,
      userId: user?.id,
    });

    const newOpportunityInfluencer = await prisma.opportunityInfluencer.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_opportunity_influencer', req, {
      id: newOpportunityInfluencer.id,
      code: newOpportunityInfluencer.code,
    });

    const [newOpportunityInfluencerWithDetails] = await getDetailsFromAPI({
      results: [newOpportunityInfluencer],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newOpportunityInfluencerWithDetails,
      ['companyContact', 'opportunity'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newOpportunityInfluencerWithDetails, [
      { relation: 'companyContact', model: 'CompanyContact' },
      { relation: 'opportunity', model: 'Opportunity' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newOpportunityInfluencerWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? {
          ...newOpportunityInfluencerWithDetails,
          [DISPLAY_VALUE_PROP]: createdDv,
        }
      : newOpportunityInfluencerWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createOpportunityInfluencer', req, {
      id: newOpportunityInfluencer.id,
      code: newOpportunityInfluencer.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_opportunity_influencer',
    });
    if (handled) return;
  }
}

async function getOpportunityInfluencer(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'OpportunityInfluencer', 'read');

  logOperationStart('getOpportunityInfluencer', req, {
    user: user?.id,
    opportunityInfluencerId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_opportunity_influencer_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      companyContact: { include: { person: true } },
      opportunity: true,
    };

    // Log database operation start
    logDatabaseStart('get_opportunity_influencer', req, {
      opportunityInfluencerId: params?.id,
      userId: user?.id,
    });

    const foundOpportunityInfluencer =
      await prisma.opportunityInfluencer.findFirst({
        where: {
          id: params?.id,
          ...getVisibilityFilters(user),
        },
        include: Object.keys(include).length ? include : undefined,
      });

    // Log database operation success
    logDatabaseSuccess('get_opportunity_influencer', req, {
      found: !!foundOpportunityInfluencer,
      opportunityInfluencerId: params?.id,
    });

    if (!foundOpportunityInfluencer) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityInfluencer not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_opportunity_influencer',
          details: { opportunityInfluencerId: params?.id },
        },
      );
      logOperationError('getOpportunityInfluencer', req, error);
      throw error;
    }

    const [foundOpportunityInfluencerWithDetails] = await getDetailsFromAPI({
      results: [foundOpportunityInfluencer],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundOpportunityInfluencerWithDetails,
      ['companyContact', 'opportunity'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundOpportunityInfluencerWithDetails, [
      { relation: 'companyContact', model: 'CompanyContact' },
      { relation: 'opportunity', model: 'Opportunity' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundOpportunityInfluencerWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? {
          ...foundOpportunityInfluencerWithDetails,
          [DISPLAY_VALUE_PROP]: foundDv,
        }
      : foundOpportunityInfluencerWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getOpportunityInfluencer', req, {
      id: foundOpportunityInfluencer.id,
      code: foundOpportunityInfluencer.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_opportunity_influencer',
    });
    if (handled) return;
  }
}

async function updateOpportunityInfluencer(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(
    req,
    'OpportunityInfluencer',
    'update',
  );

  logOperationStart('updateOpportunityInfluencer', req, {
    opportunityInfluencerId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(
      params?.id,
      req,
      'update_opportunity_influencer_param',
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
    let schema = opportunityInfluencerUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'opportunity_influencer_update',
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
    logDatabaseStart('update_opportunity_influencer', req, {
      opportunityInfluencerId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.opportunityInfluencer.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityInfluencer not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_opportunity_influencer',
          details: { opportunityInfluencerId: params?.id },
        },
      );
      throw error;
    }

    const updatedOpportunityInfluencer =
      await prisma.opportunityInfluencer.findFirst({
        where: { id: params?.id, client: user?.client?.id, deleted: null },
      });

    // Log database operation success
    logDatabaseSuccess('update_opportunity_influencer', req, {
      id: updatedOpportunityInfluencer.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedOpportunityInfluencer,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedOpportunityInfluencer, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedOpportunityInfluencer;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateOpportunityInfluencer', req, {
      id: updatedOpportunityInfluencer.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_opportunity_influencer',
    });
    if (handled) return;
  }
}

async function deleteOpportunityInfluencer(req, res) {
  const { params, user } = req;
  const context = createOperationContext(
    req,
    'OpportunityInfluencer',
    'delete',
  );

  logOperationStart('deleteOpportunityInfluencer', req, {
    user: user?.id,
    opportunityInfluencerId: params?.id,
  });

  try {
    assertValidUuidParam(
      params?.id,
      req,
      'delete_opportunity_influencer_param',
    );

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    // Log database operation start
    logDatabaseStart('delete_opportunity_influencer', req, {
      opportunityInfluencerId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.opportunityInfluencer.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_opportunity_influencer', req, {
      deletedCount: result.count,
      opportunityInfluencerId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityInfluencer not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_opportunity_influencer',
          details: { opportunityInfluencerId: params?.id },
        },
      );
      logOperationError('deleteOpportunityInfluencer', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteOpportunityInfluencer', req, {
      deletedCount: result.count,
      opportunityInfluencerId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_opportunity_influencer',
    });
    if (handled) return;
  }
}

async function getOpportunityInfluencerBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for opportunityInfluencer',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllOpportunityInfluencer,
  createOpportunityInfluencer,
  getOpportunityInfluencer,
  updateOpportunityInfluencer,
  deleteOpportunityInfluencer,
  getOpportunityInfluencerBarChartData,
  bulkUpdateOpportunityInfluencerVisibility,
};
