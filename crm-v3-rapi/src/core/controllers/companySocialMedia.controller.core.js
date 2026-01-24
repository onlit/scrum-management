/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing companySocialMedia using Prisma.
 * It includes functions for retrieving all companySocialMedia, creating a new companySocialMedia, retrieving a single companySocialMedia,
 * updating an existing companySocialMedia, and deleting a companySocialMedia.
 *
 * The `getAllCompanySocialMedia` function retrieves a paginated list of companySocialMedia based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCompanySocialMedia` function validates the request body using a Joi schema, generates a unique code
 * for the companySocialMedia, and creates a new companySocialMedia in the database with additional metadata.
 *
 * The `getCompanySocialMedia` function retrieves a single companySocialMedia based on the provided companySocialMedia ID, with visibility
 * filters applied to ensure the companySocialMedia is accessible to the requesting user.
 *
 * The `updateCompanySocialMedia` function updates an existing companySocialMedia in the database based on the provided companySocialMedia ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCompanySocialMedia` function deletes a companySocialMedia from the database based on the provided companySocialMedia ID, with
 * visibility filters applied to ensure the companySocialMedia is deletable by the requesting user.
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
  companySocialMediaCreate,
  companySocialMediaUpdate,
  companySocialMediaBulkVisibilityUpdate,
} = require('#core/schemas/companySocialMedia.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('CompanySocialMedia');
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
const MODEL_NAME_LITERAL = 'CompanySocialMedia';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/companySocialMedia.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateCompanySocialMediaVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'CompanySocialMedia', 'update');

  logOperationStart('bulkUpdateCompanySocialMediaVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      companySocialMediaBulkVisibilityUpdate,
      body,
      req,
      'company_social_media_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_company_social_media_visibility_client_guard',
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
            'bulk_update_company_social_media_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_company_social_media_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.companySocialMedia.updateMany({
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
    logDatabaseSuccess('bulk_update_company_social_media_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateCompanySocialMediaVisibility', req, {
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
      operationName: 'bulk_update_company_social_media_visibility',
    });
    if (handled) return;
  }
}

async function getAllCompanySocialMedia(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('CompanySocialMedia');
  const context = createOperationContext(req, 'CompanySocialMedia', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllCompanySocialMedia', req, {
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

    const searchFields = ['url'];
    const filterFields = [...searchFields, 'companyId', 'socialMediaId'];

    const include = {
      company: true,
      socialMedia: true,
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
    logDatabaseStart('get_all_company_social_media', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: companySocialMediaUpdate,
      filterFields,
      searchFields,
      model: 'companySocialMedia',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_company_social_media', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    await batchHydrateRelationsInList(
      response,
      ['company', 'socialMedia'],
      user?.accessToken,
    );

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        attachNestedDisplayValues(r, [
          { relation: 'company', model: 'Company' },
          { relation: 'socialMedia', model: 'SocialMediaType' },
        ]);
        const dv = computeDisplayValue(r, MODEL_NAME_LITERAL, displayOptions);
        return dv ? { ...r, [DISPLAY_VALUE_PROP]: dv } : r;
      });
    }

    // Lifecycle: afterList - transform response
    const afterListResult = await interceptor.afterList(response, context);
    const finalResponse = afterListResult.data;

    // Log operation success
    logOperationSuccess('getAllCompanySocialMedia', req, {
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
      operationName: 'get_all_company_social_media',
    });
    if (handled) return;
  }
}

