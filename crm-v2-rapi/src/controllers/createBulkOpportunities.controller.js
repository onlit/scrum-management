const _ = require('lodash');
const validator = require('validator');
const prisma = require('#configs/prisma.js');
const {
  ERROR_TYPES,
  ERROR_SEVERITY,
  DISPLAY_VALUE_PROP,
} = require('#configs/constants.js');
const { getVisibilityFilters } = require('#utils/shared/visibilityUtils.js');
const {
  verifyForeignKeyAccessBatch,
  getListFiltersAndQueries,
} = require('#utils/shared/databaseUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/shared/traceUtils.js');
const { handleDatabaseError } = require('#utils/shared/errorHandlingUtils.js');
const { companyUpdate } = require('#schemas/company.schemas.js');
const { computeDisplayValue } = require('#utils/shared/displayValueUtils.js');

function normalizeSelectionInputs(body = {}, query = {}) {
  const src = Object.keys(body || {}).length ? body : query;
  const parseCsv = (v) =>
    (Array.isArray(v) ? v : String(v || '').split(','))
      .map((x) => String(x).trim())
      .filter(Boolean);
  let filters = _.isPlainObject(src?.filters) ? src.filters : {};
  if (!_.isPlainObject(filters) && typeof filters === 'string') {
    try {
      filters = JSON.parse(filters);
    } catch (_e) {
      filters = {};
    }
  }
  return {
    all: Boolean(src?.all),
    ids: Array.isArray(src?.ids)
      ? src.ids.filter(Boolean)
      : src?.ids
      ? parseCsv(src?.ids)
      : [],
    exclude: Array.isArray(src?.exclude)
      ? src.exclude.filter(Boolean)
      : src?.exclude
      ? parseCsv(src?.exclude)
      : [],
    filters,
    search_query: _.isString(src?.search_query) ? src.search_query : '',
    pipeline: _.isPlainObject(src?.pipeline)
      ? src.pipeline
      : src?.pipeline || {},
  };
}

async function buildCompanyWhereFromSelection({ req, selection }) {
  const { user } = req;
  const { all, ids, exclude, filters, search_query } = selection;

  const visibility = getVisibilityFilters(user);

  const invalidId = [...ids, ...exclude].find(
    (id) => !validator.isUUID(String(id || ''))
  );
  if (invalidId) {
    const error = createErrorWithTrace(
      ERROR_TYPES.VALIDATION,
      'Invalid UUID provided in ids/exclude.',
      req,
      {
        severity: ERROR_SEVERITY.LOW,
        context: 'bulk_opportunity_selection',
        details: { invalidId },
      }
    );
    throw error;
  }

  const { where: baseWhere } = await getListFiltersAndQueries({
    user,
    search: search_query,
    filters,
    schema: companyUpdate,
    filterFields: [
      'name',
      'website',
      'city',
      'state',
      'zip',
      'industry',
      'color',
      'description',
      'companyIntelligence',
      'keywords',
      'phone',
      'address1',
      'address2',
      'ownerId',
      'countryId',
    ],
    searchFields: [
      'name',
      'description',
      'phone',
      'website',
      'notes',
      'keywords',
      '_tags',
    ],
  });

  const where = {
    ...visibility,
    ...(baseWhere || {}),
  };

  if (all) {
    if (exclude?.length) where.id = { notIn: exclude };
  } else {
    if (!ids?.length) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'No Companies selected! Provide ids or set all=true with optional filters.',
        req,
        { severity: ERROR_SEVERITY.LOW, context: 'bulk_opportunity_selection' }
      );
      throw error;
    }
    where.id = { in: ids };
    if (exclude?.length) where.id.notIn = exclude;
  }

  return where;
}

function normalizePipelinePayload(raw) {
  const pipelineId = raw?.pipelineId || raw?.pipeline || raw?.id;
  return { pipelineId };
}

