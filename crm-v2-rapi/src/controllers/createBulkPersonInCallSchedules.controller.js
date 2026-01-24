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

// Django parity: input is an array of concrete schedules (no selection pattern)
// Body: { call_schedules: [ { personId, callListId, callListPipelineStageId?, scheduleDatetime, color? } ] }
function normalizeBulkArray(body = {}) {
  const arr = Array.isArray(body?.call_schedules) ? body.call_schedules : [];
  return arr.map((item) => ({
    personId: item?.personId || item?.person || item?.person_id,
    callListId: item?.callListId || item?.call_list || item?.call_list_id,
    callListPipelineStageId:
      item?.callListPipelineStageId ||
      item?.call_list_pipeline_stage ||
      item?.call_list_pipeline_stage_id,
    scheduleDatetime: item?.scheduleDatetime || item?.schedule_datetime,
    color: item?.color,
  }));
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
        context: 'bulk_person_in_call_schedule_selection',
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
          context: 'bulk_person_in_call_schedule_selection',
        }
      );
      throw error;
    }
    where.id = { in: ids };
    if (exclude?.length) where.id.notIn = exclude;
  }

  return where;
}

function normalizeSchedulePayload(raw) {
  return {
    callListPipelineStageId:
      raw?.callListPipelineStageId ||
      raw?.call_list_pipeline_stage_id ||
      raw?.stageId ||
      raw?.id,
    callListId: raw?.callListId || raw?.call_list_id || null,
    scheduleDatetime: raw?.scheduleDatetime || raw?.schedule_datetime,
    color: raw?.color,
  };
}

// Django parity: no preview endpoint

async function applyCreate(req, res) {
  const { user, body } = req;
  logOperationStart('applyCreateBulkPersonInCallSchedules', req, {
    user: user?.id,
  });
  try {
    const items = normalizeBulkArray(body || {});
    if (!items.length) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'call_schedules array is required and must not be empty.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_person_in_call_schedule_create',
        }
      );
      throw error;
    }

    // Validate and collect required ids
    const personIds = [];
    const callListIds = new Set();
    const explicitStageIds = new Set();
    for (const it of items) {
      if (!it?.personId || !validator.isUUID(String(it.personId))) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'Each call schedule must include a valid personId (UUID).',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'bulk_person_in_call_schedule_create',
          }
        );
        throw error;
      }
      if (!it?.callListId || !validator.isUUID(String(it.callListId))) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'Each call schedule must include a valid callListId (UUID).',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'bulk_person_in_call_schedule_create',
          }
        );
        throw error;
      }
      if (
        !it?.scheduleDatetime ||
        !validator.isISO8601(String(it.scheduleDatetime))
      ) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'Each call schedule must include a valid scheduleDatetime (ISO8601).',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'bulk_person_in_call_schedule_create',
          }
        );
        throw error;
      }
      personIds.push(it.personId);
      callListIds.add(it.callListId);
      if (it?.callListPipelineStageId)
        explicitStageIds.add(it.callListPipelineStageId);
    }

    // FK access checks for persons, lists, and explicitly provided stages
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        ...[...callListIds].map((callListId) => ({
          model: 'callList',
          fieldValues: { callListId },
        })),
        ...[...explicitStageIds].map((callListPipelineStageId) => ({
          model: 'callListPipelineStage',
          fieldValues: { callListPipelineStageId },
        })),
        // Persons are visibility checked via selection; we verify existence/visibility in batch
        ...personIds.map((personId) => ({
          model: 'person',
          fieldValues: { personId },
        })),
      ],
    });

    // Stage defaulting: for any item without stage, fetch first stage for its call list's pipeline (order asc)
    const callLists = await prisma.callList.findMany({
      where: {
        id: { in: [...callListIds] },
        client: user?.client?.id,
        deleted: null,
      },
      select: { id: true, callListPipelineId: true },
    });
    const callListIdToPipelineId = new Map(
      callLists.map((c) => [c.id, c.callListPipelineId])
    );
    const neededPipelineIds = [
      ...new Set(
        items
          .filter((i) => !i.callListPipelineStageId)
          .map((i) => callListIdToPipelineId.get(i.callListId))
          .filter(Boolean)
      ),
    ];
    const firstStages = await prisma.callListPipelineStage.findMany({
      where: {
        callListPipelineId: { in: neededPipelineIds },
        client: user?.client?.id,
        deleted: null,
      },
      orderBy: { order: 'asc' },
      select: { id: true, callListPipelineId: true },
    });
    const pipelineIdToFirstStageId = new Map();
    for (const s of firstStages)
      if (!pipelineIdToFirstStageId.has(s.callListPipelineId))
        pipelineIdToFirstStageId.set(s.callListPipelineId, s.id);

    const data = items.map((it) => ({
      personId: it.personId,
      callListId: it.callListId,
      callListPipelineStageId:
        it.callListPipelineStageId ||
        pipelineIdToFirstStageId.get(callListIdToPipelineId.get(it.callListId)),
      scheduleDatetime: new Date(it.scheduleDatetime),
      color: it?.color || null,
      client: user?.client?.id,
      createdBy: user?.id,
      updatedBy: user?.id,
    }));

    // Ensure all defaulted stages resolved
    if (data.some((d) => !d.callListPipelineStageId)) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Could not resolve default stage for one or more call lists (pipeline has no stages).',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_person_in_call_schedule_create',
        }
      );
      throw error;
    }

    // No duplicate pre-checks (match Django): perform createMany directly
    logDatabaseStart('bulk_person_in_call_schedule_createMany', req, {
      count: data.length,
    });
    const result = await prisma.callSchedule.createMany({ data });
    logDatabaseSuccess('bulk_person_in_call_schedule_createMany', req, {
      createdCount: result.count,
    });

    logOperationSuccess('applyCreateBulkPersonInCallSchedules', req, {
      createdCount: result.count,
    });
    res.status(200).json({ createdCount: result.count });
  } catch (error) {
    logOperationError('applyCreateBulkPersonInCallSchedules', req, error);
    if (error.type && Object.values(ERROR_TYPES).includes(error.type))
      throw error;
    throw handleDatabaseError(
      error,
      'apply_create_bulk_person_in_call_schedules'
    );
  }
}

// Django parity: no DELETE bulk endpoint

module.exports = {
  applyCreate,
};
