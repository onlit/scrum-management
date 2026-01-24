/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for SalesPersonTarget API responses.
 * Defines the expected structure of all SalesPersonTarget endpoint responses.
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
 * SalesPersonTarget entity response schema
 * Includes all fields that should be present in API responses
 */
const SalesPersonTargetResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  // pipeline can be a UUID string OR a relation object (when included)
  pipeline: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  targetUnit: Joi.string()
    .valid('DAILY', 'WEEKLY', 'MONTHLY')
    .allow(null)
    .optional(),
  target: Joi.number().integer().allow(null).optional(),
  notes: Joi.string().allow(null).optional(),
  expiryDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
  // pipelineStage can be a UUID string OR a relation object (when included)
  pipelineStage: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // salesPerson can be a UUID string OR a relation object (when included)
  salesPerson: Joi.alternatives()
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
 * SalesPersonTarget list response schema
 */
const SalesPersonTargetListResponseSchema = createListResponseSchema(
  SalesPersonTargetResponseSchema,
);

/**
 * SalesPersonTarget create request schema (for validation testing)
 */
const SalesPersonTargetCreateRequestSchema = Joi.object({
  // pipeline can be a UUID string OR a relation object (when included)
  pipeline: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  targetUnit: Joi.string()
    .valid('DAILY', 'WEEKLY', 'MONTHLY')
    .allow(null)
    .optional(),
  target: Joi.number().integer().allow(null).optional(),
  notes: Joi.string().allow(null).optional(),
  expiryDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
  // pipelineStage can be a UUID string OR a relation object (when included)
  pipelineStage: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // salesPerson can be a UUID string OR a relation object (when included)
  salesPerson: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

/**
 * SalesPersonTarget update request schema (for validation testing)
 */
const SalesPersonTargetUpdateRequestSchema = Joi.object({
  // pipeline can be a UUID string OR a relation object (when included)
  pipeline: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  targetUnit: Joi.string()
    .valid('DAILY', 'WEEKLY', 'MONTHLY')
    .allow(null)
    .optional(),
  target: Joi.number().integer().allow(null).optional(),
  notes: Joi.string().allow(null).optional(),
  expiryDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
  // pipelineStage can be a UUID string OR a relation object (when included)
  pipelineStage: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // salesPerson can be a UUID string OR a relation object (when included)
  salesPerson: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  SalesPersonTargetResponseSchema,
  SalesPersonTargetListResponseSchema,
  SalesPersonTargetCreateRequestSchema,
  SalesPersonTargetUpdateRequestSchema,
};
