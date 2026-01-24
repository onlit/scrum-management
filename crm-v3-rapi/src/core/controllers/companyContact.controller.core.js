/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing companyContact using Prisma.
 * It includes functions for retrieving all companyContact, creating a new companyContact, retrieving a single companyContact,
 * updating an existing companyContact, and deleting a companyContact.
 *
 * The `getAllCompanyContact` function retrieves a paginated list of companyContact based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCompanyContact` function validates the request body using a Joi schema, generates a unique code
 * for the companyContact, and creates a new companyContact in the database with additional metadata.
 *
 * The `getCompanyContact` function retrieves a single companyContact based on the provided companyContact ID, with visibility
 * filters applied to ensure the companyContact is accessible to the requesting user.
 *
 * The `updateCompanyContact` function updates an existing companyContact in the database based on the provided companyContact ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCompanyContact` function deletes a companyContact from the database based on the provided companyContact ID, with
 * visibility filters applied to ensure the companyContact is deletable by the requesting user.
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
  companyContactCreate,
  companyContactUpdate,
  companyContactBulkVisibilityUpdate,
} = require('#core/schemas/companyContact.schema.core.js');

// Resolve interceptor for this model at module load
const interceptor = getRegistry().resolve('CompanyContact');
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
const MODEL_NAME_LITERAL = 'CompanyContact';

// Load domain filter extensions if available (for custom relation-based filters)
let domainFilterHandlers = {};
try {
  const domainExtensions = require('#domain/extensions/companyContact.filters.js');
  domainFilterHandlers = domainExtensions.filterHandlers || {};
} catch (e) {
  // No domain filter extensions for this model
}

async function bulkUpdateCompanyContactVisibility(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'CompanyContact', 'update');

  logOperationStart('bulkUpdateCompanyContactVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate with standardized error handling
    const values = await validateWithSchema(
      companyContactBulkVisibilityUpdate,
      body,
      req,
      'company_contact_bulk_visibility_update',
    );

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_company_contact_visibility_client_guard',
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
          context: 'bulk_update_company_contact_visibility_permission_check',
        },
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_company_contact_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.companyContact.updateMany({
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
    logDatabaseSuccess('bulk_update_company_contact_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateCompanyContactVisibility', req, {
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
      operationName: 'bulk_update_company_contact_visibility',
    });
    if (handled) return;
  }
}

