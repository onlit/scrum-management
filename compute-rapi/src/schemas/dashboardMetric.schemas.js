/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 2024-12-24
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi validation schemas for dashboard metrics.
 * Metrics define custom query configurations for dashboard widgets.
 */

const Joi = require('joi');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');
const {
  METRIC_OUTPUT_TYPES,
  AGGREGATION_TYPES,
} = require('#configs/constants.js');

const dashboardMetricCreate = visibilityCreate.keys({
  microserviceId: Joi.string().uuid().required(),
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

const dashboardMetricUpdate = visibilityCreate.keys({
  microserviceId: Joi.string().uuid().optional(),
  name: Joi.string().max(200).optional(),
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
    .optional(),
  cacheDurationMins: Joi.number().integer().min(0).optional().allow(null),
});

module.exports = {
  dashboardMetricCreate,
  dashboardMetricUpdate,
};
