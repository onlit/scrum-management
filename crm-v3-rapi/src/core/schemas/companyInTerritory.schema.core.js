/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to companyInTerritory.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - companyInTerritoryCreate.
 * - companyInTerritoryUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#core/schemas/visibility.schemas.js');
const { validateISODate } = require('#utils/dateValidationUtils.js');

const companyInTerritoryBase = visibilityCreate.keys({
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
  expiryDate: Joi.string()
    .custom(validateISODate)
    .messages({
      'string.base': 'Must be a valid date',
      'string.empty': 'Date is required',
    })
    .allow('', null)
    .optional(),
});

const companyInTerritoryCreate = companyInTerritoryBase.keys({
  territoryId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .required(),
});

const companyInTerritoryUpdate = companyInTerritoryBase.keys({
  territoryId: Joi.string()
    .uuid()
    .messages({
      'string.base': 'Must be text',
      'string.empty': 'This field is required',
      'string.guid': 'Invalid identifier format',
    })
    .optional(),
});

// Bulk visibility update payload: visibility fields + ids array
const companyInTerritoryBulkVisibilityUpdate = visibilityCreate.keys({
  ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  companyInTerritoryCreate,
  companyInTerritoryUpdate,
  companyInTerritoryBulkVisibilityUpdate,
};
