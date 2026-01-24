/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to companyContact.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - companyContactCreate.
 * - companyContactUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#core/schemas/visibility.schemas.js');
const { validateISODate } = require('#utils/dateValidationUtils.js');

const companyContactBase = visibilityCreate.keys({
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
  workEmail: Joi.string()
    .email()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Email is required',
      'string.email': 'Please enter a valid email address',
    })
    .allow('', null)
    .optional(),
  endDate: Joi.string()
    .custom(validateISODate)
    .messages({
      'string.base': 'Must be a valid date',
      'string.empty': 'Date is required',
    })
    .allow('', null)
    .optional(),
  accounts: Joi.boolean()
    .messages({
      'boolean.base': 'Must be Yes or No',
    })
    .allow(null)
    .optional(),
  startDate: Joi.string()
    .custom(validateISODate)
    .messages({
      'string.base': 'Must be a valid date',
      'string.empty': 'Date is required',
    })
    .allow('', null)
    .optional(),
  jobTitle: Joi.string()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .allow('', null)
    .optional(),
  workPhone: Joi.string()
    .pattern(/^\+[1-9]\d{6,14}$/)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Phone number is required',
      'string.pattern.base':
        'Please enter a valid phone number in international format (e.g., +14155552671)',
    })
    .allow('', null)
    .optional(),
  workMobile: Joi.string()
    .pattern(/^\+[1-9]\d{6,14}$/)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Phone number is required',
      'string.pattern.base':
        'Please enter a valid phone number in international format (e.g., +14155552671)',
    })
    .allow('', null)
    .optional(),
});

const companyContactCreate = companyContactBase.keys({
  personId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .required(),
});

const companyContactUpdate = companyContactBase.keys({
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
const companyContactBulkVisibilityUpdate = visibilityCreate.keys({
  ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  companyContactCreate,
  companyContactUpdate,
  companyContactBulkVisibilityUpdate,
};
