/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to opportunityInfluencer.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - opportunityInfluencerCreate.
 * - opportunityInfluencerUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const opportunityInfluencerBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  desireForSelf: Joi.string().allow('', null).optional(),
  color: Joi.string().max(40).allow('', null).optional(),
  rating: Joi.number().integer().min(0).max(2147483647).allow(null).optional(),
  desireForCompany: Joi.string().allow('', null).optional(),
  opportunityId: Joi.string().uuid().allow(null).optional(),
});

const opportunityInfluencerCreate = opportunityInfluencerBase.keys({
  role: Joi.string().required(),
  companyContactId: Joi.string().uuid().required(),
});

const opportunityInfluencerUpdate = opportunityInfluencerBase.keys({
  role: Joi.string().optional(),
  companyContactId: Joi.string().uuid().optional(),
});

module.exports = { opportunityInfluencerCreate, opportunityInfluencerUpdate };
