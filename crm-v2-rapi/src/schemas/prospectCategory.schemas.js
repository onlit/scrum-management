/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 09/10/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to prospectCategory.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - prospectCategoryCreate.
 * - prospectCategoryUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const prospectCategoryBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  name: Joi.string().max(150).allow('', null).optional(),
  description: Joi.string().allow('', null).optional(),
  color: Joi.string().max(40).allow('', null).optional(),
  tags: Joi.string().allow('', null).optional(),
});

const prospectCategoryCreate = prospectCategoryBase.keys({
  name: Joi.string().max(150).required(),
});

const prospectCategoryUpdate = prospectCategoryBase.keys({
  name: Joi.string().max(150).optional(),
});

module.exports = { prospectCategoryCreate, prospectCategoryUpdate };
