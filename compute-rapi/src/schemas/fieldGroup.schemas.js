/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 10/11/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi validation schemas for field groups.
 * Field groups allow collective validation requirements across multiple fields
 * (e.g., "at least one field must be filled").
 *
 * The schemas validate:
 * - fieldGroupCreate: Creating new field groups
 * - fieldGroupUpdate: Updating existing field groups
 */

const Joi = require('joi');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');
const { GROUP_REQUIREMENT_TYPES } = require('#configs/constants.js');

const fieldGroupCreate = visibilityCreate.keys({
  modelId: Joi.string().uuid().required(),
  name: Joi.string().max(200).required(),
  label: Joi.string().max(200).optional().allow(null, ''),
  description: Joi.string().optional().allow(null, ''),
  requirementType: Joi.string()
    .valid(...GROUP_REQUIREMENT_TYPES)
    .default('AtLeastOne'),
});

const fieldGroupUpdate = visibilityCreate.keys({
  modelId: Joi.string().uuid().optional(),
  name: Joi.string().max(200).optional(),
  label: Joi.string().max(200).optional().allow(null, ''),
  description: Joi.string().optional().allow(null, ''),
  requirementType: Joi.string()
    .valid(...GROUP_REQUIREMENT_TYPES)
    .optional(),
});

module.exports = {
  fieldGroupCreate,
  fieldGroupUpdate,
};
