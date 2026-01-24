/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
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
const { validateISODate } = require('#utils/shared/dateValidation.js');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const companyInTerritoryBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  companyId: Joi.string().uuid().allow(null).optional(),
  color: Joi.string().max(40).allow('', null).optional(),
  expiryDate: Joi.string()
    .custom(validateISODate)
    .allow('', null)
    .optional(),
});

const companyInTerritoryCreate = companyInTerritoryBase.keys({
  companyId: Joi.string().uuid().required(),
  territoryId: Joi.string().uuid().required(),
});

const companyInTerritoryUpdate = companyInTerritoryBase.keys({
  territoryId: Joi.string().uuid().optional(),
});

module.exports = { companyInTerritoryCreate, companyInTerritoryUpdate };
