/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for CallList API responses.
 * Defines the expected structure of all CallList endpoint responses.
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
 * CallList entity response schema
 * Includes all fields that should be present in API responses
 */
const CallListResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  name: Joi.string().allow(null).required(),
  // callListPipeline can be a UUID string OR a relation object (when included)
  callListPipeline: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  description: Joi.string().allow(null).optional(),

  // Visibility fields (common to all models)
  everyoneCanSeeIt: Joi.boolean().optional(),
  everyoneInObjectCompanyCanSeeIt: Joi.boolean().optional(),

  // Computed/display value fields (if any)
  displayValue: Joi.string().allow(null, '').optional(),
}).unknown(true); // Allow additional fields for flexibility

/**
 * CallList list response schema
 */
const CallListListResponseSchema = createListResponseSchema(
  CallListResponseSchema,
);

/**
 * CallList create request schema (for validation testing)
 */
const CallListCreateRequestSchema = Joi.object({
  name: Joi.string().allow(null).required(),
  // callListPipeline can be a UUID string OR a relation object (when included)
  callListPipeline: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  description: Joi.string().allow(null).optional(),
}).unknown(true);

/**
 * CallList update request schema (for validation testing)
 */
const CallListUpdateRequestSchema = Joi.object({
  name: Joi.string().allow(null).required(),
  // callListPipeline can be a UUID string OR a relation object (when included)
  callListPipeline: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  description: Joi.string().allow(null).optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  CallListResponseSchema,
  CallListListResponseSchema,
  CallListCreateRequestSchema,
  CallListUpdateRequestSchema,
};
