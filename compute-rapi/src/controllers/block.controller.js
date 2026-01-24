/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing blocks using Prisma.
 * It includes functions for retrieving all blocks, creating a new block, retrieving a single block,
 * updating an existing block, and deleting a block.
 *
 * The `getAllBlocks` function retrieves a paginated list of blocks based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createBlock` function validates the request body using a Joi schema, generates a unique code
 * for the block, and creates a new block in the database with additional metadata.
 *
 * The `getBlock` function retrieves a single block based on the provided block ID, with visibility
 * filters applied to ensure the block is accessible to the requesting user.
 *
 * The `updateBlock` function updates an existing block in the database based on the provided block ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteBlock` function deletes a block from the database based on the provided block ID, with
 * visibility filters applied to ensure the block is deletable by the requesting user.
 *
 *
 * REVISION 1:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 20/02/2024
 * REVISION REASON: Add Standard File Header Comments
 *
 *
 * REVISION 2:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 21/02/2024
 * REVISION REASON: Convert ESM to CJS
 *
 *
 * REVISION 3:
 * REVISED BY: AI Assistant
 * REVISION DATE: 2025-01-27
 * REVISION REASON: Implement standardized error handling and trace ID conventions
 */

const prisma = require('#configs/prisma.js');
const { blockCreate, blockUpdate } = require('#schemas/block.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const { getPaginatedList } = require('#utils/shared/databaseUtils.js');
const { generateUniqueCode } = require('#utils/shared/stringUtils.js');
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

async function getAllBlocks(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllBlocks', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['code', 'name', 'description', 'tags'];
    const filterFields = [...searchFields, 'order', 'groupId'];

    // Log database operation start
    logDatabaseStart('get_all_blocks', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: blockUpdate,
      filterFields,
      searchFields,
      model: 'block',
    });

    // Log database operation success
    logDatabaseSuccess('get_all_blocks', req, {
      count: response?.data?.length || 0,
      total: response?.pagination?.total || 0,
    });

    // Log operation success
    logOperationSuccess('getAllBlocks', req, {
      count: response?.data?.length || 0,
      total: response?.pagination?.total || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllBlocks', req, error);
    throw handleDatabaseError(error, 'get_all_blocks');
  }
}

async function createBlock(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createBlock', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await blockCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createBlock', req, error);
        throw handleValidationError(error, 'block_creation');
      }
      logOperationError('createBlock', req, error);
      throw error;
    }

    // Generate unique code
    const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_block', req, {
      name: values.name,
      code,
      userId: user?.id,
    });

    const block = await prisma.block.create({
      data: buildCreateRecordPayload({
        validatedValues: { ...values, code },
        requestBody: body,
        user,
      }),
    });

    // Log database operation success
    logDatabaseSuccess('create_block', req, {
      id: block.id,
      code: block.code,
    });

    // Log operation success
    logOperationSuccess('createBlock', req, {
      id: block.id,
      code: block.code,
    });

    res.status(201).json(block);
  } catch (error) {
    logOperationError('createBlock', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_block');
  }
}

async function getBlock(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getBlock', req, {
    user: user?.id,
    blockId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('get_block', req, {
      blockId: params?.id,
      userId: user?.id,
    });

    const block = await prisma.block.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
    });

    // Log database operation success
    logDatabaseSuccess('get_block', req, {
      found: !!block,
      blockId: params?.id,
    });

    if (!block) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Block not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_block',
          details: { blockId: params?.id },
        }
      );
      logOperationError('getBlock', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('getBlock', req, {
      id: block.id,
      code: block.code,
    });

    res.status(200).json(block);
  } catch (error) {
    logOperationError('getBlock', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_block');
  }
}

async function updateBlock(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateBlock', req, {
    blockId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await blockUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateBlock', req, error);
        throw handleValidationError(error, 'block_update');
      }
      logOperationError('updateBlock', req, error);
      throw error;
    }

    // Log database operation start
    logDatabaseStart('update_block', req, {
      blockId: params?.id,
      updateFields: Object.keys(values),
    });

    const updated = await prisma.block.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('update_block', req, {
      id: updated.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateBlock', req, {
      id: updated.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(updated);
  } catch (error) {
    logOperationError('updateBlock', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_block');
  }
}

async function deleteBlock(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteBlock', req, {
    user: user?.id,
    blockId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('delete_block', req, {
      blockId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.block.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_block', req, {
      deletedCount: result.count,
      blockId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Block not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_block',
          details: { blockId: params?.id },
        }
      );
      logOperationError('deleteBlock', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteBlock', req, {
      deletedCount: result.count,
      blockId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteBlock', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_block');
  }
}

module.exports = {
  getAllBlocks,
  createBlock,
  getBlock,
  updateBlock,
  deleteBlock,
};
