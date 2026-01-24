const prisma = require('#configs/prisma.js');
const { bulkDetailBase } = require('#core/schemas/getBulkDetail.schemas.js');
const { getVisibilityFilters } = require('#utils/visibilityUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  enrichRecordDisplayValues,
} = require('#utils/displayValueUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/traceUtils.js');

async function getBulkDetail(req, res) {
  const { user, body } = req;

  logOperationStart('getBulkDetail', req, {
    user: user.id,
    bodyKeys: Object.keys(body),
  });

  try {
    const { data } = await bulkDetailBase.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });

    const filters = getVisibilityFilters(user);

    logDatabaseStart('get_bulk_details', req, {
      requestCount: data.length,
      models: data.map((item) => item.model),
    });

    const prismaQueries = data.map((child) => {
      const { ids, model } = child;

      return prisma[model].findMany({
        where: {
          AND: [filters, { id: { in: ids } }],
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

    logDatabaseSuccess('get_bulk_details', req, {
      requestCount: data.length,
      totalRecords,
      models: data.map((item) => item.model),
    });

    logOperationSuccess('getBulkDetail', req, {
      requestCount: data.length,
      totalRecords,
    });

    res.status(200).json(records);
  } catch (error) {
    logOperationError('getBulkDetail', req, error);

    if (error.isJoi) {
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Bulk details request validation failed',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_details_validation',
          details: { validationErrors: error.details },
        }
      );
    }
    throw error;
  }
}

module.exports = { getBulkDetail };
