/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing onlineSignup using Prisma.
 * It includes functions for retrieving all onlineSignup, creating a new onlineSignup, retrieving a single onlineSignup,
 * updating an existing onlineSignup, and deleting a onlineSignup.
 *
 * The `getAllOnlineSignup` function retrieves a paginated list of onlineSignup based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createOnlineSignup` function validates the request body using a Joi schema, generates a unique code
 * for the onlineSignup, and creates a new onlineSignup in the database with additional metadata.
 *
 * The `getOnlineSignup` function retrieves a single onlineSignup based on the provided onlineSignup ID, with visibility
 * filters applied to ensure the onlineSignup is accessible to the requesting user.
 *
 * The `updateOnlineSignup` function updates an existing onlineSignup in the database based on the provided onlineSignup ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteOnlineSignup` function deletes a onlineSignup from the database based on the provided onlineSignup ID, with
 * visibility filters applied to ensure the onlineSignup is deletable by the requesting user.
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
  onlineSignupCreate,
  onlineSignupUpdate,
  onlineSignupBulkVisibilityUpdate,
} = require('#core/schemas/onlineSignup.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('OnlineSignup');
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
const MODEL_NAME_LITERAL = 'OnlineSignup';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/onlineSignup.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateOnlineSignupVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'OnlineSignup', 'update');

  logOperationStart('bulkUpdateOnlineSignupVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      onlineSignupBulkVisibilityUpdate,
      body,
      req,
      'online_signup_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_online_signup_visibility_client_guard',
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
          context: 'bulk_update_online_signup_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_online_signup_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.onlineSignup.updateMany({
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
    logDatabaseSuccess('bulk_update_online_signup_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateOnlineSignupVisibility', req, {
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
      operationName: 'bulk_update_online_signup_visibility',
    });
    if (handled) return;
  }
}

async function getAllOnlineSignup(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('OnlineSignup');
  const context = createOperationContext(req, 'OnlineSignup', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllOnlineSignup', req, {
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

    const searchFields = ['source', 'fields', 'owner'];
    const filterFields = [...searchFields, 'emailconfirmed'];

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
    logDatabaseStart('get_all_online_signup', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: onlineSignupUpdate,
      filterFields,
      searchFields,
      model: 'onlineSignup',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_online_signup', req, {
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
    logOperationSuccess('getAllOnlineSignup', req, {
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
      operationName: 'get_all_online_signup',
    });
    if (handled) return;
  }
}

async function createOnlineSignup(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'OnlineSignup', 'create');

  logOperationStart('createOnlineSignup', req, {
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
    let schema = onlineSignupCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'online_signup_creation',
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
    logDatabaseStart('create_online_signup', req, {
      name: values.name,
      userId: user?.id,
    });

    const newOnlineSignup = await prisma.onlineSignup.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_online_signup', req, {
      id: newOnlineSignup.id,
      code: newOnlineSignup.code,
    });

    const [newOnlineSignupWithDetails] = await getDetailsFromAPI({
      results: [newOnlineSignup],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newOnlineSignupWithDetails,
      [],
      user?.accessToken,
    );

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newOnlineSignupWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? { ...newOnlineSignupWithDetails, [DISPLAY_VALUE_PROP]: createdDv }
      : newOnlineSignupWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createOnlineSignup', req, {
      id: newOnlineSignup.id,
      code: newOnlineSignup.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_online_signup',
    });
    if (handled) return;
  }
}

async function getOnlineSignup(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'OnlineSignup', 'read');

  logOperationStart('getOnlineSignup', req, {
    user: user?.id,
    onlineSignupId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_online_signup_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {};

    // Log database operation start
    logDatabaseStart('get_online_signup', req, {
      onlineSignupId: params?.id,
      userId: user?.id,
    });

    const foundOnlineSignup = await prisma.onlineSignup.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_online_signup', req, {
      found: !!foundOnlineSignup,
      onlineSignupId: params?.id,
    });

    if (!foundOnlineSignup) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OnlineSignup not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_online_signup',
          details: { onlineSignupId: params?.id },
        },
      );
      logOperationError('getOnlineSignup', req, error);
      throw error;
    }

    const [foundOnlineSignupWithDetails] = await getDetailsFromAPI({
      results: [foundOnlineSignup],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundOnlineSignupWithDetails,
      [],
      user?.accessToken,
    );

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundOnlineSignupWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? { ...foundOnlineSignupWithDetails, [DISPLAY_VALUE_PROP]: foundDv }
      : foundOnlineSignupWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getOnlineSignup', req, {
      id: foundOnlineSignup.id,
      code: foundOnlineSignup.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_online_signup',
    });
    if (handled) return;
  }
}

async function updateOnlineSignup(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'OnlineSignup', 'update');

  logOperationStart('updateOnlineSignup', req, {
    onlineSignupId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_online_signup_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = onlineSignupUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'online_signup_update',
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
    logDatabaseStart('update_online_signup', req, {
      onlineSignupId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.onlineSignup.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OnlineSignup not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_online_signup',
          details: { onlineSignupId: params?.id },
        },
      );
      throw error;
    }

    const updatedOnlineSignup = await prisma.onlineSignup.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
    });

    // Log database operation success
    logDatabaseSuccess('update_online_signup', req, {
      id: updatedOnlineSignup.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedOnlineSignup,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedOnlineSignup, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedOnlineSignup;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateOnlineSignup', req, {
      id: updatedOnlineSignup.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_online_signup',
    });
    if (handled) return;
  }
}

async function deleteOnlineSignup(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'OnlineSignup', 'delete');

  logOperationStart('deleteOnlineSignup', req, {
    user: user?.id,
    onlineSignupId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_online_signup_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    // Log database operation start
    logDatabaseStart('delete_online_signup', req, {
      onlineSignupId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.onlineSignup.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_online_signup', req, {
      deletedCount: result.count,
      onlineSignupId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OnlineSignup not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_online_signup',
          details: { onlineSignupId: params?.id },
        },
      );
      logOperationError('deleteOnlineSignup', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteOnlineSignup', req, {
      deletedCount: result.count,
      onlineSignupId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_online_signup',
    });
    if (handled) return;
  }
}

async function getOnlineSignupBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for onlineSignup',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllOnlineSignup,
  createOnlineSignup,
  getOnlineSignup,
  updateOnlineSignup,
  deleteOnlineSignup,
  getOnlineSignupBarChartData,
  bulkUpdateOnlineSignupVisibility,
};
