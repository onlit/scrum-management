/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
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
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const companySocialMediaBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  color: Joi.string().max(40).allow('', null).optional(),
  companyId: Joi.string().uuid().allow(null).optional(),
  socialMediaId: Joi.string().uuid().allow(null).optional(),
});

const companySocialMediaCreate = companySocialMediaBase.keys({
  url: Joi.string().uri().required(),
});

const companySocialMediaUpdate = companySocialMediaBase.keys({
  url: Joi.string().uri().optional(),
});

module.exports = { companySocialMediaCreate, companySocialMediaUpdate };
