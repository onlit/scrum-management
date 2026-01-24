/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to customerEnquiry.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - customerEnquiryCreate.
 * - customerEnquiryUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const customerEnquiryBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  firstName: Joi.string().max(700).allow('', null).optional(),
  phone: Joi.string().max(30).allow('', null).optional(),
  sourceNotes: Joi.string().allow('', null).optional(),
  color: Joi.string().max(40).allow('', null).optional(),
  lastName: Joi.string().max(700).allow('', null).optional(),
  statusId: Joi.string().uuid().allow(null).optional(),
  message: Joi.string().allow('', null).optional(),
  purposeId: Joi.string().uuid().allow(null).optional(),
  source: Joi.string().allow('', null).optional(),
});

const customerEnquiryCreate = customerEnquiryBase.keys({
  // personId becomes optional to match Django: we can create/find Person by email if missing
  personId: Joi.string().uuid().optional(),
  // accept email for auto-person creation parity with Django
  email: Joi.string().email().allow('', null).optional(),
});

const customerEnquiryUpdate = customerEnquiryBase.keys({
  personId: Joi.string().uuid().optional(),
});

module.exports = { customerEnquiryCreate, customerEnquiryUpdate };
