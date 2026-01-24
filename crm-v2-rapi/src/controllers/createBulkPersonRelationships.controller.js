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

function normalizeSelectionInputs(body = {}, query = {}) {
  // Support both body (POST/PUT/PATCH/DELETE) and query (GET) based inputs
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
    relationship: _.isPlainObject(src?.relationship)
      ? src.relationship
      : src?.relationship || {},
    relationshipNotes: _.isString(src?.relationshipNotes)
      ? _.trim(src.relationshipNotes)
      : src?.relationship_notes || '',
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
        context: 'bulk_person_relationship_selection',
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
        'No Persons selected! Provide ids or set all=true with optional filters.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_person_relationship_selection',
        }
      );
      throw error;
    }
    where.id = { in: ids };
    if (exclude?.length) where.id.notIn = exclude;
  }

  return where;
}

function normalizeRelationshipPayload(raw) {
  const relationshipId = raw?.relationshipId || raw?.relationship || raw?.id;
  return {
    relationshipId,
  };
}

async function getPreview(req, res) {
  const { user, body, query } = req;
  logOperationStart('getPreviewCreateBulkPersonRelationships', req, {
    user: user?.id,
  });
  try {
    const selection = normalizeSelectionInputs(body || {}, query || {});
    const { relationshipId } = normalizeRelationshipPayload(
      selection.relationship
    );

    if (!relationshipId || !validator.isUUID(String(relationshipId))) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Invalid or missing relationshipId. Expected a UUID.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_person_relationship_preview',
        }
      );
      throw error;
    }

    await verifyForeignKeyAccessBatch({
      user,
      validations: [{ model: 'relationship', fieldValues: { relationshipId } }],
    });

    const where = await buildPersonWhereFromSelection({ req, selection });

    logDatabaseStart('bulk_person_relationship_preview_select_persons', req, {
      relationshipId,
    });
    const persons = await prisma.person.findMany({
      where,
      select: { id: true, firstName: true, email: true },
    });
    logDatabaseSuccess('bulk_person_relationship_preview_select_persons', req, {
      count: persons.length,
    });

    if (!persons.length) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'No Persons selected! Adjust ids/filters/search_query.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_person_relationship_preview',
        }
      );
      throw error;
    }

    // Duplicates: already has that relationship (soft-delete aware)
    logDatabaseStart('bulk_person_relationship_preview_find_duplicates', req, {
      count: persons.length,
    });
    const duplicates = await prisma.personRelationship.findMany({
      where: {
        client: user?.client?.id,
        deleted: null,
        relationshipId,
        personId: { in: persons.map((p) => p.id) },
      },
      select: { id: true, personId: true },
    });
    logDatabaseSuccess(
      'bulk_person_relationship_preview_find_duplicates',
      req,
      { duplicates: duplicates.length }
    );

    const duplicatePersonIds = new Set(duplicates.map((d) => d.personId));
    const createTargets = persons.filter((p) => !duplicatePersonIds.has(p.id));

    logOperationSuccess('getPreviewCreateBulkPersonRelationships', req, {
      selectedCount: persons.length,
      createCount: createTargets.length,
      duplicateCount: duplicates.length,
    });

    res.status(200).json({
      selectedCount: persons.length,
      createCount: createTargets.length,
      duplicateCount: duplicates.length,
      duplicates: duplicates.map((d) => ({ personId: d.personId })),
    });
  } catch (error) {
    logOperationError('getPreviewCreateBulkPersonRelationships', req, error);
    if (error.type && Object.values(ERROR_TYPES).includes(error.type))
      throw error;
    throw handleDatabaseError(
      error,
      'preview_create_bulk_person_relationships'
    );
  }
}

