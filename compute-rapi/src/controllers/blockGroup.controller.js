/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing blockGroups using Prisma.
 * It includes functions for retrieving all blockGroups, creating a new blockGroup, retrieving a single blockGroup,
 * updating an existing blockGroup, and deleting a blockGroup.
 *
 * The `getAllBlockGroups` function retrieves a paginated list of blockGroups based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createBlockGroup` function validates the request body using a Joi schema, generates a unique code
 * for the blockGroup, and creates a new blockGroup in the database with additional metadata.
 *
 * The `getBlockGroup` function retrieves a single blockGroup based on the provided blockGroup ID, with visibility
 * filters applied to ensure the blockGroup is accessible to the requesting user.
 *
 * The `updateBlockGroup` function updates an existing blockGroup in the database based on the provided blockGroup ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteBlockGroup` function deletes a blockGroup from the database based on the provided blockGroup ID, with
 * visibility filters applied to ensure the blockGroup is deletable by the requesting user.
 *
 *
 * REVISION 1:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 20/02/2024
 * REVISION REASON: Add Standard File Header Comments
 *
 * REVISION 2:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 21/02/2024
 * REVISION REASON: Convert ESM to CJS
 *
 * REVISION 3:
 * REVISED BY: Assistant
 * REVISION DATE: 2025-01-27
 * REVISION REASON: Implement error handling and trace ID conventions
 */

const prisma = require('#configs/prisma.js');
const {
  blockGroupCreate,
  blockGroupUpdate,
} = require('#schemas/blockGroup.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const { getPaginatedList } = require('#utils/shared/databaseUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/shared/traceUtils.js');

async function getAllBlockGroups(req, res) {
  const { user, query } = req;

  logOperationStart('getAllBlockGroups', req, {
    user: user.id,
    queryKeys: Object.keys(query),
  });

  try {
    const searchFields = ['name', 'description', 'tags'];
    const filterFields = [...searchFields, 'order'];

    logDatabaseStart('get_all_block_groups', req, {
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: blockGroupUpdate,
      filterFields,
      searchFields,
      model: 'blockGroup',
      include: {
        blocks: true,
      },
    });

    logDatabaseSuccess('get_all_block_groups', req, {
      count: response.data?.length || 0,
    });

    logOperationSuccess('getAllBlockGroups', req, {
      count: response.data?.length || 0,
    });
    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllBlockGroups', req, error);
    throw error;
  }
}

async function createBlockGroup(req, res) {
  const { user, body } = req;

  logOperationStart('createBlockGroup', req, {
    user: user.id,
    bodyKeys: Object.keys(body),
  });

  try {
    const values = await blockGroupCreate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });

    logDatabaseStart('create_block_group', req, { name: values.name });

    const blockGroup = await prisma.blockGroup.create({
      data: buildCreateRecordPayload({
        validatedValues: values,
        requestBody: body,
        user,
      }),
    });

    logDatabaseSuccess('create_block_group', req, { id: blockGroup.id });

    logOperationSuccess('createBlockGroup', req, { id: blockGroup.id });
    res.status(201).json(blockGroup);
  } catch (error) {
    logOperationError('createBlockGroup', req, error);

    if (error.isJoi) {
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'BlockGroup validation failed',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'block_group_validation',
          details: { validationErrors: error.details },
        }
      );
    }
    throw error;
  }
}

async function getBlockGroup(req, res) {
  const { params, user } = req;

  logOperationStart('getBlockGroup', req, {
    user: user.id,
    blockGroupId: params?.id,
  });

  try {
    logDatabaseStart('get_block_group', req, { id: params?.id });

    const blockGroup = await prisma.blockGroup.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
    });

    if (!blockGroup) {
      throw createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'BlockGroup not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_block_group',
          details: { blockGroupId: params?.id },
        }
      );
    }

    logDatabaseSuccess('get_block_group', req, { id: blockGroup.id });

    logOperationSuccess('getBlockGroup', req, { id: blockGroup.id });
    res.status(200).json(blockGroup);
  } catch (error) {
    logOperationError('getBlockGroup', req, error);
    throw error;
  }
}

async function updateBlockGroup(req, res) {
  const { params, body } = req;

  logOperationStart('updateBlockGroup', req, {
    blockGroupId: params?.id,
    bodyKeys: Object.keys(body),
  });

  try {
    const values = await blockGroupUpdate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });

    logDatabaseStart('update_block_group', req, {
      id: params?.id,
      updateFields: Object.keys(values),
    });

    const updated = await prisma.blockGroup.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
      },
    });

    logDatabaseSuccess('update_block_group', req, { id: updated.id });

    logOperationSuccess('updateBlockGroup', req, { id: updated.id });
    res.status(200).json(updated);
  } catch (error) {
    logOperationError('updateBlockGroup', req, error);

    if (error.isJoi) {
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'BlockGroup update validation failed',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'block_group_update_validation',
          details: { validationErrors: error.details },
        }
      );
    }
    throw error;
  }
}

async function deleteBlockGroup(req, res) {
  const { params, user } = req;

  logOperationStart('deleteBlockGroup', req, {
    user: user.id,
    blockGroupId: params?.id,
  });

  try {
    logDatabaseStart('delete_block_group', req, { id: params?.id });

    await prisma.blockGroup.deleteMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });

    logDatabaseStart('delete_blocks_by_group', req, { groupId: params?.id });

    await prisma.block.deleteMany({
      where: { groupId: params?.id, ...getVisibilityFilters(user) },
    });

    logDatabaseSuccess('delete_block_group_and_blocks', req, {
      deletedGroupId: params?.id,
    });

    logOperationSuccess('deleteBlockGroup', req, { deletedId: params?.id });
    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteBlockGroup', req, error);
    throw error;
  }
}

module.exports = {
  getAllBlockGroups,
  createBlockGroup,
  getBlockGroup,
  updateBlockGroup,
  deleteBlockGroup,
};
