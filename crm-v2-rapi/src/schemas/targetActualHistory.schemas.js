/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to targetActualHistory.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - targetActualHistoryCreate.
 * - targetActualHistoryUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const targetActualHistoryBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  color: Joi.string().max(40).allow('', null).optional(),
});

const targetActualHistoryCreate = targetActualHistoryBase.keys({
  targetId: Joi.string().uuid().required(),
  actuals: Joi.number().integer().min(0).max(2147483647).required(),
});

const targetActualHistoryUpdate = targetActualHistoryBase.keys({
  targetId: Joi.string().uuid().optional(),
  actuals: Joi.number().integer().min(0).max(2147483647).optional(),
});

module.exports = { targetActualHistoryCreate, targetActualHistoryUpdate };
