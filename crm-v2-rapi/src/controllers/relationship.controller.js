/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing relationship using Prisma.
 * It includes functions for retrieving all relationship, creating a new relationship, retrieving a single relationship,
 * updating an existing relationship, and deleting a relationship.
 *
 * The `getAllRelationship` function retrieves a paginated list of relationship based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createRelationship` function validates the request body using a Joi schema, generates a unique code
 * for the relationship, and creates a new relationship in the database with additional metadata.
 *
 * The `getRelationship` function retrieves a single relationship based on the provided relationship ID, with visibility
 * filters applied to ensure the relationship is accessible to the requesting user.
 *
 * The `updateRelationship` function updates an existing relationship in the database based on the provided relationship ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteRelationship` function deletes a relationship from the database based on the provided relationship ID, with
 * visibility filters applied to ensure the relationship is deletable by the requesting user.
 *
 *
 */

const _ = require('lodash');
const prisma = require('#configs/prisma.js');
const {
  relationshipCreate,
  relationshipUpdate,
} = require('#schemas/relationship.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const {
  ERROR_TYPES,
  ERROR_SEVERITY,
  DISPLAY_VALUE_PROP,
} = require('#configs/constants.js');
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
const { findWorkflowAndTrigger } = require('#utils/shared/automataUtils.js');
const { computeDisplayValue } = require('#utils/shared/displayValueUtils.js');

async function getAllRelationship(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllRelationship', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['name', 'description', 'color'];
    const filterFields = [...searchFields];

    const include = {};

    // Log database operation start
    logDatabaseStart('get_all_relationship', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: relationshipUpdate,
      filterFields,
      searchFields,
      model: 'relationship',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values to all relationships
    if (response?.results) {
      response.results = response.results.map((relationship) => ({
        ...relationship,
        [DISPLAY_VALUE_PROP]: computeDisplayValue(relationship, 'Relationship'),
      }));
    }

    // Log database operation success
    logDatabaseSuccess('get_all_relationship', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllRelationship', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllRelationship', req, error);
    throw handleDatabaseError(error, 'get_all_relationship');
  }
}

async function createRelationship(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createRelationship', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await relationshipCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createRelationship', req, error);
        throw handleValidationError(error, 'relationship_creation');
      }
      logOperationError('createRelationship', req, error);
      throw error;
    }

    const modelRelationFields = [];

    const include = {};

    // Controller-level uniqueness checks (soft-delete aware)
    const clientId = user?.client?.id;
    const trimmedName = _.trim(values?.name || '');
    if (trimmedName) {
      const existingByName = await prisma.relationship.findFirst({
        where: {
          client: clientId,
          deleted: null,
          name: { equals: trimmedName, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (existingByName) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'A relationship with this name already exists for your account.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'relationship_creation_uniqueness',
            details: { name: trimmedName },
          }
        );
        throw error;
      }
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_relationship', req, {
      name: values.name,
      userId: user?.id,
    });

    const newRelationship = await prisma.relationship.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_relationship', req, {
      id: newRelationship.id,
      code: newRelationship.code,
    });

    const [newRelationshipWithDetails] = await getDetailsFromAPI({
      results: [newRelationship],
      token: user?.accessToken,
    });

    // Attach display value
    const relationshipWithDisplayValue = {
      ...newRelationshipWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        newRelationshipWithDetails,
        'Relationship'
      ),
    };

    // Log operation success
    logOperationSuccess('createRelationship', req, {
      id: newRelationship.id,
      code: newRelationship.code,
    });

    res.status(201).json(relationshipWithDisplayValue);

    // Fire-and-forget workflow trigger AFTER response for lower latency
    (async () => {
      try {
        await findWorkflowAndTrigger(
          prisma,
          newRelationship,
          'relationship',
          user?.client?.id,
          {},
          user?.accessToken
        );
      } catch (_e) {
        // swallow to avoid impacting the request lifecycle
      }
    })();
  } catch (error) {
    logOperationError('createRelationship', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_relationship');
  }
}

