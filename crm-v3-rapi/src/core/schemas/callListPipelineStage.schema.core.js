/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to callListPipelineStage.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - callListPipelineStageCreate.
 * - callListPipelineStageUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#core/schemas/visibility.schemas.js');

const callListPipelineStageBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  description: Joi.string()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .allow('', null)
    .optional(),
  callListPipelineId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .allow(null)
    .optional(),
});

const callListPipelineStageCreate = callListPipelineStageBase.keys({
  order: Joi.number()
    .min(0)
    .precision(2)
    .messages({
      'number.base': 'Must be a number',
      'number.min': 'Must be 0 or greater',
      'number.precision': 'Maximum 2 decimal places allowed',
    })
    .required(),
  rottingDays: Joi.number()
    .integer()
    .min(0)
    .max(2147483647)
    .messages({
      'number.base': 'Must be a number',
      'number.integer': 'Must be a whole number (no decimals)',
      'number.min': 'Must be 0 or greater',
      'number.max': 'Number is too large',
    })
    .required(),
  name: Joi.string()
    .max(400)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .required(),
});

const callListPipelineStageUpdate = callListPipelineStageBase.keys({
  order: Joi.number()
    .min(0)
    .precision(2)
    .messages({
      'number.base': 'Must be a number',
      'number.min': 'Must be 0 or greater',
      'number.precision': 'Maximum 2 decimal places allowed',
    })
    .optional(),
  rottingDays: Joi.number()
    .integer()
    .min(0)
    .max(2147483647)
    .messages({
      'number.base': 'Must be a number',
      'number.integer': 'Must be a whole number (no decimals)',
      'number.min': 'Must be 0 or greater',
      'number.max': 'Number is too large',
    })
    .optional(),
  name: Joi.string()
    .max(400)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .optional(),
});

// Bulk visibility update payload: visibility fields + ids array
const callListPipelineStageBulkVisibilityUpdate = visibilityCreate.keys({
  ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  callListPipelineStageCreate,
  callListPipelineStageUpdate,
  callListPipelineStageBulkVisibilityUpdate,
};
