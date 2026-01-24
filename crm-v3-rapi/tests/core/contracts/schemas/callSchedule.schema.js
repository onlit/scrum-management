/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for CallSchedule API responses.
 * Defines the expected structure of all CallSchedule endpoint responses.
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
 * CallSchedule entity response schema
 * Includes all fields that should be present in API responses
 */
const CallScheduleResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  // callListPipelineStage can be a UUID string OR a relation object (when included)
  callListPipelineStage: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  scheduleDatetime: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .required(),
  // callList can be a UUID string OR a relation object (when included)
  callList: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // person can be a UUID string OR a relation object (when included)
  person: Joi.alternatives()
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
 * CallSchedule list response schema
 */
const CallScheduleListResponseSchema = createListResponseSchema(
  CallScheduleResponseSchema,
);

/**
 * CallSchedule create request schema (for validation testing)
 */
const CallScheduleCreateRequestSchema = Joi.object({
  // callListPipelineStage can be a UUID string OR a relation object (when included)
  callListPipelineStage: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  scheduleDatetime: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .required(),
  // callList can be a UUID string OR a relation object (when included)
  callList: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // person can be a UUID string OR a relation object (when included)
  person: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

/**
 * CallSchedule update request schema (for validation testing)
 */
const CallScheduleUpdateRequestSchema = Joi.object({
  // callListPipelineStage can be a UUID string OR a relation object (when included)
  callListPipelineStage: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  scheduleDatetime: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .required(),
  // callList can be a UUID string OR a relation object (when included)
  callList: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // person can be a UUID string OR a relation object (when included)
  person: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  CallScheduleResponseSchema,
  CallScheduleListResponseSchema,
  CallScheduleCreateRequestSchema,
  CallScheduleUpdateRequestSchema,
};
