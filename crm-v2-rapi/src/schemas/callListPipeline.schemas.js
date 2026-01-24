/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to callListPipeline.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - callListPipelineCreate.
 * - callListPipelineUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const callListPipelineBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  color: Joi.string().max(40).allow('', null).optional(),
  description: Joi.string().allow('', null).optional(),
});

const callListPipelineCreate = callListPipelineBase.keys({
  name: Joi.string().max(400).required(),
});

const callListPipelineUpdate = callListPipelineBase.keys({
  name: Joi.string().max(400).optional(),
});

module.exports = { callListPipelineCreate, callListPipelineUpdate };
