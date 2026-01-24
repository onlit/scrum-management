/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 2024-12-24
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi validation schemas for dashboard configurations.
 * Dashboard configs provide microservice-level dashboard settings.
 */

const Joi = require('joi');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');
const {
  DATE_RANGE_PRESETS,
  WIDGET_TYPES,
  WIDGET_SIZES,
  AGGREGATION_TYPES,
  METRIC_OUTPUT_TYPES,
} = require('#configs/constants.js');

const dashboardConfigCreate = visibilityCreate.keys({
  microserviceId: Joi.string().uuid().required(),
  title: Joi.string().max(200).optional().allow(null, ''),
  description: Joi.string().optional().allow(null, ''),
  enableDateFilter: Joi.boolean().default(true),
  defaultDateRange: Joi.string()
    .valid(...DATE_RANGE_PRESETS)
    .default('Last30Days'),
  dateFieldName: Joi.string().max(100).optional().allow(null, ''),
});

const dashboardConfigUpdate = visibilityCreate.keys({
  microserviceId: Joi.string().uuid().optional(),
  title: Joi.string().max(200).optional().allow(null, ''),
  description: Joi.string().optional().allow(null, ''),
  enableDateFilter: Joi.boolean().optional(),
  defaultDateRange: Joi.string()
    .valid(...DATE_RANGE_PRESETS)
    .optional(),
  dateFieldName: Joi.string().max(100).optional().allow(null, ''),
});

// Batch creation schemas

// Inline metric definition for batch creation (no microserviceId - inherited from root)
const dashboardMetricBatchItem = visibilityCreate.keys({
  reference: Joi.string().required(),
  name: Joi.string().max(200).required(),
  label: Joi.string().max(200).optional().allow(null, ''),
  description: Joi.string().optional().allow(null, ''),

  // Query config - relational fields
  modelId: Joi.string().uuid().optional().allow(null, ''),
  modelName: Joi.string().max(200).optional().allow(null, ''),
  aggregationType: Joi.string()
    .valid(...AGGREGATION_TYPES)
    .optional()
    .allow(null, ''),
  aggregateFieldId: Joi.string().uuid().optional().allow(null, ''),
  aggregateFieldName: Joi.string().max(200).optional().allow(null, ''),
  groupByFieldId: Joi.string().uuid().optional().allow(null, ''),
  groupByFieldName: Joi.string().max(200).optional().allow(null, ''),
  whereConditions: Joi.object().optional().allow(null),
  queryJoins: Joi.object().optional().allow(null),

  outputType: Joi.string()
    .valid(...METRIC_OUTPUT_TYPES)
    .default('Number'),
  cacheDurationMins: Joi.number().integer().min(0).optional().allow(null),
});

// Inline widget date config (no widgetId - created with widget)
const widgetDateConfigBatchItem = visibilityCreate.keys({
  // Date field can be specified by ID or name (name requires modelName context from parent widget)
  dateFieldId: Joi.string().uuid().optional().allow(null, ''),
  dateFieldName: Joi.string().max(200).optional().allow(null, ''),
  defaultRange: Joi.string()
    .valid(...DATE_RANGE_PRESETS)
    .default('Last30Days'),
  ignoreGlobalFilter: Joi.boolean().default(false),
});

// Widget definition for batch creation (no dashboardConfigId - inherited)
const dashboardWidgetBatchItem = visibilityCreate.keys({
  title: Joi.string().max(200).required(),
  description: Joi.string().optional().allow(null, ''),
  widgetType: Joi.string()
    .valid(...WIDGET_TYPES)
    .required(),
  size: Joi.string()
    .valid(...WIDGET_SIZES)
    .default('Medium'),
  gridColumn: Joi.number().integer().min(1).max(12).default(1),
  gridRow: Joi.number().integer().min(1).default(1),

  // Data source - mutually exclusive: metricReference OR modelId/modelName
  // Model can be specified by ID or name
  modelId: Joi.string().uuid().optional().allow(null, ''),
  modelName: Joi.string().max(200).optional().allow(null, ''),
  // Metric reference (references metric.reference in the same batch)
  metricReference: Joi.string().optional().allow(null, ''),

  aggregationType: Joi.string()
    .valid(...AGGREGATION_TYPES)
    .optional()
    .allow(null, ''),
  // Aggregate field can be specified by ID or name
  aggregateFieldId: Joi.string().uuid().optional().allow(null, ''),
  aggregateFieldName: Joi.string().max(200).optional().allow(null, ''),
  // Group by field can be specified by ID or name
  groupByFieldId: Joi.string().uuid().optional().allow(null, ''),
  groupByFieldName: Joi.string().max(200).optional().allow(null, ''),
  showTrend: Joi.boolean().default(false),
  trendComparisonDays: Joi.number().integer().min(1).optional().allow(null),
  order: Joi.number().optional().allow(null),

  // Nested date config (optional)
  dateConfig: widgetDateConfigBatchItem.optional().allow(null),
});

