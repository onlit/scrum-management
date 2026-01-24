/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing personRelationshipHistory using Prisma.
 * It includes functions for retrieving all personRelationshipHistory, creating a new personRelationshipHistory, retrieving a single personRelationshipHistory,
 * updating an existing personRelationshipHistory, and deleting a personRelationshipHistory.
 *
 * The `getAllPersonRelationshipHistory` function retrieves a paginated list of personRelationshipHistory based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createPersonRelationshipHistory` function validates the request body using a Joi schema, generates a unique code
 * for the personRelationshipHistory, and creates a new personRelationshipHistory in the database with additional metadata.
 *
 * The `getPersonRelationshipHistory` function retrieves a single personRelationshipHistory based on the provided personRelationshipHistory ID, with visibility
 * filters applied to ensure the personRelationshipHistory is accessible to the requesting user.
 *
 * The `updatePersonRelationshipHistory` function updates an existing personRelationshipHistory in the database based on the provided personRelationshipHistory ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deletePersonRelationshipHistory` function deletes a personRelationshipHistory from the database based on the provided personRelationshipHistory ID, with
 * visibility filters applied to ensure the personRelationshipHistory is deletable by the requesting user.
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
  personRelationshipHistoryCreate,
  personRelationshipHistoryUpdate,
  personRelationshipHistoryBulkVisibilityUpdate,
} = require('#core/schemas/personRelationshipHistory.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('PersonRelationshipHistory');
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
const MODEL_NAME_LITERAL = 'PersonRelationshipHistory';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/personRelationshipHistory.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdatePersonRelationshipHistoryVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(
    req,
    'PersonRelationshipHistory',
    'update',
  );

  logOperationStart('bulkUpdatePersonRelationshipHistoryVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      personRelationshipHistoryBulkVisibilityUpdate,
      body,
      req,
      'person_relationship_history_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context:
            'bulk_update_person_relationship_history_visibility_client_guard',
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
            'bulk_update_person_relationship_history_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart(
      'bulk_update_person_relationship_history_visibility',
      req,
      {
        idsCount: Array.isArray(ids) ? ids.length : 0,
        updateFields: Object.keys(visibilityValues || {}),
      },
    );

    const result = await prisma.personRelationshipHistory.updateMany({
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
    logDatabaseSuccess(
      'bulk_update_person_relationship_history_visibility',
      req,
      {
        updatedCount: result.count,
      },
    );

    // Log operation success
    logOperationSuccess('bulkUpdatePersonRelationshipHistoryVisibility', req, {
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
      operationName: 'bulk_update_person_relationship_history_visibility',
    });
    if (handled) return;
  }
}

async function getAllPersonRelationshipHistory(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('PersonRelationshipHistory');
  const context = createOperationContext(
    req,
    'PersonRelationshipHistory',
    'list',
    { queryBuilder },
  );

  logOperationStart('getAllPersonRelationshipHistory', req, {
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
    const filterFields = [...searchFields, 'personRelationshipId'];

    const include = {
      personRelationship: { include: { person: true } },
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
    logDatabaseStart('get_all_person_relationship_history', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: personRelationshipHistoryUpdate,
      filterFields,
      searchFields,
      model: 'personRelationshipHistory',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_person_relationship_history', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    await batchHydrateRelationsInList(
      response,
      ['personRelationship'],
      user?.accessToken,
    );

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        attachNestedDisplayValues(r, [
          { relation: 'personRelationship', model: 'PersonRelationship' },
        ]);
        const dv = computeDisplayValue(r, MODEL_NAME_LITERAL, displayOptions);
        return dv ? { ...r, [DISPLAY_VALUE_PROP]: dv } : r;
      });
    }

    // Lifecycle: afterList - transform response
    const afterListResult = await interceptor.afterList(response, context);
    const finalResponse = afterListResult.data;

    // Log operation success
    logOperationSuccess('getAllPersonRelationshipHistory', req, {
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
      operationName: 'get_all_person_relationship_history',
    });
    if (handled) return;
  }
}

