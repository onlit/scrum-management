/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing opportunityHistory using Prisma.
 * It includes functions for retrieving all opportunityHistory, creating a new opportunityHistory, retrieving a single opportunityHistory,
 * updating an existing opportunityHistory, and deleting a opportunityHistory.
 *
 * The `getAllOpportunityHistory` function retrieves a paginated list of opportunityHistory based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createOpportunityHistory` function validates the request body using a Joi schema, generates a unique code
 * for the opportunityHistory, and creates a new opportunityHistory in the database with additional metadata.
 *
 * The `getOpportunityHistory` function retrieves a single opportunityHistory based on the provided opportunityHistory ID, with visibility
 * filters applied to ensure the opportunityHistory is accessible to the requesting user.
 *
 * The `updateOpportunityHistory` function updates an existing opportunityHistory in the database based on the provided opportunityHistory ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteOpportunityHistory` function deletes a opportunityHistory from the database based on the provided opportunityHistory ID, with
 * visibility filters applied to ensure the opportunityHistory is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  opportunityHistoryCreate,
  opportunityHistoryUpdate,
} = require('#schemas/opportunityHistory.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const {
  getPaginatedList,
  verifyForeignKeyAccessBatch,
} = require('#utils/shared/databaseUtils.js');
const { getDetailsFromAPI } = require('#utils/shared/apiUtils.js');
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
const {
  enrichRecordDisplayValues,
} = require('#utils/shared/displayValueUtils.js');
const _ = require('lodash');

async function getAllOpportunityHistory(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllOpportunityHistory', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['notes', 'url', 'color'];
    const filterFields = [...searchFields, 'opportunityId'];

    const include = {
      opportunity: true,
    };

    // Log database operation start
    logDatabaseStart('get_all_opportunity_history', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: opportunityHistoryUpdate,
      filterFields,
      searchFields,
      model: 'opportunityHistory',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values to all opportunity history records
    if (response?.results) {
      response.results = response.results.map((record) =>
        enrichRecordDisplayValues(record, 'OpportunityHistory')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_opportunity_history', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllOpportunityHistory', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllOpportunityHistory', req, error);
    throw handleDatabaseError(error, 'get_all_opportunity_history');
  }
}

async function createOpportunityHistory(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createOpportunityHistory', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await opportunityHistoryCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createOpportunityHistory', req, error);
        throw handleValidationError(error, 'opportunity_history_creation');
      }
      logOperationError('createOpportunityHistory', req, error);
      throw error;
    }

    const modelRelationFields = ['opportunityId'];

    const include = {
      opportunity: true,
    };

    // Foreign key visibility validation (soft-delete aware)
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.opportunityId
          ? {
              model: 'opportunity',
              fieldValues: { opportunityId: values.opportunityId },
            }
          : null,
      ].filter(Boolean),
    });

    // Controller-level uniqueness checks removed to align with schema-driven validation.

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_opportunity_history', req, {
      name: values.name,
      userId: user?.id,
    });

    const newOpportunityHistory = await prisma.opportunityHistory.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_opportunity_history', req, {
      id: newOpportunityHistory.id,
      code: newOpportunityHistory.code,
    });

    const [newOpportunityHistoryWithDetails] = await getDetailsFromAPI({
      results: [newOpportunityHistory],
      token: user?.accessToken,
    });

    // Attach display value (including nested relations)
    const opportunityHistoryWithDisplayValue = enrichRecordDisplayValues(
      newOpportunityHistoryWithDetails,
      'OpportunityHistory'
    );

    // Log operation success
    logOperationSuccess('createOpportunityHistory', req, {
      id: newOpportunityHistory.id,
      code: newOpportunityHistory.code,
    });

    res.status(201).json(opportunityHistoryWithDisplayValue);
  } catch (error) {
    logOperationError('createOpportunityHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_opportunity_history');
  }
}

