/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing personRelationship using Prisma.
 * It includes functions for retrieving all personRelationship, creating a new personRelationship, retrieving a single personRelationship,
 * updating an existing personRelationship, and deleting a personRelationship.
 *
 * The `getAllPersonRelationship` function retrieves a paginated list of personRelationship based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createPersonRelationship` function validates the request body using a Joi schema, generates a unique code
 * for the personRelationship, and creates a new personRelationship in the database with additional metadata.
 *
 * The `getPersonRelationship` function retrieves a single personRelationship based on the provided personRelationship ID, with visibility
 * filters applied to ensure the personRelationship is accessible to the requesting user.
 *
 * The `updatePersonRelationship` function updates an existing personRelationship in the database based on the provided personRelationship ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deletePersonRelationship` function deletes a personRelationship from the database based on the provided personRelationship ID, with
 * visibility filters applied to ensure the personRelationship is deletable by the requesting user.
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
  personRelationshipCreate,
  personRelationshipUpdate,
  personRelationshipBulkVisibilityUpdate,
} = require('#core/schemas/personRelationship.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('PersonRelationship');
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
const MODEL_NAME_LITERAL = 'PersonRelationship';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/personRelationship.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdatePersonRelationshipVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'PersonRelationship', 'update');

  logOperationStart('bulkUpdatePersonRelationshipVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      personRelationshipBulkVisibilityUpdate,
      body,
      req,
      'person_relationship_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_person_relationship_visibility_client_guard',
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
            'bulk_update_person_relationship_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_person_relationship_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.personRelationship.updateMany({
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
    logDatabaseSuccess('bulk_update_person_relationship_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdatePersonRelationshipVisibility', req, {
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
      operationName: 'bulk_update_person_relationship_visibility',
    });
    if (handled) return;
  }
}

async function getAllPersonRelationship(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('PersonRelationship');
  const context = createOperationContext(req, 'PersonRelationship', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllPersonRelationship', req, {
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
    const filterFields = [...searchFields, 'relationshipId', 'personId'];

    const include = {
      relationship: true,
      person: true,
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
    logDatabaseStart('get_all_person_relationship', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: personRelationshipUpdate,
      filterFields,
      searchFields,
      model: 'personRelationship',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_person_relationship', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    await batchHydrateRelationsInList(
      response,
      ['relationship', 'person'],
      user?.accessToken,
    );

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        attachNestedDisplayValues(r, [
          { relation: 'relationship', model: 'Relationship' },
          { relation: 'person', model: 'Person' },
        ]);
        const dv = computeDisplayValue(r, MODEL_NAME_LITERAL, displayOptions);
        return dv ? { ...r, [DISPLAY_VALUE_PROP]: dv } : r;
      });
    }

    // Lifecycle: afterList - transform response
    const afterListResult = await interceptor.afterList(response, context);
    const finalResponse = afterListResult.data;

    // Log operation success
    logOperationSuccess('getAllPersonRelationship', req, {
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
      operationName: 'get_all_person_relationship',
    });
    if (handled) return;
  }
}

async function createPersonRelationship(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'PersonRelationship', 'create');

  logOperationStart('createPersonRelationship', req, {
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
    let schema = personRelationshipCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'person_relationship_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = ['relationshipId', 'personId'];

    const include = {
      relationship: true,
      person: true,
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
    logDatabaseStart('create_person_relationship', req, {
      name: values.name,
      userId: user?.id,
    });

    const newPersonRelationship = await prisma.personRelationship.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_person_relationship', req, {
      id: newPersonRelationship.id,
      code: newPersonRelationship.code,
    });

    const [newPersonRelationshipWithDetails] = await getDetailsFromAPI({
      results: [newPersonRelationship],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newPersonRelationshipWithDetails,
      ['relationship', 'person'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newPersonRelationshipWithDetails, [
      { relation: 'relationship', model: 'Relationship' },
      { relation: 'person', model: 'Person' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newPersonRelationshipWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? { ...newPersonRelationshipWithDetails, [DISPLAY_VALUE_PROP]: createdDv }
      : newPersonRelationshipWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createPersonRelationship', req, {
      id: newPersonRelationship.id,
      code: newPersonRelationship.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_person_relationship',
    });
    if (handled) return;
  }
}

async function getPersonRelationship(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'PersonRelationship', 'read');

  logOperationStart('getPersonRelationship', req, {
    user: user?.id,
    personRelationshipId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_person_relationship_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      relationship: true,
      person: true,
    };

    // Log database operation start
    logDatabaseStart('get_person_relationship', req, {
      personRelationshipId: params?.id,
      userId: user?.id,
    });

    const foundPersonRelationship = await prisma.personRelationship.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_person_relationship', req, {
      found: !!foundPersonRelationship,
      personRelationshipId: params?.id,
    });

    if (!foundPersonRelationship) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonRelationship not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_person_relationship',
          details: { personRelationshipId: params?.id },
        },
      );
      logOperationError('getPersonRelationship', req, error);
      throw error;
    }

    const [foundPersonRelationshipWithDetails] = await getDetailsFromAPI({
      results: [foundPersonRelationship],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundPersonRelationshipWithDetails,
      ['relationship', 'person'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundPersonRelationshipWithDetails, [
      { relation: 'relationship', model: 'Relationship' },
      { relation: 'person', model: 'Person' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundPersonRelationshipWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? { ...foundPersonRelationshipWithDetails, [DISPLAY_VALUE_PROP]: foundDv }
      : foundPersonRelationshipWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getPersonRelationship', req, {
      id: foundPersonRelationship.id,
      code: foundPersonRelationship.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_person_relationship',
    });
    if (handled) return;
  }
}

async function updatePersonRelationship(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'PersonRelationship', 'update');

  logOperationStart('updatePersonRelationship', req, {
    personRelationshipId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_person_relationship_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = personRelationshipUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'person_relationship_update',
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
    logDatabaseStart('update_person_relationship', req, {
      personRelationshipId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.personRelationship.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonRelationship not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_person_relationship',
          details: { personRelationshipId: params?.id },
        },
      );
      throw error;
    }

    const updatedPersonRelationship = await prisma.personRelationship.findFirst(
      {
        where: { id: params?.id, client: user?.client?.id, deleted: null },
      },
    );

    // Log database operation success
    logDatabaseSuccess('update_person_relationship', req, {
      id: updatedPersonRelationship.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedPersonRelationship,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedPersonRelationship, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedPersonRelationship;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updatePersonRelationship', req, {
      id: updatedPersonRelationship.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_person_relationship',
    });
    if (handled) return;
  }
}

async function deletePersonRelationship(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'PersonRelationship', 'delete');

  logOperationStart('deletePersonRelationship', req, {
    user: user?.id,
    personRelationshipId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_person_relationship_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    await prisma.personRelationshipHistory.updateMany({
      where: {
        personRelationshipId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_person_relationship', req, {
      personRelationshipId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.personRelationship.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_person_relationship', req, {
      deletedCount: result.count,
      personRelationshipId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonRelationship not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_person_relationship',
          details: { personRelationshipId: params?.id },
        },
      );
      logOperationError('deletePersonRelationship', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deletePersonRelationship', req, {
      deletedCount: result.count,
      personRelationshipId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_person_relationship',
    });
    if (handled) return;
  }
}

async function getPersonRelationshipBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for personRelationship',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllPersonRelationship,
  createPersonRelationship,
  getPersonRelationship,
  updatePersonRelationship,
  deletePersonRelationship,
  getPersonRelationshipBarChartData,
  bulkUpdatePersonRelationshipVisibility,
};
