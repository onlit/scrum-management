/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing personRelationshipHistory using Prisma.
 * It includes functions for retrieving all personRelationshipHistory, creating a new personRelationshipHistory, retrieving a single personRelationshipHistory,
 * updating an existing personRelationshipHistory, and deleting a personRelationshipHistory.
 *
 * The `getAllPersonRelationshipHistory` function retrieves a paginated list of personRelationshipHistory based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createPersonRelationshipHistory` function validates the request body using a Joi schema, generates a unique code
 * for the personRelationshipHistory, and creates a new personRelationshipHistory in the database with additional metadata.
 *
 * The `getPersonRelationshipHistory` function retrieves a single personRelationshipHistory based on the provided personRelationshipHistory ID, with visibility
 * filters applied to ensure the personRelationshipHistory is accessible to the requesting user.
 *
 * The `updatePersonRelationshipHistory` function updates an existing personRelationshipHistory in the database based on the provided personRelationshipHistory ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deletePersonRelationshipHistory` function deletes a personRelationshipHistory from the database based on the provided personRelationshipHistory ID, with
 * visibility filters applied to ensure the personRelationshipHistory is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const _ = require('lodash');
const {
  personRelationshipHistoryCreate,
  personRelationshipHistoryUpdate,
} = require('#schemas/personRelationshipHistory.schemas.js');
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
const { findWorkflowAndTrigger } = require('#utils/shared/automataUtils.js');
const {
  enrichRecordDisplayValues,
} = require('#utils/shared/displayValueUtils.js');

async function getAllPersonRelationshipHistory(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllPersonRelationshipHistory', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['notes', 'color'];
    const filterFields = [...searchFields, 'personRelationshipId'];

    const include = {
      personRelationship: { include: { person: true } },
    };

    // Log database operation start
    logDatabaseStart('get_all_person_relationship_history', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    // Support relational search on linked person and relationship name
    let customWhere = {};
    const rawSearch = (query?.search || '').trim();
    if (rawSearch) {
      customWhere = {
        OR: [
          {
            personRelationship: {
              person: {
                firstName: { contains: rawSearch, mode: 'insensitive' },
              },
            },
          },
          {
            personRelationship: {
              person: {
                lastName: { contains: rawSearch, mode: 'insensitive' },
              },
            },
          },
          {
            personRelationship: {
              person: { email: { contains: rawSearch, mode: 'insensitive' } },
            },
          },
          {
            personRelationship: {
              relationship: {
                name: { contains: rawSearch, mode: 'insensitive' },
              },
            },
          },
        ],
      };
    }

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: personRelationshipHistoryUpdate,
      filterFields,
      searchFields,
      model: 'personRelationshipHistory',
      include: Object.keys(include).length ? include : undefined,
      customWhere,
    });

    // Attach display values (including nested relations) to all person relationship history records
    if (response?.results) {
      response.results = response.results.map((record) =>
        enrichRecordDisplayValues(record, 'PersonRelationshipHistory')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_person_relationship_history', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllPersonRelationshipHistory', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllPersonRelationshipHistory', req, error);
    throw handleDatabaseError(error, 'get_all_person_relationship_history');
  }
}

async function createPersonRelationshipHistory(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createPersonRelationshipHistory', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await personRelationshipHistoryCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createPersonRelationshipHistory', req, error);
        throw handleValidationError(
          error,
          'person_relationship_history_creation'
        );
      }
      logOperationError('createPersonRelationshipHistory', req, error);
      throw error;
    }

    const modelRelationFields = ['personRelationshipId'];

    const include = {
      personRelationship: { include: { person: true } },
    };

    // Foreign key visibility validation (soft-delete aware)
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.personRelationshipId
          ? {
              model: 'personRelationship',
              fieldValues: {
                personRelationshipId: values.personRelationshipId,
              },
            }
          : null,
      ].filter(Boolean),
    });

    // No controller-level uniqueness checks for notes (parity with Django)

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_person_relationship_history', req, {
      name: values.name,
      userId: user?.id,
    });

    const newPersonRelationshipHistory =
      await prisma.personRelationshipHistory.create({
        data: buildCreateRecordPayload({
          user,
          validatedValues: values,
          requestBody: body,
          relations: modelRelationFields,
        }),
        include: Object.keys(include).length ? include : undefined,
      });

    // Log database operation success
    logDatabaseSuccess('create_person_relationship_history', req, {
      id: newPersonRelationshipHistory.id,
      code: newPersonRelationshipHistory.code,
    });

    const [newPersonRelationshipHistoryWithDetails] = await getDetailsFromAPI({
      results: [newPersonRelationshipHistory],
      token: user?.accessToken,
    });

    // Attach display values (including nested relations)
    const personRelationshipHistoryWithDisplayValue = enrichRecordDisplayValues(
      newPersonRelationshipHistoryWithDetails,
      'PersonRelationshipHistory'
    );

    // Log operation success
    logOperationSuccess('createPersonRelationshipHistory', req, {
      id: newPersonRelationshipHistory.id,
      code: newPersonRelationshipHistory.code,
    });

    res.status(201).json(personRelationshipHistoryWithDisplayValue);

    // Fire-and-forget workflow trigger AFTER response for lower latency
    (async () => {
      try {
        await findWorkflowAndTrigger(
          prisma,
          newPersonRelationshipHistory,
          'personRelationshipHistory',
          user?.client?.id,
          {},
          user?.accessToken
        );
      } catch (_e) {
        // swallow to avoid impacting the request lifecycle
      }
    })();
  } catch (error) {
    logOperationError('createPersonRelationshipHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_person_relationship_history');
  }
}

