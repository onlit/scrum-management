/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 09/10/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to prospectPipelineStage.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - prospectPipelineStageCreate.
 * - prospectPipelineStageUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const prospectPipelineStageBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  parentPipelineStageId: Joi.string().uuid().allow(null).optional(),
  pipelineId: Joi.string().uuid().allow(null).optional(),
  order: Joi.number().integer().min(0).allow(null).optional(),
  immediateNextAction: Joi.string().max(200).allow('', null).optional(),
  description: Joi.string().allow('', null).optional(),
  confidence: Joi.number().integer().min(0).max(100).allow(null).optional(),
  color: Joi.string().max(40).allow('', null).optional(),
  rottingDays: Joi.number().integer().min(0).allow(null).optional(),
  conversion: Joi.number().integer().min(0).max(100).allow(null).optional(),
  stage: Joi.string().max(150).allow('', null).optional(),
  tags: Joi.string().allow('', null).optional(),
});

const prospectPipelineStageCreate = prospectPipelineStageBase.keys({
  stage: Joi.string().max(150).required(),
  order: Joi.number().integer().min(0).required(),
  confidence: Joi.number().integer().min(0).max(100).required(),
  rottingDays: Joi.number().integer().min(0).required(),
  conversion: Joi.number().integer().min(0).max(100).required(),
});

const prospectPipelineStageUpdate = prospectPipelineStageBase.keys({
  stage: Joi.string().max(150).optional(),
  order: Joi.number().integer().min(0).optional(),
  confidence: Joi.number().integer().min(0).max(100).optional(),
  rottingDays: Joi.number().integer().min(0).optional(),
  conversion: Joi.number().integer().min(0).max(100).optional(),
});

module.exports = { prospectPipelineStageCreate, prospectPipelineStageUpdate };
