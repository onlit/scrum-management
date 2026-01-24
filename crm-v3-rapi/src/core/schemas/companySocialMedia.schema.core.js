/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to companySocialMedia.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - companySocialMediaCreate.
 * - companySocialMediaUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#core/schemas/visibility.schemas.js');

const companySocialMediaBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  companyId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .allow(null)
    .optional(),
  socialMediaId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .allow(null)
    .optional(),
});

const companySocialMediaCreate = companySocialMediaBase.keys({
  url: Joi.string()
    .uri()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'URL is required',
      'string.uri': 'Please enter a valid URL (e.g., https://example.com)',
    })
    .required(),
});

const companySocialMediaUpdate = companySocialMediaBase.keys({
  url: Joi.string()
    .uri()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'URL is required',
      'string.uri': 'Please enter a valid URL (e.g., https://example.com)',
    })
    .optional(),
});

// Bulk visibility update payload: visibility fields + ids array
const companySocialMediaBulkVisibilityUpdate = visibilityCreate.keys({
  ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  companySocialMediaCreate,
  companySocialMediaUpdate,
  companySocialMediaBulkVisibilityUpdate,
};
