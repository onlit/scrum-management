/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing clientHistory using Prisma.
 * It includes functions for retrieving all clientHistory, creating a new clientHistory, retrieving a single clientHistory,
 * updating an existing clientHistory, and deleting a clientHistory.
 *
 * The `getAllClientHistory` function retrieves a paginated list of clientHistory based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createClientHistory` function validates the request body using a Joi schema, generates a unique code
 * for the clientHistory, and creates a new clientHistory in the database with additional metadata.
 *
 * The `getClientHistory` function retrieves a single clientHistory based on the provided clientHistory ID, with visibility
 * filters applied to ensure the clientHistory is accessible to the requesting user.
 *
 * The `updateClientHistory` function updates an existing clientHistory in the database based on the provided clientHistory ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteClientHistory` function deletes a clientHistory from the database based on the provided clientHistory ID, with
 * visibility filters applied to ensure the clientHistory is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  clientHistoryCreate,
  clientHistoryUpdate,
} = require('#schemas/clientHistory.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const {
  getPaginatedList,
  // verifyForeignKeyAccessBatch,
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

async function getAllClientHistory(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllClientHistory', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['url', 'color'];
    const filterFields = [...searchFields, 'clientRefId'];

    const include = {
      clientRef: {
        include: {
          companyContact: {
            include: { person: true },
          },
        },
      },
    };

    // Log database operation start
    logDatabaseStart('get_all_client_history', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: clientHistoryUpdate,
      filterFields,
      searchFields,
      model: 'clientHistory',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values (including nested relations)
    if (response?.results) {
      response.results = response.results.map((record) => {
        let nextRecord = record;

        // First, enrich the nested clientRef graph (client → companyContact → person)
        if (record?.clientRef) {
          nextRecord = {
            ...nextRecord,
            clientRef: enrichRecordDisplayValues(record.clientRef, 'Client'),
          };
        }

        // Then, enrich the ClientHistory record itself
        return enrichRecordDisplayValues(nextRecord, 'ClientHistory');
      });
    }

    // Log database operation success
    logDatabaseSuccess('get_all_client_history', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllClientHistory', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllClientHistory', req, error);
    throw handleDatabaseError(error, 'get_all_client_history');
  }
}

async function createClientHistory(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createClientHistory', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await clientHistoryCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createClientHistory', req, error);
        throw handleValidationError(error, 'client_history_creation');
      }
      logOperationError('createClientHistory', req, error);
      throw error;
    }

    const modelRelationFields = ['clientRefId'];

    const include = {
      clientRef: {
        include: {
          companyContact: {
            include: { person: true },
          },
        },
      },
    };

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_client_history', req, {
      name: values.name,
      userId: user?.id,
    });

    const newClientHistory = await prisma.clientHistory.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_client_history', req, {
      id: newClientHistory.id,
      code: newClientHistory.code,
    });

    const [newClientHistoryWithDetails] = await getDetailsFromAPI({
      results: [newClientHistory],
      token: user?.accessToken,
    });

    // Attach display value (including nested relations)
    const newClientHistoryWithClientRefDisplay =
      newClientHistoryWithDetails?.clientRef
        ? {
            ...newClientHistoryWithDetails,
            clientRef: enrichRecordDisplayValues(
              newClientHistoryWithDetails.clientRef,
              'Client'
            ),
          }
        : newClientHistoryWithDetails;

    const clientHistoryWithDisplayValue = enrichRecordDisplayValues(
      newClientHistoryWithClientRefDisplay,
      'ClientHistory'
    );

    // Log operation success
    logOperationSuccess('createClientHistory', req, {
      id: newClientHistory.id,
      code: newClientHistory.code,
    });

    res.status(201).json(clientHistoryWithDisplayValue);
  } catch (error) {
    logOperationError('createClientHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_client_history');
  }
}

async function getClientHistory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getClientHistory', req, {
    user: user?.id,
    clientHistoryId: params?.id,
  });

  try {
    const include = {
      clientRef: {
        include: {
          companyContact: {
            include: { person: true },
          },
        },
      },
    };

    // Log database operation start
    logDatabaseStart('get_client_history', req, {
      clientHistoryId: params?.id,
      userId: user?.id,
    });

    const foundClientHistory = await prisma.clientHistory.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_client_history', req, {
      found: !!foundClientHistory,
      clientHistoryId: params?.id,
    });

    if (!foundClientHistory) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ClientHistory not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_client_history',
          details: { clientHistoryId: params?.id },
        }
      );
      logOperationError('getClientHistory', req, error);
      throw error;
    }

    const [foundClientHistoryWithDetails] = await getDetailsFromAPI({
      results: [foundClientHistory],
      token: user?.accessToken,
    });

    // Attach display value (including nested relations)
    const foundClientHistoryWithClientRefDisplay =
      foundClientHistoryWithDetails?.clientRef
        ? {
            ...foundClientHistoryWithDetails,
            clientRef: enrichRecordDisplayValues(
              foundClientHistoryWithDetails.clientRef,
              'Client'
            ),
          }
        : foundClientHistoryWithDetails;

    const clientHistoryWithDisplayValue = enrichRecordDisplayValues(
      foundClientHistoryWithClientRefDisplay,
      'ClientHistory'
    );

    // Log operation success
    logOperationSuccess('getClientHistory', req, {
      id: foundClientHistory.id,
      code: foundClientHistory.code,
    });

    res.status(200).json(clientHistoryWithDisplayValue);
  } catch (error) {
    logOperationError('getClientHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_client_history');
  }
}

async function updateClientHistory(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateClientHistory', req, {
    clientHistoryId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await clientHistoryUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateClientHistory', req, error);
        throw handleValidationError(error, 'client_history_update');
      }
      logOperationError('updateClientHistory', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Log database operation start
    logDatabaseStart('update_client_history', req, {
      clientHistoryId: params?.id,
      updateFields: Object.keys(values),
    });

    const include = {
      clientRef: {
        include: {
          companyContact: {
            include: { person: true },
          },
        },
      },
    };

    const updatedClientHistory = await prisma.clientHistory.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display value (including nested relations)
    const updatedClientHistoryWithClientRefDisplay =
      updatedClientHistory?.clientRef
        ? {
            ...updatedClientHistory,
            clientRef: enrichRecordDisplayValues(
              updatedClientHistory.clientRef,
              'Client'
            ),
          }
        : updatedClientHistory;

    const clientHistoryWithDisplayValue = enrichRecordDisplayValues(
      updatedClientHistoryWithClientRefDisplay,
      'ClientHistory'
    );

    // Log database operation success
    logDatabaseSuccess('update_client_history', req, {
      id: updatedClientHistory.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateClientHistory', req, {
      id: updatedClientHistory.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(clientHistoryWithDisplayValue);
  } catch (error) {
    logOperationError('updateClientHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_client_history');
  }
}

async function deleteClientHistory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteClientHistory', req, {
    user: user?.id,
    clientHistoryId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('delete_client_history', req, {
      clientHistoryId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.clientHistory.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_client_history', req, {
      deletedCount: result.count,
      clientHistoryId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ClientHistory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_client_history',
          details: { clientHistoryId: params?.id },
        }
      );
      logOperationError('deleteClientHistory', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteClientHistory', req, {
      deletedCount: result.count,
      clientHistoryId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteClientHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_client_history');
  }
}

async function getClientHistoryBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for clientHistory',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllClientHistory,
  createClientHistory,
  getClientHistory,
  updateClientHistory,
  deleteClientHistory,
  getClientHistoryBarChartData,
};
