/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing territoryOwner using Prisma.
 * It includes functions for retrieving all territoryOwner, creating a new territoryOwner, retrieving a single territoryOwner,
 * updating an existing territoryOwner, and deleting a territoryOwner.
 *
 * The `getAllTerritoryOwner` function retrieves a paginated list of territoryOwner based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createTerritoryOwner` function validates the request body using a Joi schema, generates a unique code
 * for the territoryOwner, and creates a new territoryOwner in the database with additional metadata.
 *
 * The `getTerritoryOwner` function retrieves a single territoryOwner based on the provided territoryOwner ID, with visibility
 * filters applied to ensure the territoryOwner is accessible to the requesting user.
 *
 * The `updateTerritoryOwner` function updates an existing territoryOwner in the database based on the provided territoryOwner ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteTerritoryOwner` function deletes a territoryOwner from the database based on the provided territoryOwner ID, with
 * visibility filters applied to ensure the territoryOwner is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  territoryOwnerCreate,
  territoryOwnerUpdate,
} = require('#schemas/territoryOwner.schemas.js');
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
const { computeDisplayValue } = require('#utils/shared/displayValueUtils.js');

async function getAllTerritoryOwner(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllTerritoryOwner', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['color'];
    const filterFields = [
      ...searchFields,
      'expiryDate',
      'territoryId',
      'salesPersonId',
    ];

    const include = {
      territory: true,
    };

    // Support relational search (territory name)
    let customWhere = {};
    const rawSearch = (query?.search || '').trim();
    if (rawSearch) {
      customWhere = {
        OR: [
          { territory: { name: { contains: rawSearch, mode: 'insensitive' } } },
        ],
      };
    }

    // Log database operation start
    logDatabaseStart('get_all_territory_owner', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: territoryOwnerUpdate,
      filterFields,
      searchFields,
      model: 'territoryOwner',
      include: Object.keys(include).length ? include : undefined,
      customWhere,
    });

    // Attach display values to all territory owners
    if (response?.results) {
      response.results = response.results.map((territoryOwner) => ({
        ...territoryOwner,
        [DISPLAY_VALUE_PROP]: computeDisplayValue(
          territoryOwner,
          'TerritoryOwner'
        ),
      }));
    }

    // Log database operation success
    logDatabaseSuccess('get_all_territory_owner', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllTerritoryOwner', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllTerritoryOwner', req, error);
    throw handleDatabaseError(error, 'get_all_territory_owner');
  }
}

async function createTerritoryOwner(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createTerritoryOwner', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await territoryOwnerCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createTerritoryOwner', req, error);
        throw handleValidationError(error, 'territory_owner_creation');
      }
      logOperationError('createTerritoryOwner', req, error);
      throw error;
    }

    const modelRelationFields = ['territoryId'];

    const include = {
      territory: true,
    };

    // Verify FK access (soft-delete aware)
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.territoryId
          ? {
              model: 'territory',
              fieldValues: { territoryId: values.territoryId },
            }
          : null,
      ].filter(Boolean),
    });

    // Controller-level uniqueness check: prevent active duplicate owner in territory
    try {
      const now = new Date();
      const duplicate = await prisma.territoryOwner.findFirst({
        where: {
          client: user?.client?.id,
          deleted: null,
          territoryId: values.territoryId,
          salesPersonId: values.salesPersonId,
          OR: [{ expiryDate: null }, { expiryDate: { gte: now } }],
        },
        select: { id: true },
      });
      if (duplicate) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'This salesperson already has an active ownership for the selected territory. End the current assignment or set an earlier expiry date.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'create_territory_owner_duplicate_check',
            details: {
              territoryId: values.territoryId,
              salesPersonId: values.salesPersonId,
            },
          }
        );
        throw error;
      }
    } catch (_e) {
      // best-effort duplicate protection; proceed if check fails
    }

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_territory_owner', req, {
      name: values.name,
      userId: user?.id,
    });

    const newTerritoryOwner = await prisma.territoryOwner.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_territory_owner', req, {
      id: newTerritoryOwner.id,
      code: newTerritoryOwner.code,
    });

    const [newTerritoryOwnerWithDetails] = await getDetailsFromAPI({
      results: [newTerritoryOwner],
      token: user?.accessToken,
    });

    // Attach display value
    const territoryOwnerWithDisplayValue = {
      ...newTerritoryOwnerWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        newTerritoryOwnerWithDetails,
        'TerritoryOwner'
      ),
    };

    // Log operation success
    logOperationSuccess('createTerritoryOwner', req, {
      id: newTerritoryOwner.id,
      code: newTerritoryOwner.code,
    });

    res.status(201).json(territoryOwnerWithDisplayValue);

    // Fire-and-forget workflow trigger
    setImmediate(() => {
      try {
        findWorkflowAndTrigger(
          prisma,
          newTerritoryOwner,
          'territoryOwner',
          user?.client?.id,
          {},
          user?.accessToken
        );
      } catch (_err) {
        // Ignore errors in fire-and-forget workflow trigger
      }
    });
  } catch (error) {
    logOperationError('createTerritoryOwner', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_territory_owner');
  }
}

