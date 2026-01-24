/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing onlineSignup using Prisma.
 * It includes functions for retrieving all onlineSignup, creating a new onlineSignup, retrieving a single onlineSignup,
 * updating an existing onlineSignup, and deleting a onlineSignup.
 *
 * The `getAllOnlineSignup` function retrieves a paginated list of onlineSignup based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createOnlineSignup` function validates the request body using a Joi schema, generates a unique code
 * for the onlineSignup, and creates a new onlineSignup in the database with additional metadata.
 *
 * The `getOnlineSignup` function retrieves a single onlineSignup based on the provided onlineSignup ID, with visibility
 * filters applied to ensure the onlineSignup is accessible to the requesting user.
 *
 * The `updateOnlineSignup` function updates an existing onlineSignup in the database based on the provided onlineSignup ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteOnlineSignup` function deletes a onlineSignup from the database based on the provided onlineSignup ID, with
 * visibility filters applied to ensure the onlineSignup is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  onlineSignupCreate,
  onlineSignupUpdate,
} = require('#schemas/onlineSignup.schemas.js');
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

async function getAllOnlineSignup(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllOnlineSignup', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['owner', 'color', 'fields', 'source'];
    const filterFields = [...searchFields, 'emailconfirmed'];

    const include = {};

    // Log database operation start
    logDatabaseStart('get_all_online_signup', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: onlineSignupUpdate,
      filterFields,
      searchFields,
      model: 'onlineSignup',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values to all online signups
    if (response?.results) {
      response.results = response.results.map((onlineSignup) => ({
        ...onlineSignup,
        [DISPLAY_VALUE_PROP]: computeDisplayValue(onlineSignup, 'OnlineSignup'),
      }));
    }

    // Log database operation success
    logDatabaseSuccess('get_all_online_signup', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllOnlineSignup', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllOnlineSignup', req, error);
    throw handleDatabaseError(error, 'get_all_online_signup');
  }
}

async function createOnlineSignup(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createOnlineSignup', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await onlineSignupCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createOnlineSignup', req, error);
        throw handleValidationError(error, 'online_signup_creation');
      }
      logOperationError('createOnlineSignup', req, error);
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
    logDatabaseStart('create_online_signup', req, {
      name: values.name,
      userId: user?.id,
    });

    const newOnlineSignup = await prisma.onlineSignup.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_online_signup', req, {
      id: newOnlineSignup.id,
      code: newOnlineSignup.code,
    });

    const [newOnlineSignupWithDetails] = await getDetailsFromAPI({
      results: [newOnlineSignup],
      token: user?.accessToken,
    });

    // Attach display value
    const onlineSignupWithDisplayValue = {
      ...newOnlineSignupWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        newOnlineSignupWithDetails,
        'OnlineSignup'
      ),
    };

    // Log operation success
    logOperationSuccess('createOnlineSignup', req, {
      id: newOnlineSignup.id,
      code: newOnlineSignup.code,
    });

    res.status(201).json(onlineSignupWithDisplayValue);
  } catch (error) {
    logOperationError('createOnlineSignup', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_online_signup');
  }
}

async function getOnlineSignup(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getOnlineSignup', req, {
    user: user?.id,
    onlineSignupId: params?.id,
  });

  try {
    const include = {};

    // Log database operation start
    logDatabaseStart('get_online_signup', req, {
      onlineSignupId: params?.id,
      userId: user?.id,
    });

    const foundOnlineSignup = await prisma.onlineSignup.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_online_signup', req, {
      found: !!foundOnlineSignup,
      onlineSignupId: params?.id,
    });

    if (!foundOnlineSignup) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OnlineSignup not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_online_signup',
          details: { onlineSignupId: params?.id },
        }
      );
      logOperationError('getOnlineSignup', req, error);
      throw error;
    }

    const [foundOnlineSignupWithDetails] = await getDetailsFromAPI({
      results: [foundOnlineSignup],
      token: user?.accessToken,
    });

    // Attach display value
    const onlineSignupWithDisplayValue = {
      ...foundOnlineSignupWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        foundOnlineSignupWithDetails,
        'OnlineSignup'
      ),
    };

    // Log operation success
    logOperationSuccess('getOnlineSignup', req, {
      id: foundOnlineSignup.id,
      code: foundOnlineSignup.code,
    });

    res.status(200).json(onlineSignupWithDisplayValue);
  } catch (error) {
    logOperationError('getOnlineSignup', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_online_signup');
  }
}

async function updateOnlineSignup(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateOnlineSignup', req, {
    onlineSignupId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await onlineSignupUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateOnlineSignup', req, error);
        throw handleValidationError(error, 'online_signup_update');
      }
      logOperationError('updateOnlineSignup', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Guard: fetch current in visibility scope
    const current = await prisma.onlineSignup.findFirst({
      where: {
        id: params?.id,
        AND: [getVisibilityFilters(user, { includeGlobal: true })],
      },
      select: { id: true },
    });
    if (!current) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OnlineSignup not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_online_signup_guard',
          details: { onlineSignupId: params?.id },
        }
      );
      throw error;
    }

    // Log database operation start
    logDatabaseStart('update_online_signup', req, {
      onlineSignupId: params?.id,
      updateFields: Object.keys(values),
    });

    const updatedOnlineSignup = await prisma.onlineSignup.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('update_online_signup', req, {
      id: updatedOnlineSignup.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateOnlineSignup', req, {
      id: updatedOnlineSignup.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(updatedOnlineSignup);
  } catch (error) {
    logOperationError('updateOnlineSignup', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_online_signup');
  }
}

async function deleteOnlineSignup(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteOnlineSignup', req, {
    user: user?.id,
    onlineSignupId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('delete_online_signup', req, {
      onlineSignupId: params?.id,
      userId: user?.id,
    });

    // Strict tenant scope for soft delete
    const result = await prisma.onlineSignup.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_online_signup', req, {
      deletedCount: result.count,
      onlineSignupId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OnlineSignup not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_online_signup',
          details: { onlineSignupId: params?.id },
        }
      );
      logOperationError('deleteOnlineSignup', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteOnlineSignup', req, {
      deletedCount: result.count,
      onlineSignupId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteOnlineSignup', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_online_signup');
  }
}

async function getOnlineSignupBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for onlineSignup',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllOnlineSignup,
  createOnlineSignup,
  getOnlineSignup,
  updateOnlineSignup,
  deleteOnlineSignup,
  getOnlineSignupBarChartData,
};
