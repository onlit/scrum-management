/**
 * CREATED BY: Pullstream Assistant
 *
 * DESCRIPTION:
 * ------------------
 * Bulk create/update/delete handler for assigning many Companies to a Territory
 * in one operation, migrated from Django route `/create-bulk-company-in-territories/`.
 *
 * Endpoints (mounted at `/api/v1/create-bulk-company-in-territories`):
 * - GET: Preview counts and duplicates for the provided selection criteria
 * - POST: Create CompanyInTerritory for selected Companies (skips duplicates)
 * - PUT/PATCH: Same behavior as POST (idempotent apply)
 * - DELETE: Soft-delete active CompanyInTerritory matching selection criteria
 */

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
const {
  handleDatabaseError,
  handleValidationError,
} = require('#utils/shared/errorHandlingUtils.js');
const { findWorkflowAndTrigger } = require('#utils/shared/automataUtils.js');
const { companyUpdate } = require('#schemas/company.schemas.js');
const { computeDisplayValue } = require('#utils/shared/displayValueUtils.js');

// Shared: build company selection from request inputs
function normalizeSelectionInputs(body = {}) {
  return {
    all: Boolean(body?.all),
    ids: Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [],
    exclude: Array.isArray(body?.exclude) ? body.exclude.filter(Boolean) : [],
    filters: _.isPlainObject(body?.filters) ? body.filters : {},
    search_query: _.isString(body?.search_query) ? body.search_query : '',
    territory: _.isPlainObject(body?.territory)
      ? body.territory
      : body?.territory || {},
  };
}

async function buildCompanyWhereFromSelection({ req, selection }) {
  const { user } = req;
  const { all, ids, exclude, filters, search_query } = selection;

  // Base where: tenant and non-deleted via client visibility filters
  const visibility = getVisibilityFilters(user);

  // Validate ids/exclude are UUIDs if provided
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
        context: 'bulk_company_in_territory_selection',
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
      'staffUrl',
      'email',
      'website',
      'notes',
      'city',
      'state',
      'zip',
      'industry',
      'name',
      'color',
      'description',
      'companyIntelligence',
      'keywords',
      'contactUrl',
      'phone',
      'fax',
      'address1',
      'address2',
      'newsUrl',
      'size',
      'branchOfId',
      'betaPartners',
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
      'owner',
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
        'No companies selected. Provide ids or set all=true with optional filters.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_company_in_territory_selection',
        }
      );
      throw error;
    }
    where.id = { in: ids };
    if (exclude?.length) where.id.notIn = exclude;
  }

  return where;
}

function normalizeTerritoryPayload(raw) {
  // Expect territory object with at least territoryId, expiryDate?, color?
  const territoryId = raw?.territoryId || raw?.territory || raw?.id;
  const payload = {
    territoryId,
    color: _.isString(raw?.color) ? _.trim(raw.color) : undefined,
    expiryDate: raw?.expiryDate ? new Date(raw.expiryDate) : undefined,
  };
  return payload;
}

async function getPreview(req, res) {
  const { user, body } = req;
  logOperationStart('getPreviewCreateBulkCompanyInTerritories', req, {
    user: user?.id,
  });
  try {
    const selection = normalizeSelectionInputs(body || {});
    const territoryPayload = normalizeTerritoryPayload(selection.territory);

    // Validate territoryId
    if (
      !territoryPayload?.territoryId ||
      !validator.isUUID(String(territoryPayload.territoryId))
    ) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Invalid or missing territoryId. Expected a UUID.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_company_in_territory_preview',
        }
      );
      throw error;
    }

    // FK validation for territory
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        {
          model: 'territory',
          fieldValues: { territoryId: territoryPayload.territoryId },
        },
      ],
    });

    const where = await buildCompanyWhereFromSelection({ req, selection });

    logDatabaseStart(
      'bulk_company_in_territory_preview_select_companies',
      req,
      {
        ..._.pick(selection, ['all']),
        territoryId: territoryPayload.territoryId,
      }
    );
    const companies = await prisma.company.findMany({
      where,
      select: { id: true, name: true },
    });
    logDatabaseSuccess(
      'bulk_company_in_territory_preview_select_companies',
      req,
      { count: companies.length }
    );

    if (!companies.length) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'No Companies selected! Adjust ids/filters/search_query.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_company_in_territory_preview',
        }
      );
      throw error;
    }

    const today = new Date();
    // Find duplicates: assignments with expiryDate >= now (Django parity)
    logDatabaseStart('bulk_company_in_territory_preview_find_duplicates', req, {
      count: companies.length,
    });
    const duplicates = await prisma.companyInTerritory.findMany({
      where: {
        client: user?.client?.id,
        deleted: null,
        territoryId: territoryPayload.territoryId,
        companyId: { in: companies.map((c) => c.id) },
        expiryDate: { gte: today },
      },
      select: { id: true, companyId: true },
    });
    logDatabaseSuccess(
      'bulk_company_in_territory_preview_find_duplicates',
      req,
      { duplicates: duplicates.length }
    );

    const duplicateCompanyIds = new Set(duplicates.map((d) => d.companyId));
    const createTargets = companies.filter(
      (c) => !duplicateCompanyIds.has(c.id)
    );

    // Build display map for companies
    const companyIdToDisplay = new Map(
      companies.map((c) => [c.id, computeDisplayValue(c, 'Company')])
    );

    logOperationSuccess('getPreviewCreateBulkCompanyInTerritories', req, {
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
        [DISPLAY_VALUE_PROP]: companyIdToDisplay.get(d.companyId),
      })),
    });
  } catch (error) {
    logOperationError('getPreviewCreateBulkCompanyInTerritories', req, error);
    if (error.type && Object.values(ERROR_TYPES).includes(error.type))
      throw error;
    throw handleDatabaseError(
      error,
      'preview_create_bulk_company_in_territories'
    );
  }
}

