/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to onlineSignup.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - onlineSignupCreate.
 * - onlineSignupUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const onlineSignupBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  color: Joi.string().max(40).allow('', null).optional(),
  fields: Joi.string().allow('', null).optional(),
  source: Joi.string().allow('', null).optional(),
  emailconfirmed: Joi.boolean().allow(null).optional(),
});

const onlineSignupCreate = onlineSignupBase.keys({
  owner: Joi.string().max(200).required(),
});

const onlineSignupUpdate = onlineSignupBase.keys({
  owner: Joi.string().max(200).optional(),
});

module.exports = { onlineSignupCreate, onlineSignupUpdate };