// Filter definition for batch creation (no dashboardConfigId - inherited)
const dashboardFilterBatchItem = visibilityCreate.keys({
  // Model can be specified by ID or name
  modelId: Joi.string().uuid().optional().allow(null, ''),
  modelName: Joi.string().max(200).optional().allow(null, ''),
  // Field can be specified by ID or name
  fieldId: Joi.string().uuid().optional().allow(null, ''),
  fieldName: Joi.string().max(200).optional().allow(null, ''),
  label: Joi.string().max(200).optional().allow(null, ''),
  placeholder: Joi.string().max(200).optional().allow(null, ''),
  allowMultiple: Joi.boolean().default(false),
  defaultValue: Joi.any().optional().allow(null),
  order: Joi.number().optional().allow(null),
});

// Main batch create schema (flat structure - config fields at root level)
const dashboardBatchCreate = Joi.object({
  // Internal request fields (required when request is internal)
  createdBy: Joi.string().uuid().optional(),
  client: Joi.string().uuid().optional(),
  microserviceId: Joi.string().uuid().required(),
  // Config fields (flat, not nested)
  title: Joi.string().max(200).optional().allow(null, ''),
  description: Joi.string().optional().allow(null, ''),
  enableDateFilter: Joi.boolean().default(true),
  defaultDateRange: Joi.string()
    .valid(...DATE_RANGE_PRESETS)
    .default('Last30Days'),
  dateFieldName: Joi.string().max(100).optional().allow(null, ''),
  // Data arrays
  metrics: Joi.array().items(dashboardMetricBatchItem).default([]),
  widgets: Joi.array().items(dashboardWidgetBatchItem).min(1).required(),
  filters: Joi.array().items(dashboardFilterBatchItem).default([]),
}).custom((value, helpers) => {
  // Custom validation: check metricReference references exist
  const metricReferences = new Set((value.metrics || []).map((m) => m.reference));

  for (const widget of value.widgets || []) {
    if (widget.metricReference && !metricReferences.has(widget.metricReference)) {
      return helpers.error('any.custom', {
        message: `Widget "${widget.title}" references non-existent metric reference: ${widget.metricReference}`,
      });
    }

    // Ensure mutual exclusivity: metricReference XOR (modelId OR modelName)
    const hasMetricRef = !!widget.metricReference;
    const hasModelRef = !!(widget.modelId || widget.modelName);
    if (hasMetricRef && hasModelRef) {
      return helpers.error('any.custom', {
        message: `Widget "${widget.title}" cannot have both metricReference and modelId/modelName`,
      });
    }
    // Ensure at least one data source is provided
    if (!hasMetricRef && !hasModelRef) {
      return helpers.error('any.custom', {
        message: `Widget "${widget.title}" must have either metricReference or modelId/modelName`,
      });
    }
  }

  // Validate filters have either modelId or modelName (at least one required)
  for (const filter of value.filters || []) {
    if (!filter.modelId && !filter.modelName) {
      return helpers.error('any.custom', {
        message: `Filter with label "${filter.label || '(no label)'}" must have either modelId or modelName`,
      });
    }
    if (!filter.fieldId && !filter.fieldName) {
      return helpers.error('any.custom', {
        message: `Filter with label "${filter.label || '(no label)'}" must have either fieldId or fieldName`,
      });
    }
  }

  // Validate widget dateConfig has either dateFieldId or dateFieldName
  for (const widget of value.widgets || []) {
    if (widget.dateConfig && !widget.dateConfig.dateFieldId && !widget.dateConfig.dateFieldName) {
      return helpers.error('any.custom', {
        message: `Widget "${widget.title}" dateConfig must have either dateFieldId or dateFieldName`,
      });
    }
  }

  return value;
});

module.exports = {
  dashboardConfigCreate,
  dashboardConfigUpdate,
  dashboardBatchCreate,
};
