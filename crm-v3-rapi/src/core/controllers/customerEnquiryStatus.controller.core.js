/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing customerEnquiryStatus using Prisma.
 * It includes functions for retrieving all customerEnquiryStatus, creating a new customerEnquiryStatus, retrieving a single customerEnquiryStatus,
 * updating an existing customerEnquiryStatus, and deleting a customerEnquiryStatus.
 *
 * The `getAllCustomerEnquiryStatus` function retrieves a paginated list of customerEnquiryStatus based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCustomerEnquiryStatus` function validates the request body using a Joi schema, generates a unique code
 * for the customerEnquiryStatus, and creates a new customerEnquiryStatus in the database with additional metadata.
 *
 * The `getCustomerEnquiryStatus` function retrieves a single customerEnquiryStatus based on the provided customerEnquiryStatus ID, with visibility
 * filters applied to ensure the customerEnquiryStatus is accessible to the requesting user.
 *
 * The `updateCustomerEnquiryStatus` function updates an existing customerEnquiryStatus in the database based on the provided customerEnquiryStatus ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCustomerEnquiryStatus` function deletes a customerEnquiryStatus from the database based on the provided customerEnquiryStatus ID, with
 * visibility filters applied to ensure the customerEnquiryStatus is deletable by the requesting user.
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
  customerEnquiryStatusCreate,
  customerEnquiryStatusUpdate,
  customerEnquiryStatusBulkVisibilityUpdate,
} = require('#core/schemas/customerEnquiryStatus.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('CustomerEnquiryStatus');
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
const MODEL_NAME_LITERAL = 'CustomerEnquiryStatus';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/customerEnquiryStatus.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateCustomerEnquiryStatusVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(
    req,
    'CustomerEnquiryStatus',
    'update',
  );

  logOperationStart('bulkUpdateCustomerEnquiryStatusVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      customerEnquiryStatusBulkVisibilityUpdate,
      body,
      req,
      'customer_enquiry_status_bulk_visibility_update',
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
            'bulk_update_customer_enquiry_status_visibility_client_guard',
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
            'bulk_update_customer_enquiry_status_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_customer_enquiry_status_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.customerEnquiryStatus.updateMany({
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
    logDatabaseSuccess('bulk_update_customer_enquiry_status_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateCustomerEnquiryStatusVisibility', req, {
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
      operationName: 'bulk_update_customer_enquiry_status_visibility',
    });
    if (handled) return;
  }
}

async function getAllCustomerEnquiryStatus(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('CustomerEnquiryStatus');
  const context = createOperationContext(req, 'CustomerEnquiryStatus', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllCustomerEnquiryStatus', req, {
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

    const searchFields = ['description', 'name'];
    const filterFields = [...searchFields];

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
    logDatabaseStart('get_all_customer_enquiry_status', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: customerEnquiryStatusUpdate,
      filterFields,
      searchFields,
      model: 'customerEnquiryStatus',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_customer_enquiry_status', req, {
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
    logOperationSuccess('getAllCustomerEnquiryStatus', req, {
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
      operationName: 'get_all_customer_enquiry_status',
    });
    if (handled) return;
  }
}

async function createCustomerEnquiryStatus(req, res) {
  const { user, body } = req;
  const context = createOperationContext(
    req,
    'CustomerEnquiryStatus',
    'create',
  );

  logOperationStart('createCustomerEnquiryStatus', req, {
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
    let schema = customerEnquiryStatusCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'customer_enquiry_status_creation',
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
    logDatabaseStart('create_customer_enquiry_status', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCustomerEnquiryStatus = await prisma.customerEnquiryStatus.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_customer_enquiry_status', req, {
      id: newCustomerEnquiryStatus.id,
      code: newCustomerEnquiryStatus.code,
    });

    const [newCustomerEnquiryStatusWithDetails] = await getDetailsFromAPI({
      results: [newCustomerEnquiryStatus],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newCustomerEnquiryStatusWithDetails,
      [],
      user?.accessToken,
    );

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newCustomerEnquiryStatusWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? {
          ...newCustomerEnquiryStatusWithDetails,
          [DISPLAY_VALUE_PROP]: createdDv,
        }
      : newCustomerEnquiryStatusWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createCustomerEnquiryStatus', req, {
      id: newCustomerEnquiryStatus.id,
      code: newCustomerEnquiryStatus.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_customer_enquiry_status',
    });
    if (handled) return;
  }
}

