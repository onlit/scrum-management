/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to personHistory.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - personHistoryCreate.
 * - personHistoryUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const personHistoryBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  color: Joi.string().max(40).allow('', null).optional(),
  history: Joi.string().allow('', null).optional(),
});

const personHistoryCreate = personHistoryBase.keys({
  notes: Joi.string().required(),
  personId: Joi.string().uuid().required(),
});

const personHistoryUpdate = personHistoryBase.keys({
  notes: Joi.string().optional(),
  personId: Joi.string().uuid().optional(),
});

module.exports = { personHistoryCreate, personHistoryUpdate };
