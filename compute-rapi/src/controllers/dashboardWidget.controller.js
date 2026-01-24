/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 2024-12-24
 *
 * DESCRIPTION:
 * ------------------
 * This module defines controller functions for managing dashboard widgets.
 * Widgets are individual chart/KPI card configurations within a dashboard.
 */

const prisma = require('#configs/prisma.js');
const {
  dashboardWidgetCreate,
  dashboardWidgetUpdate,
} = require('#schemas/dashboardWidget.schemas.js');
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

async function getAllDashboardWidgets(req, res) {
  const { user, query } = req;

  logOperationStart('getAllDashboardWidgets', req, { user: user?.id, query });
  const searchFields = ['title', 'description'];
  const filterFields = [...searchFields, 'dashboardConfigId', 'widgetType', 'size', 'modelId', 'metricId'];

  let response;
  try {
    logDatabaseStart('get_paginated_dashboard_widgets', req, {
      searchFields,
      filterFields,
    });
    response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: dashboardWidgetUpdate,
      filterFields,
      searchFields,
      model: 'dashboardWidget',
      include: {
        dashboardConfig: true,
        model: true,
        metric: true,
        aggregateField: true,
        groupByField: true,
        dateConfig: true,
      },
    });
    logDatabaseSuccess('get_paginated_dashboard_widgets', req, {
      count: response.data?.length,
    });
  } catch (error) {
    logOperationError('getAllDashboardWidgets', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Failed to fetch dashboard widgets',
      req,
      {
        context: 'get_all_dashboard_widgets',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('getAllDashboardWidgets', req, {
    count: response.data?.length,
  });
  res.status(200).json(response);
}

async function createDashboardWidget(req, res) {
  const { user, body } = req;

  logOperationStart('createDashboardWidget', req, {
    user: user?.id,
    bodyKeys: Object.keys(body),
  });

  let values;
  try {
    values = await dashboardWidgetCreate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('createDashboardWidget', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'create_dashboard_widget',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('createDashboardWidget', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'create_dashboard_widget',
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
    logOperationError('createDashboardWidget', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_dashboard_widget',
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
        context: 'create_dashboard_widget',
        severity: ERROR_SEVERITY.LOW,
        details: { dashboardConfigId: values.dashboardConfigId },
      }
    );
    logOperationError('createDashboardWidget', req, error);
    throw error;
  }

  // Validate model exists if provided
  if (values.modelId) {
    let model;
    try {
      logDatabaseStart('find_model', req, { modelId: values.modelId });
      model = await prisma.modelDefn.findUnique({
        where: { id: values.modelId },
      });
      logDatabaseSuccess('find_model', req, { found: !!model });
    } catch (error) {
      logOperationError('createDashboardWidget', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.INTERNAL,
        'Database operation failed',
        req,
        {
          context: 'create_dashboard_widget',
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
          context: 'create_dashboard_widget',
          severity: ERROR_SEVERITY.LOW,
          details: { modelId: values.modelId },
        }
      );
      logOperationError('createDashboardWidget', req, error);
      throw error;
    }
  }

  // Validate metric exists if provided
  if (values.metricId) {
    let metric;
    try {
      logDatabaseStart('find_metric', req, { metricId: values.metricId });
      metric = await prisma.dashboardMetric.findUnique({
        where: { id: values.metricId },
      });
      logDatabaseSuccess('find_metric', req, { found: !!metric });
    } catch (error) {
      logOperationError('createDashboardWidget', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.INTERNAL,
        'Database operation failed',
        req,
        {
          context: 'create_dashboard_widget',
          severity: ERROR_SEVERITY.HIGH,
          originalError: error,
        }
      );
    }

    if (!metric) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Metric not found',
        req,
        {
          context: 'create_dashboard_widget',
          severity: ERROR_SEVERITY.LOW,
          details: { metricId: values.metricId },
        }
      );
      logOperationError('createDashboardWidget', req, error);
      throw error;
    }
  }

  let widget;
  try {
    logDatabaseStart('create_dashboard_widget', req, {
      title: values.title,
      dashboardConfigId: values.dashboardConfigId,
    });
    widget = await prisma.dashboardWidget.create({
      data: buildCreateRecordPayload({
        validatedValues: values,
        requestBody: body,
        user,
      }),
      include: {
        dashboardConfig: true,
        model: true,
        metric: true,
        aggregateField: true,
        groupByField: true,
        dateConfig: true,
      },
    });
    logDatabaseSuccess('create_dashboard_widget', req, { id: widget.id });
  } catch (error) {
    logOperationError('createDashboardWidget', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_dashboard_widget',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('createDashboardWidget', req, { id: widget.id });
  res.status(201).json(widget);
}

async function getDashboardWidget(req, res) {
  const { params, user } = req;

  logOperationStart('getDashboardWidget', req, { user: user?.id, id: params?.id });

  let widget;
  try {
    logDatabaseStart('find_dashboard_widget', req, { id: params?.id });
    widget = await prisma.dashboardWidget.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: {
        dashboardConfig: true,
        model: true,
        metric: true,
        aggregateField: true,
        groupByField: true,
        dateConfig: {
          include: {
            dateField: true,
          },
        },
      },
    });
    logDatabaseSuccess('find_dashboard_widget', req, { found: !!widget });
  } catch (error) {
    logOperationError('getDashboardWidget', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'get_dashboard_widget',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!widget) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Dashboard widget not found',
      req,
      {
        context: 'get_dashboard_widget',
        severity: ERROR_SEVERITY.LOW,
        details: { id: params?.id },
      }
    );
    logOperationError('getDashboardWidget', req, error);
    throw error;
  }

  logOperationSuccess('getDashboardWidget', req, { id: widget.id });
  res.status(200).json(widget);
}

