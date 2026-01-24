/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for OpportunityCategory API responses.
 * Defines the expected structure of all OpportunityCategory endpoint responses.
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
 * OpportunityCategory entity response schema
 * Includes all fields that should be present in API responses
 */
const OpportunityCategoryResponseSchema = BaseEntitySchema.keys({
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
 * OpportunityCategory list response schema
 */
const OpportunityCategoryListResponseSchema = createListResponseSchema(
  OpportunityCategoryResponseSchema,
);

/**
 * OpportunityCategory create request schema (for validation testing)
 */
const OpportunityCategoryCreateRequestSchema = Joi.object({
  name: Joi.string().allow(null).required(),
  description: Joi.string().allow(null).optional(),
}).unknown(true);

/**
 * OpportunityCategory update request schema (for validation testing)
 */
const OpportunityCategoryUpdateRequestSchema = Joi.object({
  name: Joi.string().allow(null).required(),
  description: Joi.string().allow(null).optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  OpportunityCategoryResponseSchema,
  OpportunityCategoryListResponseSchema,
  OpportunityCategoryCreateRequestSchema,
  OpportunityCategoryUpdateRequestSchema,
};
