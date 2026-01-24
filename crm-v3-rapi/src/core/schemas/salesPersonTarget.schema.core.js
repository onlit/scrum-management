/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to salesPersonTarget.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - salesPersonTargetCreate.
 * - salesPersonTargetUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#core/schemas/visibility.schemas.js');
const { validateISODate } = require('#utils/dateValidationUtils.js');

const salesPersonTargetBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  targetUnit: Joi.string()
    .valid('DAILY', 'WEEKLY', 'MONTHLY')
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Please select an option',
      'any.only': 'Please select one of: DAILY, WEEKLY, MONTHLY',
    })
    .allow('', null)
    .optional(),
  target: Joi.number()
    .integer()
    .min(0)
    .max(2147483647)
    .messages({
      'number.base': 'Must be a number',
      'number.integer': 'Must be a whole number (no decimals)',
      'number.min': 'Must be 0 or greater',
      'number.max': 'Number is too large',
    })
    .allow(null)
    .optional(),
  notes: Joi.string()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .allow('', null)
    .optional(),
  expiryDate: Joi.string()
    .custom(validateISODate)
    .messages({
      'string.base': 'Must be a valid date',
      'string.empty': 'Date is required',
    })
    .allow('', null)
    .optional(),
});

const salesPersonTargetCreate = salesPersonTargetBase.keys({
  pipelineId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .required(),
  pipelineStageId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .required(),
  salesPersonId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .required(),
});

const salesPersonTargetUpdate = salesPersonTargetBase.keys({
  pipelineId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .optional(),
  pipelineStageId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .optional(),
  salesPersonId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .optional(),
});

// Bulk visibility update payload: visibility fields + ids array
const salesPersonTargetBulkVisibilityUpdate = visibilityCreate.keys({
  ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  salesPersonTargetCreate,
  salesPersonTargetUpdate,
  salesPersonTargetBulkVisibilityUpdate,
};