async function applyCreate(req, res) {
  const { user, body } = req;
  logOperationStart('applyCreateBulkCompanyInTerritories', req, {
    user: user?.id,
  });
  try {
    const selection = normalizeSelectionInputs(body || {});
    const territoryPayload = normalizeTerritoryPayload(selection.territory);

    if (
      !territoryPayload?.territoryId ||
      !validator.isUUID(String(territoryPayload.territoryId))
    ) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Invalid or missing territoryId. Expected a UUID.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_company_in_territory_create',
        }
      );
      throw error;
    }

    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        {
          model: 'territory',
          fieldValues: { territoryId: territoryPayload.territoryId },
        },
      ],
    });

    const where = await buildCompanyWhereFromSelection({ req, selection });
    logDatabaseStart(
      'bulk_company_in_territory_create_select_companies',
      req,
      {}
    );
    const companies = await prisma.company.findMany({
      where,
      select: { id: true, name: true },
    });
    logDatabaseSuccess(
      'bulk_company_in_territory_create_select_companies',
      req,
      { count: companies.length }
    );

    if (!companies.length) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'No Companies selected! Adjust ids/filters/search_query.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_company_in_territory_create',
        }
      );
      throw error;
    }

    const today = new Date();
    // Fetch duplicates first (Django parity: any duplicate aborts whole operation)
    const duplicates = await prisma.companyInTerritory.findMany({
      where: {
        client: user?.client?.id,
        deleted: null,
        territoryId: territoryPayload.territoryId,
        companyId: { in: companies.map((c) => c.id) },
        expiryDate: { gte: today },
      },
      select: { companyId: true },
    });
    const duplicateCompanyIds = new Set(duplicates.map((d) => d.companyId));
    if (duplicateCompanyIds.size > 0) {
      const dupCompanies = companies
        .filter((c) => duplicateCompanyIds.has(c.id))
        .map((c) => ({ id: c.id, name: c.name }));
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Company territory must be unique!',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_company_in_territory_create',
          details: {
            error_code: 'duplicate_territory',
            companies: dupCompanies,
          },
        }
      );
      throw error;
    }

    const targets = companies; // no duplicates, create all

    // Create in batches (createMany) for performance
    const data = targets.map((t) => ({
      companyId: t.id,
      territoryId: territoryPayload.territoryId,
      color: territoryPayload?.color ?? null,
      expiryDate: territoryPayload?.expiryDate ?? null,
      client: user?.client?.id,
      createdBy: user?.id,
      updatedBy: user?.id,
    }));

    logDatabaseStart('bulk_company_in_territory_createMany', req, {
      count: data.length,
    });
    const result = await prisma.companyInTerritory.createMany({ data });
    logDatabaseSuccess('bulk_company_in_territory_createMany', req, {
      createdCount: result.count,
    });

    // Fire-and-forget workflows for created records
    (async () => {
      try {
        const created = await prisma.companyInTerritory.findMany({
          where: {
            client: user?.client?.id,
            deleted: null,
            territoryId: territoryPayload.territoryId,
            companyId: { in: targets.map((t) => t.id) },
          },
          select: { id: true },
        });
        await Promise.allSettled(
          created.map((row) =>
            findWorkflowAndTrigger(
              prisma,
              row,
              'companyInTerritory',
              user?.client?.id,
              {},
              user?.accessToken
            )
          )
        );
      } catch (_e) {
        // swallow
      }
    })();

    logOperationSuccess('applyCreateBulkCompanyInTerritories', req, {
      createdCount: result.count,
    });
    res.status(200).json({ createdCount: result.count });
  } catch (error) {
    logOperationError('applyCreateBulkCompanyInTerritories', req, error);
    if (error.type && Object.values(ERROR_TYPES).includes(error.type))
      throw error;
    throw handleDatabaseError(
      error,
      'apply_create_bulk_company_in_territories'
    );
  }
}

async function revertBulk(req, res) {
  const { user, body } = req;
  logOperationStart('revertBulkCompanyInTerritories', req, { user: user?.id });
  try {
    const selection = normalizeSelectionInputs(body || {});
    const territoryPayload = normalizeTerritoryPayload(selection.territory);

    if (
      !territoryPayload?.territoryId ||
      !validator.isUUID(String(territoryPayload.territoryId))
    ) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Invalid or missing territoryId. Expected a UUID.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_company_in_territory_delete',
        }
      );
      throw error;
    }

    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        {
          model: 'territory',
          fieldValues: { territoryId: territoryPayload.territoryId },
        },
      ],
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
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_company_in_territory_delete',
        }
      );
      throw error;
    }

    const result = await prisma.companyInTerritory.updateMany({
      where: {
        client: user?.client?.id,
        deleted: null,
        territoryId: territoryPayload.territoryId,
        companyId: { in: companies.map((c) => c.id) },
      },
      data: { deleted: new Date().toISOString(), updatedBy: user?.id },
    });

    logOperationSuccess('revertBulkCompanyInTerritories', req, {
      deletedCount: result.count,
    });
    res.status(200).json({ deletedCount: result.count });
  } catch (error) {
    logOperationError('revertBulkCompanyInTerritories', req, error);
    if (error.type && Object.values(ERROR_TYPES).includes(error.type))
      throw error;
    throw handleDatabaseError(error, 'delete_bulk_company_in_territories');
  }
}

module.exports = {
  getPreview,
  applyCreate,
  revertBulk,
};
