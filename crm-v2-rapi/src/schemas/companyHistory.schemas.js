/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to companyHistory.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - companyHistoryCreate.
 * - companyHistoryUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const companyHistoryBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  color: Joi.string().max(40).allow('', null).optional(),
  notes: Joi.string().allow('', null).optional(),
});

const companyHistoryCreate = companyHistoryBase.keys({
  history: Joi.string().required(),
  companyId: Joi.string().uuid().required(),
});

const companyHistoryUpdate = companyHistoryBase.keys({
  history: Joi.string().optional(),
  companyId: Joi.string().uuid().optional(),
});

module.exports = { companyHistoryCreate, companyHistoryUpdate };
