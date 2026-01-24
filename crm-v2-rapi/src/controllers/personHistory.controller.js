/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing personHistory using Prisma.
 * It includes functions for retrieving all personHistory, creating a new personHistory, retrieving a single personHistory,
 * updating an existing personHistory, and deleting a personHistory.
 *
 * The `getAllPersonHistory` function retrieves a paginated list of personHistory based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createPersonHistory` function validates the request body using a Joi schema, generates a unique code
 * for the personHistory, and creates a new personHistory in the database with additional metadata.
 *
 * The `getPersonHistory` function retrieves a single personHistory based on the provided personHistory ID, with visibility
 * filters applied to ensure the personHistory is accessible to the requesting user.
 *
 * The `updatePersonHistory` function updates an existing personHistory in the database based on the provided personHistory ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deletePersonHistory` function deletes a personHistory from the database based on the provided personHistory ID, with
 * visibility filters applied to ensure the personHistory is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  personHistoryCreate,
  personHistoryUpdate,
} = require('#schemas/personHistory.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const {
  ERROR_TYPES,
  ERROR_SEVERITY,
} = require('#configs/constants.js');
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

async function getAllPersonHistory(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllPersonHistory', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['notes', 'color', 'history'];
    const filterFields = [...searchFields, 'personId'];

    const include = {
      person: true,
    };

    // Log database operation start
    logDatabaseStart('get_all_person_history', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: personHistoryUpdate,
      filterFields,
      searchFields,
      model: 'personHistory',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values to all person history records
    if (response?.results) {
      response.results = response.results.map((record) =>
        enrichRecordDisplayValues(record, 'PersonHistory')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_person_history', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllPersonHistory', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllPersonHistory', req, error);
    throw handleDatabaseError(error, 'get_all_person_history');
  }
}

async function createPersonHistory(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createPersonHistory', req, {
    user: user?.id,
    client: user?.client,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await personHistoryCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createPersonHistory', req, error);
        throw handleValidationError(error, 'person_history_creation');
      }
      logOperationError('createPersonHistory', req, error);
      throw error;
    }

    const modelRelationFields = ['personId'];

    const include = {
      person: true,
    };

    // Validate FK access (personId) parity with other history controllers
    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     values?.personId ? { model: 'person', fieldValues: { personId: values.personId } } : null,
    //   ].filter(Boolean),
    // });

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_person_history', req, {
      name: values.name,
      userId: user?.id,
    });

    const newPersonHistory = await prisma.personHistory.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_person_history', req, {
      id: newPersonHistory.id,
      code: newPersonHistory.code,
    });

    const [newPersonHistoryWithDetails] = await getDetailsFromAPI({
      results: [newPersonHistory],
      token: user?.accessToken,
    });

    // Attach display value
    const personHistoryWithDisplayValue = enrichRecordDisplayValues(
      newPersonHistoryWithDetails,
      'PersonHistory'
    );

    // Log operation success
    logOperationSuccess('createPersonHistory', req, {
      id: newPersonHistory.id,
      code: newPersonHistory.code,
    });

    res.status(201).json(personHistoryWithDisplayValue);
  } catch (error) {
    logOperationError('createPersonHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_person_history');
  }
}

async function getPersonHistory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getPersonHistory', req, {
    user: user?.id,
    personHistoryId: params?.id,
  });

  try {
    const include = {
      person: true,
    };

    // Log database operation start
    logDatabaseStart('get_person_history', req, {
      personHistoryId: params?.id,
      userId: user?.id,
    });

    const foundPersonHistory = await prisma.personHistory.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_person_history', req, {
      found: !!foundPersonHistory,
      personHistoryId: params?.id,
    });

    if (!foundPersonHistory) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonHistory not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_person_history',
          details: { personHistoryId: params?.id },
        }
      );
      logOperationError('getPersonHistory', req, error);
      throw error;
    }

    const [foundPersonHistoryWithDetails] = await getDetailsFromAPI({
      results: [foundPersonHistory],
      token: user?.accessToken,
    });

    // Attach display value
    const personHistoryWithDisplayValue = enrichRecordDisplayValues(
      foundPersonHistoryWithDetails,
      'PersonHistory'
    );

    // Log operation success
    logOperationSuccess('getPersonHistory', req, {
      id: foundPersonHistory.id,
      code: foundPersonHistory.code,
    });

    res.status(200).json(personHistoryWithDisplayValue);
  } catch (error) {
    logOperationError('getPersonHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_person_history');
  }
}

async function updatePersonHistory(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updatePersonHistory', req, {
    personHistoryId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await personHistoryUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updatePersonHistory', req, error);
        throw handleValidationError(error, 'person_history_update');
      }
      logOperationError('updatePersonHistory', req, error);
      throw error;
    }

    // Conditionally validate FK if provided
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        body?.personId
          ? { model: 'person', fieldValues: { personId: body.personId } }
          : null,
      ].filter(Boolean),
    });

    // Guard: ensure visibility before update
    const current = await prisma.personHistory.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: { id: true },
    });
    if (!current) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonHistory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_person_history',
          details: { personHistoryId: params?.id },
        }
      );
      logOperationError('updatePersonHistory', req, error);
      throw error;
    }

    // Log database operation start
    logDatabaseStart('update_person_history', req, {
      personHistoryId: params?.id,
      updateFields: Object.keys(values),
    });

    const updatedPersonHistory = await prisma.personHistory.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    // Attach display value
    const personHistoryWithDisplayValue = enrichRecordDisplayValues(
      updatedPersonHistory,
      'PersonHistory'
    );

    // Log database operation success
    logDatabaseSuccess('update_person_history', req, {
      id: updatedPersonHistory.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updatePersonHistory', req, {
      id: updatedPersonHistory.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(personHistoryWithDisplayValue);
  } catch (error) {
    logOperationError('updatePersonHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_person_history');
  }
}

async function deletePersonHistory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deletePersonHistory', req, {
    user: user?.id,
    personHistoryId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('delete_person_history', req, {
      personHistoryId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.personHistory.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_person_history', req, {
      deletedCount: result.count,
      personHistoryId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonHistory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_person_history',
          details: { personHistoryId: params?.id },
        }
      );
      logOperationError('deletePersonHistory', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deletePersonHistory', req, {
      deletedCount: result.count,
      personHistoryId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deletePersonHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_person_history');
  }
}

async function getPersonHistoryBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for personHistory',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllPersonHistory,
  createPersonHistory,
  getPersonHistory,
  updatePersonHistory,
  deletePersonHistory,
  getPersonHistoryBarChartData,
};
