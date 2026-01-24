/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to socialMediaType.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - socialMediaTypeCreate.
 * - socialMediaTypeUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#core/schemas/visibility.schemas.js');

const socialMediaTypeBase = visibilityCreate.keys({
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
});

const socialMediaTypeCreate = socialMediaTypeBase.keys({
  name: Joi.string()
    .max(50)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .required(),
});

const socialMediaTypeUpdate = socialMediaTypeBase.keys({
  name: Joi.string()
    .max(50)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .optional(),
});

// Bulk visibility update payload: visibility fields + ids array
const socialMediaTypeBulkVisibilityUpdate = visibilityCreate.keys({
  ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  socialMediaTypeCreate,
  socialMediaTypeUpdate,
  socialMediaTypeBulkVisibilityUpdate,
};