async function getAllCompanyContact(req, res) {
  const { user, query } = req;
  const queryBuilder = createQueryBuilder('CompanyContact');
  const context = createOperationContext(req, 'CompanyContact', 'list', {
    queryBuilder,
  });

  logOperationStart('getAllCompanyContact', req, {
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

    const searchFields = ['workEmail', 'jobTitle'];
    const filterFields = [
      ...searchFields,
      'personId',
      'companyId',
      'endDate',
      'accounts',
      'startDate',
      'workPhone',
      'workMobile',
    ];

    const include = {
      person: true,
      company: true,
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
    logDatabaseStart('get_all_company_contact', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: queryForDb,
      user,
      prisma,
      schema: companyContactUpdate,
      filterFields,
      searchFields,
      model: 'companyContact',
      include: Object.keys(include).length ? include : undefined,
      customWhere: Object.keys(customWhere).length ? customWhere : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_company_contact', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    await batchHydrateRelationsInList(
      response,
      ['person', 'company'],
      user?.accessToken,
    );

    // Attach canonical computed display label per record
    if (Array.isArray(response?.results)) {
      const displayOptions = { timezone: req.timezone };
      response.results = response.results.map((r) => {
        attachNestedDisplayValues(r, [
          { relation: 'person', model: 'Person' },
          { relation: 'company', model: 'Company' },
        ]);
        const dv = computeDisplayValue(r, MODEL_NAME_LITERAL, displayOptions);
        return dv ? { ...r, [DISPLAY_VALUE_PROP]: dv } : r;
      });
    }

    // Lifecycle: afterList - transform response
    const afterListResult = await interceptor.afterList(response, context);
    const finalResponse = afterListResult.data;

    // Log operation success
    logOperationSuccess('getAllCompanyContact', req, {
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
      operationName: 'get_all_company_contact',
    });
    if (handled) return;
  }
}

async function createCompanyContact(req, res) {
  const { user, body } = req;
  const context = createOperationContext(req, 'CompanyContact', 'create');

  logOperationStart('createCompanyContact', req, {
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
    let schema = companyContactCreate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'company_contact_creation',
    );

    // Lifecycle: afterValidate - cross-field validation
    const afterValidateResult = await interceptor.afterValidate(
      values,
      context,
    );
    if (checkInterceptorHalt(afterValidateResult, res)) return;
    values = afterValidateResult.data;

    const modelRelationFields = ['personId', 'companyId'];

    const include = {
      person: true,
      company: true,
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
    logDatabaseStart('create_company_contact', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCompanyContact = await prisma.companyContact.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_company_contact', req, {
      id: newCompanyContact.id,
      code: newCompanyContact.code,
    });

    const [newCompanyContactWithDetails] = await getDetailsFromAPI({
      results: [newCompanyContact],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      newCompanyContactWithDetails,
      ['person', 'company'],
      user?.accessToken,
    );

    attachNestedDisplayValues(newCompanyContactWithDetails, [
      { relation: 'person', model: 'Person' },
      { relation: 'company', model: 'Company' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const createdDv = computeDisplayValue(
      newCompanyContactWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const createdWithDisplay = createdDv
      ? { ...newCompanyContactWithDetails, [DISPLAY_VALUE_PROP]: createdDv }
      : newCompanyContactWithDetails;

    // Lifecycle: afterCreate - post-database logic (notifications, audit, etc.)
    const afterCreateResult = await interceptor.afterCreate(
      createdWithDisplay,
      context,
    );
    const finalRecord = afterCreateResult.data;

    // Log operation success
    logOperationSuccess('createCompanyContact', req, {
      id: newCompanyContact.id,
      code: newCompanyContact.code,
    });

    res.status(201).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'create_company_contact',
    });
    if (handled) return;
  }
}

async function getCompanyContact(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'CompanyContact', 'read');

  logOperationStart('getCompanyContact', req, {
    user: user?.id,
    companyContactId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'get_company_contact_param');

    // Lifecycle: beforeRead - access control, modify query
    const beforeReadResult = await interceptor.beforeRead(params?.id, context);
    if (checkInterceptorHalt(beforeReadResult, res)) return;

    const include = {
      person: true,
      company: true,
    };

    // Log database operation start
    logDatabaseStart('get_company_contact', req, {
      companyContactId: params?.id,
      userId: user?.id,
    });

    const foundCompanyContact = await prisma.companyContact.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_company_contact', req, {
      found: !!foundCompanyContact,
      companyContactId: params?.id,
    });

    if (!foundCompanyContact) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanyContact not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_company_contact',
          details: { companyContactId: params?.id },
        },
      );
      logOperationError('getCompanyContact', req, error);
      throw error;
    }

    const [foundCompanyContactWithDetails] = await getDetailsFromAPI({
      results: [foundCompanyContact],
      token: user?.accessToken,
    });

    // First hydrate and attach nested display values so that relation-based
    // fallback fields (e.g. relatedModel.__displayValue) are available
    await hydrateRelationsOnRecord(
      foundCompanyContactWithDetails,
      ['person', 'company'],
      user?.accessToken,
    );

    attachNestedDisplayValues(foundCompanyContactWithDetails, [
      { relation: 'person', model: 'Person' },
      { relation: 'company', model: 'Company' },
    ]);

    // Now compute the record's own display value using enriched relations
    const displayOptions = { timezone: req.timezone };
    const foundDv = computeDisplayValue(
      foundCompanyContactWithDetails,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const foundWithDisplay = foundDv
      ? { ...foundCompanyContactWithDetails, [DISPLAY_VALUE_PROP]: foundDv }
      : foundCompanyContactWithDetails;

    // Lifecycle: afterRead - redact fields, transform response
    const afterReadResult = await interceptor.afterRead(
      foundWithDisplay,
      context,
    );
    const finalRecord = afterReadResult.data;

    // Log operation success
    logOperationSuccess('getCompanyContact', req, {
      id: foundCompanyContact.id,
      code: foundCompanyContact.code,
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'get_company_contact',
    });
    if (handled) return;
  }
}

