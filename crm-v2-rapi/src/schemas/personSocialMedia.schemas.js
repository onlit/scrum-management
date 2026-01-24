/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to personSocialMedia.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - personSocialMediaCreate.
 * - personSocialMediaUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const personSocialMediaBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  color: Joi.string().max(40).allow('', null).optional(),
  personId: Joi.string().uuid().allow(null).optional(),
  socialMediaId: Joi.string().uuid().allow(null).optional(),
});

const personSocialMediaCreate = personSocialMediaBase.keys({
  username: Joi.string().required(),
  url: Joi.string().uri().required(),
});

const personSocialMediaUpdate = personSocialMediaBase.keys({
  username: Joi.string().optional(),
  url: Joi.string().uri().optional(),
});

module.exports = { personSocialMediaCreate, personSocialMediaUpdate };
