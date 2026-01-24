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
const { personUpdate } = require('#schemas/person.schemas.js');
const { computeDisplayValue } = require('#utils/shared/displayValueUtils.js');

function normalizeSelectionInputs(body = {}) {
  return {
    all: Boolean(body?.all),
    ids: Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [],
    exclude: Array.isArray(body?.exclude) ? body.exclude.filter(Boolean) : [],
    filters: _.isPlainObject(body?.filters) ? body.filters : {},
    search_query: _.isString(body?.search_query) ? body.search_query : '',
    marketingList: _.isPlainObject(body?.marketingList)
      ? body.marketingList
      : body?.marketingList || {},
  };
}

async function buildPersonWhereFromSelection({ req, selection }) {
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
        context: 'bulk_person_in_marketing_list_selection',
        details: { invalidId },
      }
    );
    throw error;
  }

  const { where: baseWhere } = await getListFiltersAndQueries({
    user,
    search: search_query,
    filters,
    schema: personUpdate,
    filterFields: [
      'firstName',
      'middleName',
      'lastName',
      'preferredName',
      'username',
      'email',
      'address1',
      'address2',
      'city',
      'country',
      'notes',
      'phone',
      '_tags',
      'source',
      'sourceNotes',
      'owner',
      'zip',
      'state',
      'personalMobile',
      'homePhone',
    ],
    searchFields: [
      'firstName',
      'lastName',
      'preferredName',
      'username',
      'email',
      'address1',
      'address2',
      'city',
      'country',
      'notes',
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
        'No persons selected. Provide ids or set all=true with optional filters.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_person_in_marketing_list_selection',
        }
      );
      throw error;
    }
    where.id = { in: ids };
    if (exclude?.length) where.id.notIn = exclude;
  }

  return where;
}

function normalizeMarketingListPayload(raw) {
  const marketingListId =
    raw?.marketingListId || raw?.marketing_list || raw?.id;
  const payload = {
    marketingListId,
    color: _.isString(raw?.color) ? _.trim(raw.color) : undefined,
    expiryDate: raw?.expiryDate ? new Date(raw.expiryDate) : undefined,
  };
  return payload;
}

async function getPreview(req, res) {
  const { user, body } = req;
  logOperationStart('getPreviewCreateBulkPersonInMarketingLists', req, {
    user: user?.id,
  });
  try {
    const selection = normalizeSelectionInputs(body || {});
    const mlPayload = normalizeMarketingListPayload(selection.marketingList);

    if (
      !mlPayload?.marketingListId ||
      !validator.isUUID(String(mlPayload.marketingListId))
    ) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Invalid or missing marketingListId. Expected a UUID.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_person_in_marketing_list_preview',
        }
      );
      throw error;
    }

    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        {
          model: 'marketingList',
          fieldValues: { marketingListId: mlPayload.marketingListId },
        },
      ],
    });

    const where = await buildPersonWhereFromSelection({ req, selection });

    logDatabaseStart(
      'bulk_person_in_marketing_list_preview_select_persons',
      req,
      {
        ..._.pick(selection, ['all']),
        marketingListId: mlPayload.marketingListId,
      }
    );
    const persons = await prisma.person.findMany({
      where,
      select: { id: true, firstName: true, email: true },
    });
    logDatabaseSuccess(
      'bulk_person_in_marketing_list_preview_select_persons',
      req,
      { count: persons.length }
    );

    if (!persons.length) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'No Persons selected! Adjust ids/filters/search_query.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_person_in_marketing_list_preview',
        }
      );
      throw error;
    }

    // Find duplicates: person already in marketing list (soft-delete aware)
    logDatabaseStart(
      'bulk_person_in_marketing_list_preview_find_duplicates',
      req,
      { count: persons.length }
    );
    const duplicates = await prisma.personInMarketingList.findMany({
      where: {
        client: user?.client?.id,
        deleted: null,
        marketingListId: mlPayload.marketingListId,
        personId: { in: persons.map((p) => p.id) },
      },
      select: { id: true, personId: true },
    });
    logDatabaseSuccess(
      'bulk_person_in_marketing_list_preview_find_duplicates',
      req,
      { duplicates: duplicates.length }
    );

    const duplicatePersonIds = new Set(duplicates.map((d) => d.personId));
    const createTargets = persons.filter((p) => !duplicatePersonIds.has(p.id));

    // Build display map for persons
    const personIdToDisplay = new Map(
      persons.map((p) => [p.id, computeDisplayValue(p, 'Person')])
    );

    logOperationSuccess('getPreviewCreateBulkPersonInMarketingLists', req, {
      selectedCount: persons.length,
      createCount: createTargets.length,
      duplicateCount: duplicates.length,
    });

    res.status(200).json({
      selectedCount: persons.length,
      createCount: createTargets.length,
      duplicateCount: duplicates.length,
      duplicates: duplicates.map((d) => ({
        personId: d.personId,
        [DISPLAY_VALUE_PROP]: personIdToDisplay.get(d.personId),
      })),
    });
  } catch (error) {
    logOperationError('getPreviewCreateBulkPersonInMarketingLists', req, error);
    if (error.type && Object.values(ERROR_TYPES).includes(error.type))
      throw error;
    throw handleDatabaseError(
      error,
      'preview_create_bulk_person_in_marketing_lists'
    );
  }
}

