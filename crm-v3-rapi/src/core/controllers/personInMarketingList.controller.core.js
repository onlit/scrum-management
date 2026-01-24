/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing personInMarketingList using Prisma.
 * It includes functions for retrieving all personInMarketingList, creating a new personInMarketingList, retrieving a single personInMarketingList,
 * updating an existing personInMarketingList, and deleting a personInMarketingList.
 *
 * The `getAllPersonInMarketingList` function retrieves a paginated list of personInMarketingList based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createPersonInMarketingList` function validates the request body using a Joi schema, generates a unique code
 * for the personInMarketingList, and creates a new personInMarketingList in the database with additional metadata.
 *
 * The `getPersonInMarketingList` function retrieves a single personInMarketingList based on the provided personInMarketingList ID, with visibility
 * filters applied to ensure the personInMarketingList is accessible to the requesting user.
 *
 * The `updatePersonInMarketingList` function updates an existing personInMarketingList in the database based on the provided personInMarketingList ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deletePersonInMarketingList` function deletes a personInMarketingList from the database based on the provided personInMarketingList ID, with
 * visibility filters applied to ensure the personInMarketingList is deletable by the requesting user.
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
  personInMarketingListCreate,
  personInMarketingListUpdate,
  personInMarketingListBulkVisibilityUpdate,
} = require('#core/schemas/personInMarketingList.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('PersonInMarketingList');
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
const MODEL_NAME_LITERAL = 'PersonInMarketingList';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/personInMarketingList.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdatePersonInMarketingListVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(
    req,
    'PersonInMarketingList',
    'update',
  );

  logOperationStart('bulkUpdatePersonInMarketingListVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      personInMarketingListBulkVisibilityUpdate,
      body,
      req,
      'person_in_marketing_list_bulk_visibility_update',
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
            'bulk_update_person_in_marketing_list_visibility_client_guard',
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
            'bulk_update_person_in_marketing_list_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_person_in_marketing_list_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.personInMarketingList.updateMany({
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
    logDatabaseSuccess('bulk_update_person_in_marketing_list_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdatePersonInMarketingListVisibility', req, {
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
      operationName: 'bulk_update_person_in_marketing_list_visibility',
    });
    if (handled) return;
  }
}

async function getAllPersonInMarketingList(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('PersonInMarketingList');
  const context = createOperationContext(req, 'PersonInMarketingList', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllPersonInMarketingList', req, {
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

    const searchFields = [];
    const filterFields = [
      ...searchFields,
      'personId',
      'marketingListId',
      'expiryDate',
    ];

    const include = {
      person: true,
      marketingList: true,
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
    logDatabaseStart('get_all_person_in_marketing_list', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: personInMarketingListUpdate,
      filterFields,
      searchFields,
      model: 'personInMarketingList',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_person_in_marketing_list', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    await batchHydrateRelationsInList(
      response,
      ['person', 'marketingList'],
      user?.accessToken,
    );

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        attachNestedDisplayValues(r, [
          { relation: 'person', model: 'Person' },
          { relation: 'marketingList', model: 'MarketingList' },
        ]);
        const dv = computeDisplayValue(r, MODEL_NAME_LITERAL, displayOptions);
        return dv ? { ...r, [DISPLAY_VALUE_PROP]: dv } : r;
      });
    }

    // Lifecycle: afterList - transform response
    const afterListResult = await interceptor.afterList(response, context);
    const finalResponse = afterListResult.data;

    // Log operation success
    logOperationSuccess('getAllPersonInMarketingList', req, {
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
      operationName: 'get_all_person_in_marketing_list',
    });
    if (handled) return;
  }
}

