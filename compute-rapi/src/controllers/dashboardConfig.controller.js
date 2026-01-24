/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 2024-12-24
 *
 * DESCRIPTION:
 * ------------------
 * This module defines controller functions for managing dashboard configurations.
 * Dashboard configs provide microservice-level dashboard settings including
 * global date filtering and widget/filter relations.
 */

const prisma = require('#configs/prisma.js');
const {
  dashboardConfigCreate,
  dashboardConfigUpdate,
  dashboardBatchCreate,
} = require('#schemas/dashboardConfig.schemas.js');
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
const {
  resolveModelNamesToIds,
  resolveFieldNamesToIds,
} = require('#utils/shared/nameResolver.js');

async function getAllDashboardConfigs(req, res) {
  const { user, query } = req;

  logOperationStart('getAllDashboardConfigs', req, { user: user?.id, query });
  const searchFields = ['title', 'description'];
  const filterFields = [...searchFields, 'microserviceId', 'enableDateFilter', 'defaultDateRange'];

  let response;
  try {
    logDatabaseStart('get_paginated_dashboard_configs', req, {
      searchFields,
      filterFields,
    });
    response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: dashboardConfigUpdate,
      filterFields,
      searchFields,
      model: 'dashboardConfig',
      include: {
        microservice: true,
        widgets: true,
        filters: true,
      },
    });
    logDatabaseSuccess('get_paginated_dashboard_configs', req, {
      count: response.data?.length,
    });
  } catch (error) {
    logOperationError('getAllDashboardConfigs', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Failed to fetch dashboard configs',
      req,
      {
        context: 'get_all_dashboard_configs',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('getAllDashboardConfigs', req, {
    count: response.data?.length,
  });
  res.status(200).json(response);
}

async function createDashboardConfig(req, res) {
  const { user, body } = req;

  logOperationStart('createDashboardConfig', req, {
    user: user?.id,
    bodyKeys: Object.keys(body),
  });

  let values;
  try {
    values = await dashboardConfigCreate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('createDashboardConfig', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'create_dashboard_config',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('createDashboardConfig', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'create_dashboard_config',
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
    });
  }

  // Validate microservice exists
  let microservice;
  try {
    logDatabaseStart('find_microservice', req, { microserviceId: values.microserviceId });
    microservice = await prisma.microservice.findUnique({
      where: { id: values.microserviceId },
    });
    logDatabaseSuccess('find_microservice', req, { found: !!microservice });
  } catch (error) {
    logOperationError('createDashboardConfig', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_dashboard_config',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!microservice) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Microservice not found',
      req,
      {
        context: 'create_dashboard_config',
        severity: ERROR_SEVERITY.LOW,
        details: { microserviceId: values.microserviceId },
      }
    );
    logOperationError('createDashboardConfig', req, error);
    throw error;
  }

  // Check for existing dashboard config for this microservice (1:1 relation)
  let existing;
  try {
    logDatabaseStart('find_existing_dashboard_config', req, {
      microserviceId: values.microserviceId,
    });
    existing = await prisma.dashboardConfig.findUnique({
      where: { microserviceId: values.microserviceId },
    });
    logDatabaseSuccess('find_existing_dashboard_config', req, {
      found: !!existing,
    });
  } catch (error) {
    logOperationError('createDashboardConfig', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_dashboard_config',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (existing) {
    const error = createErrorWithTrace(
      ERROR_TYPES.CONFLICT,
      'A dashboard config already exists for this microservice',
      req,
      {
        context: 'create_dashboard_config',
        severity: ERROR_SEVERITY.LOW,
        details: { microserviceId: values.microserviceId, existingId: existing.id },
      }
    );
    logOperationError('createDashboardConfig', req, error);
    throw error;
  }

  let config;
  try {
    logDatabaseStart('create_dashboard_config', req, {
      microserviceId: values.microserviceId,
    });
    config = await prisma.dashboardConfig.create({
      data: buildCreateRecordPayload({
        validatedValues: values,
        requestBody: body,
        user,
      }),
      include: {
        microservice: true,
        widgets: true,
        filters: true,
      },
    });
    logDatabaseSuccess('create_dashboard_config', req, { id: config.id });
  } catch (error) {
    logOperationError('createDashboardConfig', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_dashboard_config',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('createDashboardConfig', req, { id: config.id });
  res.status(201).json(config);
}

async function getDashboardConfig(req, res) {
  const { params, user } = req;

  logOperationStart('getDashboardConfig', req, { user: user?.id, id: params?.id });

  let config;
  try {
    logDatabaseStart('find_dashboard_config', req, { id: params?.id });
    config = await prisma.dashboardConfig.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: {
        microservice: true,
        widgets: {
          include: {
            model: true,
            metric: true,
            aggregateField: true,
            groupByField: true,
            dateConfig: true,
          },
        },
        filters: {
          include: {
            model: true,
            field: true,
          },
        },
      },
    });
    logDatabaseSuccess('find_dashboard_config', req, { found: !!config });
  } catch (error) {
    logOperationError('getDashboardConfig', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'get_dashboard_config',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!config) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Dashboard config not found',
      req,
      {
        context: 'get_dashboard_config',
        severity: ERROR_SEVERITY.LOW,
        details: { id: params?.id },
      }
    );
    logOperationError('getDashboardConfig', req, error);
    throw error;
  }

  logOperationSuccess('getDashboardConfig', req, { id: config.id });
  res.status(200).json(config);
}

async function getDashboardConfigByMicroservice(req, res) {
  const { params, user } = req;

  logOperationStart('getDashboardConfigByMicroservice', req, { user: user?.id, microserviceId: params?.microserviceId });

  let config;
  try {
    logDatabaseStart('find_dashboard_config_by_microservice', req, { microserviceId: params?.microserviceId });
    config = await prisma.dashboardConfig.findFirst({
      where: {
        microserviceId: params?.microserviceId,
        ...getVisibilityFilters(user),
      },
      include: {
        microservice: true,
        widgets: {
          include: {
            model: true,
            metric: true,
            aggregateField: true,
            groupByField: true,
            dateConfig: true,
          },
          orderBy: [{ gridRow: 'asc' }, { gridColumn: 'asc' }],
        },
        filters: {
          include: {
            model: true,
            field: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });
    logDatabaseSuccess('find_dashboard_config_by_microservice', req, { found: !!config });
  } catch (error) {
    logOperationError('getDashboardConfigByMicroservice', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'get_dashboard_config_by_microservice',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!config) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Dashboard config not found for this microservice',
      req,
      {
        context: 'get_dashboard_config_by_microservice',
        severity: ERROR_SEVERITY.LOW,
        details: { microserviceId: params?.microserviceId },
      }
    );
    logOperationError('getDashboardConfigByMicroservice', req, error);
    throw error;
  }

  logOperationSuccess('getDashboardConfigByMicroservice', req, { id: config.id });
  res.status(200).json(config);
}

async function updateDashboardConfig(req, res) {
  const { params, body, user } = req;

  logOperationStart('updateDashboardConfig', req, {
    user: user?.id,
    id: params?.id,
    bodyKeys: Object.keys(body),
  });

  let values;
  try {
    values = await dashboardConfigUpdate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('updateDashboardConfig', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'update_dashboard_config',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('updateDashboardConfig', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'update_dashboard_config',
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
    });
  }

  let existingConfig;
  try {
    logDatabaseStart('find_dashboard_config', req, { id: params?.id });
    existingConfig = await prisma.dashboardConfig.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
    });
    logDatabaseSuccess('find_dashboard_config', req, { found: !!existingConfig });
  } catch (error) {
    logOperationError('updateDashboardConfig', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'update_dashboard_config',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!existingConfig) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Dashboard config not found',
      req,
      {
        context: 'update_dashboard_config',
        severity: ERROR_SEVERITY.LOW,
        details: { id: params?.id },
      }
    );
    logOperationError('updateDashboardConfig', req, error);
    throw error;
  }

  let updated;
  try {
    logDatabaseStart('update_dashboard_config', req, {
      id: params?.id,
    });
    updated = await prisma.dashboardConfig.update({
      where: { id: params?.id },
      data: {
        title: values.title,
        description: values.description,
        enableDateFilter: values.enableDateFilter,
        defaultDateRange: values.defaultDateRange,
        dateFieldName: values.dateFieldName,
        updatedBy: user.id,
      },
      include: {
        microservice: true,
        widgets: true,
        filters: true,
      },
    });
    logDatabaseSuccess('update_dashboard_config', req, { id: updated.id });
  } catch (error) {
    logOperationError('updateDashboardConfig', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'update_dashboard_config',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('updateDashboardConfig', req, { id: updated.id });
  res.status(200).json(updated);
}

async function deleteDashboardConfig(req, res) {
  const { params, user } = req;

  logOperationStart('deleteDashboardConfig', req, {
    user: user?.id,
    id: params?.id,
  });

  try {
    logDatabaseStart('delete_dashboard_config', req, { id: params?.id });
    await prisma.dashboardConfig.deleteMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });
    logDatabaseSuccess('delete_dashboard_config', req, { id: params?.id });
  } catch (error) {
    logOperationError('deleteDashboardConfig', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'delete_dashboard_config',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('deleteDashboardConfig', req, { deleted: params?.id });
  res.status(200).json({ deleted: params?.id });
}

async function validateBatchReferences(req, { widgets, filters, resolvedWidgets, resolvedFilters }) {
  const errors = [];

  // Use resolved data if available, otherwise use original data
  const widgetsToValidate = resolvedWidgets || widgets;
  const filtersToValidate = resolvedFilters || filters;

  // Collect all referenced IDs (after resolution)
  const modelIds = new Set();
  const fieldIds = new Set();

  for (const widget of widgetsToValidate) {
    if (widget.modelId) modelIds.add(widget.modelId);
    if (widget.aggregateFieldId) fieldIds.add(widget.aggregateFieldId);
    if (widget.groupByFieldId) fieldIds.add(widget.groupByFieldId);
    if (widget.dateConfig?.dateFieldId) fieldIds.add(widget.dateConfig.dateFieldId);
  }

  for (const filter of filtersToValidate) {
    if (filter.modelId) modelIds.add(filter.modelId);
    if (filter.fieldId) fieldIds.add(filter.fieldId);
  }

  // Validate models exist
  if (modelIds.size > 0) {
    const existingModels = await prisma.modelDefn.findMany({
      where: { id: { in: [...modelIds] } },
      select: { id: true },
    });
    const existingModelIds = new Set(existingModels.map((m) => m.id));

    for (const modelId of modelIds) {
      if (!existingModelIds.has(modelId)) {
        errors.push({ type: 'MODEL_NOT_FOUND', modelId });
      }
    }
  }

  // Validate fields exist
  if (fieldIds.size > 0) {
    const existingFields = await prisma.fieldDefn.findMany({
      where: { id: { in: [...fieldIds] } },
      select: { id: true },
    });
    const existingFieldIds = new Set(existingFields.map((f) => f.id));

    for (const fieldId of fieldIds) {
      if (!existingFieldIds.has(fieldId)) {
        errors.push({ type: 'FIELD_NOT_FOUND', fieldId });
      }
    }
  }

  if (errors.length > 0) {
    throw createErrorWithTrace(
      ERROR_TYPES.BAD_REQUEST,
      'Referenced entities not found',
      req,
      {
        context: 'dashboard_batch_validate_references',
        severity: ERROR_SEVERITY.LOW,
        details: { errors },
      }
    );
  }
}

async function createDashboardBatch(req, res) {
  let { user } = req;
  const { body } = req;

  logOperationStart('createDashboardBatch', req, {
    user: user?.id,
    bodyKeys: Object.keys(body),
  });

  // Step 1: Validate input
  let values;
  try {
    values = await dashboardBatchCreate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('createDashboardBatch', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'dashboard_batch_create',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('createDashboardBatch', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'dashboard_batch_create',
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
    });
  }

  const {
    createdBy,
    client,
    microserviceId,
    // Config fields (flat structure)
    title,
    description,
    enableDateFilter,
    defaultDateRange,
    dateFieldName,
    // Data arrays
    metrics,
    widgets,
    filters,
  } = values;

  // Step 1b: Handle internal request authentication
  const isInternal = !user.isAuthenticated && user.internalRequest;

  if (isInternal) {
    if (!createdBy || !client) {
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'For internal requests, both client and createdBy fields are required.',
        req,
        {
          context: 'dashboard_batch_create',
          severity: ERROR_SEVERITY.LOW,
        }
      );
    }
    // Override user object with provided values
    user = { ...user, client: { id: client }, id: createdBy };
  }

  // Step 2: Validate microservice exists
  let microservice;
  try {
    logDatabaseStart('find_microservice', req, { microserviceId });
    microservice = await prisma.microservice.findUnique({
      where: { id: microserviceId },
    });
    logDatabaseSuccess('find_microservice', req, { found: !!microservice });
  } catch (error) {
    logOperationError('createDashboardBatch', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'dashboard_batch_create',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!microservice) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Microservice not found',
      req,
      {
        context: 'dashboard_batch_create',
        severity: ERROR_SEVERITY.LOW,
        details: { microserviceId },
      }
    );
    logOperationError('createDashboardBatch', req, error);
    throw error;
  }

  // Step 3: Check no existing dashboard config
  let existing;
  try {
    logDatabaseStart('find_existing_dashboard_config', req, { microserviceId });
    existing = await prisma.dashboardConfig.findUnique({
      where: { microserviceId },
    });
    logDatabaseSuccess('find_existing_dashboard_config', req, { found: !!existing });
  } catch (error) {
    logOperationError('createDashboardBatch', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'dashboard_batch_create',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (existing) {
    const error = createErrorWithTrace(
      ERROR_TYPES.CONFLICT,
      'A dashboard config already exists for this microservice',
      req,
      {
        context: 'dashboard_batch_create',
        severity: ERROR_SEVERITY.LOW,
        details: { microserviceId, existingId: existing.id },
      }
    );
    logOperationError('createDashboardBatch', req, error);
    throw error;
  }

  // Step 4: Resolve model/field names to IDs
  logDatabaseStart('resolve_name_references', req, {
    widgetsWithModelName: widgets.filter((w) => w.modelName).length,
    filtersWithModelName: filters.filter((f) => f.modelName).length,
  });

  // Collect all model names that need resolution
  const modelNamesToResolve = [
    ...widgets.filter((w) => w.modelName).map((w) => w.modelName),
    ...filters.filter((f) => f.modelName).map((f) => f.modelName),
    ...metrics.filter((m) => m.modelName).map((m) => m.modelName),
  ];

  // Resolve model names to IDs
  let modelNameToIdMap = new Map();
  if (modelNamesToResolve.length > 0) {
    modelNameToIdMap = await resolveModelNamesToIds(microserviceId, modelNamesToResolve);

    // Check for unresolved model names
    const unresolvedModelNames = modelNamesToResolve.filter(
      (name) => name && !modelNameToIdMap.has(name)
    );
    if (unresolvedModelNames.length > 0) {
      throw createErrorWithTrace(
        ERROR_TYPES.BAD_REQUEST,
        'Some model names could not be resolved',
        req,
        {
          context: 'dashboard_batch_create',
          severity: ERROR_SEVERITY.LOW,
          details: { unresolvedModelNames: [...new Set(unresolvedModelNames)] },
        }
      );
    }
  }

  // Resolve widgets with model IDs (either provided or resolved from names)
  const resolvedWidgets = widgets.map((widget) => {
    const resolvedModelId = widget.modelId || modelNameToIdMap.get(widget.modelName) || null;
    return {
      ...widget,
      modelId: resolvedModelId,
    };
  });

  // Resolve filters with model IDs
  const resolvedFilters = filters.map((filter) => {
    const resolvedModelId = filter.modelId || modelNameToIdMap.get(filter.modelName) || null;
    return {
      ...filter,
      modelId: resolvedModelId,
    };
  });

  // Resolve metrics with model IDs
  const resolvedMetrics = metrics.map((metric) => {
    const resolvedModelId = metric.modelId || modelNameToIdMap.get(metric.modelName) || null;
    return {
      ...metric,
      modelId: resolvedModelId,
    };
  });

  // Build a map from metric reference to its modelId (for widgets that reference metrics)
  const metricReferenceToModelId = new Map();
  resolvedMetrics.forEach((metric) => {
    if (metric.reference && metric.modelId) {
      metricReferenceToModelId.set(metric.reference, metric.modelId);
    }
  });

  // Collect field names that need resolution (grouped by model ID)
  const modelFieldRequests = [];
  resolvedWidgets.forEach((widget) => {
    // For widgets with metricReference but no modelId, use the metric's modelId for field resolution
    const effectiveModelId = widget.modelId || metricReferenceToModelId.get(widget.metricReference);
    if (effectiveModelId) {
      const fieldNames = [];
      if (widget.aggregateFieldName) fieldNames.push(widget.aggregateFieldName);
      if (widget.groupByFieldName) fieldNames.push(widget.groupByFieldName);
      if (widget.dateConfig?.dateFieldName) fieldNames.push(widget.dateConfig.dateFieldName);
      if (fieldNames.length > 0) {
        modelFieldRequests.push({ modelId: effectiveModelId, fieldNames });
      }
    }
  });
  resolvedFilters.forEach((filter) => {
    if (filter.modelId && filter.fieldName) {
      modelFieldRequests.push({ modelId: filter.modelId, fieldNames: [filter.fieldName] });
    }
  });
  resolvedMetrics.forEach((metric) => {
    if (metric.modelId) {
      const fieldNames = [];
      if (metric.aggregateFieldName) fieldNames.push(metric.aggregateFieldName);
      if (metric.groupByFieldName) fieldNames.push(metric.groupByFieldName);
      if (fieldNames.length > 0) {
        modelFieldRequests.push({ modelId: metric.modelId, fieldNames });
      }
    }
  });

  // Resolve field names to IDs
  let modelFieldMap = new Map();
  if (modelFieldRequests.length > 0) {
    modelFieldMap = await resolveFieldNamesToIds(modelFieldRequests);
  }

  // Apply resolved field IDs to widgets
  const fullyResolvedWidgets = resolvedWidgets.map((widget) => {
    // For widgets with metricReference but no modelId, use the metric's modelId for field lookup
    const effectiveModelId = widget.modelId || metricReferenceToModelId.get(widget.metricReference);
    const fieldMap = modelFieldMap.get(effectiveModelId) || new Map();
    const resolvedAggregateFieldId =
      widget.aggregateFieldId || fieldMap.get(widget.aggregateFieldName) || null;
    const resolvedGroupByFieldId =
      widget.groupByFieldId || fieldMap.get(widget.groupByFieldName) || null;

    let resolvedDateConfig = widget.dateConfig;
    if (widget.dateConfig) {
      const resolvedDateFieldId =
        widget.dateConfig.dateFieldId || fieldMap.get(widget.dateConfig.dateFieldName) || null;
      resolvedDateConfig = {
        ...widget.dateConfig,
        dateFieldId: resolvedDateFieldId,
      };
    }

    return {
      ...widget,
      aggregateFieldId: resolvedAggregateFieldId,
      groupByFieldId: resolvedGroupByFieldId,
      dateConfig: resolvedDateConfig,
    };
  });

  // Apply resolved field IDs to filters
  const fullyResolvedFilters = resolvedFilters.map((filter) => {
    const fieldMap = modelFieldMap.get(filter.modelId) || new Map();
    const resolvedFieldId = filter.fieldId || fieldMap.get(filter.fieldName) || null;
    return {
      ...filter,
      fieldId: resolvedFieldId,
    };
  });

  // Apply resolved field IDs to metrics
  const fullyResolvedMetrics = resolvedMetrics.map((metric) => {
    const fieldMap = modelFieldMap.get(metric.modelId) || new Map();
    const resolvedAggregateFieldId =
      metric.aggregateFieldId || fieldMap.get(metric.aggregateFieldName) || null;
    const resolvedGroupByFieldId =
      metric.groupByFieldId || fieldMap.get(metric.groupByFieldName) || null;
    return {
      ...metric,
      aggregateFieldId: resolvedAggregateFieldId,
      groupByFieldId: resolvedGroupByFieldId,
    };
  });

  // Validate all field names were resolved
  const unresolvedFields = [];
  fullyResolvedWidgets.forEach((widget, index) => {
    if (widgets[index].aggregateFieldName && !widget.aggregateFieldId) {
      unresolvedFields.push({
        type: 'aggregateFieldName',
        widget: widget.title,
        fieldName: widgets[index].aggregateFieldName,
      });
    }
    if (widgets[index].groupByFieldName && !widget.groupByFieldId) {
      unresolvedFields.push({
        type: 'groupByFieldName',
        widget: widget.title,
        fieldName: widgets[index].groupByFieldName,
      });
    }
    if (widgets[index].dateConfig?.dateFieldName && !widget.dateConfig?.dateFieldId) {
      unresolvedFields.push({
        type: 'dateFieldName',
        widget: widget.title,
        fieldName: widgets[index].dateConfig.dateFieldName,
      });
    }
  });
  fullyResolvedFilters.forEach((filter, index) => {
    if (filters[index].fieldName && !filter.fieldId) {
      unresolvedFields.push({
        type: 'fieldName',
        filter: filter.label || `Filter ${index + 1}`,
        fieldName: filters[index].fieldName,
      });
    }
  });
  fullyResolvedMetrics.forEach((metric, index) => {
    if (metrics[index].aggregateFieldName && !metric.aggregateFieldId) {
      unresolvedFields.push({
        type: 'aggregateFieldName',
        metric: metric.name,
        fieldName: metrics[index].aggregateFieldName,
      });
    }
    if (metrics[index].groupByFieldName && !metric.groupByFieldId) {
      unresolvedFields.push({
        type: 'groupByFieldName',
        metric: metric.name,
        fieldName: metrics[index].groupByFieldName,
      });
    }
  });

  if (unresolvedFields.length > 0) {
    throw createErrorWithTrace(
      ERROR_TYPES.BAD_REQUEST,
      'Some field names could not be resolved',
      req,
      {
        context: 'dashboard_batch_create',
        severity: ERROR_SEVERITY.LOW,
        details: { unresolvedFields },
      }
    );
  }

  logDatabaseSuccess('resolve_name_references', req, {
    modelsResolved: modelNameToIdMap.size,
    fieldsResolved: modelFieldMap.size,
  });

  // Step 5: Validate referenced entities exist (using resolved IDs)
  await validateBatchReferences(req, {
    widgets,
    filters,
    resolvedWidgets: fullyResolvedWidgets,
    resolvedFilters: fullyResolvedFilters,
  });

  // Step 6: Execute transaction
  logDatabaseStart('dashboard_batch_transaction', req, {
    metricsCount: metrics.length,
    widgetsCount: fullyResolvedWidgets.length,
    filtersCount: fullyResolvedFilters.length,
  });

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      // 6a: Create DashboardConfig
      const dashboardConfig = await tx.dashboardConfig.create({
        data: buildCreateRecordPayload({
          validatedValues: {
            microserviceId,
            title,
            description,
            enableDateFilter,
            defaultDateRange,
            dateFieldName,
          },
          requestBody: { title, description, enableDateFilter, defaultDateRange, dateFieldName },
          user,
        }),
      });

      // 6b: Create Metrics (if any) and build reference -> realId map
      const metricIdMap = new Map();

      for (const metric of fullyResolvedMetrics) {
        const createdMetric = await tx.dashboardMetric.create({
          data: buildCreateRecordPayload({
            validatedValues: {
              microserviceId,
              name: metric.name,
              label: metric.label,
              description: metric.description,
              modelId: metric.modelId || null,
              aggregationType: metric.aggregationType || null,
              aggregateFieldId: metric.aggregateFieldId || null,
              groupByFieldId: metric.groupByFieldId || null,
              whereConditions: metric.whereConditions || null,
              queryJoins: metric.queryJoins || null,
              outputType: metric.outputType,
              cacheDurationMins: metric.cacheDurationMins,
            },
            requestBody: metric,
            user,
          }),
        });
        metricIdMap.set(metric.reference, createdMetric.id);
      }

      // 6c: Create Widgets with resolved metricIds and field IDs
      const createdWidgets = [];

      for (const widget of fullyResolvedWidgets) {
        // Resolve metricReference to actual metricId
        const resolvedMetricId = widget.metricReference
          ? metricIdMap.get(widget.metricReference)
          : null;

        const createdWidget = await tx.dashboardWidget.create({
          data: buildCreateRecordPayload({
            validatedValues: {
              dashboardConfigId: dashboardConfig.id,
              title: widget.title,
              description: widget.description,
              widgetType: widget.widgetType,
              size: widget.size,
              gridColumn: widget.gridColumn,
              gridRow: widget.gridRow,
              modelId: widget.modelId || null,
              metricId: resolvedMetricId,
              aggregationType: widget.aggregationType,
              aggregateFieldId: widget.aggregateFieldId || null,
              groupByFieldId: widget.groupByFieldId || null,
              showTrend: widget.showTrend,
              trendComparisonDays: widget.trendComparisonDays,
              order: widget.order,
            },
            requestBody: widget,
            user,
          }),
        });

        // 6d: Create WidgetDateConfig if provided
        if (widget.dateConfig && widget.dateConfig.dateFieldId) {
          await tx.widgetDateConfig.create({
            data: buildCreateRecordPayload({
              validatedValues: {
                widgetId: createdWidget.id,
                dateFieldId: widget.dateConfig.dateFieldId,
                defaultRange: widget.dateConfig.defaultRange,
                ignoreGlobalFilter: widget.dateConfig.ignoreGlobalFilter,
              },
              requestBody: widget.dateConfig,
              user,
            }),
          });
        }

        createdWidgets.push(createdWidget);
      }

      // 6e: Create Filters with resolved IDs
      const createdFilters = [];

      for (const filter of fullyResolvedFilters) {
        const createdFilter = await tx.dashboardFilter.create({
          data: buildCreateRecordPayload({
            validatedValues: {
              dashboardConfigId: dashboardConfig.id,
              modelId: filter.modelId,
              fieldId: filter.fieldId,
              label: filter.label,
              placeholder: filter.placeholder,
              allowMultiple: filter.allowMultiple,
              defaultValue: filter.defaultValue,
              order: filter.order,
            },
            requestBody: filter,
            user,
          }),
        });
        createdFilters.push(createdFilter);
      }

      return {
        dashboardConfig,
        metricsCreated: metricIdMap.size,
        widgetsCreated: createdWidgets.length,
        filtersCreated: createdFilters.length,
      };
    });

    logDatabaseSuccess('dashboard_batch_transaction', req, {
      configId: result.dashboardConfig.id,
      metricsCreated: result.metricsCreated,
      widgetsCreated: result.widgetsCreated,
      filtersCreated: result.filtersCreated,
    });
  } catch (error) {
    logOperationError('createDashboardBatch', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database transaction failed',
      req,
      {
        context: 'dashboard_batch_create',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  // Step 7: Fetch complete result with includes
  let completeResult;
  try {
    logDatabaseStart('fetch_complete_dashboard_config', req, { id: result.dashboardConfig.id });
    completeResult = await prisma.dashboardConfig.findUnique({
      where: { id: result.dashboardConfig.id },
      include: {
        microservice: true,
        widgets: {
          include: {
            model: true,
            metric: true,
            aggregateField: true,
            groupByField: true,
            dateConfig: true,
          },
          orderBy: [{ gridRow: 'asc' }, { gridColumn: 'asc' }],
        },
        filters: {
          include: {
            model: true,
            field: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    });
    logDatabaseSuccess('fetch_complete_dashboard_config', req, { id: completeResult.id });
  } catch (error) {
    logOperationError('createDashboardBatch', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Failed to fetch created dashboard config',
      req,
      {
        context: 'dashboard_batch_create',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  // Fetch created metrics separately
  let createdMetrics;
  try {
    createdMetrics = await prisma.dashboardMetric.findMany({
      where: { microserviceId },
      orderBy: { createdAt: 'asc' },
    });
  } catch (error) {
    logOperationError('createDashboardBatch', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Failed to fetch created metrics',
      req,
      {
        context: 'dashboard_batch_create',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('createDashboardBatch', req, { id: result.dashboardConfig.id });
  res.status(201).json({
    ...completeResult,
    metrics: createdMetrics,
  });
}

module.exports = {
  getAllDashboardConfigs,
  createDashboardConfig,
  getDashboardConfig,
  getDashboardConfigByMicroservice,
  updateDashboardConfig,
  deleteDashboardConfig,
  createDashboardBatch,
};
