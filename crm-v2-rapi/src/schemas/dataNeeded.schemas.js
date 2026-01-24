/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to dataNeeded.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - dataNeededCreate.
 * - dataNeededUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const dataNeededBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  opportunityId: Joi.string().uuid().allow(null).optional(),
  notes: Joi.string().allow('', null).optional(),
  color: Joi.string().max(40).allow('', null).optional(),
});

const dataNeededCreate = dataNeededBase.keys({
  whoFrom: Joi.string().required(),
  infoNeeded: Joi.string().required(),
});

const dataNeededUpdate = dataNeededBase.keys({
  whoFrom: Joi.string().optional(),
  infoNeeded: Joi.string().optional(),
});

module.exports = { dataNeededCreate, dataNeededUpdate };
