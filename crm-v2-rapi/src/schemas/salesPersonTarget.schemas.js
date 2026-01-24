/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to salesPersonTarget.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - salesPersonTargetCreate.
 * - salesPersonTargetUpdate.
 *
 *
 */

const Joi = require('joi');
const { validateISODate } = require('#utils/shared/dateValidation.js');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const salesPersonTargetBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  target: Joi.number().integer().min(0).max(2147483647).allow(null).optional(),
  targetUnit: Joi.string()
    .valid('DAILY', 'WEEKLY', 'MONTHLY')
    .allow('', null)
    .optional(),
  color: Joi.string().max(40).allow('', null).optional(),
  notes: Joi.string().allow('', null).optional(),
  expiryDate: Joi.string().custom(validateISODate).allow('', null).optional(),
});

const salesPersonTargetCreate = salesPersonTargetBase.keys({
  pipelineStageId: Joi.string().uuid().required(),
  salesPersonId: Joi.string().uuid().required(),
  pipelineId: Joi.string().uuid().required(),
});

const salesPersonTargetUpdate = salesPersonTargetBase.keys({
  pipelineStageId: Joi.string().uuid().optional(),
  salesPersonId: Joi.string().uuid().optional(),
  pipelineId: Joi.string().uuid().optional(),
});

module.exports = { salesPersonTargetCreate, salesPersonTargetUpdate };
