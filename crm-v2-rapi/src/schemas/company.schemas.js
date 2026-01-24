/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to company.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - companyCreate.
 * - companyUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');
const { isValidE164PhoneNumber } = require('#utils/shared/generalUtils.js');

const companyBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  staffUrl: Joi.string().uri().allow('', null).optional(),
  email: Joi.string().email().allow('', null).optional(),
  website: Joi.string().uri().allow('', null).optional(),
  notes: Joi.string().allow('', null).optional(),
  city: Joi.string().allow('', null).optional(),
  state: Joi.string().allow('', null).optional(),
  zip: Joi.string().max(15).allow('', null).optional(),
  industry: Joi.string().max(300).allow('', null).optional(),
  color: Joi.string().max(40).allow('', null).optional(),
  description: Joi.string().allow('', null).optional(),
  companyIntelligence: Joi.string().allow('', null).optional(),
  size: Joi.string()
    .allow(null)
    .valid(
      'SIZE_2_TO_10',
      'SIZE_1',
      'SIZE_11_TO_50',
      'SIZE_51_TO_100',
      'SIZE_101_TO_250',
      'SIZE_501_TO_1000',
      'SIZE_251_TO_500',
      'SIZE_1001_TO_10000',
      null
    )
    .empty('')
    .optional(),
  keywords: Joi.string().allow('', null).optional(),
  contactUrl: Joi.string().uri().allow('', null).optional(),
  phone: Joi.string()
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
  fax: Joi.string().max(25).allow('', null).optional(),
  address1: Joi.string().allow('', null).optional(),
  address2: Joi.string().allow('', null).optional(),
  branchOfId: Joi.string().uuid().allow(null).optional(),
  ownerId: Joi.string().uuid().allow(null).optional(),
  newsUrl: Joi.string().uri().allow('', null).optional(),
  countryId: Joi.string().uuid().allow(null).optional(),
  stateId: Joi.string().uuid().allow(null).optional(),
  cityId: Joi.string().uuid().allow(null).optional(),
  industryId: Joi.string().uuid().allow(null).optional(),
  tags: Joi.string().allow('', null).optional(),
});

const companyCreate = companyBase.keys({
  name: Joi.string().max(150).required(),
  betaPartners: Joi.boolean().required(),
});

const companyUpdate = companyBase.keys({
  name: Joi.string().max(150).optional(),
  betaPartners: Joi.boolean().optional(),
});

module.exports = { companyCreate, companyUpdate };
