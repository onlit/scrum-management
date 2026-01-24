/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing customerEnquiry using Prisma.
 * It includes functions for retrieving all customerEnquiry, creating a new customerEnquiry, retrieving a single customerEnquiry,
 * updating an existing customerEnquiry, and deleting a customerEnquiry.
 *
 * The `getAllCustomerEnquiry` function retrieves a paginated list of customerEnquiry based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCustomerEnquiry` function validates the request body using a Joi schema, generates a unique code
 * for the customerEnquiry, and creates a new customerEnquiry in the database with additional metadata.
 *
 * The `getCustomerEnquiry` function retrieves a single customerEnquiry based on the provided customerEnquiry ID, with visibility
 * filters applied to ensure the customerEnquiry is accessible to the requesting user.
 *
 * The `updateCustomerEnquiry` function updates an existing customerEnquiry in the database based on the provided customerEnquiry ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCustomerEnquiry` function deletes a customerEnquiry from the database based on the provided customerEnquiry ID, with
 * visibility filters applied to ensure the customerEnquiry is deletable by the requesting user.
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
  customerEnquiryCreate,
  customerEnquiryUpdate,
  customerEnquiryBulkVisibilityUpdate,
} = require('#core/schemas/customerEnquiry.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('CustomerEnquiry');
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
const MODEL_NAME_LITERAL = 'CustomerEnquiry';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/customerEnquiry.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateCustomerEnquiryVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'CustomerEnquiry', 'update');

  logOperationStart('bulkUpdateCustomerEnquiryVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      customerEnquiryBulkVisibilityUpdate,
      body,
      req,
      'customer_enquiry_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_customer_enquiry_visibility_client_guard',
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
          context: 'bulk_update_customer_enquiry_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_customer_enquiry_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.customerEnquiry.updateMany({
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
    logDatabaseSuccess('bulk_update_customer_enquiry_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateCustomerEnquiryVisibility', req, {
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
      operationName: 'bulk_update_customer_enquiry_visibility',
    });
    if (handled) return;
  }
}

async function getAllCustomerEnquiry(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('CustomerEnquiry');
  const context = createOperationContext(req, 'CustomerEnquiry', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllCustomerEnquiry', req, {
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

    const searchFields = [
      'firstName',
      'lastName',
      'sourceNotes',
      'message',
      'source',
    ];
    const filterFields = [
      ...searchFields,
      'personId',
      'statusId',
      'purposeId',
      'phone',
    ];

    const include = {
      person: true,
      status: true,
      purpose: true,
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
    logDatabaseStart('get_all_customer_enquiry', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: customerEnquiryUpdate,
      filterFields,
      searchFields,
      model: 'customerEnquiry',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_customer_enquiry', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    await batchHydrateRelationsInList(
      response,
      ['person', 'status', 'purpose'],
      user?.accessToken,
    );

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        attachNestedDisplayValues(r, [
          { relation: 'person', model: 'Person' },
          { relation: 'status', model: 'CustomerEnquiryStatus' },
          { relation: 'purpose', model: 'CustomerEnquiryPurpose' },
        ]);
        const dv = computeDisplayValue(r, MODEL_NAME_LITERAL, displayOptions);
        return dv ? { ...r, [DISPLAY_VALUE_PROP]: dv } : r;
      });
    }

    // Lifecycle: afterList - transform response
    const afterListResult = await interceptor.afterList(response, context);
    const finalResponse = afterListResult.data;

    // Log operation success
    logOperationSuccess('getAllCustomerEnquiry', req, {
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
      operationName: 'get_all_customer_enquiry',
    });
    if (handled) return;
  }
}

