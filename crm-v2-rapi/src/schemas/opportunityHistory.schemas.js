/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to opportunityHistory.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - opportunityHistoryCreate.
 * - opportunityHistoryUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const opportunityHistoryBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  url: Joi.string().uri().allow('', null).optional(),
  color: Joi.string().max(40).allow('', null).optional(),
});

const opportunityHistoryCreate = opportunityHistoryBase.keys({
  notes: Joi.string().required(),
  opportunityId: Joi.string().uuid().required(),
});

const opportunityHistoryUpdate = opportunityHistoryBase.keys({
  notes: Joi.string().optional(),
  opportunityId: Joi.string().uuid().optional(),
});

module.exports = { opportunityHistoryCreate, opportunityHistoryUpdate };
