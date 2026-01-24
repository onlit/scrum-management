/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to callHistory.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - callHistoryCreate.
 * - callHistoryUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const callHistoryBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  callScheduleId: Joi.string().uuid().allow(null).optional(),
  color: Joi.string().max(40).allow('', null).optional(),
});

const callHistoryCreate = callHistoryBase.keys({
  outcome: Joi.string().required(),
  callListPipelineStageId: Joi.string().uuid().required(),
});

const callHistoryUpdate = callHistoryBase.keys({
  outcome: Joi.string().optional(),
  callListPipelineStageId: Joi.string().uuid().optional(),
});

module.exports = { callHistoryCreate, callHistoryUpdate };
