/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
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
const { validateISODate } = require('#utils/shared/dateValidation.js');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const territoryOwnerBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  color: Joi.string().max(40).allow('', null).optional(),
  expiryDate: Joi.string()
    .custom(validateISODate)
    .allow('', null)
    .optional(),
  territoryId: Joi.string().uuid().allow(null).optional(),
});

const territoryOwnerCreate = territoryOwnerBase.keys({
  salesPersonId: Joi.string().uuid().required(),
});

const territoryOwnerUpdate = territoryOwnerBase.keys({
  salesPersonId: Joi.string().uuid().optional(),
});

module.exports = { territoryOwnerCreate, territoryOwnerUpdate };
