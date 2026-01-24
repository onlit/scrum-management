const prisma = require('#configs/prisma.js');
const {
  menuDefnCreate,
  menuDefnUpdate,
} = require('#schemas/menuDefn.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const {
  getPaginatedList,
  rebaseOrders,
} = require('#utils/shared/databaseUtils.js');
const { MODEL_DEFN_DETAIL } = require('#configs/constants.js');
const { createStandardError } = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES } = require('#configs/constants.js');
const {
  getTraceId,
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/shared/traceUtils.js');

async function getAllMenuDefns(req, res) {
  logOperationStart('getAllMenuDefns', req, { user: req.user?.id, query: req.query });
  try {
    const { user, query } = req;

    const searchFields = ['tags'];
    const filterFields = [
      ...searchFields,
      'order',
      'parentMenuId',
      'modelId',
      'microserviceId',
    ];

    logDatabaseStart('get_paginated_menu_defns', req, { filterFields, searchFields });
    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: menuDefnUpdate,
      filterFields,
      searchFields,
      model: 'menuDefn',
      include: {
        model: MODEL_DEFN_DETAIL,
        parentMenu: {
          include: {
            model: MODEL_DEFN_DETAIL,
          },
        },
      },
    });
    logDatabaseSuccess('get_paginated_menu_defns', req, { count: response.data?.length });
    logOperationSuccess('getAllMenuDefns', req, { count: response.data?.length });
    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllMenuDefns', req, error);
    throw createErrorWithTrace(
      error.type || ERROR_TYPES.INTERNAL,
      error.message || 'Failed to get menu definitions',
      req,
      { context: 'get_all_menu_defns', originalError: error }
    );
  }
}

async function createMenuDefn(req, res) {
  logOperationStart('createMenuDefn', req, { user: req.user?.id, bodyKeys: Object.keys(req.body || {}) });
  try {
    const { user, body } = req;
    let values;
    try {
      values = await menuDefnCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      logOperationError('createMenuDefn', req, error);
      throw createErrorWithTrace(ERROR_TYPES.VALIDATION, 'Input validation failed', req, { context: 'create_menu_defn_validation', originalError: error });
    }

    if (values?.modelId === values?.parentMenuId) {
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'The model ID cannot be the same as the parent menu ID.',
        req,
        { context: 'create_menu_defn_model_parent_check' }
      );
    }

    logDatabaseStart('check_existing_menu_defn', req, { modelId: values?.modelId, microserviceId: values?.microserviceId });
    const existingMenu = await prisma.menuDefn.findFirst({
      where: {
        modelId: values?.modelId,
        microserviceId: values?.microserviceId,
        ...getVisibilityFilters(user),
      },
    });

    if (existingMenu) {
      throw createErrorWithTrace(
        ERROR_TYPES.CONFLICT,
        'A menu with the same model already exists.',
        req,
        { context: 'create_menu_defn_duplicate_check' }
      );
    }

    // Check if `order` already exists
    logDatabaseStart('check_existing_menu_order', req, { order: values?.order, microserviceId: values?.microserviceId });
    const existingOrder = await prisma.menuDefn.findFirst({
      where: {
        order: values?.order,
        microserviceId: values?.microserviceId,
      },
    });

    if (existingOrder) {
      // Rebase orders for the menuDefn model
      await rebaseOrders({
        modelName: 'menuDefn',
        conditions: { microserviceId: values?.microserviceId },
        order: values?.order,
      });
    }

    logDatabaseStart('create_menu_defn', req, { values });
    const menuDefn = await prisma.menuDefn.create({
      data: buildCreateRecordPayload({
        validatedValues: values,
        requestBody: body,
        user,
      }),
    });
    logDatabaseSuccess('create_menu_defn', req, { id: menuDefn.id });
    logOperationSuccess('createMenuDefn', req, { id: menuDefn.id });
    res.status(201).json(menuDefn);
  } catch (error) {
    logOperationError('createMenuDefn', req, error);
    throw createErrorWithTrace(
      error.type || ERROR_TYPES.INTERNAL,
      error.message || 'Failed to create menu definition',
      req,
      { context: 'create_menu_defn', originalError: error }
    );
  }
}

