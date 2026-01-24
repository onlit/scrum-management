/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to clientHistory.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - clientHistoryCreate.
 * - clientHistoryUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const clientHistoryBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  clientRefId: Joi.string().uuid().allow(null).optional(),
  color: Joi.string().max(40).allow('', null).optional(),
});

const relaxedUrlValidator = (value, helpers) => {
  if (!value) return value;
  try {
    new URL(value);
    return value;
  } catch (_err) {
    return helpers.message('url must be a valid uri');
  }
};

const clientHistoryCreate = clientHistoryBase.keys({
  url: Joi.string().custom(relaxedUrlValidator).required(),
});

const clientHistoryUpdate = clientHistoryBase.keys({
  url: Joi.string().custom(relaxedUrlValidator).optional(),
});

module.exports = { clientHistoryCreate, clientHistoryUpdate };
