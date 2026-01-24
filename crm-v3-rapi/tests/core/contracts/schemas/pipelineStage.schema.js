/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for PipelineStage API responses.
 * Defines the expected structure of all PipelineStage endpoint responses.
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
 * PipelineStage entity response schema
 * Includes all fields that should be present in API responses
 */
const PipelineStageResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  stage: Joi.string().allow(null).required(),
  conversion: Joi.number().integer().allow(null).required(),
  confidence: Joi.number().integer().allow(null).required(),
  rottingDays: Joi.number().integer().allow(null).required(),
  // pipeline can be a UUID string OR a relation object (when included)
  pipeline: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // parentPipelineStage can be a UUID string OR a relation object (when included)
  parentPipelineStage: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  description: Joi.string().allow(null).optional(),
  immediateNextAction: Joi.string().allow(null).optional(),
  order: Joi.number().integer().allow(null).required(),

  // Visibility fields (common to all models)
  everyoneCanSeeIt: Joi.boolean().optional(),
  everyoneInObjectCompanyCanSeeIt: Joi.boolean().optional(),

  // Computed/display value fields (if any)
  displayValue: Joi.string().allow(null, '').optional(),
}).unknown(true); // Allow additional fields for flexibility

/**
 * PipelineStage list response schema
 */
const PipelineStageListResponseSchema = createListResponseSchema(
  PipelineStageResponseSchema,
);

/**
 * PipelineStage create request schema (for validation testing)
 */
const PipelineStageCreateRequestSchema = Joi.object({
  stage: Joi.string().allow(null).required(),
  conversion: Joi.number().integer().allow(null).required(),
  confidence: Joi.number().integer().allow(null).required(),
  rottingDays: Joi.number().integer().allow(null).required(),
  // pipeline can be a UUID string OR a relation object (when included)
  pipeline: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // parentPipelineStage can be a UUID string OR a relation object (when included)
  parentPipelineStage: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  description: Joi.string().allow(null).optional(),
  immediateNextAction: Joi.string().allow(null).optional(),
  order: Joi.number().integer().allow(null).required(),
}).unknown(true);

/**
 * PipelineStage update request schema (for validation testing)
 */
const PipelineStageUpdateRequestSchema = Joi.object({
  stage: Joi.string().allow(null).required(),
  conversion: Joi.number().integer().allow(null).required(),
  confidence: Joi.number().integer().allow(null).required(),
  rottingDays: Joi.number().integer().allow(null).required(),
  // pipeline can be a UUID string OR a relation object (when included)
  pipeline: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // parentPipelineStage can be a UUID string OR a relation object (when included)
  parentPipelineStage: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  description: Joi.string().allow(null).optional(),
  immediateNextAction: Joi.string().allow(null).optional(),
  order: Joi.number().integer().allow(null).required(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  PipelineStageResponseSchema,
  PipelineStageListResponseSchema,
  PipelineStageCreateRequestSchema,
  PipelineStageUpdateRequestSchema,
};
