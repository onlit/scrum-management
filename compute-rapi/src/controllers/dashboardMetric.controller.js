/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 2024-12-24
 *
 * DESCRIPTION:
 * ------------------
 * This module defines controller functions for managing dashboard metrics.
 * Metrics define custom query configurations for complex dashboard visualizations.
 */

const prisma = require('#configs/prisma.js');
const {
  dashboardMetricCreate,
  dashboardMetricUpdate,
} = require('#schemas/dashboardMetric.schemas.js');
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

async function getAllDashboardMetrics(req, res) {
  const { user, query } = req;

  logOperationStart('getAllDashboardMetrics', req, { user: user?.id, query });
  const searchFields = ['name', 'label', 'description'];
  const filterFields = [
    ...searchFields,
    'microserviceId',
    'outputType',
    'modelId',
    'aggregationType',
  ];

  let response;
  try {
    logDatabaseStart('get_paginated_dashboard_metrics', req, {
      searchFields,
      filterFields,
    });
    response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: dashboardMetricUpdate,
      filterFields,
      searchFields,
      model: 'dashboardMetric',
      include: {
        microservice: true,
        widgets: true,
        model: true,
        aggregateField: true,
        groupByField: true,
      },
    });
    logDatabaseSuccess('get_paginated_dashboard_metrics', req, {
      count: response.data?.length,
    });
  } catch (error) {
    logOperationError('getAllDashboardMetrics', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Failed to fetch dashboard metrics',
      req,
      {
        context: 'get_all_dashboard_metrics',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('getAllDashboardMetrics', req, {
    count: response.data?.length,
  });
  res.status(200).json(response);
}

async function createDashboardMetric(req, res) {
  const { user, body } = req;

  logOperationStart('createDashboardMetric', req, {
    user: user?.id,
    bodyKeys: Object.keys(body),
  });

  let values;
  try {
    values = await dashboardMetricCreate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('createDashboardMetric', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'create_dashboard_metric',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('createDashboardMetric', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'create_dashboard_metric',
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
    logOperationError('createDashboardMetric', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_dashboard_metric',
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
        context: 'create_dashboard_metric',
        severity: ERROR_SEVERITY.LOW,
        details: { microserviceId: values.microserviceId },
      }
    );
    logOperationError('createDashboardMetric', req, error);
    throw error;
  }

  // Check for duplicate metric name in same microservice
  let existing;
  try {
    logDatabaseStart('find_existing_dashboard_metric', req, {
      microserviceId: values.microserviceId,
      name: values.name,
    });
    existing = await prisma.dashboardMetric.findFirst({
      where: {
        microserviceId: values.microserviceId,
        name: values.name,
        deleted: null,
      },
    });
    logDatabaseSuccess('find_existing_dashboard_metric', req, {
      found: !!existing,
    });
  } catch (error) {
    logOperationError('createDashboardMetric', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_dashboard_metric',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (existing) {
    const error = createErrorWithTrace(
      ERROR_TYPES.CONFLICT,
      'A metric with this name already exists for this microservice',
      req,
      {
        context: 'create_dashboard_metric',
        severity: ERROR_SEVERITY.LOW,
        details: { microserviceId: values.microserviceId, name: values.name },
      }
    );
    logOperationError('createDashboardMetric', req, error);
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
      logOperationError('createDashboardMetric', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.INTERNAL,
        'Database operation failed',
        req,
        {
          context: 'create_dashboard_metric',
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
          context: 'create_dashboard_metric',
          severity: ERROR_SEVERITY.LOW,
          details: { modelId: values.modelId },
        }
      );
      logOperationError('createDashboardMetric', req, error);
      throw error;
    }
  }

  // Validate aggregateField exists if provided
  if (values.aggregateFieldId) {
    let field;
    try {
      logDatabaseStart('find_aggregate_field', req, {
        fieldId: values.aggregateFieldId,
      });
      field = await prisma.fieldDefn.findUnique({
        where: { id: values.aggregateFieldId },
      });
      logDatabaseSuccess('find_aggregate_field', req, { found: !!field });
    } catch (error) {
      logOperationError('createDashboardMetric', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.INTERNAL,
        'Database operation failed',
        req,
        {
          context: 'create_dashboard_metric',
          severity: ERROR_SEVERITY.HIGH,
          originalError: error,
        }
      );
    }

    if (!field) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Aggregate field not found',
        req,
        {
          context: 'create_dashboard_metric',
          severity: ERROR_SEVERITY.LOW,
          details: { aggregateFieldId: values.aggregateFieldId },
        }
      );
      logOperationError('createDashboardMetric', req, error);
      throw error;
    }
  }

  // Validate groupByField exists if provided
  if (values.groupByFieldId) {
    let field;
    try {
      logDatabaseStart('find_group_by_field', req, {
        fieldId: values.groupByFieldId,
      });
      field = await prisma.fieldDefn.findUnique({
        where: { id: values.groupByFieldId },
      });
      logDatabaseSuccess('find_group_by_field', req, { found: !!field });
    } catch (error) {
      logOperationError('createDashboardMetric', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.INTERNAL,
        'Database operation failed',
        req,
        {
          context: 'create_dashboard_metric',
          severity: ERROR_SEVERITY.HIGH,
          originalError: error,
        }
      );
    }

    if (!field) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'GroupBy field not found',
        req,
        {
          context: 'create_dashboard_metric',
          severity: ERROR_SEVERITY.LOW,
          details: { groupByFieldId: values.groupByFieldId },
        }
      );
      logOperationError('createDashboardMetric', req, error);
      throw error;
    }
  }

  let metric;
  try {
    logDatabaseStart('create_dashboard_metric', req, {
      name: values.name,
      microserviceId: values.microserviceId,
    });
    metric = await prisma.dashboardMetric.create({
      data: buildCreateRecordPayload({
        validatedValues: values,
        requestBody: body,
        user,
      }),
      include: {
        microservice: true,
        widgets: true,
        model: true,
        aggregateField: true,
        groupByField: true,
      },
    });
    logDatabaseSuccess('create_dashboard_metric', req, { id: metric.id });
  } catch (error) {
    logOperationError('createDashboardMetric', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_dashboard_metric',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('createDashboardMetric', req, { id: metric.id });
  res.status(201).json(metric);
}

async function getDashboardMetric(req, res) {
  const { params, user } = req;

  logOperationStart('getDashboardMetric', req, { user: user?.id, id: params?.id });

  let metric;
  try {
    logDatabaseStart('find_dashboard_metric', req, { id: params?.id });
    metric = await prisma.dashboardMetric.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: {
        microservice: true,
        widgets: true,
        model: true,
        aggregateField: true,
        groupByField: true,
      },
    });
    logDatabaseSuccess('find_dashboard_metric', req, { found: !!metric });
  } catch (error) {
    logOperationError('getDashboardMetric', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'get_dashboard_metric',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!metric) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Dashboard metric not found',
      req,
      {
        context: 'get_dashboard_metric',
        severity: ERROR_SEVERITY.LOW,
        details: { id: params?.id },
      }
    );
    logOperationError('getDashboardMetric', req, error);
    throw error;
  }

  logOperationSuccess('getDashboardMetric', req, { id: metric.id });
  res.status(200).json(metric);
}

