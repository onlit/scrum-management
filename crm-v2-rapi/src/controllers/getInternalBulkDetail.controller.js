const prisma = require('#configs/prisma.js');
const { bulkDetailBase } = require('#schemas/getBulkDetail.schemas.js');
const { getVisibilityFilters } = require('#utils/shared/visibilityUtils.js');
const {
  ERROR_TYPES,
  ERROR_SEVERITY,
  DISPLAY_VALUE_PROP,
} = require('#configs/constants.js');
const {
  enrichRecordDisplayValues,
} = require('#utils/shared/displayValueUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/shared/traceUtils.js');

function isInternalRequest(req) {
  // Internal requests are tagged by internalRequestHandler via req.skipCors
  // and generally have no Origin header
  return Boolean(req.skipCors) && !req.headers.origin;
}

async function getInternalBulkDetail(req, res) {
  const { user, body, query } = req;

  logOperationStart('getInternalBulkDetail', req, {
    user: user?.id,
    method: req.method,
  });

  try {
    // Support GET by accepting a JSON payload via `payload` query param
    let payload;
    if (req.method === 'GET') {
      payload = query?.payload ? JSON.parse(query.payload) : {};
    } else {
      payload = body;
    }

    const { data } = await bulkDetailBase.validateAsync(payload || {}, {
      abortEarly: false,
      stripUnknown: true,
    });

    const internal = isInternalRequest(req);

    logDatabaseStart('get_internal_bulk_details', req, {
      requestCount: data.length,
      models: data.map((item) => item.model),
      internal,
    });

    const prismaQueries = data.map((child) => {
      const { ids, model } = child;

      // For internal requests, replicate Django parity: for Person only, bypass visibility filters
      const whereFilters =
        internal && String(model).toLowerCase() === 'person'
          ? {}
          : getVisibilityFilters(user);

      return prisma[model].findMany({
        where: {
          AND: [whereFilters, { id: { in: ids } }],
        },
      });
    });

    const responses = await prisma.$transaction(prismaQueries);

    const records = data.map((child, index) => {
      const details = responses[index].reduce((acc, item) => {
        // If record is soft-deleted, return redacted version
        if (item.deleted) {
          acc[item.id] = {
            id: item.id,
            deleted: item.deleted,
            __displayValue: '[Record Deleted]',
          };
          return acc;
        }
        const enriched = enrichRecordDisplayValues(item, child?.model);
        acc[item.id] = enriched;
        return acc;
      }, {});

      return {
        ...child,
        details,
      };
    });

    const totalRecords = records.reduce(
      (sum, record) => sum + Object.keys(record.details).length,
      0
    );

    logDatabaseSuccess('get_internal_bulk_details', req, {
      requestCount: data.length,
      totalRecords,
      models: data.map((item) => item.model),
      internal,
    });

    logOperationSuccess('getInternalBulkDetail', req, {
      requestCount: data.length,
      totalRecords,
      internal,
    });

    res.status(200).json(records);
  } catch (error) {
    logOperationError('getInternalBulkDetail', req, error);

    if (error?.isJoi) {
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Bulk details request validation failed',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'internal_bulk_details_validation',
          details: { validationErrors: error.details },
        }
      );
    }
    throw error;
  }
}

function methodNotAllowed(req, res) {
  // Strict parity: This endpoint is read-only; update/delete are not applicable
  res.status(405).json({
    title: 'Method Not Allowed',
    message:
      'This endpoint only supports GET and POST for fetching bulk details.',
    allowed: ['GET', 'POST', 'PUT', 'PATCH'].filter(Boolean),
  });
}

module.exports = { getInternalBulkDetail, methodNotAllowed };
