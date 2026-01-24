/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to companyContact.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - companyContactCreate.
 * - companyContactUpdate.
 *
 *
 */

const Joi = require('joi');
const { validateISODate } = require('#utils/shared/dateValidation.js');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');
const { isValidE164PhoneNumber } = require('#utils/shared/generalUtils.js');

const companyContactBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  color: Joi.string().max(40).allow('', null).optional(),
  workPhone: Joi.string()
    .max(25)
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
  jobTitle: Joi.string().allow('', null).optional(),
  accounts: Joi.boolean().allow(null).optional(),
  workMobile: Joi.string()
    .max(25)
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
  startDate: Joi.string().custom(validateISODate).allow('', null).optional(),
  endDate: Joi.string().custom(validateISODate).allow('', null).optional(),
  workEmail: Joi.string().email().allow('', null).optional(),
});

const companyContactCreate = companyContactBase.keys({
  personId: Joi.string().uuid().required(),
  companyId: Joi.string().uuid().required(),
});

const companyContactUpdate = companyContactBase.keys({
  personId: Joi.string().uuid().optional(),
  companyId: Joi.string().uuid().optional(),
});

module.exports = { companyContactCreate, companyContactUpdate };
