/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for CallListPipelineStage API responses.
 * Defines the expected structure of all CallListPipelineStage endpoint responses.
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
 * CallListPipelineStage entity response schema
 * Includes all fields that should be present in API responses
 */
const CallListPipelineStageResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  order: Joi.number().allow(null).required(),
  rottingDays: Joi.number().integer().allow(null).required(),
  name: Joi.string().allow(null).required(),
  description: Joi.string().allow(null).optional(),
  // callListPipeline can be a UUID string OR a relation object (when included)
  callListPipeline: Joi.alternatives()
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
 * CallListPipelineStage list response schema
 */
const CallListPipelineStageListResponseSchema = createListResponseSchema(
  CallListPipelineStageResponseSchema,
);

/**
 * CallListPipelineStage create request schema (for validation testing)
 */
const CallListPipelineStageCreateRequestSchema = Joi.object({
  order: Joi.number().allow(null).required(),
  rottingDays: Joi.number().integer().allow(null).required(),
  name: Joi.string().allow(null).required(),
  description: Joi.string().allow(null).optional(),
  // callListPipeline can be a UUID string OR a relation object (when included)
  callListPipeline: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

/**
 * CallListPipelineStage update request schema (for validation testing)
 */
const CallListPipelineStageUpdateRequestSchema = Joi.object({
  order: Joi.number().allow(null).required(),
  rottingDays: Joi.number().integer().allow(null).required(),
  name: Joi.string().allow(null).required(),
  description: Joi.string().allow(null).optional(),
  // callListPipeline can be a UUID string OR a relation object (when included)
  callListPipeline: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  CallListPipelineStageResponseSchema,
  CallListPipelineStageListResponseSchema,
  CallListPipelineStageCreateRequestSchema,
  CallListPipelineStageUpdateRequestSchema,
};