async function applyCreate(req, res) {
  const { user, body } = req;
  logOperationStart('applyCreateBulkPersonInMarketingLists', req, {
    user: user?.id,
  });
  try {
    const selection = normalizeSelectionInputs(body || {});
    const mlPayload = normalizeMarketingListPayload(selection.marketingList);

    if (
      !mlPayload?.marketingListId ||
      !validator.isUUID(String(mlPayload.marketingListId))
    ) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Invalid or missing marketingListId. Expected a UUID.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_person_in_marketing_list_create',
        }
      );
      throw error;
    }

    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        {
          model: 'marketingList',
          fieldValues: { marketingListId: mlPayload.marketingListId },
        },
      ],
    });

    const where = await buildPersonWhereFromSelection({ req, selection });
    logDatabaseStart(
      'bulk_person_in_marketing_list_create_select_persons',
      req,
      {}
    );
    const persons = await prisma.person.findMany({
      where,
      select: { id: true, firstName: true, email: true },
    });
    logDatabaseSuccess(
      'bulk_person_in_marketing_list_create_select_persons',
      req,
      { count: persons.length }
    );

    if (!persons.length) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'No Persons selected! Adjust ids/filters/search_query.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_person_in_marketing_list_create',
        }
      );
      throw error;
    }

    // Fetch duplicates first (controller-level uniqueness)
    const duplicates = await prisma.personInMarketingList.findMany({
      where: {
        client: user?.client?.id,
        deleted: null,
        marketingListId: mlPayload.marketingListId,
        personId: { in: persons.map((p) => p.id) },
      },
      select: { personId: true },
    });
    const duplicatePersonIds = new Set(duplicates.map((d) => d.personId));
    const targets = persons.filter((p) => !duplicatePersonIds.has(p.id));

    const data = targets.map((p) => ({
      personId: p.id,
      marketingListId: mlPayload.marketingListId,
      color: mlPayload?.color ?? null,
      expiryDate: mlPayload?.expiryDate ?? null,
      client: user?.client?.id,
      createdBy: user?.id,
      updatedBy: user?.id,
    }));

    logDatabaseStart('bulk_person_in_marketing_list_createMany', req, {
      count: data.length,
    });
    const result = await prisma.personInMarketingList.createMany({ data });
    logDatabaseSuccess('bulk_person_in_marketing_list_createMany', req, {
      createdCount: result.count,
    });

    // Fire-and-forget workflows for created rows
    (async () => {
      try {
        const created = await prisma.personInMarketingList.findMany({
          where: {
            client: user?.client?.id,
            deleted: null,
            marketingListId: mlPayload.marketingListId,
            personId: { in: targets.map((t) => t.id) },
          },
          select: { id: true },
        });
        // No specific workflow currently; kept for parity
      } catch (_e) {}
    })();

    logOperationSuccess('applyCreateBulkPersonInMarketingLists', req, {
      createdCount: result.count,
    });
    res.status(200).json({ createdCount: result.count });
  } catch (error) {
    logOperationError('applyCreateBulkPersonInMarketingLists', req, error);
    if (error.type && Object.values(ERROR_TYPES).includes(error.type))
      throw error;
    throw handleDatabaseError(
      error,
      'apply_create_bulk_person_in_marketing_lists'
    );
  }
}

async function revertBulk(req, res) {
  const { user, body } = req;
  logOperationStart('revertBulkPersonInMarketingLists', req, {
    user: user?.id,
  });
  try {
    const selection = normalizeSelectionInputs(body || {});
    const mlPayload = normalizeMarketingListPayload(selection.marketingList);

    if (
      !mlPayload?.marketingListId ||
      !validator.isUUID(String(mlPayload.marketingListId))
    ) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Invalid or missing marketingListId. Expected a UUID.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_person_in_marketing_list_delete',
        }
      );
      throw error;
    }

    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        {
          model: 'marketingList',
          fieldValues: { marketingListId: mlPayload.marketingListId },
        },
      ],
    });

    const wherePersons = await buildPersonWhereFromSelection({
      req,
      selection,
    });
    const persons = await prisma.person.findMany({
      where: wherePersons,
      select: { id: true },
    });

    if (!persons.length) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'No Persons selected! Adjust ids/filters/search_query.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_person_in_marketing_list_delete',
        }
      );
      throw error;
    }

    const result = await prisma.personInMarketingList.updateMany({
      where: {
        client: user?.client?.id,
        deleted: null,
        marketingListId: mlPayload.marketingListId,
        personId: { in: persons.map((p) => p.id) },
      },
      data: { deleted: new Date().toISOString(), updatedBy: user?.id },
    });

    logOperationSuccess('revertBulkPersonInMarketingLists', req, {
      deletedCount: result.count,
    });
    res.status(200).json({ deletedCount: result.count });
  } catch (error) {
    logOperationError('revertBulkPersonInMarketingLists', req, error);
    if (error.type && Object.values(ERROR_TYPES).includes(error.type))
      throw error;
    throw handleDatabaseError(error, 'delete_bulk_person_in_marketing_lists');
  }
}

module.exports = {
  getPreview,
  applyCreate,
  revertBulk,
};