async function getMenuDefn(req, res) {
  logOperationStart('getMenuDefn', req, { menuDefnId: req.params?.id, user: req.user?.id });
  try {
    const { params, user } = req;

    logDatabaseStart('find_menu_defn', req, { menuDefnId: params?.id });
    const menuDefn = await prisma.menuDefn.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: {
        model: MODEL_DEFN_DETAIL,
        parentMenu: {
          include: {
            model: MODEL_DEFN_DETAIL,
          },
        },
      },
    });
    logDatabaseSuccess('find_menu_defn', req, { found: !!menuDefn });
    if (!menuDefn) {
      throw createErrorWithTrace(ERROR_TYPES.NOT_FOUND, 'MenuDefn not found', req, { context: 'get_menu_defn' });
    }
    logOperationSuccess('getMenuDefn', req, { id: menuDefn.id });
    res.status(200).json(menuDefn);
  } catch (error) {
    logOperationError('getMenuDefn', req, error);
    throw createErrorWithTrace(
      error.type || ERROR_TYPES.INTERNAL,
      error.message || 'Failed to get menu definition',
      req,
      { context: 'get_menu_defn', originalError: error }
    );
  }
}

async function updateMenuDefn(req, res) {
  logOperationStart('updateMenuDefn', req, { menuDefnId: req.params?.id, bodyKeys: Object.keys(req.body || {}) });
  try {
    const { params, body } = req;
    let values;
    try {
      values = await menuDefnUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      logOperationError('updateMenuDefn', req, error);
      throw createErrorWithTrace(ERROR_TYPES.VALIDATION, 'Input validation failed', req, { context: 'update_menu_defn_validation', originalError: error });
    }

    logDatabaseStart('find_menu_defn', req, { menuDefnId: params?.id });
    const found = await prisma.menuDefn.findFirst({
      where: { id: params?.id },
    });

    if (
      found?.modelId === values?.parentMenuId ||
      found?.parentMenuId === values?.modelId
    ) {
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'The model ID cannot be the same as the parent menu ID.',
        req,
        { context: 'update_menu_defn_model_parent_check' }
      );
    }

    // Check if `order` is changing and if it already exists
    if (values?.order !== found?.order) {
      logDatabaseStart('check_existing_menu_order', req, { order: values?.order, microserviceId: found?.microserviceId });
      const existingOrder = await prisma.menuDefn.findFirst({
        where: {
          order: values?.order,
          microserviceId: found?.microserviceId,
        },
      });

      if (existingOrder) {
        // Rebase orders for the menuDefn model
        await rebaseOrders({
          modelName: 'menuDefn',
          conditions: { microserviceId: found?.microserviceId },
          order: values?.order,
        });
      }
    }

    logDatabaseStart('update_menu_defn', req, { menuDefnId: params?.id, values });
    const updated = await prisma.menuDefn.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
      },
    });
    logDatabaseSuccess('update_menu_defn', req, { id: updated.id });
    logOperationSuccess('updateMenuDefn', req, { id: updated.id });
    res.status(200).json(updated);
  } catch (error) {
    logOperationError('updateMenuDefn', req, error);
    throw createErrorWithTrace(
      error.type || ERROR_TYPES.INTERNAL,
      error.message || 'Failed to update menu definition',
      req,
      { context: 'update_menu_defn', originalError: error }
    );
  }
}

async function deleteMenuDefn(req, res) {
  logOperationStart('deleteMenuDefn', req, { menuDefnId: req.params?.id, user: req.user?.id });
  try {
    const { params, user } = req;

    logDatabaseStart('delete_menu_defn', req, { menuDefnId: params?.id });
    await prisma.menuDefn.deleteMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });

    await prisma.menuDefn.deleteMany({
      where: { parentMenuId: params?.id, ...getVisibilityFilters(user) },
    });
    logDatabaseSuccess('delete_menu_defn', req, { deletedId: params?.id });
    logOperationSuccess('deleteMenuDefn', req, { deletedId: params?.id });
    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteMenuDefn', req, error);
    throw createErrorWithTrace(
      error.type || ERROR_TYPES.INTERNAL,
      error.message || 'Failed to delete menu definition',
      req,
      { context: 'delete_menu_defn', originalError: error }
    );
  }
}

module.exports = {
  getAllMenuDefns,
  createMenuDefn,
  getMenuDefn,
  updateMenuDefn,
  deleteMenuDefn,
};
