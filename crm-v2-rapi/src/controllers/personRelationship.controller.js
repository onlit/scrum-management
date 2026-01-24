/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing personRelationship using Prisma.
 * It includes functions for retrieving all personRelationship, creating a new personRelationship, retrieving a single personRelationship,
 * updating an existing personRelationship, and deleting a personRelationship.
 *
 * The `getAllPersonRelationship` function retrieves a paginated list of personRelationship based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createPersonRelationship` function validates the request body using a Joi schema, generates a unique code
 * for the personRelationship, and creates a new personRelationship in the database with additional metadata.
 *
 * The `getPersonRelationship` function retrieves a single personRelationship based on the provided personRelationship ID, with visibility
 * filters applied to ensure the personRelationship is accessible to the requesting user.
 *
 * The `updatePersonRelationship` function updates an existing personRelationship in the database based on the provided personRelationship ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deletePersonRelationship` function deletes a personRelationship from the database based on the provided personRelationship ID, with
 * visibility filters applied to ensure the personRelationship is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  personRelationshipCreate,
  personRelationshipUpdate,
} = require('#schemas/personRelationship.schemas.js');
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

async function getAllPersonRelationship(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllPersonRelationship', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['color'];
    const filterFields = [...searchFields, 'personId', 'relationshipId'];

    const include = {
      person: true,
      relationship: true,
    };

    // Support relational search parity with Django (person name/email, relationship name)
    let customWhere = {};
    const rawSearch = (query?.search || '').trim();
    const isAutocomplete = !!query?.autocomplete;
    if (rawSearch) {
      if (isAutocomplete) {
        customWhere = {
          OR: [
            { person: { email: { contains: rawSearch, mode: 'insensitive' } } },
            {
              relationship: {
                name: { contains: rawSearch, mode: 'insensitive' },
              },
            },
          ],
        };
      } else {
        customWhere = {
          OR: [
            {
              person: {
                firstName: { contains: rawSearch, mode: 'insensitive' },
              },
            },
            {
              person: {
                middleName: { contains: rawSearch, mode: 'insensitive' },
              },
            },
            {
              person: {
                lastName: { contains: rawSearch, mode: 'insensitive' },
              },
            },
            { person: { email: { contains: rawSearch, mode: 'insensitive' } } },
            {
              relationship: {
                name: { contains: rawSearch, mode: 'insensitive' },
              },
            },
          ],
        };
      }
    }

    // Log database operation start
    logDatabaseStart('get_all_person_relationship', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: personRelationshipUpdate,
      filterFields,
      searchFields,
      model: 'personRelationship',
      include: Object.keys(include).length ? include : undefined,
      customWhere,
    });

    // Attach display values (including nested relations) to all person relationship records
    if (response?.results) {
      response.results = response.results.map((record) =>
        enrichRecordDisplayValues(record, 'PersonRelationship')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_person_relationship', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllPersonRelationship', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllPersonRelationship', req, error);
    throw handleDatabaseError(error, 'get_all_person_relationship');
  }
}

async function createPersonRelationship(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createPersonRelationship', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await personRelationshipCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createPersonRelationship', req, error);
        throw handleValidationError(error, 'person_relationship_creation');
      }
      logOperationError('createPersonRelationship', req, error);
      throw error;
    }

    const modelRelationFields = ['personId', 'relationshipId'];

    const include = {
      person: true,
      relationship: true,
    };

    // Verify FK access for personId and relationshipId
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.personId
          ? { model: 'person', fieldValues: { personId: values.personId } }
          : null,
        values?.relationshipId
          ? {
              model: 'relationship',
              fieldValues: { relationshipId: values.relationshipId },
            }
          : null,
      ].filter(Boolean),
    });

    // Controller-level uniqueness checks (soft-delete aware)
    const clientId = user?.client?.id;
    const existing = await prisma.personRelationship.findFirst({
      where: {
        client: clientId,
        deleted: null,
        personId: values?.personId,
        relationshipId: values?.relationshipId,
      },
      select: { id: true },
    });
    if (existing) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'This person already has this relationship.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'person_relationship_creation_uniqueness',
          details: {
            personId: values?.personId,
            relationshipId: values?.relationshipId,
          },
        }
      );
      throw error;
    }

    // Log database operation start
    logDatabaseStart('create_person_relationship', req, {
      name: values.name,
      userId: user?.id,
    });

    const newPersonRelationship = await prisma.personRelationship.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_person_relationship', req, {
      id: newPersonRelationship.id,
      code: newPersonRelationship.code,
    });

    const [newPersonRelationshipWithDetails] = await getDetailsFromAPI({
      results: [newPersonRelationship],
      token: user?.accessToken,
    });

    // Attach display value (including nested relations)
    const personRelationshipWithDisplayValue = enrichRecordDisplayValues(
      newPersonRelationshipWithDetails,
      'PersonRelationship'
    );

    // Log operation success
    logOperationSuccess('createPersonRelationship', req, {
      id: newPersonRelationship.id,
      code: newPersonRelationship.code,
    });

    res.status(201).json(personRelationshipWithDisplayValue);

    // Fire-and-forget workflow trigger AFTER response for lower latency
    (async () => {
      try {
        await findWorkflowAndTrigger(
          prisma,
          newPersonRelationship,
          'personRelationship',
          user?.client?.id,
          {},
          user?.accessToken
        );
      } catch (_e) {
        // swallow to avoid impacting the request lifecycle
      }
    })();
  } catch (error) {
    logOperationError('createPersonRelationship', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_person_relationship');
  }
}

