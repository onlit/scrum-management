/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to targetActualHistory.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - targetActualHistoryCreate.
 * - targetActualHistoryUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#core/schemas/visibility.schemas.js');

const targetActualHistoryBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
});

const targetActualHistoryCreate = targetActualHistoryBase.keys({
  actuals: Joi.number()
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
  targetId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .required(),
});

const targetActualHistoryUpdate = targetActualHistoryBase.keys({
  actuals: Joi.number()
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
  targetId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .optional(),
});

// Bulk visibility update payload: visibility fields + ids array
const targetActualHistoryBulkVisibilityUpdate = visibilityCreate.keys({
  ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  targetActualHistoryCreate,
  targetActualHistoryUpdate,
  targetActualHistoryBulkVisibilityUpdate,
};
