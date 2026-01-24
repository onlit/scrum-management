/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to callSchedule.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - callScheduleCreate.
 * - callScheduleUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#core/schemas/visibility.schemas.js');
const { validateISODateTime } = require('#utils/dateValidationUtils.js');

const callScheduleBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  callListId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .allow(null)
    .optional(),
});

const callScheduleCreate = callScheduleBase.keys({
  callListPipelineStageId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .required(),
  scheduleDatetime: Joi.string()
    .custom(validateISODateTime)
    .messages({
      'string.base': 'Must be a valid date and time',
      'string.empty': 'Date and time is required',
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
});

const callScheduleUpdate = callScheduleBase.keys({
  callListPipelineStageId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .optional(),
  scheduleDatetime: Joi.string()
    .custom(validateISODateTime)
    .messages({
      'string.base': 'Must be a valid date and time',
      'string.empty': 'Date and time is required',
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
});

// Bulk visibility update payload: visibility fields + ids array
const callScheduleBulkVisibilityUpdate = visibilityCreate.keys({
  ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  callScheduleCreate,
  callScheduleUpdate,
  callScheduleBulkVisibilityUpdate,
};