async function createCompanySocialMedia(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'CompanySocialMedia', 'create');

  logOperationStart('createCompanySocialMedia', req, {
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
    let schema = companySocialMediaCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'company_social_media_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = ['companyId', 'socialMediaId'];

    const include = {
      company: true,
      socialMedia: true,
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
    logDatabaseStart('create_company_social_media', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCompanySocialMedia = await prisma.companySocialMedia.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_company_social_media', req, {
      id: newCompanySocialMedia.id,
      code: newCompanySocialMedia.code,
    });

    const [newCompanySocialMediaWithDetails] = await getDetailsFromAPI({
      results: [newCompanySocialMedia],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newCompanySocialMediaWithDetails,
      ['company', 'socialMedia'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newCompanySocialMediaWithDetails, [
      { relation: 'company', model: 'Company' },
      { relation: 'socialMedia', model: 'SocialMediaType' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newCompanySocialMediaWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? { ...newCompanySocialMediaWithDetails, [DISPLAY_VALUE_PROP]: createdDv }
      : newCompanySocialMediaWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createCompanySocialMedia', req, {
      id: newCompanySocialMedia.id,
      code: newCompanySocialMedia.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_company_social_media',
    });
    if (handled) return;
  }
}

async function getCompanySocialMedia(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'CompanySocialMedia', 'read');

  logOperationStart('getCompanySocialMedia', req, {
    user: user?.id,
    companySocialMediaId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_company_social_media_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      company: true,
      socialMedia: true,
    };

    // Log database operation start
    logDatabaseStart('get_company_social_media', req, {
      companySocialMediaId: params?.id,
      userId: user?.id,
    });

    const foundCompanySocialMedia = await prisma.companySocialMedia.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_company_social_media', req, {
      found: !!foundCompanySocialMedia,
      companySocialMediaId: params?.id,
    });

    if (!foundCompanySocialMedia) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanySocialMedia not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_company_social_media',
          details: { companySocialMediaId: params?.id },
        },
      );
      logOperationError('getCompanySocialMedia', req, error);
      throw error;
    }

    const [foundCompanySocialMediaWithDetails] = await getDetailsFromAPI({
      results: [foundCompanySocialMedia],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundCompanySocialMediaWithDetails,
      ['company', 'socialMedia'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundCompanySocialMediaWithDetails, [
      { relation: 'company', model: 'Company' },
      { relation: 'socialMedia', model: 'SocialMediaType' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundCompanySocialMediaWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? { ...foundCompanySocialMediaWithDetails, [DISPLAY_VALUE_PROP]: foundDv }
      : foundCompanySocialMediaWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getCompanySocialMedia', req, {
      id: foundCompanySocialMedia.id,
      code: foundCompanySocialMedia.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_company_social_media',
    });
    if (handled) return;
  }
}

async function updateCompanySocialMedia(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'CompanySocialMedia', 'update');

  logOperationStart('updateCompanySocialMedia', req, {
    companySocialMediaId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_company_social_media_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = companySocialMediaUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'company_social_media_update',
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
    logDatabaseStart('update_company_social_media', req, {
      companySocialMediaId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.companySocialMedia.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanySocialMedia not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_company_social_media',
          details: { companySocialMediaId: params?.id },
        },
      );
      throw error;
    }

    const updatedCompanySocialMedia = await prisma.companySocialMedia.findFirst(
      {
        where: { id: params?.id, client: user?.client?.id, deleted: null },
      },
    );

    // Log database operation success
    logDatabaseSuccess('update_company_social_media', req, {
      id: updatedCompanySocialMedia.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedCompanySocialMedia,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedCompanySocialMedia, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedCompanySocialMedia;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateCompanySocialMedia', req, {
      id: updatedCompanySocialMedia.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_company_social_media',
    });
    if (handled) return;
  }
}

async function deleteCompanySocialMedia(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'CompanySocialMedia', 'delete');

  logOperationStart('deleteCompanySocialMedia', req, {
    user: user?.id,
    companySocialMediaId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_company_social_media_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    // Log database operation start
    logDatabaseStart('delete_company_social_media', req, {
      companySocialMediaId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.companySocialMedia.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_company_social_media', req, {
      deletedCount: result.count,
      companySocialMediaId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanySocialMedia not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_company_social_media',
          details: { companySocialMediaId: params?.id },
        },
      );
      logOperationError('deleteCompanySocialMedia', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteCompanySocialMedia', req, {
      deletedCount: result.count,
      companySocialMediaId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_company_social_media',
    });
    if (handled) return;
  }
}

async function getCompanySocialMediaBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for companySocialMedia',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCompanySocialMedia,
  createCompanySocialMedia,
  getCompanySocialMedia,
  updateCompanySocialMedia,
  deleteCompanySocialMedia,
  getCompanySocialMediaBarChartData,
  bulkUpdateCompanySocialMediaVisibility,
};
