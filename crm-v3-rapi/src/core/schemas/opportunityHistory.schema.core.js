/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to opportunityHistory.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - opportunityHistoryCreate.
 * - opportunityHistoryUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#core/schemas/visibility.schemas.js');

const opportunityHistoryBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  opportunityId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .allow(null)
    .optional(),
  url: Joi.string()
    .uri()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'URL is required',
      'string.uri': 'Please enter a valid URL (e.g., https://example.com)',
    })
    .allow('', null)
    .optional(),
});

const opportunityHistoryCreate = opportunityHistoryBase.keys({
  notes: Joi.string()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .required(),
});

const opportunityHistoryUpdate = opportunityHistoryBase.keys({
  notes: Joi.string()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .optional(),
});

// Bulk visibility update payload: visibility fields + ids array
const opportunityHistoryBulkVisibilityUpdate = visibilityCreate.keys({
  ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  opportunityHistoryCreate,
  opportunityHistoryUpdate,
  opportunityHistoryBulkVisibilityUpdate,
};
