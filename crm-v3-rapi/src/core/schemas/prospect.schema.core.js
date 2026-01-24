/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to prospect.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - prospectCreate.
 * - prospectUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#core/schemas/visibility.schemas.js');

const prospectBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  disqualificationReason: Joi.string()
    .valid(
      'NO_BUDGET',
      'WRONG_TIMING',
      'LOST_TO_COMPETITOR',
      'UNRESPONSIVE',
      'NOT_A_FIT',
      'OTHER',
    )
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Please select an option',
      'any.only':
        'Please select one of: No Budget, Wrong Timing, Lost to Competitor, Unresponsive, Not a Fit, Other',
    })
    .allow('', null)
    .optional(),
  sourceCampaign: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .allow(null)
    .optional(),
  interestSummary: Joi.string()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .allow('', null)
    .optional(),
  prospectPipelineId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .allow(null)
    .optional(),
  statusId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .allow(null)
    .optional(),
});

const prospectCreate = prospectBase.keys({
  ownerId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .required(),
  categoryId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .required(),
  personId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .required(),
  qualificationScore: Joi.number()
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
  temperature: Joi.string()
    .valid('COLD', 'WARM', 'HOT')
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Please select an option',
      'any.only': 'Please select one of: Cold, Warm, Hot',
    })
    .required(),
});

const prospectUpdate = prospectBase.keys({
  ownerId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .optional(),
  categoryId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .optional(),
  personId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .optional(),
  qualificationScore: Joi.number()
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
  temperature: Joi.string()
    .valid('COLD', 'WARM', 'HOT')
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Please select an option',
      'any.only': 'Please select one of: Cold, Warm, Hot',
    })
    .optional(),
});

// Bulk visibility update payload: visibility fields + ids array
const prospectBulkVisibilityUpdate = visibilityCreate.keys({
  ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  prospectCreate,
  prospectUpdate,
  prospectBulkVisibilityUpdate,
};