async function getPersonRelationship(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getPersonRelationship', req, {
    user: user?.id,
    personRelationshipId: params?.id,
  });

  try {
    const include = {
      person: true,
      relationship: true,
    };

    // Log database operation start
    logDatabaseStart('get_person_relationship', req, {
      personRelationshipId: params?.id,
      userId: user?.id,
    });

    const foundPersonRelationship = await prisma.personRelationship.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_person_relationship', req, {
      found: !!foundPersonRelationship,
      personRelationshipId: params?.id,
    });

    if (!foundPersonRelationship) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonRelationship not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_person_relationship',
          details: { personRelationshipId: params?.id },
        }
      );
      logOperationError('getPersonRelationship', req, error);
      throw error;
    }

    const [foundPersonRelationshipWithDetails] = await getDetailsFromAPI({
      results: [foundPersonRelationship],
      token: user?.accessToken,
    });

    // Attach display value (including nested relations)
    const personRelationshipWithDisplayValue = enrichRecordDisplayValues(
      foundPersonRelationshipWithDetails,
      'PersonRelationship'
    );

    // Log operation success
    logOperationSuccess('getPersonRelationship', req, {
      id: foundPersonRelationship.id,
      code: foundPersonRelationship.code,
    });

    res.status(200).json(personRelationshipWithDisplayValue);
  } catch (error) {
    logOperationError('getPersonRelationship', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_person_relationship');
  }
}

async function updatePersonRelationship(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updatePersonRelationship', req, {
    personRelationshipId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await personRelationshipUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updatePersonRelationship', req, error);
        throw handleValidationError(error, 'person_relationship_update');
      }
      logOperationError('updatePersonRelationship', req, error);
      throw error;
    }

    // Verify FK access for provided FKs
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.personId
          ? { model: 'person', fieldValues: { personId: values.personId } }
          : null,
        values?.relationshipId
          ? {
              model: 'relationship',
              fieldValues: { relationshipId: values.relationshipId },
            }
          : null,
      ].filter(Boolean),
    });

    // Soft-delete aware fetch for current record to ensure visibility
    const current = await prisma.personRelationship.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: { id: true, client: true, personId: true, relationshipId: true },
    });
    if (!current) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonRelationship not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'person_relationship_update_fetch',
          details: { personRelationshipId: params?.id },
        }
      );
      throw error;
    }

    // Uniqueness checks for composite keys (personId + relationshipId)
    const clientId = user?.client?.id || current.client;
    const targetPersonId = values?.personId ?? current.personId;
    const targetRelationshipId =
      values?.relationshipId ?? current.relationshipId;
    const duplicate = await prisma.personRelationship.findFirst({
      where: {
        client: clientId,
        deleted: null,
        id: { not: params?.id },
        personId: targetPersonId,
        relationshipId: targetRelationshipId,
      },
      select: { id: true },
    });
    if (duplicate) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'This person already has this relationship.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'person_relationship_update_uniqueness',
          details: {
            personId: targetPersonId,
            relationshipId: targetRelationshipId,
          },
        }
      );
      throw error;
    }

    // Log database operation start
    logDatabaseStart('update_person_relationship', req, {
      personRelationshipId: params?.id,
      updateFields: Object.keys(values),
    });

    const updatedPersonRelationship = await prisma.personRelationship.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    // Attach display value (including nested relations)
    const personRelationshipWithDisplayValue = enrichRecordDisplayValues(
      updatedPersonRelationship,
      'PersonRelationship'
    );

    // Log database operation success
    logDatabaseSuccess('update_person_relationship', req, {
      id: updatedPersonRelationship.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updatePersonRelationship', req, {
      id: updatedPersonRelationship.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(personRelationshipWithDisplayValue);
  } catch (error) {
    logOperationError('updatePersonRelationship', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_person_relationship');
  }
}

async function deletePersonRelationship(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deletePersonRelationship', req, {
    user: user?.id,
    personRelationshipId: params?.id,
  });

  try {
    await prisma.personRelationshipHistory.updateMany({
      where: {
        personRelationshipId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_person_relationship', req, {
      personRelationshipId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.personRelationship.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_person_relationship', req, {
      deletedCount: result.count,
      personRelationshipId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonRelationship not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_person_relationship',
          details: { personRelationshipId: params?.id },
        }
      );
      logOperationError('deletePersonRelationship', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deletePersonRelationship', req, {
      deletedCount: result.count,
      personRelationshipId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deletePersonRelationship', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_person_relationship');
  }
}

async function getPersonRelationshipBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for personRelationship',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllPersonRelationship,
  createPersonRelationship,
  getPersonRelationship,
  updatePersonRelationship,
  deletePersonRelationship,
  getPersonRelationshipBarChartData,
};
