/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to accountManagerInCompany.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - accountManagerInCompanyCreate.
 * - accountManagerInCompanyUpdate.
 *
 *
 */

const Joi = require('joi');
const { validateISODate } = require('#utils/shared/dateValidation.js');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const accountManagerInCompanyBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  color: Joi.string().max(40).allow('', null).optional(),
  expiryDate: Joi.string()
    .custom(validateISODate)
    .allow('', null)
    .optional(),
});

const accountManagerInCompanyCreate = accountManagerInCompanyBase.keys({
  companyId: Joi.string().uuid().required(),
  accountManagerId: Joi.string().uuid().required(),
});

const accountManagerInCompanyUpdate = accountManagerInCompanyBase.keys({
  companyId: Joi.string().uuid().optional(),
  accountManagerId: Joi.string().uuid().optional(),
});

module.exports = {
  accountManagerInCompanyCreate,
  accountManagerInCompanyUpdate,
};
