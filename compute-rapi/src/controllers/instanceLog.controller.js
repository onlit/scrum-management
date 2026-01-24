/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing instance logs in a database using Prisma.
 * It includes functions for retrieving all instance logs, creating a new instance log, retrieving
 * a single instance log, updating an existing instance log, and deleting an instance log.
 *
 * The `getAllInstanceLogs` function retrieves a paginated list of instance logs based on query
 * parameters such as search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createInstanceLog` function validates the request body using a Joi schema and creates a new
 * instance log in the database with additional metadata.
 *
 * The `getInstanceLog` function retrieves a single instance log based on the provided instance log ID,
 * with visibility filters applied to ensure the instance log is accessible to the requesting user.
 *
 * The `updateInstanceLog` function updates an existing instance log in the database based on the provided
 * instance log ID and request body.
 *
 * The `deleteInstanceLog` function deletes an instance log from the database based on the provided instance
 * log ID, with visibility filters applied to ensure the instance log is deletable by the requesting user.
 *
 *
 * REVISION 1:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 20/02/2024
 * REVISION REASON: Add Standard File Header Comments
 */

const prisma = require('#configs/prisma.js');
const {
  instanceLogCreate,
  instanceLogUpdate,
} = require('#schemas/instanceLog.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const { createStandardError } = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES } = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const { getPaginatedList } = require('#utils/shared/databaseUtils.js');
const {
  getTraceId,
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/shared/traceUtils.js');

async function getAllInstanceLogs(req, res) {
  logOperationStart('getAllInstanceLogs', req, { user: req.user?.id, query: req.query });
  try {
    const { user, query } = req;
    const searchFields = ['status', 'message', 'tags'];
    const filterFields = [...searchFields, 'instanceId', 'blockId'];
    logDatabaseStart('get_paginated_instance_logs', req, { filterFields, searchFields });
    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: instanceLogUpdate,
      filterFields,
      searchFields,
      model: 'instanceLog',
      include: {
        block: true,
      },
    });
    logDatabaseSuccess('get_paginated_instance_logs', req, { count: response.data?.length });
    logOperationSuccess('getAllInstanceLogs', req, { count: response.data?.length });
    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllInstanceLogs', req, error);
    throw createErrorWithTrace(
      error.type || ERROR_TYPES.INTERNAL,
      error.message || 'Failed to get instance logs',
      req,
      { context: 'get_all_instance_logs', originalError: error }
    );
  }
}

async function createInstanceLog(req, res) {
  logOperationStart('createInstanceLog', req, { user: req.user?.id, bodyKeys: Object.keys(req.body || {}) });
  try {
    const { user, body } = req;
    let values;
    try {
      values = await instanceLogCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      logOperationError('createInstanceLog', req, error);
      throw createErrorWithTrace(ERROR_TYPES.VALIDATION, 'Input validation failed', req, { context: 'create_instance_log_validation', originalError: error });
    }
    logDatabaseStart('create_instance_log', req, { values });
    const instanceLog = await prisma.instanceLog.create({
      data: buildCreateRecordPayload({
        validatedValues: values,
        requestBody: body,
        user,
      }),
    });
    logDatabaseSuccess('create_instance_log', req, { id: instanceLog.id });
    logOperationSuccess('createInstanceLog', req, { id: instanceLog.id });
    res.status(201).json(instanceLog);
  } catch (error) {
    logOperationError('createInstanceLog', req, error);
    throw createErrorWithTrace(
      error.type || ERROR_TYPES.INTERNAL,
      error.message || 'Failed to create instance log',
      req,
      { context: 'create_instance_log', originalError: error }
    );
  }
}

async function getInstanceLog(req, res) {
  logOperationStart('getInstanceLog', req, { instanceLogId: req.params?.id, user: req.user?.id });
  try {
    const { params, user } = req;
    logDatabaseStart('find_instance_log', req, { instanceLogId: params?.id });
    const instanceLog = await prisma.instanceLog.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
    });
    logDatabaseSuccess('find_instance_log', req, { found: !!instanceLog });
    if (!instanceLog) {
      throw createErrorWithTrace(ERROR_TYPES.NOT_FOUND, 'InstanceLog not found', req, { context: 'get_instance_log' });
    }
    logOperationSuccess('getInstanceLog', req, { id: instanceLog.id });
    res.status(200).json(instanceLog);
  } catch (error) {
    logOperationError('getInstanceLog', req, error);
    throw createErrorWithTrace(
      error.type || ERROR_TYPES.INTERNAL,
      error.message || 'Failed to get instance log',
      req,
      { context: 'get_instance_log', originalError: error }
    );
  }
}

async function updateInstanceLog(req, res) {
  logOperationStart('updateInstanceLog', req, { instanceLogId: req.params?.id, bodyKeys: Object.keys(req.body || {}) });
  try {
    const { params, body } = req;
    let values;
    try {
      values = await instanceLogUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      logOperationError('updateInstanceLog', req, error);
      throw createErrorWithTrace(ERROR_TYPES.VALIDATION, 'Input validation failed', req, { context: 'update_instance_log_validation', originalError: error });
    }
    logDatabaseStart('update_instance_log', req, { instanceLogId: params?.id, values });
    const updated = await prisma.instanceLog.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
      },
    });
    logDatabaseSuccess('update_instance_log', req, { id: updated.id });
    logOperationSuccess('updateInstanceLog', req, { id: updated.id });
    res.status(200).json(updated);
  } catch (error) {
    logOperationError('updateInstanceLog', req, error);
    throw createErrorWithTrace(
      error.type || ERROR_TYPES.INTERNAL,
      error.message || 'Failed to update instance log',
      req,
      { context: 'update_instance_log', originalError: error }
    );
  }
}

async function deleteInstanceLog(req, res) {
  logOperationStart('deleteInstanceLog', req, { instanceLogId: req.params?.id, user: req.user?.id });
  try {
    const { params, user } = req;
    logDatabaseStart('delete_instance_log', req, { instanceLogId: params?.id });
    await prisma.instanceLog.deleteMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });
    logDatabaseSuccess('delete_instance_log', req, { deletedId: params?.id });
    logOperationSuccess('deleteInstanceLog', req, { deletedId: params?.id });
    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteInstanceLog', req, error);
    throw createErrorWithTrace(
      error.type || ERROR_TYPES.INTERNAL,
      error.message || 'Failed to delete instance log',
      req,
      { context: 'delete_instance_log', originalError: error }
    );
  }
}

module.exports = {
  getAllInstanceLogs,
  createInstanceLog,
  getInstanceLog,
  updateInstanceLog,
  deleteInstanceLog,
};
