/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to personInMarketingList.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - personInMarketingListCreate.
 * - personInMarketingListUpdate.
 *
 *
 */

const Joi = require('joi');
const { validateISODate } = require('#utils/shared/dateValidation.js');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const personInMarketingListBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  expiryDate: Joi.string()
    .custom(validateISODate)
    .allow('', null)
    .optional(),
  color: Joi.string().max(40).allow('', null).optional(),
});

const personInMarketingListCreate = personInMarketingListBase.keys({
  marketingListId: Joi.string().uuid().required(),
  personId: Joi.string().uuid().required(),
});

const personInMarketingListUpdate = personInMarketingListBase.keys({
  marketingListId: Joi.string().uuid().optional(),
  personId: Joi.string().uuid().optional(),
});

module.exports = { personInMarketingListCreate, personInMarketingListUpdate };
