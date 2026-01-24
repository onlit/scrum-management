/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to territoryOwner.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - territoryOwnerCreate.
 * - territoryOwnerUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#core/schemas/visibility.schemas.js');
const { validateISODate } = require('#utils/dateValidationUtils.js');

const territoryOwnerBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  territoryId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .allow(null)
    .optional(),
  expiryDate: Joi.string()
    .custom(validateISODate)
    .messages({
      'string.base': 'Must be a valid date',
      'string.empty': 'Date is required',
    })
    .allow('', null)
    .optional(),
});

const territoryOwnerCreate = territoryOwnerBase.keys({
  salesPersonId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .required(),
});

const territoryOwnerUpdate = territoryOwnerBase.keys({
  salesPersonId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .optional(),
});

// Bulk visibility update payload: visibility fields + ids array
const territoryOwnerBulkVisibilityUpdate = visibilityCreate.keys({
  ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  territoryOwnerCreate,
  territoryOwnerUpdate,
  territoryOwnerBulkVisibilityUpdate,
};
