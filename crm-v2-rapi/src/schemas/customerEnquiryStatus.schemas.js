/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to customerEnquiryStatus.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - customerEnquiryStatusCreate.
 * - customerEnquiryStatusUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const customerEnquiryStatusBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  color: Joi.string().max(40).allow('', null).optional(),
  description: Joi.string().allow('', null).optional(),
});

const customerEnquiryStatusCreate = customerEnquiryStatusBase.keys({
  name: Joi.string().max(700).required(),
});

const customerEnquiryStatusUpdate = customerEnquiryStatusBase.keys({
  name: Joi.string().max(700).optional(),
});

module.exports = { customerEnquiryStatusCreate, customerEnquiryStatusUpdate };
