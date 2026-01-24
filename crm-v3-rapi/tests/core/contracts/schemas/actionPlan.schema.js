/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for ActionPlan API responses.
 * Defines the expected structure of all ActionPlan endpoint responses.
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
 * ActionPlan entity response schema
 * Includes all fields that should be present in API responses
 */
const ActionPlanResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  what: Joi.string().allow(null).required(),
  // opportunity can be a UUID string OR a relation object (when included)
  opportunity: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  who: Joi.string().allow(null).optional(),
  when: Joi.alternatives()
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
 * ActionPlan list response schema
 */
const ActionPlanListResponseSchema = createListResponseSchema(
  ActionPlanResponseSchema,
);

/**
 * ActionPlan create request schema (for validation testing)
 */
const ActionPlanCreateRequestSchema = Joi.object({
  what: Joi.string().allow(null).required(),
  // opportunity can be a UUID string OR a relation object (when included)
  opportunity: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  who: Joi.string().allow(null).optional(),
  when: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
}).unknown(true);

/**
 * ActionPlan update request schema (for validation testing)
 */
const ActionPlanUpdateRequestSchema = Joi.object({
  what: Joi.string().allow(null).required(),
  // opportunity can be a UUID string OR a relation object (when included)
  opportunity: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  who: Joi.string().allow(null).optional(),
  when: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  ActionPlanResponseSchema,
  ActionPlanListResponseSchema,
  ActionPlanCreateRequestSchema,
  ActionPlanUpdateRequestSchema,
};
