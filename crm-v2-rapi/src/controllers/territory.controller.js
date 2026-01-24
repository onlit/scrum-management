/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing territory using Prisma.
 * It includes functions for retrieving all territory, creating a new territory, retrieving a single territory,
 * updating an existing territory, and deleting a territory.
 *
 * The `getAllTerritory` function retrieves a paginated list of territory based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createTerritory` function validates the request body using a Joi schema, generates a unique code
 * for the territory, and creates a new territory in the database with additional metadata.
 *
 * The `getTerritory` function retrieves a single territory based on the provided territory ID, with visibility
 * filters applied to ensure the territory is accessible to the requesting user.
 *
 * The `updateTerritory` function updates an existing territory in the database based on the provided territory ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteTerritory` function deletes a territory from the database based on the provided territory ID, with
 * visibility filters applied to ensure the territory is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  territoryCreate,
  territoryUpdate,
} = require('#schemas/territory.schemas.js');
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
const { computeDisplayValue } = require('#utils/shared/displayValueUtils.js');

async function getAllTerritory(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllTerritory', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['description', 'name', 'color'];
    const filterFields = [...searchFields, 'expiryDate'];

    const include = {};

    // Log database operation start
    logDatabaseStart('get_all_territory', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: territoryUpdate,
      filterFields,
      searchFields,
      model: 'territory',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values to all territories
    if (response?.results) {
      response.results = response.results.map((territory) => ({
        ...territory,
        [DISPLAY_VALUE_PROP]: computeDisplayValue(territory, 'Territory'),
      }));
    }

    // Log database operation success
    logDatabaseSuccess('get_all_territory', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllTerritory', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllTerritory', req, error);
    throw handleDatabaseError(error, 'get_all_territory');
  }
}

async function createTerritory(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createTerritory', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await territoryCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createTerritory', req, error);
        throw handleValidationError(error, 'territory_creation');
      }
      logOperationError('createTerritory', req, error);
      throw error;
    }

    const modelRelationFields = [];

    const include = {};

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_territory', req, {
      name: values.name,
      userId: user?.id,
    });

    const newTerritory = await prisma.territory.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_territory', req, {
      id: newTerritory.id,
      code: newTerritory.code,
    });

    const [newTerritoryWithDetails] = await getDetailsFromAPI({
      results: [newTerritory],
      token: user?.accessToken,
    });

    // Attach display value
    const territoryWithDisplayValue = {
      ...newTerritoryWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        newTerritoryWithDetails,
        'Territory'
      ),
    };

    // Log operation success
    logOperationSuccess('createTerritory', req, {
      id: newTerritory.id,
      code: newTerritory.code,
    });

    res.status(201).json(territoryWithDisplayValue);
  } catch (error) {
    logOperationError('createTerritory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_territory');
  }
}

async function getTerritory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getTerritory', req, {
    user: user?.id,
    territoryId: params?.id,
  });

  try {
    const include = {};

    // Log database operation start
    logDatabaseStart('get_territory', req, {
      territoryId: params?.id,
      userId: user?.id,
    });

    const foundTerritory = await prisma.territory.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_territory', req, {
      found: !!foundTerritory,
      territoryId: params?.id,
    });

    if (!foundTerritory) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Territory not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_territory',
          details: { territoryId: params?.id },
        }
      );
      logOperationError('getTerritory', req, error);
      throw error;
    }

    const [foundTerritoryWithDetails] = await getDetailsFromAPI({
      results: [foundTerritory],
      token: user?.accessToken,
    });

    // Attach display value
    const territoryWithDisplayValue = {
      ...foundTerritoryWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        foundTerritoryWithDetails,
        'Territory'
      ),
    };

    // Log operation success
    logOperationSuccess('getTerritory', req, {
      id: foundTerritory.id,
      code: foundTerritory.code,
    });

    res.status(200).json(territoryWithDisplayValue);
  } catch (error) {
    logOperationError('getTerritory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_territory');
  }
}

async function updateTerritory(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateTerritory', req, {
    territoryId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await territoryUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateTerritory', req, error);
        throw handleValidationError(error, 'territory_update');
      }
      logOperationError('updateTerritory', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Log database operation start
    logDatabaseStart('update_territory', req, {
      territoryId: params?.id,
      updateFields: Object.keys(values),
    });

    const updatedTerritory = await prisma.territory.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('update_territory', req, {
      id: updatedTerritory.id,
      updatedFields: Object.keys(values),
    });

    // Attach display value
    const territoryWithDisplayValue = {
      ...updatedTerritory,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(updatedTerritory, 'Territory'),
    };

    // Log operation success
    logOperationSuccess('updateTerritory', req, {
      id: updatedTerritory.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(territoryWithDisplayValue);
  } catch (error) {
    logOperationError('updateTerritory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_territory');
  }
}

async function deleteTerritory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteTerritory', req, {
    user: user?.id,
    territoryId: params?.id,
  });

  try {
    await prisma.territoryOwner.updateMany({
      where: {
        territoryId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    await prisma.companyInTerritory.updateMany({
      where: {
        territoryId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_territory', req, {
      territoryId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.territory.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_territory', req, {
      deletedCount: result.count,
      territoryId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Territory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_territory',
          details: { territoryId: params?.id },
        }
      );
      logOperationError('deleteTerritory', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteTerritory', req, {
      deletedCount: result.count,
      territoryId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteTerritory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_territory');
  }
}

async function getTerritoryBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for territory',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllTerritory,
  createTerritory,
  getTerritory,
  updateTerritory,
  deleteTerritory,
  getTerritoryBarChartData,
};
