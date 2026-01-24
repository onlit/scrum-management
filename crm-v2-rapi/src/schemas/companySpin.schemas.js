/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to companySpin.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - companySpinCreate.
 * - companySpinUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const companySpinBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  notes: Joi.string().allow('', null).optional(),
  color: Joi.string().max(40).allow('', null).optional(),
});

const companySpinCreate = companySpinBase.keys({
  situation: Joi.string().required(),
  implication: Joi.string().required(),
  need: Joi.string().required(),
  companyId: Joi.string().uuid().required(),
  buyerInfluence: Joi.string()
    .valid('USER', 'TECHNICAL', 'ECONOMIC')
    .required(),
  problem: Joi.string().required(),
});

const companySpinUpdate = companySpinBase.keys({
  situation: Joi.string().optional(),
  implication: Joi.string().optional(),
  need: Joi.string().optional(),
  companyId: Joi.string().uuid().optional(),
  buyerInfluence: Joi.any().valid('USER', 'TECHNICAL', 'ECONOMIC').optional(),
  problem: Joi.string().optional(),
});

module.exports = { companySpinCreate, companySpinUpdate };
