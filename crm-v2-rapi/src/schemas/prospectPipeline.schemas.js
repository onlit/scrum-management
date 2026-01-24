/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 09/10/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to prospectPipeline.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - prospectPipelineCreate.
 * - prospectPipelineUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const prospectPipelineBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  color: Joi.string().max(40).allow('', null).optional(),
  description: Joi.string().allow('', null).optional(),
  name: Joi.string().max(50).allow('', null).optional(),
  tags: Joi.string().allow('', null).optional(),
});

const prospectPipelineCreate = prospectPipelineBase.keys({
  name: Joi.string().max(50).required(),
});

const prospectPipelineUpdate = prospectPipelineBase.keys({
  name: Joi.string().max(50).optional(),
});

module.exports = { prospectPipelineCreate, prospectPipelineUpdate };
