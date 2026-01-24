/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 2024-12-24
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi validation schemas for dashboard widgets.
 * Widgets are individual chart/KPI card configurations within a dashboard.
 */

const Joi = require('joi');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');
const {
  WIDGET_TYPES,
  WIDGET_SIZES,
  AGGREGATION_TYPES,
} = require('#configs/constants.js');

const dashboardWidgetCreate = visibilityCreate.keys({
  dashboardConfigId: Joi.string().uuid().required(),
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
  modelId: Joi.string().uuid().optional().allow(null, ''),
  metricId: Joi.string().uuid().optional().allow(null, ''),
  aggregationType: Joi.string()
    .valid(...AGGREGATION_TYPES)
    .optional()
    .allow(null, ''),
  aggregateFieldId: Joi.string().uuid().optional().allow(null, ''),
  groupByFieldId: Joi.string().uuid().optional().allow(null, ''),
  showTrend: Joi.boolean().default(false),
  trendComparisonDays: Joi.number().integer().min(1).optional().allow(null),
  order: Joi.number().optional().allow(null),
});

const dashboardWidgetUpdate = visibilityCreate.keys({
  dashboardConfigId: Joi.string().uuid().optional(),
  title: Joi.string().max(200).optional(),
  description: Joi.string().optional().allow(null, ''),
  widgetType: Joi.string()
    .valid(...WIDGET_TYPES)
    .optional(),
  size: Joi.string()
    .valid(...WIDGET_SIZES)
    .optional(),
  gridColumn: Joi.number().integer().min(1).max(12).optional(),
  gridRow: Joi.number().integer().min(1).optional(),
  modelId: Joi.string().uuid().optional().allow(null, ''),
  metricId: Joi.string().uuid().optional().allow(null, ''),
  aggregationType: Joi.string()
    .valid(...AGGREGATION_TYPES)
    .optional()
    .allow(null, ''),
  aggregateFieldId: Joi.string().uuid().optional().allow(null, ''),
  groupByFieldId: Joi.string().uuid().optional().allow(null, ''),
  showTrend: Joi.boolean().optional(),
  trendComparisonDays: Joi.number().integer().min(1).optional().allow(null),
  order: Joi.number().optional().allow(null),
});

module.exports = {
  dashboardWidgetCreate,
  dashboardWidgetUpdate,
};
