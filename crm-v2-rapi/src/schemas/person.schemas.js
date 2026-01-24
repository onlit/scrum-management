/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to person.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - personCreate.
 * - personUpdate.
 *
 *
 */

const Joi = require('joi');
const { validateISODate } = require('#utils/shared/dateValidation.js');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');
const { isValidE164PhoneNumber } = require('#utils/shared/generalUtils.js');

const personBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  color: Joi.string().max(40).allow('', null).optional(),
  middleName: Joi.string().max(100).allow('', null).optional(),
  dob: Joi.string().custom(validateISODate).allow('', null).optional(),
  personalMobile: Joi.string()
    .max(50)
    .allow('', null)
    .optional()
    .custom((value, helpers) => {
      if (value && !isValidE164PhoneNumber(value)) {
        return helpers.error('any.invalid', {
          message:
            'Phone number must be in the format: +[CountryCode][Number] without spaces or hyphens (E.164 format).',
        });
      }
      return value;
    }),
  address2: Joi.string().allow('', null).optional(),
  state: Joi.string().allow('', null).optional(),
  owner: Joi.string().max(50).allow('', null).optional(),
  source: Joi.string().allow('', null).optional(),
  preferredName: Joi.string().max(100).allow('', null).optional(),
  username: Joi.string().max(100).allow('', null).optional(),
  avatar: Joi.string().max(200).allow('', null).optional(),
  countryId: Joi.string().uuid().allow(null).optional(),
  stateId: Joi.string().uuid().allow(null).optional(),
  cityId: Joi.string().uuid().allow(null).optional(),
  homePhone: Joi.string()
    .max(50)
    .allow('', null)
    .optional()
    .custom((value, helpers) => {
      if (value && !isValidE164PhoneNumber(value)) {
        return helpers.error('any.invalid', {
          message:
            'Phone number must be in the format: +[CountryCode][Number] without spaces or hyphens (E.164 format).',
        });
      }
      return value;
    }),
  city: Joi.string().allow('', null).optional(),
  parentId: Joi.string().uuid().allow(null).optional(),
  companyOwnerId: Joi.string().uuid().allow(null).optional(),
  address1: Joi.string().allow('', null).optional(),
  notes: Joi.string().allow('', null).optional(),
  zip: Joi.string().max(15).allow('', null).optional(),
  sourceNotes: Joi.string().allow('', null).optional(),
  lastName: Joi.string().max(100).allow('', null).optional(),
  user: Joi.string().uuid().allow(null).optional(),
  status: Joi.string()
    .allow(null)
    .valid('APPLICANT', 'NEW', null)
    .empty('')
    .optional(),
  hasWhatsapp: Joi.boolean().optional().default(false),
  tags: Joi.string().allow('', null).optional(),
  workflowId: Joi.string().uuid().allow(null).optional(),
});

const personCreate = personBase.keys({
  firstName: Joi.string().max(100).required(),
  email: Joi.string().email().required(),
});

const personUpdate = personBase.keys({
  firstName: Joi.string().max(100).optional(),
  email: Joi.string().email().optional(),
});

module.exports = { personCreate, personUpdate };
