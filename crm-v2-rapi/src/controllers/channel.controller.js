/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing channel using Prisma.
 * It includes functions for retrieving all channel, creating a new channel, retrieving a single channel,
 * updating an existing channel, and deleting a channel.
 *
 * The `getAllChannel` function retrieves a paginated list of channel based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createChannel` function validates the request body using a Joi schema, generates a unique code
 * for the channel, and creates a new channel in the database with additional metadata.
 *
 * The `getChannel` function retrieves a single channel based on the provided channel ID, with visibility
 * filters applied to ensure the channel is accessible to the requesting user.
 *
 * The `updateChannel` function updates an existing channel in the database based on the provided channel ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteChannel` function deletes a channel from the database based on the provided channel ID, with
 * visibility filters applied to ensure the channel is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const { channelCreate, channelUpdate } = require('#schemas/channel.schemas.js');
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

async function getAllChannel(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllChannel', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['color', 'description', 'name'];
    const filterFields = [...searchFields];

    const include = {};

    // Log database operation start
    logDatabaseStart('get_all_channel', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: channelUpdate,
      filterFields,
      searchFields,
      model: 'channel',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values
    if (response?.results) {
      response.results = response.results.map((channel) => ({
        ...channel,
        [DISPLAY_VALUE_PROP]: computeDisplayValue(channel, 'Channel'),
      }));
    }

    // Log database operation success
    logDatabaseSuccess('get_all_channel', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllChannel', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllChannel', req, error);
    throw handleDatabaseError(error, 'get_all_channel');
  }
}

async function createChannel(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createChannel', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await channelCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createChannel', req, error);
        throw handleValidationError(error, 'channel_creation');
      }
      logOperationError('createChannel', req, error);
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
    logDatabaseStart('create_channel', req, {
      name: values.name,
      userId: user?.id,
    });

    const newChannel = await prisma.channel.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_channel', req, {
      id: newChannel.id,
      code: newChannel.code,
    });

    const [newChannelWithDetails] = await getDetailsFromAPI({
      results: [newChannel],
      token: user?.accessToken,
    });

    // Attach display value
    const channelWithDisplayValue = {
      ...newChannelWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        newChannelWithDetails,
        'Channel'
      ),
    };

    // Log operation success
    logOperationSuccess('createChannel', req, {
      id: newChannel.id,
      code: newChannel.code,
    });

    res.status(201).json(channelWithDisplayValue);
  } catch (error) {
    logOperationError('createChannel', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_channel');
  }
}

async function getChannel(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getChannel', req, {
    user: user?.id,
    channelId: params?.id,
  });

  try {
    const include = {};

    // Log database operation start
    logDatabaseStart('get_channel', req, {
      channelId: params?.id,
      userId: user?.id,
    });

    const foundChannel = await prisma.channel.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_channel', req, {
      found: !!foundChannel,
      channelId: params?.id,
    });

    if (!foundChannel) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Channel not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_channel',
          details: { channelId: params?.id },
        }
      );
      logOperationError('getChannel', req, error);
      throw error;
    }

    const [foundChannelWithDetails] = await getDetailsFromAPI({
      results: [foundChannel],
      token: user?.accessToken,
    });

    // Attach display value
    const channelWithDisplayValue = {
      ...foundChannelWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        foundChannelWithDetails,
        'Channel'
      ),
    };

    // Log operation success
    logOperationSuccess('getChannel', req, {
      id: foundChannel.id,
      code: foundChannel.code,
    });

    res.status(200).json(channelWithDisplayValue);
  } catch (error) {
    logOperationError('getChannel', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_channel');
  }
}

async function updateChannel(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateChannel', req, {
    channelId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await channelUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateChannel', req, error);
        throw handleValidationError(error, 'channel_update');
      }
      logOperationError('updateChannel', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Log database operation start
    logDatabaseStart('update_channel', req, {
      channelId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.channel.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Channel not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_channel',
          details: { channelId: params?.id },
        }
      );
      throw error;
    }

    const updatedChannel = await prisma.channel.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
    });

    // Log database operation success
    logDatabaseSuccess('update_channel', req, {
      id: updatedChannel.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateChannel', req, {
      id: updatedChannel.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(updatedChannel);
  } catch (error) {
    logOperationError('updateChannel', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_channel');
  }
}

async function deleteChannel(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteChannel', req, {
    user: user?.id,
    channelId: params?.id,
  });

  try {
    await prisma.opportunity.updateMany({
      where: { channelId: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_channel', req, {
      channelId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.channel.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_channel', req, {
      deletedCount: result.count,
      channelId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Channel not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_channel',
          details: { channelId: params?.id },
        }
      );
      logOperationError('deleteChannel', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteChannel', req, {
      deletedCount: result.count,
      channelId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteChannel', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_channel');
  }
}

async function getChannelBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for channel',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllChannel,
  createChannel,
  getChannel,
  updateChannel,
  deleteChannel,
  getChannelBarChartData,
};