async function getRelationship(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getRelationship', req, {
    user: user?.id,
    relationshipId: params?.id,
  });

  try {
    const include = {};

    // Log database operation start
    logDatabaseStart('get_relationship', req, {
      relationshipId: params?.id,
      userId: user?.id,
    });

    const foundRelationship = await prisma.relationship.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_relationship', req, {
      found: !!foundRelationship,
      relationshipId: params?.id,
    });

    if (!foundRelationship) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Relationship not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_relationship',
          details: { relationshipId: params?.id },
        }
      );
      logOperationError('getRelationship', req, error);
      throw error;
    }

    const [foundRelationshipWithDetails] = await getDetailsFromAPI({
      results: [foundRelationship],
      token: user?.accessToken,
    });

    // Attach display value
    const relationshipWithDisplayValue = {
      ...foundRelationshipWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        foundRelationshipWithDetails,
        'Relationship'
      ),
    };

    // Log operation success
    logOperationSuccess('getRelationship', req, {
      id: foundRelationship.id,
      code: foundRelationship.code,
    });

    res.status(200).json(relationshipWithDisplayValue);
  } catch (error) {
    logOperationError('getRelationship', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_relationship');
  }
}

async function updateRelationship(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateRelationship', req, {
    relationshipId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await relationshipUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateRelationship', req, error);
        throw handleValidationError(error, 'relationship_update');
      }
      logOperationError('updateRelationship', req, error);
      throw error;
    }

    // Soft-delete aware fetch for current record to ensure visibility
    const current = await prisma.relationship.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: { id: true, name: true, client: true },
    });
    if (!current) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Relationship not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'relationship_update_fetch',
          details: { relationshipId: params?.id },
        }
      );
      throw error;
    }

    // Controller-level uniqueness checks (soft-delete aware)
    const clientId = user?.client?.id || current.client;
    const trimmedName = _.trim(values?.name || '');
    if (trimmedName) {
      const existingByName = await prisma.relationship.findFirst({
        where: {
          client: clientId,
          deleted: null,
          id: { not: params?.id },
          name: { equals: trimmedName, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (existingByName) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'A relationship with this name already exists for your account.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'relationship_update_uniqueness',
            details: { name: trimmedName },
          }
        );
        throw error;
      }
    }

    // Log database operation start
    logDatabaseStart('update_relationship', req, {
      relationshipId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.relationship.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Relationship not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_relationship',
          details: { relationshipId: params?.id },
        }
      );
      throw error;
    }

    const updatedRelationship = await prisma.relationship.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
    });

    // Attach display value
    const relationshipWithDisplayValue = {
      ...updatedRelationship,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        updatedRelationship,
        'Relationship'
      ),
    };

    // Log database operation success
    logDatabaseSuccess('update_relationship', req, {
      id: updatedRelationship.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateRelationship', req, {
      id: updatedRelationship.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(relationshipWithDisplayValue);
  } catch (error) {
    logOperationError('updateRelationship', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_relationship');
  }
}

async function deleteRelationship(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteRelationship', req, {
    user: user?.id,
    relationshipId: params?.id,
  });

  try {
    await prisma.personRelationship.updateMany({
      where: {
        relationshipId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_relationship', req, {
      relationshipId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.relationship.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_relationship', req, {
      deletedCount: result.count,
      relationshipId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Relationship not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_relationship',
          details: { relationshipId: params?.id },
        }
      );
      logOperationError('deleteRelationship', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteRelationship', req, {
      deletedCount: result.count,
      relationshipId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteRelationship', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_relationship');
  }
}

async function getRelationshipBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for relationship',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllRelationship,
  createRelationship,
  getRelationship,
  updateRelationship,
  deleteRelationship,
  getRelationshipBarChartData,
};
