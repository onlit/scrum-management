/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing dataNeeded using Prisma.
 * It includes functions for retrieving all dataNeeded, creating a new dataNeeded, retrieving a single dataNeeded,
 * updating an existing dataNeeded, and deleting a dataNeeded.
 *
 * The `getAllDataNeeded` function retrieves a paginated list of dataNeeded based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createDataNeeded` function validates the request body using a Joi schema, generates a unique code
 * for the dataNeeded, and creates a new dataNeeded in the database with additional metadata.
 *
 * The `getDataNeeded` function retrieves a single dataNeeded based on the provided dataNeeded ID, with visibility
 * filters applied to ensure the dataNeeded is accessible to the requesting user.
 *
 * The `updateDataNeeded` function updates an existing dataNeeded in the database based on the provided dataNeeded ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteDataNeeded` function deletes a dataNeeded from the database based on the provided dataNeeded ID, with
 * visibility filters applied to ensure the dataNeeded is deletable by the requesting user.
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
  dataNeededCreate,
  dataNeededUpdate,
  dataNeededBulkVisibilityUpdate,
} = require('#core/schemas/dataNeeded.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('DataNeeded');
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
const MODEL_NAME_LITERAL = 'DataNeeded';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/dataNeeded.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateDataNeededVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'DataNeeded', 'update');

  logOperationStart('bulkUpdateDataNeededVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      dataNeededBulkVisibilityUpdate,
      body,
      req,
      'data_needed_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_data_needed_visibility_client_guard',
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
          context: 'bulk_update_data_needed_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_data_needed_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.dataNeeded.updateMany({
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
    logDatabaseSuccess('bulk_update_data_needed_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateDataNeededVisibility', req, {
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
      operationName: 'bulk_update_data_needed_visibility',
    });
    if (handled) return;
  }
}

async function getAllDataNeeded(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('DataNeeded');
  const context = createOperationContext(req, 'DataNeeded', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllDataNeeded', req, {
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

    const searchFields = ['whoFrom', 'infoNeeded', 'notes'];
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
    logDatabaseStart('get_all_data_needed', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: dataNeededUpdate,
      filterFields,
      searchFields,
      model: 'dataNeeded',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_data_needed', req, {
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
    logOperationSuccess('getAllDataNeeded', req, {
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
      operationName: 'get_all_data_needed',
    });
    if (handled) return;
  }
}

async function createDataNeeded(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'DataNeeded', 'create');

  logOperationStart('createDataNeeded', req, {
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
    let schema = dataNeededCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'data_needed_creation',
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
    logDatabaseStart('create_data_needed', req, {
      name: values.name,
      userId: user?.id,
    });

    const newDataNeeded = await prisma.dataNeeded.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_data_needed', req, {
      id: newDataNeeded.id,
      code: newDataNeeded.code,
    });

    const [newDataNeededWithDetails] = await getDetailsFromAPI({
      results: [newDataNeeded],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newDataNeededWithDetails,
      ['opportunity'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newDataNeededWithDetails, [
      { relation: 'opportunity', model: 'Opportunity' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newDataNeededWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? { ...newDataNeededWithDetails, [DISPLAY_VALUE_PROP]: createdDv }
      : newDataNeededWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createDataNeeded', req, {
      id: newDataNeeded.id,
      code: newDataNeeded.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_data_needed',
    });
    if (handled) return;
  }
}

async function getDataNeeded(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'DataNeeded', 'read');

  logOperationStart('getDataNeeded', req, {
    user: user?.id,
    dataNeededId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_data_needed_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      opportunity: true,
    };

    // Log database operation start
    logDatabaseStart('get_data_needed', req, {
      dataNeededId: params?.id,
      userId: user?.id,
    });

    const foundDataNeeded = await prisma.dataNeeded.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_data_needed', req, {
      found: !!foundDataNeeded,
      dataNeededId: params?.id,
    });

    if (!foundDataNeeded) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'DataNeeded not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_data_needed',
          details: { dataNeededId: params?.id },
        },
      );
      logOperationError('getDataNeeded', req, error);
      throw error;
    }

    const [foundDataNeededWithDetails] = await getDetailsFromAPI({
      results: [foundDataNeeded],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundDataNeededWithDetails,
      ['opportunity'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundDataNeededWithDetails, [
      { relation: 'opportunity', model: 'Opportunity' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundDataNeededWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? { ...foundDataNeededWithDetails, [DISPLAY_VALUE_PROP]: foundDv }
      : foundDataNeededWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getDataNeeded', req, {
      id: foundDataNeeded.id,
      code: foundDataNeeded.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_data_needed',
    });
    if (handled) return;
  }
}

async function updateDataNeeded(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'DataNeeded', 'update');

  logOperationStart('updateDataNeeded', req, {
    dataNeededId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_data_needed_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = dataNeededUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'data_needed_update',
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
    logDatabaseStart('update_data_needed', req, {
      dataNeededId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.dataNeeded.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'DataNeeded not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_data_needed',
          details: { dataNeededId: params?.id },
        },
      );
      throw error;
    }

    const updatedDataNeeded = await prisma.dataNeeded.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
    });

    // Log database operation success
    logDatabaseSuccess('update_data_needed', req, {
      id: updatedDataNeeded.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedDataNeeded,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedDataNeeded, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedDataNeeded;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateDataNeeded', req, {
      id: updatedDataNeeded.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_data_needed',
    });
    if (handled) return;
  }
}

async function deleteDataNeeded(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'DataNeeded', 'delete');

  logOperationStart('deleteDataNeeded', req, {
    user: user?.id,
    dataNeededId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_data_needed_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    // Log database operation start
    logDatabaseStart('delete_data_needed', req, {
      dataNeededId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.dataNeeded.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_data_needed', req, {
      deletedCount: result.count,
      dataNeededId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'DataNeeded not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_data_needed',
          details: { dataNeededId: params?.id },
        },
      );
      logOperationError('deleteDataNeeded', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteDataNeeded', req, {
      deletedCount: result.count,
      dataNeededId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_data_needed',
    });
    if (handled) return;
  }
}

async function getDataNeededBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for dataNeeded',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllDataNeeded,
  createDataNeeded,
  getDataNeeded,
  updateDataNeeded,
  deleteDataNeeded,
  getDataNeededBarChartData,
  bulkUpdateDataNeededVisibility,
};
