/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to prospectPipelineStage.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - prospectPipelineStageCreate.
 * - prospectPipelineStageUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#core/schemas/visibility.schemas.js');

const prospectPipelineStageBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  immediateNextAction: Joi.string()
    .max(200)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .allow('', null)
    .optional(),
  description: Joi.string()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .allow('', null)
    .optional(),
  parentPipelineStageId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .allow(null)
    .optional(),
  pipelineId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .allow(null)
    .optional(),
});

const prospectPipelineStageCreate = prospectPipelineStageBase.keys({
  order: Joi.number()
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
  confidence: Joi.number()
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
  conversion: Joi.number()
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
  stage: Joi.string()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .required(),
});

const prospectPipelineStageUpdate = prospectPipelineStageBase.keys({
  order: Joi.number()
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
  confidence: Joi.number()
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
  conversion: Joi.number()
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
  stage: Joi.string()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .optional(),
});

// Bulk visibility update payload: visibility fields + ids array
const prospectPipelineStageBulkVisibilityUpdate = visibilityCreate.keys({
  ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  prospectPipelineStageCreate,
  prospectPipelineStageUpdate,
  prospectPipelineStageBulkVisibilityUpdate,
};
