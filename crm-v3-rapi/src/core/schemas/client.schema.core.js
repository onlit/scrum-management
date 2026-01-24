/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to client.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - clientCreate.
 * - clientUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#core/schemas/visibility.schemas.js');

const clientBase = visibilityCreate.keys({
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
  notes: Joi.string()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .allow('', null)
    .optional(),
});

const clientCreate = clientBase.keys({
  companyContactId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .required(),
});

const clientUpdate = clientBase.keys({
  companyContactId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .optional(),
});

// Bulk visibility update payload: visibility fields + ids array
const clientBulkVisibilityUpdate = visibilityCreate.keys({
  ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  clientCreate,
  clientUpdate,
  clientBulkVisibilityUpdate,
};
