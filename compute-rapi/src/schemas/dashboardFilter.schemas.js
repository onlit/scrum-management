/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 2024-12-24
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi validation schemas for dashboard filters.
 * Filters provide dynamic dropdown configurations for dashboard data filtering.
 */

const Joi = require('joi');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const dashboardFilterCreate = visibilityCreate.keys({
  dashboardConfigId: Joi.string().uuid().required(),
  modelId: Joi.string().uuid().required(),
  fieldId: Joi.string().uuid().required(),
  label: Joi.string().max(200).optional().allow(null, ''),
  placeholder: Joi.string().max(200).optional().allow(null, ''),
  allowMultiple: Joi.boolean().default(false),
  defaultValue: Joi.any().optional().allow(null),
  order: Joi.number().optional().allow(null),
});

const dashboardFilterUpdate = visibilityCreate.keys({
  dashboardConfigId: Joi.string().uuid().optional(),
  modelId: Joi.string().uuid().optional(),
  fieldId: Joi.string().uuid().optional(),
  label: Joi.string().max(200).optional().allow(null, ''),
  placeholder: Joi.string().max(200).optional().allow(null, ''),
  allowMultiple: Joi.boolean().optional(),
  defaultValue: Joi.any().optional().allow(null),
  order: Joi.number().optional().allow(null),
});

module.exports = {
  dashboardFilterCreate,
  dashboardFilterUpdate,
};
