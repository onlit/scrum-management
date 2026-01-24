/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to opportunityProduct.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - opportunityProductCreate.
 * - opportunityProductUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#core/schemas/visibility.schemas.js');

const opportunityProductBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  amount: Joi.number()
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
  estimatedValue: Joi.number()
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
});

const opportunityProductCreate = opportunityProductBase.keys({
  opportunityId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .required(),
  productVariantId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .required(),
});

const opportunityProductUpdate = opportunityProductBase.keys({
  opportunityId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .optional(),
  productVariantId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .optional(),
});

// Bulk visibility update payload: visibility fields + ids array
const opportunityProductBulkVisibilityUpdate = visibilityCreate.keys({
  ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  opportunityProductCreate,
  opportunityProductUpdate,
  opportunityProductBulkVisibilityUpdate,
};
