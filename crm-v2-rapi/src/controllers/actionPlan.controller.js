/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing actionPlan using Prisma.
 * It includes functions for retrieving all actionPlan, creating a new actionPlan, retrieving a single actionPlan,
 * updating an existing actionPlan, and deleting a actionPlan.
 *
 * The `getAllActionPlan` function retrieves a paginated list of actionPlan based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createActionPlan` function validates the request body using a Joi schema, generates a unique code
 * for the actionPlan, and creates a new actionPlan in the database with additional metadata.
 *
 * The `getActionPlan` function retrieves a single actionPlan based on the provided actionPlan ID, with visibility
 * filters applied to ensure the actionPlan is accessible to the requesting user.
 *
 * The `updateActionPlan` function updates an existing actionPlan in the database based on the provided actionPlan ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteActionPlan` function deletes a actionPlan from the database based on the provided actionPlan ID, with
 * visibility filters applied to ensure the actionPlan is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  actionPlanCreate,
  actionPlanUpdate,
} = require('#schemas/actionPlan.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
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
const {
  enrichRecordDisplayValues,
} = require('#utils/shared/displayValueUtils.js');

async function getAllActionPlan(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllActionPlan', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['who', 'what', 'color'];
    const filterFields = [...searchFields, 'opportunityId', 'when'];

    const include = {
      opportunity: true,
    };

    // Log database operation start
    logDatabaseStart('get_all_action_plan', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: actionPlanUpdate,
      filterFields,
      searchFields,
      model: 'actionPlan',
      include: Object.keys(include).length ? include : undefined,
    });

    if (Array.isArray(response?.results)) {
      response.results = response.results.map((actionPlan) =>
        enrichRecordDisplayValues(actionPlan, 'ActionPlan')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_action_plan', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllActionPlan', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllActionPlan', req, error);
    throw handleDatabaseError(error, 'get_all_action_plan');
  }
}

async function createActionPlan(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createActionPlan', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await actionPlanCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createActionPlan', req, error);
        throw handleValidationError(error, 'action_plan_creation');
      }
      logOperationError('createActionPlan', req, error);
      throw error;
    }

    const modelRelationFields = ['opportunityId'];

    const include = {
      opportunity: true,
    };

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_action_plan', req, {
      name: values.name,
      userId: user?.id,
    });

    const newActionPlan = await prisma.actionPlan.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_action_plan', req, {
      id: newActionPlan.id,
      code: newActionPlan.code,
    });

    const [newActionPlanWithDetails] = await getDetailsFromAPI({
      results: [newActionPlan],
      token: user?.accessToken,
    });

    // Log operation success
    logOperationSuccess('createActionPlan', req, {
      id: newActionPlan.id,
      code: newActionPlan.code,
    });

    const actionPlanWithDisplayValue = enrichRecordDisplayValues(
      newActionPlanWithDetails,
      'ActionPlan'
    );

    res.status(201).json(actionPlanWithDisplayValue);
  } catch (error) {
    logOperationError('createActionPlan', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_action_plan');
  }
}

async function getActionPlan(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getActionPlan', req, {
    user: user?.id,
    actionPlanId: params?.id,
  });

  try {
    const include = {
      opportunity: true,
    };

    // Log database operation start
    logDatabaseStart('get_action_plan', req, {
      actionPlanId: params?.id,
      userId: user?.id,
    });

    const foundActionPlan = await prisma.actionPlan.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_action_plan', req, {
      found: !!foundActionPlan,
      actionPlanId: params?.id,
    });

    if (!foundActionPlan) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ActionPlan not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_action_plan',
          details: { actionPlanId: params?.id },
        }
      );
      logOperationError('getActionPlan', req, error);
      throw error;
    }

    const [foundActionPlanWithDetails] = await getDetailsFromAPI({
      results: [foundActionPlan],
      token: user?.accessToken,
    });

    // Log operation success
    logOperationSuccess('getActionPlan', req, {
      id: foundActionPlan.id,
      code: foundActionPlan.code,
    });

    const actionPlanWithDisplayValue = enrichRecordDisplayValues(
      foundActionPlanWithDetails,
      'ActionPlan'
    );

    res.status(200).json(actionPlanWithDisplayValue);
  } catch (error) {
    logOperationError('getActionPlan', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_action_plan');
  }
}

async function updateActionPlan(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateActionPlan', req, {
    actionPlanId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await actionPlanUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateActionPlan', req, error);
        throw handleValidationError(error, 'action_plan_update');
      }
      logOperationError('updateActionPlan', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Log database operation start
    logDatabaseStart('update_action_plan', req, {
      actionPlanId: params?.id,
      updateFields: Object.keys(values),
    });

    // Guard: ensure record exists within visibility scope
    const currentActionPlan = await prisma.actionPlan.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: { id: true },
    });
    if (!currentActionPlan) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ActionPlan not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_action_plan',
          details: { actionPlanId: params?.id },
        }
      );
      logOperationError('updateActionPlan', req, error);
      throw error;
    }

    const updatedActionPlan = await prisma.actionPlan.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('update_action_plan', req, {
      id: updatedActionPlan.id,
      updatedFields: Object.keys(values),
    });

    const actionPlanWithDisplayValue = enrichRecordDisplayValues(
      updatedActionPlan,
      'ActionPlan'
    );

    // Log operation success
    logOperationSuccess('updateActionPlan', req, {
      id: updatedActionPlan.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(actionPlanWithDisplayValue);
  } catch (error) {
    logOperationError('updateActionPlan', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_action_plan');
  }
}

async function deleteActionPlan(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteActionPlan', req, {
    user: user?.id,
    actionPlanId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('delete_action_plan', req, {
      actionPlanId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.actionPlan.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_action_plan', req, {
      deletedCount: result.count,
      actionPlanId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'ActionPlan not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_action_plan',
          details: { actionPlanId: params?.id },
        }
      );
      logOperationError('deleteActionPlan', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteActionPlan', req, {
      deletedCount: result.count,
      actionPlanId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteActionPlan', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_action_plan');
  }
}

async function getActionPlanBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for actionPlan',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllActionPlan,
  createActionPlan,
  getActionPlan,
  updateActionPlan,
  deleteActionPlan,
  getActionPlanBarChartData,
};