async function getPersonRelationshipHistory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getPersonRelationshipHistory', req, {
    user: user?.id,
    personRelationshipHistoryId: params?.id,
  });

  try {
    const include = {
      personRelationship: { include: { person: true } },
    };

    // Log database operation start
    logDatabaseStart('get_person_relationship_history', req, {
      personRelationshipHistoryId: params?.id,
      userId: user?.id,
    });

    const foundPersonRelationshipHistory =
      await prisma.personRelationshipHistory.findFirst({
        where: {
          id: params?.id,
          ...getVisibilityFilters(user),
        },
        include: Object.keys(include).length ? include : undefined,
      });

    // Log database operation success
    logDatabaseSuccess('get_person_relationship_history', req, {
      found: !!foundPersonRelationshipHistory,
      personRelationshipHistoryId: params?.id,
    });

    if (!foundPersonRelationshipHistory) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonRelationshipHistory not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_person_relationship_history',
          details: { personRelationshipHistoryId: params?.id },
        }
      );
      logOperationError('getPersonRelationshipHistory', req, error);
      throw error;
    }

    const [foundPersonRelationshipHistoryWithDetails] = await getDetailsFromAPI(
      {
        results: [foundPersonRelationshipHistory],
        token: user?.accessToken,
      }
    );

    // Attach display values (including nested relations)
    const personRelationshipHistoryWithDisplayValue = enrichRecordDisplayValues(
      foundPersonRelationshipHistoryWithDetails,
      'PersonRelationshipHistory'
    );

    // Log operation success
    logOperationSuccess('getPersonRelationshipHistory', req, {
      id: foundPersonRelationshipHistory.id,
      code: foundPersonRelationshipHistory.code,
    });

    res.status(200).json(personRelationshipHistoryWithDisplayValue);
  } catch (error) {
    logOperationError('getPersonRelationshipHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_person_relationship_history');
  }
}

async function updatePersonRelationshipHistory(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updatePersonRelationshipHistory', req, {
    personRelationshipHistoryId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await personRelationshipHistoryUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updatePersonRelationshipHistory', req, error);
        throw handleValidationError(
          error,
          'person_relationship_history_update'
        );
      }
      logOperationError('updatePersonRelationshipHistory', req, error);
      throw error;
    }

    // Verify FK access for provided FKs
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        body?.personRelationshipId
          ? {
              model: 'personRelationship',
              fieldValues: { personRelationshipId: body.personRelationshipId },
            }
          : null,
      ].filter(Boolean),
    });

    // Soft-delete aware fetch for current record to ensure visibility
    const current = await prisma.personRelationshipHistory.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: {
        id: true,
        client: true,
        personRelationshipId: true,
        notes: true,
      },
    });
    if (!current) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonRelationshipHistory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'person_relationship_history_update_fetch',
          details: { personRelationshipHistoryId: params?.id },
        }
      );
      throw error;
    }

    // No controller-level uniqueness checks for notes on update (parity with Django)

    // Log database operation start
    logDatabaseStart('update_person_relationship_history', req, {
      personRelationshipHistoryId: params?.id,
      updateFields: Object.keys(values),
    });

    const updatedPersonRelationshipHistory =
      await prisma.personRelationshipHistory.update({
        where: { id: params?.id },
        data: {
          ...objectKeysToCamelCase(values),
          updatedBy: user?.id,
        },
      });

    // Attach display values (including nested relations)
    const personRelationshipHistoryWithDisplayValue = enrichRecordDisplayValues(
      updatedPersonRelationshipHistory,
      'PersonRelationshipHistory'
    );

    // Log database operation success
    logDatabaseSuccess('update_person_relationship_history', req, {
      id: updatedPersonRelationshipHistory.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updatePersonRelationshipHistory', req, {
      id: updatedPersonRelationshipHistory.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(personRelationshipHistoryWithDisplayValue);
  } catch (error) {
    logOperationError('updatePersonRelationshipHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_person_relationship_history');
  }
}

async function deletePersonRelationshipHistory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deletePersonRelationshipHistory', req, {
    user: user?.id,
    personRelationshipHistoryId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('delete_person_relationship_history', req, {
      personRelationshipHistoryId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.personRelationshipHistory.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_person_relationship_history', req, {
      deletedCount: result.count,
      personRelationshipHistoryId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonRelationshipHistory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_person_relationship_history',
          details: { personRelationshipHistoryId: params?.id },
        }
      );
      logOperationError('deletePersonRelationshipHistory', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deletePersonRelationshipHistory', req, {
      deletedCount: result.count,
      personRelationshipHistoryId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deletePersonRelationshipHistory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_person_relationship_history');
  }
}

async function getPersonRelationshipHistoryBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for personRelationshipHistory',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllPersonRelationshipHistory,
  createPersonRelationshipHistory,
  getPersonRelationshipHistory,
  updatePersonRelationshipHistory,
  deletePersonRelationshipHistory,
  getPersonRelationshipHistoryBarChartData,
};
