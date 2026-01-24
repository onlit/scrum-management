/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to marketingList.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - marketingListCreate.
 * - marketingListUpdate.
 *
 *
 */

const Joi = require('joi');
const { validateISODate } = require('#utils/shared/dateValidation.js');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const marketingListBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  color: Joi.string().max(40).allow('', null).optional(),
  expiryDate: Joi.string()
    .custom(validateISODate)
    .allow('', null)
    .optional(),
  description: Joi.string().allow('', null).optional(),
  workflowId: Joi.string().uuid().allow(null).optional(),
});

const marketingListCreate = marketingListBase.keys({
  name: Joi.string().max(400).required(),
});

const marketingListUpdate = marketingListBase.keys({
  name: Joi.string().max(400).optional(),
});

module.exports = { marketingListCreate, marketingListUpdate };
