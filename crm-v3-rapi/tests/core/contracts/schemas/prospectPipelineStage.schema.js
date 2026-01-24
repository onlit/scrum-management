/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for ProspectPipelineStage API responses.
 * Defines the expected structure of all ProspectPipelineStage endpoint responses.
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
 * ProspectPipelineStage entity response schema
 * Includes all fields that should be present in API responses
 */
const ProspectPipelineStageResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  order: Joi.number().integer().allow(null).required(),
  immediateNextAction: Joi.string().allow(null).optional(),
  description: Joi.string().allow(null).optional(),
  confidence: Joi.number().integer().allow(null).required(),
  rottingDays: Joi.number().integer().allow(null).required(),
  conversion: Joi.number().integer().allow(null).required(),
  stage: Joi.string().allow(null).required(),
  // parentPipelineStage can be a UUID string OR a relation object (when included)
  parentPipelineStage: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // pipeline can be a UUID string OR a relation object (when included)
  pipeline: Joi.alternatives()
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
 * ProspectPipelineStage list response schema
 */
const ProspectPipelineStageListResponseSchema = createListResponseSchema(
  ProspectPipelineStageResponseSchema,
);

/**
 * ProspectPipelineStage create request schema (for validation testing)
 */
const ProspectPipelineStageCreateRequestSchema = Joi.object({
  order: Joi.number().integer().allow(null).required(),
  immediateNextAction: Joi.string().allow(null).optional(),
  description: Joi.string().allow(null).optional(),
  confidence: Joi.number().integer().allow(null).required(),
  rottingDays: Joi.number().integer().allow(null).required(),
  conversion: Joi.number().integer().allow(null).required(),
  stage: Joi.string().allow(null).required(),
  // parentPipelineStage can be a UUID string OR a relation object (when included)
  parentPipelineStage: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // pipeline can be a UUID string OR a relation object (when included)
  pipeline: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

/**
 * ProspectPipelineStage update request schema (for validation testing)
 */
const ProspectPipelineStageUpdateRequestSchema = Joi.object({
  order: Joi.number().integer().allow(null).required(),
  immediateNextAction: Joi.string().allow(null).optional(),
  description: Joi.string().allow(null).optional(),
  confidence: Joi.number().integer().allow(null).required(),
  rottingDays: Joi.number().integer().allow(null).required(),
  conversion: Joi.number().integer().allow(null).required(),
  stage: Joi.string().allow(null).required(),
  // parentPipelineStage can be a UUID string OR a relation object (when included)
  parentPipelineStage: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // pipeline can be a UUID string OR a relation object (when included)
  pipeline: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  ProspectPipelineStageResponseSchema,
  ProspectPipelineStageListResponseSchema,
  ProspectPipelineStageCreateRequestSchema,
  ProspectPipelineStageUpdateRequestSchema,
};
