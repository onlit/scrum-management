/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 2024-12-24
 *
 * DESCRIPTION:
 * ------------------
 * This module defines controller functions for managing widget date configurations.
 * Widget date configs provide per-widget date field override settings.
 */

const prisma = require('#configs/prisma.js');
const {
  widgetDateConfigCreate,
  widgetDateConfigUpdate,
} = require('#schemas/widgetDateConfig.schemas.js');
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

async function getAllWidgetDateConfigs(req, res) {
  const { user, query } = req;

  logOperationStart('getAllWidgetDateConfigs', req, { user: user?.id, query });
  const searchFields = [];
  const filterFields = ['widgetId', 'dateFieldId', 'defaultRange', 'ignoreGlobalFilter'];

  let response;
  try {
    logDatabaseStart('get_paginated_widget_date_configs', req, {
      searchFields,
      filterFields,
    });
    response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: widgetDateConfigUpdate,
      filterFields,
      searchFields,
      model: 'widgetDateConfig',
      include: {
        widget: true,
        dateField: true,
      },
    });
    logDatabaseSuccess('get_paginated_widget_date_configs', req, {
      count: response.data?.length,
    });
  } catch (error) {
    logOperationError('getAllWidgetDateConfigs', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Failed to fetch widget date configs',
      req,
      {
        context: 'get_all_widget_date_configs',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('getAllWidgetDateConfigs', req, {
    count: response.data?.length,
  });
  res.status(200).json(response);
}

async function createWidgetDateConfig(req, res) {
  const { user, body } = req;

  logOperationStart('createWidgetDateConfig', req, {
    user: user?.id,
    bodyKeys: Object.keys(body),
  });

  let values;
  try {
    values = await widgetDateConfigCreate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('createWidgetDateConfig', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'create_widget_date_config',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('createWidgetDateConfig', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'create_widget_date_config',
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
    });
  }

  // Validate widget exists
  let widget;
  try {
    logDatabaseStart('find_widget', req, { widgetId: values.widgetId });
    widget = await prisma.dashboardWidget.findUnique({
      where: { id: values.widgetId },
    });
    logDatabaseSuccess('find_widget', req, { found: !!widget });
  } catch (error) {
    logOperationError('createWidgetDateConfig', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_widget_date_config',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!widget) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Widget not found',
      req,
      {
        context: 'create_widget_date_config',
        severity: ERROR_SEVERITY.LOW,
        details: { widgetId: values.widgetId },
      }
    );
    logOperationError('createWidgetDateConfig', req, error);
    throw error;
  }

  // Check for existing date config for this widget (1:1 relation)
  let existing;
  try {
    logDatabaseStart('find_existing_widget_date_config', req, {
      widgetId: values.widgetId,
    });
    existing = await prisma.widgetDateConfig.findUnique({
      where: { widgetId: values.widgetId },
    });
    logDatabaseSuccess('find_existing_widget_date_config', req, {
      found: !!existing,
    });
  } catch (error) {
    logOperationError('createWidgetDateConfig', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_widget_date_config',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (existing) {
    const error = createErrorWithTrace(
      ERROR_TYPES.CONFLICT,
      'A date config already exists for this widget',
      req,
      {
        context: 'create_widget_date_config',
        severity: ERROR_SEVERITY.LOW,
        details: { widgetId: values.widgetId, existingId: existing.id },
      }
    );
    logOperationError('createWidgetDateConfig', req, error);
    throw error;
  }

  // Validate date field exists
  let dateField;
  try {
    logDatabaseStart('find_date_field', req, { dateFieldId: values.dateFieldId });
    dateField = await prisma.fieldDefn.findUnique({
      where: { id: values.dateFieldId },
    });
    logDatabaseSuccess('find_date_field', req, { found: !!dateField });
  } catch (error) {
    logOperationError('createWidgetDateConfig', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_widget_date_config',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!dateField) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Date field not found',
      req,
      {
        context: 'create_widget_date_config',
        severity: ERROR_SEVERITY.LOW,
        details: { dateFieldId: values.dateFieldId },
      }
    );
    logOperationError('createWidgetDateConfig', req, error);
    throw error;
  }

  let config;
  try {
    logDatabaseStart('create_widget_date_config', req, {
      widgetId: values.widgetId,
      dateFieldId: values.dateFieldId,
    });
    config = await prisma.widgetDateConfig.create({
      data: buildCreateRecordPayload({
        validatedValues: values,
        requestBody: body,
        user,
      }),
      include: {
        widget: true,
        dateField: true,
      },
    });
    logDatabaseSuccess('create_widget_date_config', req, { id: config.id });
  } catch (error) {
    logOperationError('createWidgetDateConfig', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_widget_date_config',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('createWidgetDateConfig', req, { id: config.id });
  res.status(201).json(config);
}

async function getWidgetDateConfig(req, res) {
  const { params, user } = req;

  logOperationStart('getWidgetDateConfig', req, { user: user?.id, id: params?.id });

  let config;
  try {
    logDatabaseStart('find_widget_date_config', req, { id: params?.id });
    config = await prisma.widgetDateConfig.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: {
        widget: true,
        dateField: true,
      },
    });
    logDatabaseSuccess('find_widget_date_config', req, { found: !!config });
  } catch (error) {
    logOperationError('getWidgetDateConfig', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'get_widget_date_config',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!config) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Widget date config not found',
      req,
      {
        context: 'get_widget_date_config',
        severity: ERROR_SEVERITY.LOW,
        details: { id: params?.id },
      }
    );
    logOperationError('getWidgetDateConfig', req, error);
    throw error;
  }

  logOperationSuccess('getWidgetDateConfig', req, { id: config.id });
  res.status(200).json(config);
}

async function updateWidgetDateConfig(req, res) {
  const { params, body, user } = req;

  logOperationStart('updateWidgetDateConfig', req, {
    user: user?.id,
    id: params?.id,
    bodyKeys: Object.keys(body),
  });

  let values;
  try {
    values = await widgetDateConfigUpdate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('updateWidgetDateConfig', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'update_widget_date_config',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('updateWidgetDateConfig', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'update_widget_date_config',
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
    });
  }

  let existingConfig;
  try {
    logDatabaseStart('find_widget_date_config', req, { id: params?.id });
    existingConfig = await prisma.widgetDateConfig.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
    });
    logDatabaseSuccess('find_widget_date_config', req, { found: !!existingConfig });
  } catch (error) {
    logOperationError('updateWidgetDateConfig', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'update_widget_date_config',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!existingConfig) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Widget date config not found',
      req,
      {
        context: 'update_widget_date_config',
        severity: ERROR_SEVERITY.LOW,
        details: { id: params?.id },
      }
    );
    logOperationError('updateWidgetDateConfig', req, error);
    throw error;
  }

  let updated;
  try {
    logDatabaseStart('update_widget_date_config', req, {
      id: params?.id,
    });
    updated = await prisma.widgetDateConfig.update({
      where: { id: params?.id },
      data: {
        dateFieldId: values.dateFieldId,
        defaultRange: values.defaultRange,
        ignoreGlobalFilter: values.ignoreGlobalFilter,
        updatedBy: user.id,
      },
      include: {
        widget: true,
        dateField: true,
      },
    });
    logDatabaseSuccess('update_widget_date_config', req, { id: updated.id });
  } catch (error) {
    logOperationError('updateWidgetDateConfig', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'update_widget_date_config',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('updateWidgetDateConfig', req, { id: updated.id });
  res.status(200).json(updated);
}

async function deleteWidgetDateConfig(req, res) {
  const { params, user } = req;

  logOperationStart('deleteWidgetDateConfig', req, {
    user: user?.id,
    id: params?.id,
  });

  try {
    logDatabaseStart('delete_widget_date_config', req, { id: params?.id });
    await prisma.widgetDateConfig.deleteMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });
    logDatabaseSuccess('delete_widget_date_config', req, { id: params?.id });
  } catch (error) {
    logOperationError('deleteWidgetDateConfig', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'delete_widget_date_config',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('deleteWidgetDateConfig', req, { deleted: params?.id });
  res.status(200).json({ deleted: params?.id });
}

module.exports = {
  getAllWidgetDateConfigs,
  createWidgetDateConfig,
  getWidgetDateConfig,
  updateWidgetDateConfig,
  deleteWidgetDateConfig,
};
