/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 09/10/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to prospectProduct.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - prospectProductCreate.
 * - prospectProductUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const prospectProductBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  amount: Joi.number().integer().min(0).allow(null).optional(),
  estimatedValue: Joi.number().integer().min(0).allow(null).optional(),
  prospectId: Joi.string().uuid().allow(null).optional(),
  productVariantId: Joi.string().uuid().allow(null).optional(),
  color: Joi.string().max(40).allow('', null).optional(),
  tags: Joi.string().allow('', null).optional(),
});

const prospectProductCreate = prospectProductBase.keys({
  prospectId: Joi.string().uuid().required(),
  productVariantId: Joi.string().uuid().required(),
});

const prospectProductUpdate = prospectProductBase.keys({
  prospectId: Joi.string().uuid().optional(),
  productVariantId: Joi.string().uuid().optional(),
});

module.exports = { prospectProductCreate, prospectProductUpdate };