async function updateDashboardWidget(req, res) {
  const { params, body, user } = req;

  logOperationStart('updateDashboardWidget', req, {
    user: user?.id,
    id: params?.id,
    bodyKeys: Object.keys(body),
  });

  let values;
  try {
    values = await dashboardWidgetUpdate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('updateDashboardWidget', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'update_dashboard_widget',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('updateDashboardWidget', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'update_dashboard_widget',
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
    });
  }

  let existingWidget;
  try {
    logDatabaseStart('find_dashboard_widget', req, { id: params?.id });
    existingWidget = await prisma.dashboardWidget.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
    });
    logDatabaseSuccess('find_dashboard_widget', req, { found: !!existingWidget });
  } catch (error) {
    logOperationError('updateDashboardWidget', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'update_dashboard_widget',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!existingWidget) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Dashboard widget not found',
      req,
      {
        context: 'update_dashboard_widget',
        severity: ERROR_SEVERITY.LOW,
        details: { id: params?.id },
      }
    );
    logOperationError('updateDashboardWidget', req, error);
    throw error;
  }

  let updated;
  try {
    logDatabaseStart('update_dashboard_widget', req, {
      id: params?.id,
      title: values.title,
    });
    updated = await prisma.dashboardWidget.update({
      where: { id: params?.id },
      data: {
        title: values.title,
        description: values.description,
        widgetType: values.widgetType,
        size: values.size,
        gridColumn: values.gridColumn,
        gridRow: values.gridRow,
        modelId: values.modelId,
        metricId: values.metricId,
        aggregationType: values.aggregationType,
        aggregateFieldId: values.aggregateFieldId,
        groupByFieldId: values.groupByFieldId,
        showTrend: values.showTrend,
        trendComparisonDays: values.trendComparisonDays,
        order: values.order,
        updatedBy: user.id,
      },
      include: {
        dashboardConfig: true,
        model: true,
        metric: true,
        aggregateField: true,
        groupByField: true,
        dateConfig: true,
      },
    });
    logDatabaseSuccess('update_dashboard_widget', req, { id: updated.id });
  } catch (error) {
    logOperationError('updateDashboardWidget', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'update_dashboard_widget',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('updateDashboardWidget', req, { id: updated.id });
  res.status(200).json(updated);
}

async function deleteDashboardWidget(req, res) {
  const { params, user } = req;

  logOperationStart('deleteDashboardWidget', req, {
    user: user?.id,
    id: params?.id,
  });

  try {
    logDatabaseStart('delete_dashboard_widget', req, { id: params?.id });
    await prisma.dashboardWidget.deleteMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });
    logDatabaseSuccess('delete_dashboard_widget', req, { id: params?.id });
  } catch (error) {
    logOperationError('deleteDashboardWidget', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'delete_dashboard_widget',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('deleteDashboardWidget', req, { deleted: params?.id });
  res.status(200).json({ deleted: params?.id });
}

module.exports = {
  getAllDashboardWidgets,
  createDashboardWidget,
  getDashboardWidget,
  updateDashboardWidget,
  deleteDashboardWidget,
};
