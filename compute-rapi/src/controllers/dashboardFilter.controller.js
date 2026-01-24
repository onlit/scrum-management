/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 2024-12-24
 *
 * DESCRIPTION:
 * ------------------
 * This module defines controller functions for managing dashboard filters.
 * Filters provide dynamic dropdown configurations for dashboard data filtering.
 */

const prisma = require('#configs/prisma.js');
const {
  dashboardFilterCreate,
  dashboardFilterUpdate,
} = require('#schemas/dashboardFilter.schemas.js');
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

async function getAllDashboardFilters(req, res) {
  const { user, query } = req;

  logOperationStart('getAllDashboardFilters', req, { user: user?.id, query });
  const searchFields = ['label', 'placeholder'];
  const filterFields = [...searchFields, 'dashboardConfigId', 'modelId', 'fieldId', 'allowMultiple'];

  let response;
  try {
    logDatabaseStart('get_paginated_dashboard_filters', req, {
      searchFields,
      filterFields,
    });
    response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: dashboardFilterUpdate,
      filterFields,
      searchFields,
      model: 'dashboardFilter',
      include: {
        dashboardConfig: true,
        model: true,
        field: true,
      },
    });
    logDatabaseSuccess('get_paginated_dashboard_filters', req, {
      count: response.data?.length,
    });
  } catch (error) {
    logOperationError('getAllDashboardFilters', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Failed to fetch dashboard filters',
      req,
      {
        context: 'get_all_dashboard_filters',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('getAllDashboardFilters', req, {
    count: response.data?.length,
  });
  res.status(200).json(response);
}

async function createDashboardFilter(req, res) {
  const { user, body } = req;

  logOperationStart('createDashboardFilter', req, {
    user: user?.id,
    bodyKeys: Object.keys(body),
  });

  let values;
  try {
    values = await dashboardFilterCreate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('createDashboardFilter', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'create_dashboard_filter',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('createDashboardFilter', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'create_dashboard_filter',
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
    });
  }

  // Validate dashboard config exists
  let dashboardConfig;
  try {
    logDatabaseStart('find_dashboard_config', req, { dashboardConfigId: values.dashboardConfigId });
    dashboardConfig = await prisma.dashboardConfig.findUnique({
      where: { id: values.dashboardConfigId },
    });
    logDatabaseSuccess('find_dashboard_config', req, { found: !!dashboardConfig });
  } catch (error) {
    logOperationError('createDashboardFilter', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_dashboard_filter',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!dashboardConfig) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Dashboard config not found',
      req,
      {
        context: 'create_dashboard_filter',
        severity: ERROR_SEVERITY.LOW,
        details: { dashboardConfigId: values.dashboardConfigId },
      }
    );
    logOperationError('createDashboardFilter', req, error);
    throw error;
  }

  // Validate model exists
  let model;
  try {
    logDatabaseStart('find_model', req, { modelId: values.modelId });
    model = await prisma.modelDefn.findUnique({
      where: { id: values.modelId },
    });
    logDatabaseSuccess('find_model', req, { found: !!model });
  } catch (error) {
    logOperationError('createDashboardFilter', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_dashboard_filter',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!model) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Model not found',
      req,
      {
        context: 'create_dashboard_filter',
        severity: ERROR_SEVERITY.LOW,
        details: { modelId: values.modelId },
      }
    );
    logOperationError('createDashboardFilter', req, error);
    throw error;
  }

  // Validate field exists
  let field;
  try {
    logDatabaseStart('find_field', req, { fieldId: values.fieldId });
    field = await prisma.fieldDefn.findUnique({
      where: { id: values.fieldId },
    });
    logDatabaseSuccess('find_field', req, { found: !!field });
  } catch (error) {
    logOperationError('createDashboardFilter', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_dashboard_filter',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!field) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Field not found',
      req,
      {
        context: 'create_dashboard_filter',
        severity: ERROR_SEVERITY.LOW,
        details: { fieldId: values.fieldId },
      }
    );
    logOperationError('createDashboardFilter', req, error);
    throw error;
  }

  let filter;
  try {
    logDatabaseStart('create_dashboard_filter', req, {
      dashboardConfigId: values.dashboardConfigId,
      modelId: values.modelId,
      fieldId: values.fieldId,
    });
    filter = await prisma.dashboardFilter.create({
      data: buildCreateRecordPayload({
        validatedValues: values,
        requestBody: body,
        user,
      }),
      include: {
        dashboardConfig: true,
        model: true,
        field: true,
      },
    });
    logDatabaseSuccess('create_dashboard_filter', req, { id: filter.id });
  } catch (error) {
    logOperationError('createDashboardFilter', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_dashboard_filter',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('createDashboardFilter', req, { id: filter.id });
  res.status(201).json(filter);
}

async function getDashboardFilter(req, res) {
  const { params, user } = req;

  logOperationStart('getDashboardFilter', req, { user: user?.id, id: params?.id });

  let filter;
  try {
    logDatabaseStart('find_dashboard_filter', req, { id: params?.id });
    filter = await prisma.dashboardFilter.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: {
        dashboardConfig: true,
        model: true,
        field: true,
      },
    });
    logDatabaseSuccess('find_dashboard_filter', req, { found: !!filter });
  } catch (error) {
    logOperationError('getDashboardFilter', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'get_dashboard_filter',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!filter) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Dashboard filter not found',
      req,
      {
        context: 'get_dashboard_filter',
        severity: ERROR_SEVERITY.LOW,
        details: { id: params?.id },
      }
    );
    logOperationError('getDashboardFilter', req, error);
    throw error;
  }

  logOperationSuccess('getDashboardFilter', req, { id: filter.id });
  res.status(200).json(filter);
}

async function updateDashboardFilter(req, res) {
  const { params, body, user } = req;

  logOperationStart('updateDashboardFilter', req, {
    user: user?.id,
    id: params?.id,
    bodyKeys: Object.keys(body),
  });

  let values;
  try {
    values = await dashboardFilterUpdate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('updateDashboardFilter', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'update_dashboard_filter',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('updateDashboardFilter', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'update_dashboard_filter',
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
    });
  }

  let existingFilter;
  try {
    logDatabaseStart('find_dashboard_filter', req, { id: params?.id });
    existingFilter = await prisma.dashboardFilter.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
    });
    logDatabaseSuccess('find_dashboard_filter', req, { found: !!existingFilter });
  } catch (error) {
    logOperationError('updateDashboardFilter', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'update_dashboard_filter',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!existingFilter) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Dashboard filter not found',
      req,
      {
        context: 'update_dashboard_filter',
        severity: ERROR_SEVERITY.LOW,
        details: { id: params?.id },
      }
    );
    logOperationError('updateDashboardFilter', req, error);
    throw error;
  }

  let updated;
  try {
    logDatabaseStart('update_dashboard_filter', req, {
      id: params?.id,
    });
    updated = await prisma.dashboardFilter.update({
      where: { id: params?.id },
      data: {
        label: values.label,
        placeholder: values.placeholder,
        allowMultiple: values.allowMultiple,
        defaultValue: values.defaultValue,
        order: values.order,
        updatedBy: user.id,
      },
      include: {
        dashboardConfig: true,
        model: true,
        field: true,
      },
    });
    logDatabaseSuccess('update_dashboard_filter', req, { id: updated.id });
  } catch (error) {
    logOperationError('updateDashboardFilter', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'update_dashboard_filter',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('updateDashboardFilter', req, { id: updated.id });
  res.status(200).json(updated);
}

async function deleteDashboardFilter(req, res) {
  const { params, user } = req;

  logOperationStart('deleteDashboardFilter', req, {
    user: user?.id,
    id: params?.id,
  });

  try {
    logDatabaseStart('delete_dashboard_filter', req, { id: params?.id });
    await prisma.dashboardFilter.deleteMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });
    logDatabaseSuccess('delete_dashboard_filter', req, { id: params?.id });
  } catch (error) {
    logOperationError('deleteDashboardFilter', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'delete_dashboard_filter',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('deleteDashboardFilter', req, { deleted: params?.id });
  res.status(200).json({ deleted: params?.id });
}

module.exports = {
  getAllDashboardFilters,
  createDashboardFilter,
  getDashboardFilter,
  updateDashboardFilter,
  deleteDashboardFilter,
};
