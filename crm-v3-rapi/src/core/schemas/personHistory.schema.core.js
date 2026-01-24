/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to personHistory.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - personHistoryCreate.
 * - personHistoryUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#core/schemas/visibility.schemas.js');

const personHistoryBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  history: Joi.string()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .allow('', null)
    .optional(),
});

const personHistoryCreate = personHistoryBase.keys({
  notes: Joi.string()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
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

const personHistoryUpdate = personHistoryBase.keys({
  notes: Joi.string()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
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
const personHistoryBulkVisibilityUpdate = visibilityCreate.keys({
  ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  personHistoryCreate,
  personHistoryUpdate,
  personHistoryBulkVisibilityUpdate,
};
