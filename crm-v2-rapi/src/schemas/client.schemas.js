/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to client.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - clientCreate.
 * - clientUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const clientBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  opportunityId: Joi.string().uuid().allow(null).optional(),
  notes: Joi.string().allow('', null).optional(),
  color: Joi.string().max(40).allow('', null).optional(),
});

const clientCreate = clientBase.keys({
  companyContactId: Joi.string().uuid().required(),
});

const clientUpdate = clientBase.keys({
  companyContactId: Joi.string().uuid().optional(),
});

const createClientFromOpportunity = Joi.object({
  opportunityId: Joi.string().uuid().required(),
});

const createClientsFromOpportunities = Joi.object({
  opportunityIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  clientCreate,
  clientUpdate,
  createClientFromOpportunity,
  createClientsFromOpportunities,
};
