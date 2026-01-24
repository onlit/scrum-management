/**
 * CREATED BY: @gen{CREATOR_NAME}
 * CREATOR EMAIL: @gen{CREATOR_EMAIL}
 * CREATION DATE: @gen{NOW}
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing modelName using Prisma.
 * It includes functions for retrieving all modelName, creating a new modelName, retrieving a single modelName,
 * updating an existing modelName, and deleting a modelName.
 *
 * The `getAllModelName` function retrieves a paginated list of modelName based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createModelName` function validates the request body using a Joi schema, generates a unique code
 * for the modelName, and creates a new modelName in the database with additional metadata.
 *
 * The `getModelName` function retrieves a single modelName based on the provided modelName ID, with visibility
 * filters applied to ensure the modelName is accessible to the requesting user.
 *
 * The `updateModelName` function updates an existing modelName in the database based on the provided modelName ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteModelName` function deletes a modelName from the database based on the provided modelName ID, with
 * visibility filters applied to ensure the modelName is deletable by the requesting user.
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
  modelNameCreate,
  modelNameUpdate,
  modelNameBulkVisibilityUpdate,
} = require('#core/schemas/modelName.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('ModelName');
const { objectKeysToCamelCase } = require('#utils/generalUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/visibilityUtils.js');
const {
  getPaginatedList,
} = require('#utils/databaseUtils.js');
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
  // @gen:ATTACH_NESTED_DISPLAY_IMPORT
} = require('#utils/displayValueUtils.js');
const {
  batchHydrateRelationsInList,
  hydrateRelationsOnRecord,
} = require('#utils/nestedHydrationUtils.js');

// Model name literal used for display-value maps
const MODEL_NAME_LITERAL = '@gen{MODEL_NAME_LITERAL}';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/modelName.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateModelNameVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'ModelName', 'update');

  logOperationStart('bulkUpdateModelNameVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      modelNameBulkVisibilityUpdate,
      body,
      req,
      'model_name_bulk_visibility_update'
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_model_name_visibility_client_guard',
        }
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
          context: 'bulk_update_model_name_visibility_permission_check',
        }
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_model_name_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.modelName.updateMany({
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
    logDatabaseSuccess('bulk_update_model_name_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateModelNameVisibility', req, {
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
      operationName: 'bulk_update_model_name_visibility',
    });
    if (handled) return;
  }
}

async function getAllModelName(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('ModelName');
  const context = createOperationContext(req, 'ModelName', 'list', { queryBuilder });

  logOperationStart('getAllModelName', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    // Lifecycle: beforeList - modify query builder or filters
    const beforeListResult = await interceptor.beforeList(queryBuilder, context);
    if (checkInterceptorHalt(beforeListResult, res)) return;

    // Get modified query builder (interceptor can return new builder or plain query object)
    const modifiedBuilder = beforeListResult.data instanceof QueryBuilder
      ? beforeListResult.data
      : queryBuilder;

    // Extract any additional query modifications from the builder
    const builderQuery = modifiedBuilder.build();
    const modifiedQuery = { ...query, ...builderQuery };

    const searchFields = [
      // @gen:SEARCH_FIELDS
    ];
    const filterFields = [...searchFields, @gen{FILTER_FIELDS}];

    const include = {
      // @gen:INCLUDE_FIELDS
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
    logDatabaseStart('get_all_model_name', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: modelNameUpdate,
      filterFields,
      searchFields,
      model: 'modelName',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_model_name', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // @gen:LIST_RECORD_CUSTOM_ASSIGNMENTS

    await batchHydrateRelationsInList(
      response,
      [@gen{RELATION_ARRAY}],
      user?.accessToken
    );

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        // @gen:COMPUTE_NESTED_DISPLAY_VALUES_LIST
        const dv = computeDisplayValue(r, MODEL_NAME_LITERAL, displayOptions);
        return dv ? { ...r, [DISPLAY_VALUE_PROP]: dv } : r;
      });
    }

    // Lifecycle: afterList - transform response
    const afterListResult = await interceptor.afterList(response, context);
    const finalResponse = afterListResult.data;

    // Log operation success
    logOperationSuccess('getAllModelName', req, {
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
      operationName: 'get_all_model_name',
    });
    if (handled) return;
  }
}

async function createModelName(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'ModelName', 'create');

  logOperationStart('createModelName', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(data, context);
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = modelNameCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(schema, data, req, 'model_name_creation');

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(values, context);
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = [
      // @gen:RELATION_FIELDS
    ];

    const include = {
      // @gen:INCLUDE_FIELDS
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
    logDatabaseStart('create_model_name', req, {
      name: values.name,
      userId: user?.id,
    });

    const newModelName = await prisma.modelName.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_model_name', req, {
      id: newModelName.id,
      code: newModelName.code,
    });

    // @gen:NEW_RECORD_CUSTOM_ASSIGNMENTS

    const [newModelNameWithDetails] = await getDetailsFromAPI({
      results: [newModelName],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newModelNameWithDetails,
      [@gen{RELATION_ARRAY}],
      user?.accessToken
    );

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };

    // @gen:COMPUTE_NESTED_DISPLAY_VALUES_CREATE
    const createdDv = computeDisplayValue(
      newModelNameWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions
    );
    @gen{VAR_CREATED_WITH_DISPLAY} createdWithDisplay = createdDv
      ? { ...newModelNameWithDetails, [DISPLAY_VALUE_PROP]: createdDv }
      : newModelNameWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(createdWithDisplay, context);
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createModelName', req, {
      id: newModelName.id,
      code: newModelName.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_model_name',
    });
    if (handled) return;
  }
}

async function getModelName(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'ModelName', 'read');

  logOperationStart('getModelName', req, {
    user: user?.id,
    modelNameId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_model_name_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      // @gen:INCLUDE_FIELDS
    };

    // Log database operation start
    logDatabaseStart('get_model_name', req, {
      modelNameId: params?.id,
      userId: user?.id,
    });

    const foundModelName = await prisma.modelName.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_model_name', req, {
      found: !!foundModelName,
      modelNameId: params?.id,
    });

    if (!foundModelName) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ModelName not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_model_name',
          details: { modelNameId: params?.id },
        }
      );
      logOperationError('getModelName', req, error);
      throw error;
    }

    // @gen:GET_RECORD_CUSTOM_ASSIGNMENTS

    const [foundModelNameWithDetails] = await getDetailsFromAPI({
      results: [foundModelName],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundModelNameWithDetails,
      [@gen{RELATION_ARRAY}],
      user?.accessToken
    );

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };

    // @gen:COMPUTE_NESTED_DISPLAY_VALUES_GET
    const foundDv = computeDisplayValue(
      foundModelNameWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions
    );
    @gen{VAR_FOUND_WITH_DISPLAY} foundWithDisplay = foundDv
      ? { ...foundModelNameWithDetails, [DISPLAY_VALUE_PROP]: foundDv }
      : foundModelNameWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(foundWithDisplay, context);
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getModelName', req, {
      id: foundModelName.id,
      code: foundModelName.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_model_name',
    });
    if (handled) return;
  }
}

async function updateModelName(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'ModelName', 'update');

  logOperationStart('updateModelName', req, {
    modelNameId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_model_name_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(data, context);
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = modelNameUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(schema, data, req, 'model_name_update');

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(values, context);
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
    logDatabaseStart('update_model_name', req, {
      modelNameId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.modelName.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ModelName not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_model_name',
          details: { modelNameId: params?.id },
        }
      );
      throw error;
    }

    const updatedModelName = await prisma.modelName.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
    });

    // Log database operation success
    logDatabaseSuccess('update_model_name', req, {
      id: updatedModelName.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedModelName,
      MODEL_NAME_LITERAL,
      displayOptions
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedModelName, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedModelName;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(updatedWithDisplay, context);
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateModelName', req, {
      id: updatedModelName.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_model_name',
    });
    if (handled) return;
  }
}

async function deleteModelName(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'ModelName', 'delete');

  logOperationStart('deleteModelName', req, {
    user: user?.id,
    modelNameId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_model_name_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete({ id: params?.id }, context);
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    // @gen:RESTRICT_CHECKS

    // @gen:CASCADE_DELETE

    // Log database operation start
    logDatabaseStart('delete_model_name', req, {
      modelNameId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.modelName.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_model_name', req, {
      deletedCount: result.count,
      modelNameId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ModelName not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_model_name',
          details: { modelNameId: params?.id },
        }
      );
      logOperationError('deleteModelName', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { @gen{DELETE_RESPONSE_KEY}: params?.id },
      context
    );

    // Log operation success
    logOperationSuccess('deleteModelName', req, {
      deletedCount: result.count,
      modelNameId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { @gen{DELETE_RESPONSE_KEY}: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_model_name',
    });
    if (handled) return;
  }
}

async function getModelNameBarChartData(req, res) {
  // @gen:DASHBOARD_BAR_CHART
}

module.exports = {
  getAllModelName,
  createModelName,
  getModelName,
  updateModelName,
  deleteModelName,
  getModelNameBarChartData,
  bulkUpdateModelNameVisibility,
};