async function createPersonRelationshipHistory(req, res) {
  const { user, body } = req;
  const context = createOperationContext(
    req,
    'PersonRelationshipHistory',
    'create',
  );

  logOperationStart('createPersonRelationshipHistory', req, {
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
    let schema = personRelationshipHistoryCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'person_relationship_history_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = ['personRelationshipId'];

    const include = {
      personRelationship: { include: { person: true } },
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
    logDatabaseStart('create_person_relationship_history', req, {
      name: values.name,
      userId: user?.id,
    });

    const newPersonRelationshipHistory =
      await prisma.personRelationshipHistory.create({
        data: buildCreateRecordPayload({
          user,
          validatedValues: values,
          requestBody: body,
          relations: modelRelationFields,
        }),
        include: Object.keys(include).length ? include : undefined,
      });

    // Log database operation success
    logDatabaseSuccess('create_person_relationship_history', req, {
      id: newPersonRelationshipHistory.id,
      code: newPersonRelationshipHistory.code,
    });

    const [newPersonRelationshipHistoryWithDetails] = await getDetailsFromAPI({
      results: [newPersonRelationshipHistory],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newPersonRelationshipHistoryWithDetails,
      ['personRelationship'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newPersonRelationshipHistoryWithDetails, [
      { relation: 'personRelationship', model: 'PersonRelationship' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newPersonRelationshipHistoryWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? {
          ...newPersonRelationshipHistoryWithDetails,
          [DISPLAY_VALUE_PROP]: createdDv,
        }
      : newPersonRelationshipHistoryWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createPersonRelationshipHistory', req, {
      id: newPersonRelationshipHistory.id,
      code: newPersonRelationshipHistory.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_person_relationship_history',
    });
    if (handled) return;
  }
}

async function getPersonRelationshipHistory(req, res) {
  const { params, user } = req;
  const context = createOperationContext(
    req,
    'PersonRelationshipHistory',
    'read',
  );

  logOperationStart('getPersonRelationshipHistory', req, {
    user: user?.id,
    personRelationshipHistoryId: params?.id,
  });

  try {
    assertValidUuidParam(
      params?.id,
      req,
      'get_person_relationship_history_param',
    );

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      personRelationship: { include: { person: true } },
    };

    // Log database operation start
    logDatabaseStart('get_person_relationship_history', req, {
      personRelationshipHistoryId: params?.id,
      userId: user?.id,
    });

    const foundPersonRelationshipHistory =
      await prisma.personRelationshipHistory.findFirst({
        where: {
          id: params?.id,
          ...getVisibilityFilters(user),
        },
        include: Object.keys(include).length ? include : undefined,
      });

    // Log database operation success
    logDatabaseSuccess('get_person_relationship_history', req, {
      found: !!foundPersonRelationshipHistory,
      personRelationshipHistoryId: params?.id,
    });

    if (!foundPersonRelationshipHistory) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonRelationshipHistory not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_person_relationship_history',
          details: { personRelationshipHistoryId: params?.id },
        },
      );
      logOperationError('getPersonRelationshipHistory', req, error);
      throw error;
    }

    const [foundPersonRelationshipHistoryWithDetails] = await getDetailsFromAPI(
      {
        results: [foundPersonRelationshipHistory],
        token: user?.accessToken,
      },
    );

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundPersonRelationshipHistoryWithDetails,
      ['personRelationship'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundPersonRelationshipHistoryWithDetails, [
      { relation: 'personRelationship', model: 'PersonRelationship' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundPersonRelationshipHistoryWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? {
          ...foundPersonRelationshipHistoryWithDetails,
          [DISPLAY_VALUE_PROP]: foundDv,
        }
      : foundPersonRelationshipHistoryWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getPersonRelationshipHistory', req, {
      id: foundPersonRelationshipHistory.id,
      code: foundPersonRelationshipHistory.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_person_relationship_history',
    });
    if (handled) return;
  }
}

async function updatePersonRelationshipHistory(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(
    req,
    'PersonRelationshipHistory',
    'update',
  );

  logOperationStart('updatePersonRelationshipHistory', req, {
    personRelationshipHistoryId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(
      params?.id,
      req,
      'update_person_relationship_history_param',
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
    let schema = personRelationshipHistoryUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'person_relationship_history_update',
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
    logDatabaseStart('update_person_relationship_history', req, {
      personRelationshipHistoryId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.personRelationshipHistory.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonRelationshipHistory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_person_relationship_history',
          details: { personRelationshipHistoryId: params?.id },
        },
      );
      throw error;
    }

    const updatedPersonRelationshipHistory =
      await prisma.personRelationshipHistory.findFirst({
        where: { id: params?.id, client: user?.client?.id, deleted: null },
      });

    // Log database operation success
    logDatabaseSuccess('update_person_relationship_history', req, {
      id: updatedPersonRelationshipHistory.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedPersonRelationshipHistory,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedPersonRelationshipHistory, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedPersonRelationshipHistory;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updatePersonRelationshipHistory', req, {
      id: updatedPersonRelationshipHistory.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_person_relationship_history',
    });
    if (handled) return;
  }
}

async function deletePersonRelationshipHistory(req, res) {
  const { params, user } = req;
  const context = createOperationContext(
    req,
    'PersonRelationshipHistory',
    'delete',
  );

  logOperationStart('deletePersonRelationshipHistory', req, {
    user: user?.id,
    personRelationshipHistoryId: params?.id,
  });

  try {
    assertValidUuidParam(
      params?.id,
      req,
      'delete_person_relationship_history_param',
    );

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    // Log database operation start
    logDatabaseStart('delete_person_relationship_history', req, {
      personRelationshipHistoryId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.personRelationshipHistory.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_person_relationship_history', req, {
      deletedCount: result.count,
      personRelationshipHistoryId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonRelationshipHistory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_person_relationship_history',
          details: { personRelationshipHistoryId: params?.id },
        },
      );
      logOperationError('deletePersonRelationshipHistory', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deletePersonRelationshipHistory', req, {
      deletedCount: result.count,
      personRelationshipHistoryId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_person_relationship_history',
    });
    if (handled) return;
  }
}

async function getPersonRelationshipHistoryBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for personRelationshipHistory',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllPersonRelationshipHistory,
  createPersonRelationshipHistory,
  getPersonRelationshipHistory,
  updatePersonRelationshipHistory,
  deletePersonRelationshipHistory,
  getPersonRelationshipHistoryBarChartData,
  bulkUpdatePersonRelationshipHistoryVisibility,
};
