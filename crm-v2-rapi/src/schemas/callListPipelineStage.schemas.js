/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to callListPipelineStage.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - callListPipelineStageCreate.
 * - callListPipelineStageUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const callListPipelineStageBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  color: Joi.string().max(40).allow('', null).optional(),
  description: Joi.string().allow('', null).optional(),
  callListPipelineId: Joi.string().uuid().allow(null).optional(),
});

const callListPipelineStageCreate = callListPipelineStageBase.keys({
  order: Joi.number().min(0).precision(2).required(),
  rottingDays: Joi.number().integer().min(0).max(2147483647).required(),
  name: Joi.string().max(400).required(),
});

const callListPipelineStageUpdate = callListPipelineStageBase.keys({
  order: Joi.number().min(0).precision(2).optional(),
  rottingDays: Joi.number().integer().min(0).max(2147483647).optional(),
  name: Joi.string().max(400).optional(),
});

module.exports = { callListPipelineStageCreate, callListPipelineStageUpdate };