async function applyCreate(req, res) {
  const { user, body } = req;
  logOperationStart('applyCreateBulkPersonRelationships', req, {
    user: user?.id,
  });
  try {
    const selection = normalizeSelectionInputs(body || {});
    const { relationshipId } = normalizeRelationshipPayload(
      selection.relationship
    );
    const relationshipNotes = selection.relationshipNotes || '';

    if (!relationshipId || !validator.isUUID(String(relationshipId))) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Invalid or missing relationshipId. Expected a UUID.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_person_relationship_create',
        }
      );
      throw error;
    }

    await verifyForeignKeyAccessBatch({
      user,
      validations: [{ model: 'relationship', fieldValues: { relationshipId } }],
    });

    const where = await buildPersonWhereFromSelection({ req, selection });
    logDatabaseStart('bulk_person_relationship_create_select_persons', req, {});
    const persons = await prisma.person.findMany({
      where,
      select: { id: true },
    });
    logDatabaseSuccess('bulk_person_relationship_create_select_persons', req, {
      count: persons.length,
    });

    if (!persons.length) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'No Persons selected! Adjust ids/filters/search_query.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_person_relationship_create',
        }
      );
      throw error;
    }

    // Fetch duplicates first (controller-level uniqueness)
    const duplicates = await prisma.personRelationship.findMany({
      where: {
        client: user?.client?.id,
        deleted: null,
        relationshipId,
        personId: { in: persons.map((p) => p.id) },
      },
      select: { personId: true },
    });
    const duplicatePersonIds = new Set(duplicates.map((d) => d.personId));
    const targets = persons.filter((p) => !duplicatePersonIds.has(p.id));

    const nowIds = targets.map((p) => p.id);
    const data = nowIds.map((personId) => ({
      personId,
      relationshipId,
      client: user?.client?.id,
      createdBy: user?.id,
      updatedBy: user?.id,
    }));

    logDatabaseStart('bulk_person_relationship_createMany', req, {
      count: data.length,
    });
    const result = await prisma.personRelationship.createMany({ data });
    logDatabaseSuccess('bulk_person_relationship_createMany', req, {
      createdCount: result.count,
    });

    // Respond
    logOperationSuccess('applyCreateBulkPersonRelationships', req, {
      createdCount: result.count,
    });
    res.status(200).json({ createdCount: result.count });

    // Fire-and-forget optional notes history AFTER response (no workflows for parity)
    (async () => {
      try {
        const created = await prisma.personRelationship.findMany({
          where: {
            client: user?.client?.id,
            deleted: null,
            relationshipId,
            personId: { in: nowIds },
          },
          select: { id: true },
        });

        if (relationshipNotes && created.length) {
          const histories = created.map((r) => ({
            personRelationshipId: r.id,
            notes: relationshipNotes,
            client: user?.client?.id,
            createdBy: user?.id,
            updatedBy: user?.id,
          }));
          await prisma.personRelationshipHistory.createMany({
            data: histories,
          });
        }
      } catch (_e) {}
    })();
  } catch (error) {
    logOperationError('applyCreateBulkPersonRelationships', req, error);
    if (error.type && Object.values(ERROR_TYPES).includes(error.type))
      throw error;
    throw handleDatabaseError(error, 'apply_create_bulk_person_relationships');
  }
}

async function revertBulk(req, res) {
  const { user, body } = req;
  logOperationStart('revertBulkPersonRelationships', req, { user: user?.id });
  try {
    const selection = normalizeSelectionInputs(body || {});
    const { relationshipId } = normalizeRelationshipPayload(
      selection.relationship
    );

    if (!relationshipId || !validator.isUUID(String(relationshipId))) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Invalid or missing relationshipId. Expected a UUID.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_person_relationship_delete',
        }
      );
      throw error;
    }

    await verifyForeignKeyAccessBatch({
      user,
      validations: [{ model: 'relationship', fieldValues: { relationshipId } }],
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
          context: 'bulk_person_relationship_delete',
        }
      );
      throw error;
    }

    const result = await prisma.personRelationship.updateMany({
      where: {
        client: user?.client?.id,
        deleted: null,
        relationshipId,
        personId: { in: persons.map((p) => p.id) },
      },
      data: { deleted: new Date().toISOString(), updatedBy: user?.id },
    });

    logOperationSuccess('revertBulkPersonRelationships', req, {
      deletedCount: result.count,
    });
    res.status(200).json({ deletedCount: result.count });
  } catch (error) {
    logOperationError('revertBulkPersonRelationships', req, error);
    if (error.type && Object.values(ERROR_TYPES).includes(error.type))
      throw error;
    throw handleDatabaseError(error, 'delete_bulk_person_relationships');
  }
}

module.exports = {
  getPreview,
  applyCreate,
  revertBulk,
};
