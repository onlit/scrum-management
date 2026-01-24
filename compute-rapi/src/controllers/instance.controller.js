/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing instances in a database using Prisma.
 * It includes functions for retrieving all instances, creating a new instance, retrieving
 * a single instance, updating an existing instance, and deleting an instance.
 *
 * The `getAllInstances` function retrieves a paginated list of instances based on query
 * parameters such as search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createInstance` function validates the request body using a Joi schema and creates a new
 * instance in the database with additional metadata.
 *
 * The `getInstance` function retrieves a single instance based on the provided instance ID,
 * with visibility filters applied to ensure the instance is accessible to the requesting user.
 *
 * The `updateInstance` function updates an existing instance in the database based on the provided
 * instance ID and request body.
 *
 * The `deleteInstance` function deletes an instance from the database based on the provided instance
 * ID, along with its associated instance logs, with visibility filters applied to ensure the instance
 * is deletable by the requesting user.
 *
 *
 * REVISION 1:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 20/02/2024
 * REVISION REASON: Add Standard File Header Comments
 */

const prisma = require('#configs/prisma.js');
const {
  instanceCreate,
  instanceUpdate,
} = require('#schemas/instance.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const { createStandardError } = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES } = require('#configs/constants.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
  withTraceLogging,
} = require('#utils/shared/traceUtils.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const { getPaginatedList } = require('#utils/shared/databaseUtils.js');

async function getAllInstances(req, res) {
  const { user, query } = req;
  logOperationStart('getAllInstances', req, { user: user?.id });
  try {
    const searchFields = ['status', 'tags'];
    const filterFields = [...searchFields, 'microserviceId'];
    logDatabaseStart('get_paginated_list', req, { model: 'instance' });
    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: instanceUpdate,
      filterFields,
      searchFields,
      model: 'instance',
    });
    logDatabaseSuccess('get_paginated_list', req);
    logOperationSuccess('getAllInstances', req);
    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllInstances', req, error);
    throw error.type && Object.values(ERROR_TYPES).includes(error.type)
      ? error
      : createErrorWithTrace(ERROR_TYPES.INTERNAL, error.message, req, { context: 'get_all_instances', originalError: error });
  }
}

async function createInstance(req, res) {
  const { user, body } = req;
  logOperationStart('createInstance', req, { user: user?.id });
  try {
    let values;
    try {
      values = await instanceCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      logOperationError('createInstance', req, error);
      throw createErrorWithTrace(ERROR_TYPES.VALIDATION, 'Input validation failed', req, { context: 'create_instance_validation', originalError: error });
    }
    logDatabaseStart('create_instance', req);
    const instance = await prisma.instance.create({
      data: buildCreateRecordPayload({
        validatedValues: values,
        requestBody: body,
        user,
      }),
    });
    logDatabaseSuccess('create_instance', req, { id: instance.id });
    logOperationSuccess('createInstance', req, { id: instance.id });
    res.status(201).json(instance);
  } catch (error) {
    logOperationError('createInstance', req, error);
    throw error.type && Object.values(ERROR_TYPES).includes(error.type)
      ? error
      : createErrorWithTrace(ERROR_TYPES.INTERNAL, error.message, req, { context: 'create_instance', originalError: error });
  }
}

async function getInstance(req, res) {
  const { params, user } = req;
  logOperationStart('getInstance', req, { user: user?.id, instanceId: params?.id });
  try {
    logDatabaseStart('get_instance', req, { instanceId: params?.id });
    const instance = await prisma.instance.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
    });
    logDatabaseSuccess('get_instance', req, { found: !!instance });
    if (!instance) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Instance not found',
        req,
        { context: 'get_instance' }
      );
      logOperationError('getInstance', req, error);
      throw error;
    }
    logOperationSuccess('getInstance', req, { id: instance.id });
    res.status(200).json(instance);
  } catch (error) {
    logOperationError('getInstance', req, error);
    throw error.type && Object.values(ERROR_TYPES).includes(error.type)
      ? error
      : createErrorWithTrace(ERROR_TYPES.INTERNAL, error.message, req, { context: 'get_instance', originalError: error });
  }
}

async function updateInstance(req, res) {
  const { params, body } = req;
  logOperationStart('updateInstance', req, { instanceId: params?.id });
  try {
    let values;
    try {
      values = await instanceUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      logOperationError('updateInstance', req, error);
      throw createErrorWithTrace(ERROR_TYPES.VALIDATION, 'Input validation failed', req, { context: 'update_instance_validation', originalError: error });
    }
    logDatabaseStart('update_instance', req, { instanceId: params?.id });
    const updated = await prisma.instance.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
      },
    });
    logDatabaseSuccess('update_instance', req, { id: updated.id });
    logOperationSuccess('updateInstance', req, { id: updated.id });
    res.status(200).json(updated);
  } catch (error) {
    logOperationError('updateInstance', req, error);
    throw error.type && Object.values(ERROR_TYPES).includes(error.type)
      ? error
      : createErrorWithTrace(ERROR_TYPES.INTERNAL, error.message, req, { context: 'update_instance', originalError: error });
  }
}

async function deleteInstance(req, res) {
  const { params, user } = req;
  logOperationStart('deleteInstance', req, { user: user?.id, instanceId: params?.id });
  try {
    logDatabaseStart('delete_instance', req, { instanceId: params?.id });
    await prisma.instance.deleteMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });
    logDatabaseSuccess('delete_instance', req, { instanceId: params?.id });
    logDatabaseStart('delete_instance_logs', req, { instanceId: params?.id });
    await prisma.instanceLog.deleteMany({
      where: { instanceId: params?.id, ...getVisibilityFilters(user) },
    });
    logDatabaseSuccess('delete_instance_logs', req, { instanceId: params?.id });
    logOperationSuccess('deleteInstance', req, { deleted: params?.id });
    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteInstance', req, error);
    throw error.type && Object.values(ERROR_TYPES).includes(error.type)
      ? error
      : createErrorWithTrace(ERROR_TYPES.INTERNAL, error.message, req, { context: 'delete_instance', originalError: error });
  }
}

module.exports = {
  getAllInstances: withTraceLogging(getAllInstances, 'getAllInstances'),
  createInstance: withTraceLogging(createInstance, 'createInstance'),
  getInstance: withTraceLogging(getInstance, 'getInstance'),
  updateInstance: withTraceLogging(updateInstance, 'updateInstance'),
  deleteInstance: withTraceLogging(deleteInstance, 'deleteInstance'),
};