async function updateCompanyContact(req, res) {
  const { params, body, user } = req;
  const context = createOperationContext(req, 'CompanyContact', 'update');

  logOperationStart('updateCompanyContact', req, {
    companyContactId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    assertValidUuidParam(params?.id, req, 'update_company_contact_param');

    let data = body;

    // Lifecycle: beforeValidate - transform input before validation
    const beforeValidateResult = await interceptor.beforeValidate(
      data,
      context,
    );
    if (checkInterceptorHalt(beforeValidateResult, res)) return;
    data = beforeValidateResult.data;

    // Lifecycle: extendSchema - allow custom schema rules
    let schema = companyContactUpdate;
    schema = interceptor.extendSchema(schema, context);

    // Validate with standardized error handling
    let values = await validateWithSchema(
      schema,
      data,
      req,
      'company_contact_update',
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
    logDatabaseStart('update_company_contact', req, {
      companyContactId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.companyContact.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanyContact not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_company_contact',
          details: { companyContactId: params?.id },
        },
      );
      throw error;
    }

    const updatedCompanyContact = await prisma.companyContact.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
    });

    // Log database operation success
    logDatabaseSuccess('update_company_contact', req, {
      id: updatedCompanyContact.id,
      updatedFields: Object.keys(values),
    });

    const displayOptions = { timezone: req.timezone };
    const updatedDv = computeDisplayValue(
      updatedCompanyContact,
      MODEL_NAME_LITERAL,
      displayOptions,
    );
    const updatedWithDisplay = updatedDv
      ? { ...updatedCompanyContact, [DISPLAY_VALUE_PROP]: updatedDv }
      : updatedCompanyContact;

    // Lifecycle: afterUpdate - post-database logic (change notifications, etc.)
    const afterUpdateResult = await interceptor.afterUpdate(
      updatedWithDisplay,
      context,
    );
    const finalRecord = afterUpdateResult.data;

    // Log operation success
    logOperationSuccess('updateCompanyContact', req, {
      id: updatedCompanyContact.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(finalRecord);
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'update_company_contact',
    });
    if (handled) return;
  }
}

async function deleteCompanyContact(req, res) {
  const { params, user } = req;
  const context = createOperationContext(req, 'CompanyContact', 'delete');

  logOperationStart('deleteCompanyContact', req, {
    user: user?.id,
    companyContactId: params?.id,
  });

  try {
    assertValidUuidParam(params?.id, req, 'delete_company_contact_param');

    // Lifecycle: beforeDelete - referential checks, access control
    const beforeDeleteResult = await interceptor.beforeDelete(
      { id: params?.id },
      context,
    );
    if (checkInterceptorHalt(beforeDeleteResult, res)) return;

    await prisma.client.updateMany({
      where: {
        companyContactId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.opportunityInfluencer.updateMany({
      where: {
        companyContactId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.opportunity.updateMany({
      where: {
        companyContactId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_company_contact', req, {
      companyContactId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.companyContact.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_company_contact', req, {
      deletedCount: result.count,
      companyContactId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanyContact not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_company_contact',
          details: { companyContactId: params?.id },
        },
      );
      logOperationError('deleteCompanyContact', req, error);
      throw error;
    }

    // Lifecycle: afterDelete - cleanup, notifications
    const afterDeleteResult = await interceptor.afterDelete(
      { deleted: params?.id },
      context,
    );

    // Log operation success
    logOperationSuccess('deleteCompanyContact', req, {
      deletedCount: result.count,
      companyContactId: params?.id,
    });

    res.status(200).json(afterDeleteResult.data || { deleted: params?.id });
  } catch (error) {
    const handled = await handleControllerError(error, {
      req,
      res,
      interceptor,
      context,
      operationName: 'delete_company_contact',
    });
    if (handled) return;
  }
}

async function getCompanyContactBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for companyContact',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCompanyContact,
  createCompanyContact,
  getCompanyContact,
  updateCompanyContact,
  deleteCompanyContact,
  getCompanyContactBarChartData,
  bulkUpdateCompanyContactVisibility,
};
