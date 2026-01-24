/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to person.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - personCreate.
 * - personUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#core/schemas/visibility.schemas.js');
const { validateISODate } = require('#utils/dateValidationUtils.js');

const personBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  middleName: Joi.string()
    .max(100)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .allow('', null)
    .optional(),
  preferredName: Joi.string()
    .max(100)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .allow('', null)
    .optional(),
  username: Joi.string()
    .max(100)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .allow('', null)
    .optional(),
  homePhone: Joi.string()
    .pattern(/^\+[1-9]\d{6,14}$/)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Phone number is required',
      'string.pattern.base':
        'Please enter a valid phone number in international format (e.g., +14155552671)',
    })
    .allow('', null)
    .optional(),
  avatar: Joi.string()
    .max(200)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
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
  dob: Joi.string()
    .custom(validateISODate)
    .messages({
      'string.base': 'Must be a valid date',
      'string.empty': 'Date is required',
    })
    .allow('', null)
    .optional(),
  personalMobile: Joi.string()
    .pattern(/^\+[1-9]\d{6,14}$/)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Phone number is required',
      'string.pattern.base':
        'Please enter a valid phone number in international format (e.g., +14155552671)',
    })
    .allow('', null)
    .optional(),
  zip: Joi.string()
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
  parentId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .allow(null)
    .optional(),
  companyOwnerId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .allow(null)
    .optional(),
  source: Joi.string()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .allow('', null)
    .optional(),
  sourceNotes: Joi.string()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .allow('', null)
    .optional(),
  owner: Joi.string()
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
  lastName: Joi.string()
    .max(100)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .allow('', null)
    .optional(),
  status: Joi.string()
    .valid('APPLICANT', 'NEW')
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Please select an option',
      'any.only': 'Please select one of: APPLICANT, NEW',
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
  user: Joi.string()
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
});

const personCreate = personBase.keys({
  firstName: Joi.string()
    .max(100)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .required(),
  hasWhatsapp: Joi.boolean()
    .messages({
      'boolean.base': 'Must be Yes or No',
    })
    .required(),
  email: Joi.string()
    .email()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Email is required',
      'string.email': 'Please enter a valid email address',
    })
    .required(),
});

const personUpdate = personBase.keys({
  firstName: Joi.string()
    .max(100)
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Cannot be empty',
      'string.min': 'Must be at least {#limit} characters',
      'string.max': 'Cannot exceed {#limit} characters',
    })
    .optional(),
  hasWhatsapp: Joi.boolean()
    .messages({
      'boolean.base': 'Must be Yes or No',
    })
    .optional(),
  email: Joi.string()
    .email()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'Email is required',
      'string.email': 'Please enter a valid email address',
    })
    .optional(),
});

// Bulk visibility update payload: visibility fields + ids array
const personBulkVisibilityUpdate = visibilityCreate.keys({
  ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  personCreate,
  personUpdate,
  personBulkVisibilityUpdate,
};