async function createPersonInMarketingList(req, res) {
  const { user, body } = req;
  const context = createOperationContext(
    req,
    'PersonInMarketingList',
    'create',
  );

  logOperationStart('createPersonInMarketingList', req, {
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
    let schema = personInMarketingListCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'person_in_marketing_list_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = ['personId', 'marketingListId'];

    const include = {
      person: true,
      marketingList: true,
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
    logDatabaseStart('create_person_in_marketing_list', req, {
      name: values.name,
      userId: user?.id,
    });

    const newPersonInMarketingList = await prisma.personInMarketingList.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_person_in_marketing_list', req, {
      id: newPersonInMarketingList.id,
      code: newPersonInMarketingList.code,
    });

    const [newPersonInMarketingListWithDetails] = await getDetailsFromAPI({
      results: [newPersonInMarketingList],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newPersonInMarketingListWithDetails,
      ['person', 'marketingList'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newPersonInMarketingListWithDetails, [
      { relation: 'person', model: 'Person' },
      { relation: 'marketingList', model: 'MarketingList' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newPersonInMarketingListWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? {
          ...newPersonInMarketingListWithDetails,
          [DISPLAY_VALUE_PROP]: createdDv,
        }
      : newPersonInMarketingListWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createPersonInMarketingList', req, {
      id: newPersonInMarketingList.id,
      code: newPersonInMarketingList.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_person_in_marketing_list',
    });
    if (handled) return;
  }
}

async function getPersonInMarketingList(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'PersonInMarketingList', 'read');

  logOperationStart('getPersonInMarketingList', req, {
    user: user?.id,
    personInMarketingListId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_person_in_marketing_list_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      person: true,
      marketingList: true,
    };

    // Log database operation start
    logDatabaseStart('get_person_in_marketing_list', req, {
      personInMarketingListId: params?.id,
      userId: user?.id,
    });

    const foundPersonInMarketingList =
      await prisma.personInMarketingList.findFirst({
        where: {
          id: params?.id,
          ...getVisibilityFilters(user),
        },
        include: Object.keys(include).length ? include : undefined,
      });

    // Log database operation success
    logDatabaseSuccess('get_person_in_marketing_list', req, {
      found: !!foundPersonInMarketingList,
      personInMarketingListId: params?.id,
    });

    if (!foundPersonInMarketingList) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonInMarketingList not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_person_in_marketing_list',
          details: { personInMarketingListId: params?.id },
        },
      );
      logOperationError('getPersonInMarketingList', req, error);
      throw error;
    }

    const [foundPersonInMarketingListWithDetails] = await getDetailsFromAPI({
      results: [foundPersonInMarketingList],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundPersonInMarketingListWithDetails,
      ['person', 'marketingList'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundPersonInMarketingListWithDetails, [
      { relation: 'person', model: 'Person' },
      { relation: 'marketingList', model: 'MarketingList' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundPersonInMarketingListWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? {
          ...foundPersonInMarketingListWithDetails,
          [DISPLAY_VALUE_PROP]: foundDv,
        }
      : foundPersonInMarketingListWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getPersonInMarketingList', req, {
      id: foundPersonInMarketingList.id,
      code: foundPersonInMarketingList.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_person_in_marketing_list',
    });
    if (handled) return;
  }
}

async function updatePersonInMarketingList(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(
    req,
    'PersonInMarketingList',
    'update',
  );

  logOperationStart('updatePersonInMarketingList', req, {
    personInMarketingListId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(
      params?.id,
      req,
      'update_person_in_marketing_list_param',
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
    let schema = personInMarketingListUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'person_in_marketing_list_update',
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
    logDatabaseStart('update_person_in_marketing_list', req, {
      personInMarketingListId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.personInMarketingList.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonInMarketingList not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_person_in_marketing_list',
          details: { personInMarketingListId: params?.id },
        },
      );
      throw error;
    }

    const updatedPersonInMarketingList =
      await prisma.personInMarketingList.findFirst({
        where: { id: params?.id, client: user?.client?.id, deleted: null },
      });

    // Log database operation success
    logDatabaseSuccess('update_person_in_marketing_list', req, {
      id: updatedPersonInMarketingList.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedPersonInMarketingList,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedPersonInMarketingList, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedPersonInMarketingList;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updatePersonInMarketingList', req, {
      id: updatedPersonInMarketingList.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_person_in_marketing_list',
    });
    if (handled) return;
  }
}

async function deletePersonInMarketingList(req, res) {
  const { params, user } = req;
  const context = createOperationContext(
    req,
    'PersonInMarketingList',
    'delete',
  );

  logOperationStart('deletePersonInMarketingList', req, {
    user: user?.id,
    personInMarketingListId: params?.id,
  });

  try {
    assertValidUuidParam(
      params?.id,
      req,
      'delete_person_in_marketing_list_param',
    );

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    // Log database operation start
    logDatabaseStart('delete_person_in_marketing_list', req, {
      personInMarketingListId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.personInMarketingList.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_person_in_marketing_list', req, {
      deletedCount: result.count,
      personInMarketingListId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonInMarketingList not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_person_in_marketing_list',
          details: { personInMarketingListId: params?.id },
        },
      );
      logOperationError('deletePersonInMarketingList', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deletePersonInMarketingList', req, {
      deletedCount: result.count,
      personInMarketingListId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_person_in_marketing_list',
    });
    if (handled) return;
  }
}

async function getPersonInMarketingListBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for personInMarketingList',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllPersonInMarketingList,
  createPersonInMarketingList,
  getPersonInMarketingList,
  updatePersonInMarketingList,
  deletePersonInMarketingList,
  getPersonInMarketingListBarChartData,
  bulkUpdatePersonInMarketingListVisibility,
};
