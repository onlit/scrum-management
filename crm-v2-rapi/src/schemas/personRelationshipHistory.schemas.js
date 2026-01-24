/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to personRelationshipHistory.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - personRelationshipHistoryCreate.
 * - personRelationshipHistoryUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const personRelationshipHistoryBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  color: Joi.string().max(40).allow('', null).optional(),
});

const personRelationshipHistoryCreate = personRelationshipHistoryBase.keys({
  personRelationshipId: Joi.string().uuid().required(),
  notes: Joi.string().required(),
});

const personRelationshipHistoryUpdate = personRelationshipHistoryBase.keys({
  personRelationshipId: Joi.string().uuid().optional(),
  notes: Joi.string().optional(),
});

module.exports = {
  personRelationshipHistoryCreate,
  personRelationshipHistoryUpdate,
};
