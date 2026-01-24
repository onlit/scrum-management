/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing prospectProduct using Prisma.
 * It includes functions for retrieving all prospectProduct, creating a new prospectProduct, retrieving a single prospectProduct,
 * updating an existing prospectProduct, and deleting a prospectProduct.
 *
 * The `getAllProspectProduct` function retrieves a paginated list of prospectProduct based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createProspectProduct` function validates the request body using a Joi schema, generates a unique code
 * for the prospectProduct, and creates a new prospectProduct in the database with additional metadata.
 *
 * The `getProspectProduct` function retrieves a single prospectProduct based on the provided prospectProduct ID, with visibility
 * filters applied to ensure the prospectProduct is accessible to the requesting user.
 *
 * The `updateProspectProduct` function updates an existing prospectProduct in the database based on the provided prospectProduct ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteProspectProduct` function deletes a prospectProduct from the database based on the provided prospectProduct ID, with
 * visibility filters applied to ensure the prospectProduct is deletable by the requesting user.
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
  prospectProductCreate,
  prospectProductUpdate,
  prospectProductBulkVisibilityUpdate,
} = require('#core/schemas/prospectProduct.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('ProspectProduct');
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
const MODEL_NAME_LITERAL = 'ProspectProduct';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/prospectProduct.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateProspectProductVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'ProspectProduct', 'update');

  logOperationStart('bulkUpdateProspectProductVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      prospectProductBulkVisibilityUpdate,
      body,
      req,
      'prospect_product_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_prospect_product_visibility_client_guard',
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
          context: 'bulk_update_prospect_product_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_prospect_product_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.prospectProduct.updateMany({
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
    logDatabaseSuccess('bulk_update_prospect_product_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateProspectProductVisibility', req, {
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
      operationName: 'bulk_update_prospect_product_visibility',
    });
    if (handled) return;
  }
}

async function getAllProspectProduct(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('ProspectProduct');
  const context = createOperationContext(req, 'ProspectProduct', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllProspectProduct', req, {
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
      'amount',
      'estimatedValue',
      'productVariantId',
      'prospectId',
    ];

    const include = {
      prospect: { include: { person: true } },
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
    logDatabaseStart('get_all_prospect_product', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: prospectProductUpdate,
      filterFields,
      searchFields,
      model: 'prospectProduct',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_prospect_product', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    await batchHydrateRelationsInList(
      response,
      ['prospect'],
      user?.accessToken,
    );

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        attachNestedDisplayValues(r, [
          { relation: 'prospect', model: 'Prospect' },
        ]);
        const dv = computeDisplayValue(r, MODEL_NAME_LITERAL, displayOptions);
        return dv ? { ...r, [DISPLAY_VALUE_PROP]: dv } : r;
      });
    }

    // Lifecycle: afterList - transform response
    const afterListResult = await interceptor.afterList(response, context);
    const finalResponse = afterListResult.data;

    // Log operation success
    logOperationSuccess('getAllProspectProduct', req, {
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
      operationName: 'get_all_prospect_product',
    });
    if (handled) return;
  }
}

async function createProspectProduct(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'ProspectProduct', 'create');

  logOperationStart('createProspectProduct', req, {
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
    let schema = prospectProductCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'prospect_product_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = ['prospectId'];

    const include = {
      prospect: { include: { person: true } },
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
    logDatabaseStart('create_prospect_product', req, {
      name: values.name,
      userId: user?.id,
    });

    const newProspectProduct = await prisma.prospectProduct.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_prospect_product', req, {
      id: newProspectProduct.id,
      code: newProspectProduct.code,
    });

    const [newProspectProductWithDetails] = await getDetailsFromAPI({
      results: [newProspectProduct],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newProspectProductWithDetails,
      ['prospect'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newProspectProductWithDetails, [
      { relation: 'prospect', model: 'Prospect' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newProspectProductWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? { ...newProspectProductWithDetails, [DISPLAY_VALUE_PROP]: createdDv }
      : newProspectProductWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createProspectProduct', req, {
      id: newProspectProduct.id,
      code: newProspectProduct.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_prospect_product',
    });
    if (handled) return;
  }
}

async function getProspectProduct(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'ProspectProduct', 'read');

  logOperationStart('getProspectProduct', req, {
    user: user?.id,
    prospectProductId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_prospect_product_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      prospect: { include: { person: true } },
    };

    // Log database operation start
    logDatabaseStart('get_prospect_product', req, {
      prospectProductId: params?.id,
      userId: user?.id,
    });

    const foundProspectProduct = await prisma.prospectProduct.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_prospect_product', req, {
      found: !!foundProspectProduct,
      prospectProductId: params?.id,
    });

    if (!foundProspectProduct) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ProspectProduct not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_prospect_product',
          details: { prospectProductId: params?.id },
        },
      );
      logOperationError('getProspectProduct', req, error);
      throw error;
    }

    const [foundProspectProductWithDetails] = await getDetailsFromAPI({
      results: [foundProspectProduct],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundProspectProductWithDetails,
      ['prospect'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundProspectProductWithDetails, [
      { relation: 'prospect', model: 'Prospect' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundProspectProductWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? { ...foundProspectProductWithDetails, [DISPLAY_VALUE_PROP]: foundDv }
      : foundProspectProductWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getProspectProduct', req, {
      id: foundProspectProduct.id,
      code: foundProspectProduct.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_prospect_product',
    });
    if (handled) return;
  }
}

async function updateProspectProduct(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'ProspectProduct', 'update');

  logOperationStart('updateProspectProduct', req, {
    prospectProductId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_prospect_product_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = prospectProductUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'prospect_product_update',
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
    logDatabaseStart('update_prospect_product', req, {
      prospectProductId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.prospectProduct.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ProspectProduct not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_prospect_product',
          details: { prospectProductId: params?.id },
        },
      );
      throw error;
    }

    const updatedProspectProduct = await prisma.prospectProduct.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
    });

    // Log database operation success
    logDatabaseSuccess('update_prospect_product', req, {
      id: updatedProspectProduct.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedProspectProduct,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedProspectProduct, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedProspectProduct;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateProspectProduct', req, {
      id: updatedProspectProduct.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_prospect_product',
    });
    if (handled) return;
  }
}

async function deleteProspectProduct(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'ProspectProduct', 'delete');

  logOperationStart('deleteProspectProduct', req, {
    user: user?.id,
    prospectProductId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_prospect_product_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    // Log database operation start
    logDatabaseStart('delete_prospect_product', req, {
      prospectProductId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.prospectProduct.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_prospect_product', req, {
      deletedCount: result.count,
      prospectProductId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ProspectProduct not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_prospect_product',
          details: { prospectProductId: params?.id },
        },
      );
      logOperationError('deleteProspectProduct', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteProspectProduct', req, {
      deletedCount: result.count,
      prospectProductId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_prospect_product',
    });
    if (handled) return;
  }
}

async function getProspectProductBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for prospectProduct',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllProspectProduct,
  createProspectProduct,
  getProspectProduct,
  updateProspectProduct,
  deleteProspectProduct,
  getProspectProductBarChartData,
  bulkUpdateProspectProductVisibility,
};