async function updateDashboardMetric(req, res) {
  const { params, body, user } = req;

  logOperationStart('updateDashboardMetric', req, {
    user: user?.id,
    id: params?.id,
    bodyKeys: Object.keys(body),
  });

  let values;
  try {
    values = await dashboardMetricUpdate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('updateDashboardMetric', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'update_dashboard_metric',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('updateDashboardMetric', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'update_dashboard_metric',
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
    });
  }

  let existingMetric;
  try {
    logDatabaseStart('find_dashboard_metric', req, { id: params?.id });
    existingMetric = await prisma.dashboardMetric.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
    });
    logDatabaseSuccess('find_dashboard_metric', req, { found: !!existingMetric });
  } catch (error) {
    logOperationError('updateDashboardMetric', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'update_dashboard_metric',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!existingMetric) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Dashboard metric not found',
      req,
      {
        context: 'update_dashboard_metric',
        severity: ERROR_SEVERITY.LOW,
        details: { id: params?.id },
      }
    );
    logOperationError('updateDashboardMetric', req, error);
    throw error;
  }

  let updated;
  try {
    logDatabaseStart('update_dashboard_metric', req, {
      id: params?.id,
      name: values.name,
    });
    updated = await prisma.dashboardMetric.update({
      where: { id: params?.id },
      data: {
        name: values.name,
        label: values.label,
        description: values.description,
        modelId: values.modelId,
        aggregationType: values.aggregationType,
        aggregateFieldId: values.aggregateFieldId,
        groupByFieldId: values.groupByFieldId,
        whereConditions: values.whereConditions,
        queryJoins: values.queryJoins,
        outputType: values.outputType,
        cacheDurationMins: values.cacheDurationMins,
        updatedBy: user.id,
      },
      include: {
        microservice: true,
        widgets: true,
        model: true,
        aggregateField: true,
        groupByField: true,
      },
    });
    logDatabaseSuccess('update_dashboard_metric', req, { id: updated.id });
  } catch (error) {
    logOperationError('updateDashboardMetric', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'update_dashboard_metric',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('updateDashboardMetric', req, { id: updated.id });
  res.status(200).json(updated);
}

async function deleteDashboardMetric(req, res) {
  const { params, user } = req;

  logOperationStart('deleteDashboardMetric', req, {
    user: user?.id,
    id: params?.id,
  });

  try {
    logDatabaseStart('delete_dashboard_metric', req, { id: params?.id });
    await prisma.dashboardMetric.deleteMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });
    logDatabaseSuccess('delete_dashboard_metric', req, { id: params?.id });
  } catch (error) {
    logOperationError('deleteDashboardMetric', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'delete_dashboard_metric',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('deleteDashboardMetric', req, { deleted: params?.id });
  res.status(200).json({ deleted: params?.id });
}

module.exports = {
  getAllDashboardMetrics,
  createDashboardMetric,
  getDashboardMetric,
  updateDashboardMetric,
  deleteDashboardMetric,
};
