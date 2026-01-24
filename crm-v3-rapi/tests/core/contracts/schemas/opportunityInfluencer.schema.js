/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for OpportunityInfluencer API responses.
 * Defines the expected structure of all OpportunityInfluencer endpoint responses.
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
 * OpportunityInfluencer entity response schema
 * Includes all fields that should be present in API responses
 */
const OpportunityInfluencerResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  role: Joi.string().allow(null).required(),
  // companyContact can be a UUID string OR a relation object (when included)
  companyContact: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // opportunity can be a UUID string OR a relation object (when included)
  opportunity: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  desireForCompany: Joi.string().allow(null).optional(),
  desireForSelf: Joi.string().allow(null).optional(),
  rating: Joi.number().integer().allow(null).optional(),

  // Visibility fields (common to all models)
  everyoneCanSeeIt: Joi.boolean().optional(),
  everyoneInObjectCompanyCanSeeIt: Joi.boolean().optional(),

  // Computed/display value fields (if any)
  displayValue: Joi.string().allow(null, '').optional(),
}).unknown(true); // Allow additional fields for flexibility

/**
 * OpportunityInfluencer list response schema
 */
const OpportunityInfluencerListResponseSchema = createListResponseSchema(
  OpportunityInfluencerResponseSchema,
);

/**
 * OpportunityInfluencer create request schema (for validation testing)
 */
const OpportunityInfluencerCreateRequestSchema = Joi.object({
  role: Joi.string().allow(null).required(),
  // companyContact can be a UUID string OR a relation object (when included)
  companyContact: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // opportunity can be a UUID string OR a relation object (when included)
  opportunity: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  desireForCompany: Joi.string().allow(null).optional(),
  desireForSelf: Joi.string().allow(null).optional(),
  rating: Joi.number().integer().allow(null).optional(),
}).unknown(true);

/**
 * OpportunityInfluencer update request schema (for validation testing)
 */
const OpportunityInfluencerUpdateRequestSchema = Joi.object({
  role: Joi.string().allow(null).required(),
  // companyContact can be a UUID string OR a relation object (when included)
  companyContact: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // opportunity can be a UUID string OR a relation object (when included)
  opportunity: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  desireForCompany: Joi.string().allow(null).optional(),
  desireForSelf: Joi.string().allow(null).optional(),
  rating: Joi.number().integer().allow(null).optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  OpportunityInfluencerResponseSchema,
  OpportunityInfluencerListResponseSchema,
  OpportunityInfluencerCreateRequestSchema,
  OpportunityInfluencerUpdateRequestSchema,
};