async function getPreview(req, res) {
  const { user, body, query } = req;
  logOperationStart('getPreviewCreateBulkOpportunities', req, {
    user: user?.id,
  });
  try {
    const selection = normalizeSelectionInputs(body || {}, query || {});
    const { pipelineId } = normalizePipelinePayload(selection.pipeline);

    if (!pipelineId || !validator.isUUID(String(pipelineId))) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Invalid or missing pipelineId. Expected a UUID.',
        req,
        { severity: ERROR_SEVERITY.LOW, context: 'bulk_opportunity_preview' }
      );
      throw error;
    }

    await verifyForeignKeyAccessBatch({
      user,
      validations: [{ model: 'pipeline', fieldValues: { pipelineId } }],
    });

    const where = await buildCompanyWhereFromSelection({ req, selection });

    logDatabaseStart('bulk_opportunity_preview_select_companies', req, {
      ..._.pick(selection, ['all']),
      pipelineId,
    });
    const companies = await prisma.company.findMany({
      where,
      select: { id: true, name: true },
    });
    logDatabaseSuccess('bulk_opportunity_preview_select_companies', req, {
      count: companies.length,
    });

    if (!companies.length) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'No Companies selected! Adjust ids/filters/search_query.',
        req,
        { severity: ERROR_SEVERITY.LOW, context: 'bulk_opportunity_preview' }
      );
      throw error;
    }

    // Fetch first stage in pipeline (strict tenant scope per guidelines)
    logDatabaseStart('bulk_opportunity_preview_first_stage', req, {
      pipelineId,
    });
    const firstStage = await prisma.pipelineStage.findFirst({
      where: { pipelineId, client: user?.client?.id, deleted: null },
      orderBy: { order: 'asc' },
      select: { id: true },
    });
    logDatabaseSuccess('bulk_opportunity_preview_first_stage', req, {
      found: !!firstStage,
    });
    if (!firstStage) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Pipeline has no stages.',
        req,
        { severity: ERROR_SEVERITY.LOW, context: 'bulk_opportunity_preview' }
      );
      throw error;
    }

    // Controller-level uniqueness: duplicate if an opportunity with same companyId and pipelineId exists (soft-delete aware)
    logDatabaseStart('bulk_opportunity_preview_find_duplicates', req, {
      count: companies.length,
    });
    const duplicates = await prisma.opportunity.findMany({
      where: {
        client: user?.client?.id,
        deleted: null,
        pipelineId,
        companyId: { in: companies.map((c) => c.id) },
      },
      select: { companyId: true, id: true, name: true },
    });
    logDatabaseSuccess('bulk_opportunity_preview_find_duplicates', req, {
      duplicates: duplicates.length,
    });

    const duplicateCompanyIds = new Set(duplicates.map((d) => d.companyId));
    const createTargets = companies.filter(
      (c) => !duplicateCompanyIds.has(c.id)
    );

    // Build display map for companies
    const companyIdToDisplay = new Map(
      companies.map((c) => [c.id, computeDisplayValue(c, 'Company')])
    );

    logOperationSuccess('getPreviewCreateBulkOpportunities', req, {
      selectedCount: companies.length,
      createCount: createTargets.length,
      duplicateCount: duplicates.length,
    });

    res.status(200).json({
      selectedCount: companies.length,
      createCount: createTargets.length,
      duplicateCount: duplicates.length,
      duplicates: duplicates.map((d) => ({
        companyId: d.companyId,
        opportunityId: d.id,
        name: d.name,
        [DISPLAY_VALUE_PROP]: companyIdToDisplay.get(d.companyId),
      })),
    });
  } catch (error) {
    logOperationError('getPreviewCreateBulkOpportunities', req, error);
    if (error.type && Object.values(ERROR_TYPES).includes(error.type))
      throw error;
    throw handleDatabaseError(error, 'preview_create_bulk_opportunities');
  }
}

