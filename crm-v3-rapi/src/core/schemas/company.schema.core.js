/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to company.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - companyCreate.
 * - companyUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#core/schemas/visibility.schemas.js');

const companyBase = visibilityCreate.keys({
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
  email: Joi.string()
    .email()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Email is required',
      'string.email': 'Please enter a valid email address',
    })
    .allow('', null)
    .optional(),
  fax: Joi.string()
    .max(25)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .allow('', null)
    .optional(),
  staffUrl: Joi.string()
    .uri()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'URL is required',
      'string.uri': 'Please enter a valid URL (e.g., https://example.com)',
    })
    .allow('', null)
    .optional(),
  contactUrl: Joi.string()
    .uri()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'URL is required',
      'string.uri': 'Please enter a valid URL (e.g., https://example.com)',
    })
    .allow('', null)
    .optional(),
  address1: Joi.string()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .allow('', null)
    .optional(),
  address2: Joi.string()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .allow('', null)
    .optional(),
  stateId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .allow(null)
    .optional(),
  zip: Joi.string()
    .max(15)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .allow('', null)
    .optional(),
  size: Joi.string()
    .valid(
      'SIZE_1',
      'SIZE_2_TO_10',
      'SIZE_11_TO_50',
      'SIZE_51_TO_100',
      'SIZE_101_TO_250',
      'SIZE_251_TO_500',
      'SIZE_501_TO_1000',
      'SIZE_1001_TO_10000',
    )
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Please select an option',
      'any.only':
        'Please select one of: 1, 2-10, 11-50, 51-100, 101-250, 251-500, 501-1000, 1001-10000',
    })
    .allow('', null)
    .optional(),
  industryId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .allow(null)
    .optional(),
  keywords: Joi.string()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .allow('', null)
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
  branchOfId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .allow(null)
    .optional(),
  ownerId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .allow(null)
    .optional(),
  website: Joi.string()
    .uri()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'URL is required',
      'string.uri': 'Please enter a valid URL (e.g., https://example.com)',
    })
    .allow('', null)
    .optional(),
  newsUrl: Joi.string()
    .uri()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'URL is required',
      'string.uri': 'Please enter a valid URL (e.g., https://example.com)',
    })
    .allow('', null)
    .optional(),
  phone: Joi.string()
    .pattern(/^\+[1-9]\d{6,14}$/)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Phone number is required',
      'string.pattern.base':
        'Please enter a valid phone number in international format (e.g., +14155552671)',
    })
    .allow('', null)
    .optional(),
  countryId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .allow(null)
    .optional(),
  cityId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .allow(null)
    .optional(),
  companyIntelligence: Joi.string()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .allow('', null)
    .optional(),
});

const companyCreate = companyBase.keys({
  name: Joi.string()
    .max(150)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .required(),
  betaPartners: Joi.boolean()
    .messages({
      'boolean.base': 'Must be Yes or No',
    })
    .required(),
});

const companyUpdate = companyBase.keys({
  name: Joi.string()
    .max(150)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .optional(),
  betaPartners: Joi.boolean()
    .messages({
      'boolean.base': 'Must be Yes or No',
    })
    .optional(),
});

// Bulk visibility update payload: visibility fields + ids array
const companyBulkVisibilityUpdate = visibilityCreate.keys({
  ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  companyCreate,
  companyUpdate,
  companyBulkVisibilityUpdate,
};
