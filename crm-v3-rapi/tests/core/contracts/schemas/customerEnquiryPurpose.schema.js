/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for CustomerEnquiryPurpose API responses.
 * Defines the expected structure of all CustomerEnquiryPurpose endpoint responses.
 */

const Joi = require('joi');
const {
  createListResponseSchema,
  BaseEntitySchema,
} = require('#tests/core/contracts/schemas/common.schema.js');

/**
 * Schema for relation objects returned when using Prisma includes.
 * When the API includes a relation (e.g., stakeholder: true), it returns
 * the full object instead of just the foreign key ID.
 */
const RelationObjectSchema = Joi.object({
  id: Joi.string().uuid().required(),
}).unknown(true); // Allow additional fields on the relation

/**
 * CustomerEnquiryPurpose entity response schema
 * Includes all fields that should be present in API responses
 */
const CustomerEnquiryPurposeResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  name: Joi.string().allow(null).required(),
  description: Joi.string().allow(null).optional(),

  // Visibility fields (common to all models)
  everyoneCanSeeIt: Joi.boolean().optional(),
  everyoneInObjectCompanyCanSeeIt: Joi.boolean().optional(),

  // Computed/display value fields (if any)
  displayValue: Joi.string().allow(null, '').optional(),
}).unknown(true); // Allow additional fields for flexibility

/**
 * CustomerEnquiryPurpose list response schema
 */
const CustomerEnquiryPurposeListResponseSchema = createListResponseSchema(
  CustomerEnquiryPurposeResponseSchema,
);

/**
 * CustomerEnquiryPurpose create request schema (for validation testing)
 */
const CustomerEnquiryPurposeCreateRequestSchema = Joi.object({
  name: Joi.string().allow(null).required(),
  description: Joi.string().allow(null).optional(),
}).unknown(true);

/**
 * CustomerEnquiryPurpose update request schema (for validation testing)
 */
const CustomerEnquiryPurposeUpdateRequestSchema = Joi.object({
  name: Joi.string().allow(null).required(),
  description: Joi.string().allow(null).optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  CustomerEnquiryPurposeResponseSchema,
  CustomerEnquiryPurposeListResponseSchema,
  CustomerEnquiryPurposeCreateRequestSchema,
  CustomerEnquiryPurposeUpdateRequestSchema,
};