async function applyCreate(req, res) {
  const { user, body } = req;
  logOperationStart('applyCreateBulkOpportunities', req, { user: user?.id });
  try {
    const selection = normalizeSelectionInputs(body || {});
    const { pipelineId } = normalizePipelinePayload(selection.pipeline);

    if (!pipelineId || !validator.isUUID(String(pipelineId))) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Invalid or missing pipelineId. Expected a UUID.',
        req,
        { severity: ERROR_SEVERITY.LOW, context: 'bulk_opportunity_create' }
      );
      throw error;
    }

    await verifyForeignKeyAccessBatch({
      user,
      validations: [{ model: 'pipeline', fieldValues: { pipelineId } }],
    });

    // Get first stage (strict tenant scope per guidelines)
    const firstStage = await prisma.pipelineStage.findFirst({
      where: { pipelineId, client: user?.client?.id, deleted: null },
      orderBy: { order: 'asc' },
      select: { id: true },
    });
    if (!firstStage) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Pipeline has no stages.',
        req,
        { severity: ERROR_SEVERITY.LOW, context: 'bulk_opportunity_create' }
      );
      throw error;
    }

    const where = await buildCompanyWhereFromSelection({ req, selection });
    logDatabaseStart('bulk_opportunity_create_select_companies', req, {});
    const companies = await prisma.company.findMany({
      where,
      select: { id: true, name: true },
    });
    logDatabaseSuccess('bulk_opportunity_create_select_companies', req, {
      count: companies.length,
    });

    if (!companies.length) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'No Companies selected! Adjust ids/filters/search_query.',
        req,
        { severity: ERROR_SEVERITY.LOW, context: 'bulk_opportunity_create' }
      );
      throw error;
    }

    // Controller-level uniqueness: existing opportunities for same (pipelineId, companyId)
    const duplicates = await prisma.opportunity.findMany({
      where: {
        client: user?.client?.id,
        deleted: null,
        pipelineId,
        companyId: { in: companies.map((c) => c.id) },
      },
      select: { companyId: true },
    });
    const duplicateCompanyIds = new Set(duplicates.map((d) => d.companyId));
    const targets = companies.filter((c) => !duplicateCompanyIds.has(c.id));

    if (!targets.length) {
      res.status(200).json({ createdCount: 0, skippedCount: companies.length });
      return;
    }

    const now = new Date().toISOString();
    const data = targets.map((c) => ({
      companyId: c.id,
      pipelineId,
      statusId: firstStage.id,
      name: c.name,
      probability: 0,
      ownerId: user?.id,
      createdBy: user?.id,
      updatedBy: user?.id,
      client: user?.client?.id,
      statusAssignedDate: now,
    }));

    logDatabaseStart('bulk_opportunity_createMany', req, {
      count: data.length,
    });
    const result = await prisma.opportunity.createMany({ data });
    logDatabaseSuccess('bulk_opportunity_createMany', req, {
      createdCount: result.count,
    });

    logOperationSuccess('applyCreateBulkOpportunities', req, {
      createdCount: result.count,
    });
    res.status(200).json({ createdCount: result.count });

    // No workflow triggers for this bulk route (parity with Django)
  } catch (error) {
    logOperationError('applyCreateBulkOpportunities', req, error);
    if (error.type && Object.values(ERROR_TYPES).includes(error.type))
      throw error;
    throw handleDatabaseError(error, 'apply_create_bulk_opportunities');
  }
}

async function revertBulk(req, res) {
  const { user, body } = req;
  logOperationStart('revertBulkOpportunities', req, { user: user?.id });
  try {
    const selection = normalizeSelectionInputs(body || {});
    const { pipelineId } = normalizePipelinePayload(selection.pipeline);

    if (!pipelineId || !validator.isUUID(String(pipelineId))) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Invalid or missing pipelineId. Expected a UUID.',
        req,
        { severity: ERROR_SEVERITY.LOW, context: 'bulk_opportunity_delete' }
      );
      throw error;
    }

    await verifyForeignKeyAccessBatch({
      user,
      validations: [{ model: 'pipeline', fieldValues: { pipelineId } }],
    });

    const whereCompanies = await buildCompanyWhereFromSelection({
      req,
      selection,
    });
    const companies = await prisma.company.findMany({
      where: whereCompanies,
      select: { id: true },
    });

    if (!companies.length) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'No Companies selected! Adjust ids/filters/search_query.',
        req,
        { severity: ERROR_SEVERITY.LOW, context: 'bulk_opportunity_delete' }
      );
      throw error;
    }

    const result = await prisma.opportunity.updateMany({
      where: {
        client: user?.client?.id,
        deleted: null,
        pipelineId,
        companyId: { in: companies.map((c) => c.id) },
      },
      data: { deleted: new Date().toISOString(), updatedBy: user?.id },
    });

    logOperationSuccess('revertBulkOpportunities', req, {
      deletedCount: result.count,
    });
    res.status(200).json({ deletedCount: result.count });
  } catch (error) {
    logOperationError('revertBulkOpportunities', req, error);
    if (error.type && Object.values(ERROR_TYPES).includes(error.type))
      throw error;
    throw handleDatabaseError(error, 'delete_bulk_opportunities');
  }
}

module.exports = {
  getPreview,
  applyCreate,
  revertBulk,
};
