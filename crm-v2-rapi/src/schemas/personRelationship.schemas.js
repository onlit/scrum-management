/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to personRelationship.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - personRelationshipCreate.
 * - personRelationshipUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const personRelationshipBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  color: Joi.string().max(40).allow('', null).optional(),
});

const personRelationshipCreate = personRelationshipBase.keys({
  personId: Joi.string().uuid().required(),
  relationshipId: Joi.string().uuid().required(),
});

const personRelationshipUpdate = personRelationshipBase.keys({
  personId: Joi.string().uuid().optional(),
  relationshipId: Joi.string().uuid().optional(),
});

module.exports = { personRelationshipCreate, personRelationshipUpdate };