async function getCustomerEnquiryStatus(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'CustomerEnquiryStatus', 'read');

  logOperationStart('getCustomerEnquiryStatus', req, {
    user: user?.id,
    customerEnquiryStatusId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_customer_enquiry_status_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {};

    // Log database operation start
    logDatabaseStart('get_customer_enquiry_status', req, {
      customerEnquiryStatusId: params?.id,
      userId: user?.id,
    });

    const foundCustomerEnquiryStatus =
      await prisma.customerEnquiryStatus.findFirst({
        where: {
          id: params?.id,
          ...getVisibilityFilters(user),
        },
        include: Object.keys(include).length ? include : undefined,
      });

    // Log database operation success
    logDatabaseSuccess('get_customer_enquiry_status', req, {
      found: !!foundCustomerEnquiryStatus,
      customerEnquiryStatusId: params?.id,
    });

    if (!foundCustomerEnquiryStatus) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CustomerEnquiryStatus not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_customer_enquiry_status',
          details: { customerEnquiryStatusId: params?.id },
        },
      );
      logOperationError('getCustomerEnquiryStatus', req, error);
      throw error;
    }

    const [foundCustomerEnquiryStatusWithDetails] = await getDetailsFromAPI({
      results: [foundCustomerEnquiryStatus],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundCustomerEnquiryStatusWithDetails,
      [],
      user?.accessToken,
    );

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundCustomerEnquiryStatusWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? {
          ...foundCustomerEnquiryStatusWithDetails,
          [DISPLAY_VALUE_PROP]: foundDv,
        }
      : foundCustomerEnquiryStatusWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getCustomerEnquiryStatus', req, {
      id: foundCustomerEnquiryStatus.id,
      code: foundCustomerEnquiryStatus.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_customer_enquiry_status',
    });
    if (handled) return;
  }
}

async function updateCustomerEnquiryStatus(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(
    req,
    'CustomerEnquiryStatus',
    'update',
  );

  logOperationStart('updateCustomerEnquiryStatus', req, {
    customerEnquiryStatusId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(
      params?.id,
      req,
      'update_customer_enquiry_status_param',
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
    let schema = customerEnquiryStatusUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'customer_enquiry_status_update',
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
    logDatabaseStart('update_customer_enquiry_status', req, {
      customerEnquiryStatusId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.customerEnquiryStatus.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CustomerEnquiryStatus not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_customer_enquiry_status',
          details: { customerEnquiryStatusId: params?.id },
        },
      );
      throw error;
    }

    const updatedCustomerEnquiryStatus =
      await prisma.customerEnquiryStatus.findFirst({
        where: { id: params?.id, client: user?.client?.id, deleted: null },
      });

    // Log database operation success
    logDatabaseSuccess('update_customer_enquiry_status', req, {
      id: updatedCustomerEnquiryStatus.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedCustomerEnquiryStatus,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedCustomerEnquiryStatus, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedCustomerEnquiryStatus;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateCustomerEnquiryStatus', req, {
      id: updatedCustomerEnquiryStatus.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_customer_enquiry_status',
    });
    if (handled) return;
  }
}

async function deleteCustomerEnquiryStatus(req, res) {
  const { params, user } = req;
  const context = createOperationContext(
    req,
    'CustomerEnquiryStatus',
    'delete',
  );

  logOperationStart('deleteCustomerEnquiryStatus', req, {
    user: user?.id,
    customerEnquiryStatusId: params?.id,
  });

  try {
    assertValidUuidParam(
      params?.id,
      req,
      'delete_customer_enquiry_status_param',
    );

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    await prisma.customerEnquiry.updateMany({
      where: { statusId: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_customer_enquiry_status', req, {
      customerEnquiryStatusId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.customerEnquiryStatus.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_customer_enquiry_status', req, {
      deletedCount: result.count,
      customerEnquiryStatusId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CustomerEnquiryStatus not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_customer_enquiry_status',
          details: { customerEnquiryStatusId: params?.id },
        },
      );
      logOperationError('deleteCustomerEnquiryStatus', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteCustomerEnquiryStatus', req, {
      deletedCount: result.count,
      customerEnquiryStatusId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_customer_enquiry_status',
    });
    if (handled) return;
  }
}

async function getCustomerEnquiryStatusBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for customerEnquiryStatus',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCustomerEnquiryStatus,
  createCustomerEnquiryStatus,
  getCustomerEnquiryStatus,
  updateCustomerEnquiryStatus,
  deleteCustomerEnquiryStatus,
  getCustomerEnquiryStatusBarChartData,
  bulkUpdateCustomerEnquiryStatusVisibility,
};
