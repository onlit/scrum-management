/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to opportunityProduct.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - opportunityProductCreate.
 * - opportunityProductUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const opportunityProductBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  color: Joi.string().max(40).allow('', null).optional(),
  amount: Joi.number().integer().min(0).max(2147483647).allow(null).optional(),
  estimatedValue: Joi.number()
    .integer()
    .min(0)
    .max(2147483647)
    .allow(null)
    .optional(),
});

const opportunityProductCreate = opportunityProductBase.keys({
  opportunityId: Joi.string().uuid().required(),
  productVariant: Joi.string().uuid().required(),
});

const opportunityProductUpdate = opportunityProductBase.keys({
  opportunityId: Joi.string().uuid().optional(),
  productVariant: Joi.string().uuid().optional(),
});

module.exports = { opportunityProductCreate, opportunityProductUpdate };
