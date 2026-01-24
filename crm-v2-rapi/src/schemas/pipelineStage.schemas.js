/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to pipelineStage.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - pipelineStageCreate.
 * - pipelineStageUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const pipelineStageBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  parentPipelineStageId: Joi.string().uuid().allow(null).optional(),
  pipelineId: Joi.string().uuid().allow(null).optional(),
  immediateNextAction: Joi.string().max(200).allow('', null).optional(),
  description: Joi.string().allow('', null).optional(),
  color: Joi.string().max(40).allow('', null).optional(),
  rebase: Joi.boolean().optional(),
});

const pipelineStageCreate = pipelineStageBase.keys({
  order: Joi.number().integer().min(0).max(2147483647).default(0),
  confidence: Joi.number().integer().min(0).max(2147483647).default(0),
  rottingDays: Joi.number().integer().min(0).max(2147483647).default(0),
  conversion: Joi.number().integer().min(0).max(2147483647).default(0),
  stage: Joi.string().max(150).allow('', null).optional(),
});

const pipelineStageUpdate = pipelineStageBase.keys({
  order: Joi.number().integer().min(0).max(2147483647).optional(),
  confidence: Joi.number().integer().min(0).max(2147483647).optional(),
  rottingDays: Joi.number().integer().min(0).max(2147483647).optional(),
  conversion: Joi.number().integer().min(0).max(2147483647).optional(),
  stage: Joi.string().max(150).optional(),
});

module.exports = { pipelineStageCreate, pipelineStageUpdate };
