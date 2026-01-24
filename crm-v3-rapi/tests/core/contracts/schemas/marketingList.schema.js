/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for MarketingList API responses.
 * Defines the expected structure of all MarketingList endpoint responses.
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
 * MarketingList entity response schema
 * Includes all fields that should be present in API responses
 */
const MarketingListResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  description: Joi.string().allow(null).optional(),
  name: Joi.string().allow(null).required(),
  expiryDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),

  // Visibility fields (common to all models)
  everyoneCanSeeIt: Joi.boolean().optional(),
  everyoneInObjectCompanyCanSeeIt: Joi.boolean().optional(),

  // Computed/display value fields (if any)
  displayValue: Joi.string().allow(null, '').optional(),
}).unknown(true); // Allow additional fields for flexibility

/**
 * MarketingList list response schema
 */
const MarketingListListResponseSchema = createListResponseSchema(
  MarketingListResponseSchema,
);

/**
 * MarketingList create request schema (for validation testing)
 */
const MarketingListCreateRequestSchema = Joi.object({
  description: Joi.string().allow(null).optional(),
  name: Joi.string().allow(null).required(),
  expiryDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
}).unknown(true);

/**
 * MarketingList update request schema (for validation testing)
 */
const MarketingListUpdateRequestSchema = Joi.object({
  description: Joi.string().allow(null).optional(),
  name: Joi.string().allow(null).required(),
  expiryDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  MarketingListResponseSchema,
  MarketingListListResponseSchema,
  MarketingListCreateRequestSchema,
  MarketingListUpdateRequestSchema,
};
