/**
 * CREATED BY: Assistant
 * CREATION DATE: 2025-01-27
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for retrieving bulk details for multiple resources.
 * The `getBulkDetail` function processes a request containing multiple model and ID combinations,
 * retrieves the corresponding records from the database with visibility filters applied,
 * and returns the results in a structured format.
 *
 * REVISION 1:
 * REVISED BY: Assistant
 * REVISION DATE: 2025-01-27
 * REVISION REASON: Implement error handling and trace ID conventions
 */

const prisma = require('#configs/prisma.js');
const { bulkDetailBase } = require('#schemas/getBulkDetail.schemas.js');
const { getVisibilityFilters } = require('#utils/shared/visibilityUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/shared/traceUtils.js');

async function getBulkDetail(req, res) {
  const { user, body } = req;

  logOperationStart('getBulkDetail', req, {
    user: user.id,
    bodyKeys: Object.keys(body),
  });

  try {
    // Validate body using the schema
    const { data } = await bulkDetailBase.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });

    // Get visibility filters based on the user
    const filters = getVisibilityFilters(user);

    logDatabaseStart('get_bulk_details', req, {
      requestCount: data.length,
      models: data.map((item) => item.model),
    });

    // Prepare all prisma queries
    const prismaQueries = data.map((child) => {
      const { ids, model } = child;

      // Prepare the query for each model and ID set
      return prisma[model].findMany({
        where: {
          AND: [filters, { id: { in: ids } }],
        },
      });
    });

    // Run all queries in a single transaction
    const responses = await prisma.$transaction(prismaQueries);

    // Map the responses to the desired output format
    const records = data.map((child, index) => {
      // Convert array response to an object for easier reference
      const details = responses[index].reduce((acc, item) => {
        acc[item.id] = item;
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
