/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to customerEnquiryPurpose.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - customerEnquiryPurposeCreate.
 * - customerEnquiryPurposeUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const customerEnquiryPurposeBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  description: Joi.string().allow('', null).optional(),
  color: Joi.string().max(40).allow('', null).optional(),
});

const customerEnquiryPurposeCreate = customerEnquiryPurposeBase.keys({
  name: Joi.string().max(700).required(),
});

const customerEnquiryPurposeUpdate = customerEnquiryPurposeBase.keys({
  name: Joi.string().max(700).optional(),
});

module.exports = { customerEnquiryPurposeCreate, customerEnquiryPurposeUpdate };
