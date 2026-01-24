/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for OpportunityHistory API responses.
 * Defines the expected structure of all OpportunityHistory endpoint responses.
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
 * OpportunityHistory entity response schema
 * Includes all fields that should be present in API responses
 */
const OpportunityHistoryResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  // opportunity can be a UUID string OR a relation object (when included)
  opportunity: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  notes: Joi.string().allow(null).required(),
  url: Joi.string().uri().allow(null).optional(),

  // Visibility fields (common to all models)
  everyoneCanSeeIt: Joi.boolean().optional(),
  everyoneInObjectCompanyCanSeeIt: Joi.boolean().optional(),

  // Computed/display value fields (if any)
  displayValue: Joi.string().allow(null, '').optional(),
}).unknown(true); // Allow additional fields for flexibility

/**
 * OpportunityHistory list response schema
 */
const OpportunityHistoryListResponseSchema = createListResponseSchema(
  OpportunityHistoryResponseSchema,
);

/**
 * OpportunityHistory create request schema (for validation testing)
 */
const OpportunityHistoryCreateRequestSchema = Joi.object({
  // opportunity can be a UUID string OR a relation object (when included)
  opportunity: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  notes: Joi.string().allow(null).required(),
  url: Joi.string().uri().allow(null).optional(),
}).unknown(true);

/**
 * OpportunityHistory update request schema (for validation testing)
 */
const OpportunityHistoryUpdateRequestSchema = Joi.object({
  // opportunity can be a UUID string OR a relation object (when included)
  opportunity: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  notes: Joi.string().allow(null).required(),
  url: Joi.string().uri().allow(null).optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  OpportunityHistoryResponseSchema,
  OpportunityHistoryListResponseSchema,
  OpportunityHistoryCreateRequestSchema,
  OpportunityHistoryUpdateRequestSchema,
};