async function getOpportunityHistory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getOpportunityHistory', req, {
    user: user?.id,
    opportunityHistoryId: params?.id,
  });

  try {
    const include = {
      opportunity: { include: { company: true } },
    };

    // Log database operation start
    logDatabaseStart('get_opportunity_history', req, {
      opportunityHistoryId: params?.id,
      userId: user?.id,
    });

    const foundOpportunityHistory = await prisma.opportunityHistory.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_opportunity_history', req, {
      found: !!foundOpportunityHistory,
      opportunityHistoryId: params?.id,
    });

    if (!foundOpportunityHistory) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityHistory not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_opportunity_history',
          details: { opportunityHistoryId: params?.id },
        }
      );
      logOperationError('getOpportunityHistory', req, error);
      throw error;
    }

    const [foundOpportunityHistoryWithDetails] = await getDetailsFromAPI({
      results: [foundOpportunityHistory],
      token: user?.accessToken,
    });

    // Attach display value (including nested relations)
    const opportunityHistoryWithDisplayValue = enrichRecordDisplayValues(
      foundOpportunityHistoryWithDetails,
      'OpportunityHistory'
    );

    // Log operation success
    logOperationSuccess('getOpportunityHistory', req, {
      id: foundOpportunityHistory.id,
      code: foundOpportunityHistory.code,
    });

    res.status(200).json(opportunityHistoryWithDisplayValue);
  } catch (error) {
    logOperationError('getOpportunityHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_opportunity_history');
  }
}

async function updateOpportunityHistory(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateOpportunityHistory', req, {
    opportunityHistoryId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await opportunityHistoryUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateOpportunityHistory', req, error);
        throw handleValidationError(error, 'opportunity_history_update');
      }
      logOperationError('updateOpportunityHistory', req, error);
      throw error;
    }

    // Fetch current record for parity logic and visibility
    const current = await prisma.opportunityHistory.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: {
        id: true,
        client: true,
        opportunityId: true,
        url: true,
        notes: true,
      },
    });
    if (!current) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityHistory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_opportunity_history',
          details: { id: params?.id },
        }
      );
      throw error;
    }

    // Foreign key visibility validation
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.opportunityId
          ? {
              model: 'opportunity',
              fieldValues: { opportunityId: values.opportunityId },
            }
          : null,
      ].filter(Boolean),
    });

    // Controller-level uniqueness checks removed to align with schema-driven validation.

    // Log database operation start
    logDatabaseStart('update_opportunity_history', req, {
      opportunityHistoryId: params?.id,
      updateFields: Object.keys(values),
    });

    const updatedOpportunityHistory = await prisma.opportunityHistory.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    // Attach display value (including nested relations)
    const opportunityHistoryWithDisplayValue = enrichRecordDisplayValues(
      updatedOpportunityHistory,
      'OpportunityHistory'
    );

    // Log database operation success
    logDatabaseSuccess('update_opportunity_history', req, {
      id: updatedOpportunityHistory.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateOpportunityHistory', req, {
      id: updatedOpportunityHistory.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(opportunityHistoryWithDisplayValue);
  } catch (error) {
    logOperationError('updateOpportunityHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_opportunity_history');
  }
}

async function deleteOpportunityHistory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteOpportunityHistory', req, {
    user: user?.id,
    opportunityHistoryId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('delete_opportunity_history', req, {
      opportunityHistoryId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.opportunityHistory.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_opportunity_history', req, {
      deletedCount: result.count,
      opportunityHistoryId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityHistory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_opportunity_history',
          details: { opportunityHistoryId: params?.id },
        }
      );
      logOperationError('deleteOpportunityHistory', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteOpportunityHistory', req, {
      deletedCount: result.count,
      opportunityHistoryId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteOpportunityHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_opportunity_history');
  }
}

async function getOpportunityHistoryBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for opportunityHistory',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllOpportunityHistory,
  createOpportunityHistory,
  getOpportunityHistory,
  updateOpportunityHistory,
  deleteOpportunityHistory,
  getOpportunityHistoryBarChartData,
};
