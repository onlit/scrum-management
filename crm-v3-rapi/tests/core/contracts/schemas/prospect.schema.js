/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for Prospect API responses.
 * Defines the expected structure of all Prospect endpoint responses.
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
 * Prospect entity response schema
 * Includes all fields that should be present in API responses
 */
const ProspectResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  disqualificationReason: Joi.string()
    .valid(
      'NO_BUDGET',
      'WRONG_TIMING',
      'LOST_TO_COMPETITOR',
      'UNRESPONSIVE',
      'NOT_A_FIT',
      'OTHER',
    )
    .allow(null)
    .optional(),
  sourceCampaign: Joi.string().uuid().allow(null).optional(),
  interestSummary: Joi.string().allow(null).optional(),
  // owner can be a UUID string OR a relation object (when included)
  owner: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // category can be a UUID string OR a relation object (when included)
  category: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // person can be a UUID string OR a relation object (when included)
  person: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  qualificationScore: Joi.number().integer().allow(null).required(),
  temperature: Joi.string().valid('COLD', 'WARM', 'HOT').allow(null).required(),
  // prospectPipeline can be a UUID string OR a relation object (when included)
  prospectPipeline: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // status can be a UUID string OR a relation object (when included)
  status: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),

  // Visibility fields (common to all models)
  everyoneCanSeeIt: Joi.boolean().optional(),
  everyoneInObjectCompanyCanSeeIt: Joi.boolean().optional(),

  // Computed/display value fields (if any)
  displayValue: Joi.string().allow(null, '').optional(),
}).unknown(true); // Allow additional fields for flexibility

/**
 * Prospect list response schema
 */
const ProspectListResponseSchema = createListResponseSchema(
  ProspectResponseSchema,
);

/**
 * Prospect create request schema (for validation testing)
 */
const ProspectCreateRequestSchema = Joi.object({
  disqualificationReason: Joi.string()
    .valid(
      'NO_BUDGET',
      'WRONG_TIMING',
      'LOST_TO_COMPETITOR',
      'UNRESPONSIVE',
      'NOT_A_FIT',
      'OTHER',
    )
    .allow(null)
    .optional(),
  sourceCampaign: Joi.string().uuid().allow(null).optional(),
  interestSummary: Joi.string().allow(null).optional(),
  // owner can be a UUID string OR a relation object (when included)
  owner: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // category can be a UUID string OR a relation object (when included)
  category: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // person can be a UUID string OR a relation object (when included)
  person: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  qualificationScore: Joi.number().integer().allow(null).required(),
  temperature: Joi.string().valid('COLD', 'WARM', 'HOT').allow(null).required(),
  // prospectPipeline can be a UUID string OR a relation object (when included)
  prospectPipeline: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // status can be a UUID string OR a relation object (when included)
  status: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

/**
 * Prospect update request schema (for validation testing)
 */
const ProspectUpdateRequestSchema = Joi.object({
  disqualificationReason: Joi.string()
    .valid(
      'NO_BUDGET',
      'WRONG_TIMING',
      'LOST_TO_COMPETITOR',
      'UNRESPONSIVE',
      'NOT_A_FIT',
      'OTHER',
    )
    .allow(null)
    .optional(),
  sourceCampaign: Joi.string().uuid().allow(null).optional(),
  interestSummary: Joi.string().allow(null).optional(),
  // owner can be a UUID string OR a relation object (when included)
  owner: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // category can be a UUID string OR a relation object (when included)
  category: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // person can be a UUID string OR a relation object (when included)
  person: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  qualificationScore: Joi.number().integer().allow(null).required(),
  temperature: Joi.string().valid('COLD', 'WARM', 'HOT').allow(null).required(),
  // prospectPipeline can be a UUID string OR a relation object (when included)
  prospectPipeline: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // status can be a UUID string OR a relation object (when included)
  status: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  ProspectResponseSchema,
  ProspectListResponseSchema,
  ProspectCreateRequestSchema,
  ProspectUpdateRequestSchema,
};
