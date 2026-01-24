/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for CallHistory API responses.
 * Defines the expected structure of all CallHistory endpoint responses.
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
 * CallHistory entity response schema
 * Includes all fields that should be present in API responses
 */
const CallHistoryResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  outcome: Joi.string().allow(null).required(),
  // callListPipelineStage can be a UUID string OR a relation object (when included)
  callListPipelineStage: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // callSchedule can be a UUID string OR a relation object (when included)
  callSchedule: Joi.alternatives()
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
 * CallHistory list response schema
 */
const CallHistoryListResponseSchema = createListResponseSchema(
  CallHistoryResponseSchema,
);

/**
 * CallHistory create request schema (for validation testing)
 */
const CallHistoryCreateRequestSchema = Joi.object({
  outcome: Joi.string().allow(null).required(),
  // callListPipelineStage can be a UUID string OR a relation object (when included)
  callListPipelineStage: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // callSchedule can be a UUID string OR a relation object (when included)
  callSchedule: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

/**
 * CallHistory update request schema (for validation testing)
 */
const CallHistoryUpdateRequestSchema = Joi.object({
  outcome: Joi.string().allow(null).required(),
  // callListPipelineStage can be a UUID string OR a relation object (when included)
  callListPipelineStage: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // callSchedule can be a UUID string OR a relation object (when included)
  callSchedule: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  CallHistoryResponseSchema,
  CallHistoryListResponseSchema,
  CallHistoryCreateRequestSchema,
  CallHistoryUpdateRequestSchema,
};