async function getTerritoryOwner(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getTerritoryOwner', req, {
    user: user?.id,
    territoryOwnerId: params?.id,
  });

  try {
    const include = {
      territory: true,
    };

    // Log database operation start
    logDatabaseStart('get_territory_owner', req, {
      territoryOwnerId: params?.id,
      userId: user?.id,
    });

    const foundTerritoryOwner = await prisma.territoryOwner.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_territory_owner', req, {
      found: !!foundTerritoryOwner,
      territoryOwnerId: params?.id,
    });

    if (!foundTerritoryOwner) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'TerritoryOwner not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_territory_owner',
          details: { territoryOwnerId: params?.id },
        }
      );
      logOperationError('getTerritoryOwner', req, error);
      throw error;
    }

    const [foundTerritoryOwnerWithDetails] = await getDetailsFromAPI({
      results: [foundTerritoryOwner],
      token: user?.accessToken,
    });

    // Attach display value
    const territoryOwnerWithDisplayValue = {
      ...foundTerritoryOwnerWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        foundTerritoryOwnerWithDetails,
        'TerritoryOwner'
      ),
    };

    // Log operation success
    logOperationSuccess('getTerritoryOwner', req, {
      id: foundTerritoryOwner.id,
      code: foundTerritoryOwner.code,
    });

    res.status(200).json(territoryOwnerWithDisplayValue);
  } catch (error) {
    logOperationError('getTerritoryOwner', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_territory_owner');
  }
}

async function updateTerritoryOwner(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateTerritoryOwner', req, {
    territoryOwnerId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await territoryOwnerUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateTerritoryOwner', req, error);
        throw handleValidationError(error, 'territory_owner_update');
      }
      logOperationError('updateTerritoryOwner', req, error);
      throw error;
    }

    // Load current to compute effective values and validate
    const current = await prisma.territoryOwner.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: {
        id: true,
        territoryId: true,
        salesPersonId: true,
        expiryDate: true,
        client: true,
      },
    });

    if (!current) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'TerritoryOwner not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_territory_owner',
          details: { territoryOwnerId: params?.id },
        }
      );
      logOperationError('updateTerritoryOwner', req, error);
      throw error;
    }

    const effectiveTerritoryId = values?.territoryId ?? current.territoryId;
    const effectiveSalesPersonId =
      values?.salesPersonId ?? current.salesPersonId;
    const effectiveExpiryDate =
      values?.expiryDate !== undefined ? values.expiryDate : current.expiryDate;

    // Verify FK access when provided
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.territoryId
          ? {
              model: 'territory',
              fieldValues: { territoryId: values.territoryId },
            }
          : null,
      ].filter(Boolean),
    });

    // Active duplicate prevention
    try {
      const willBeActive =
        !effectiveExpiryDate || new Date(effectiveExpiryDate) >= new Date();
      if (willBeActive) {
        const duplicate = await prisma.territoryOwner.findFirst({
          where: {
            id: { not: current.id },
            client: user?.client?.id,
            deleted: null,
            territoryId: effectiveTerritoryId,
            salesPersonId: effectiveSalesPersonId,
            OR: [{ expiryDate: null }, { expiryDate: { gte: new Date() } }],
          },
          select: { id: true },
        });
        if (duplicate) {
          const error = createErrorWithTrace(
            ERROR_TYPES.VALIDATION,
            'This salesperson already has an active ownership for the selected territory. End the current assignment or set an earlier expiry date.',
            req,
            {
              severity: ERROR_SEVERITY.LOW,
              context: 'update_territory_owner_duplicate_check',
              details: {
                territoryId: effectiveTerritoryId,
                salesPersonId: effectiveSalesPersonId,
              },
            }
          );
          throw error;
        }
      }
    } catch (_e) {
      // best-effort duplicate protection; proceed if check fails
    }

    // Log database operation start
    logDatabaseStart('update_territory_owner', req, {
      territoryOwnerId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.territoryOwner.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'TerritoryOwner not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_territory_owner',
          details: { territoryOwnerId: params?.id },
        }
      );
      logOperationError('updateTerritoryOwner', req, error);
      throw error;
    }

    const updatedTerritoryOwner = await prisma.territoryOwner.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });

    // Log database operation success
    logDatabaseSuccess('update_territory_owner', req, {
      id: updatedTerritoryOwner.id,
      updatedFields: Object.keys(values),
    });

    // Attach display value
    const territoryOwnerWithDisplayValue = {
      ...updatedTerritoryOwner,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        updatedTerritoryOwner,
        'TerritoryOwner'
      ),
    };

    // Log operation success
    logOperationSuccess('updateTerritoryOwner', req, {
      id: updatedTerritoryOwner.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(territoryOwnerWithDisplayValue);
  } catch (error) {
    logOperationError('updateTerritoryOwner', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_territory_owner');
  }
}

async function deleteTerritoryOwner(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteTerritoryOwner', req, {
    user: user?.id,
    territoryOwnerId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('delete_territory_owner', req, {
      territoryOwnerId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.territoryOwner.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_territory_owner', req, {
      deletedCount: result.count,
      territoryOwnerId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'TerritoryOwner not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_territory_owner',
          details: { territoryOwnerId: params?.id },
        }
      );
      logOperationError('deleteTerritoryOwner', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteTerritoryOwner', req, {
      deletedCount: result.count,
      territoryOwnerId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteTerritoryOwner', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_territory_owner');
  }
}

async function getTerritoryOwnerBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for territoryOwner',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllTerritoryOwner,
  createTerritoryOwner,
  getTerritoryOwner,
  updateTerritoryOwner,
  deleteTerritoryOwner,
  getTerritoryOwnerBarChartData,
};
