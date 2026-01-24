/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to callList.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - callListCreate.
 * - callListUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const callListBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  color: Joi.string().max(40).allow('', null).optional(),
  description: Joi.string().allow('', null).optional(),
});

const callListCreate = callListBase.keys({
  name: Joi.string().max(400).required(),
  callListPipelineId: Joi.string().uuid().required(),
});

const callListUpdate = callListBase.keys({
  name: Joi.string().max(400).optional(),
  callListPipelineId: Joi.string().uuid().optional(),
});

module.exports = { callListCreate, callListUpdate };