async function createCustomerEnquiry(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'CustomerEnquiry', 'create');

  logOperationStart('createCustomerEnquiry', req, {
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
    let schema = customerEnquiryCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'customer_enquiry_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = ['personId', 'statusId', 'purposeId'];

    const include = {
      person: true,
      status: true,
      purpose: true,
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
    logDatabaseStart('create_customer_enquiry', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCustomerEnquiry = await prisma.customerEnquiry.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_customer_enquiry', req, {
      id: newCustomerEnquiry.id,
      code: newCustomerEnquiry.code,
    });

    const [newCustomerEnquiryWithDetails] = await getDetailsFromAPI({
      results: [newCustomerEnquiry],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newCustomerEnquiryWithDetails,
      ['person', 'status', 'purpose'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newCustomerEnquiryWithDetails, [
      { relation: 'person', model: 'Person' },
      { relation: 'status', model: 'CustomerEnquiryStatus' },
      { relation: 'purpose', model: 'CustomerEnquiryPurpose' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newCustomerEnquiryWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? { ...newCustomerEnquiryWithDetails, [DISPLAY_VALUE_PROP]: createdDv }
      : newCustomerEnquiryWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createCustomerEnquiry', req, {
      id: newCustomerEnquiry.id,
      code: newCustomerEnquiry.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_customer_enquiry',
    });
    if (handled) return;
  }
}

async function getCustomerEnquiry(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'CustomerEnquiry', 'read');

  logOperationStart('getCustomerEnquiry', req, {
    user: user?.id,
    customerEnquiryId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_customer_enquiry_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      person: true,
      status: true,
      purpose: true,
    };

    // Log database operation start
    logDatabaseStart('get_customer_enquiry', req, {
      customerEnquiryId: params?.id,
      userId: user?.id,
    });

    const foundCustomerEnquiry = await prisma.customerEnquiry.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_customer_enquiry', req, {
      found: !!foundCustomerEnquiry,
      customerEnquiryId: params?.id,
    });

    if (!foundCustomerEnquiry) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CustomerEnquiry not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_customer_enquiry',
          details: { customerEnquiryId: params?.id },
        },
      );
      logOperationError('getCustomerEnquiry', req, error);
      throw error;
    }

    const [foundCustomerEnquiryWithDetails] = await getDetailsFromAPI({
      results: [foundCustomerEnquiry],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundCustomerEnquiryWithDetails,
      ['person', 'status', 'purpose'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundCustomerEnquiryWithDetails, [
      { relation: 'person', model: 'Person' },
      { relation: 'status', model: 'CustomerEnquiryStatus' },
      { relation: 'purpose', model: 'CustomerEnquiryPurpose' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundCustomerEnquiryWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? { ...foundCustomerEnquiryWithDetails, [DISPLAY_VALUE_PROP]: foundDv }
      : foundCustomerEnquiryWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getCustomerEnquiry', req, {
      id: foundCustomerEnquiry.id,
      code: foundCustomerEnquiry.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_customer_enquiry',
    });
    if (handled) return;
  }
}

async function updateCustomerEnquiry(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'CustomerEnquiry', 'update');

  logOperationStart('updateCustomerEnquiry', req, {
    customerEnquiryId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_customer_enquiry_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = customerEnquiryUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'customer_enquiry_update',
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
    logDatabaseStart('update_customer_enquiry', req, {
      customerEnquiryId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.customerEnquiry.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CustomerEnquiry not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_customer_enquiry',
          details: { customerEnquiryId: params?.id },
        },
      );
      throw error;
    }

    const updatedCustomerEnquiry = await prisma.customerEnquiry.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
    });

    // Log database operation success
    logDatabaseSuccess('update_customer_enquiry', req, {
      id: updatedCustomerEnquiry.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedCustomerEnquiry,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedCustomerEnquiry, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedCustomerEnquiry;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateCustomerEnquiry', req, {
      id: updatedCustomerEnquiry.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_customer_enquiry',
    });
    if (handled) return;
  }
}

async function deleteCustomerEnquiry(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'CustomerEnquiry', 'delete');

  logOperationStart('deleteCustomerEnquiry', req, {
    user: user?.id,
    customerEnquiryId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_customer_enquiry_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    // Log database operation start
    logDatabaseStart('delete_customer_enquiry', req, {
      customerEnquiryId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.customerEnquiry.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_customer_enquiry', req, {
      deletedCount: result.count,
      customerEnquiryId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CustomerEnquiry not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_customer_enquiry',
          details: { customerEnquiryId: params?.id },
        },
      );
      logOperationError('deleteCustomerEnquiry', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteCustomerEnquiry', req, {
      deletedCount: result.count,
      customerEnquiryId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_customer_enquiry',
    });
    if (handled) return;
  }
}

async function getCustomerEnquiryBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for customerEnquiry',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCustomerEnquiry,
  createCustomerEnquiry,
  getCustomerEnquiry,
  updateCustomerEnquiry,
  deleteCustomerEnquiry,
  getCustomerEnquiryBarChartData,
  bulkUpdateCustomerEnquiryVisibility,
};
