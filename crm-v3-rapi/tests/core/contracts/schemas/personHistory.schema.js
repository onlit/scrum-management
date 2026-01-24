/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for PersonHistory API responses.
 * Defines the expected structure of all PersonHistory endpoint responses.
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
 * PersonHistory entity response schema
 * Includes all fields that should be present in API responses
 */
const PersonHistoryResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  notes: Joi.string().allow(null).required(),
  history: Joi.string().allow(null).optional(),
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
 * PersonHistory list response schema
 */
const PersonHistoryListResponseSchema = createListResponseSchema(
  PersonHistoryResponseSchema,
);

/**
 * PersonHistory create request schema (for validation testing)
 */
const PersonHistoryCreateRequestSchema = Joi.object({
  notes: Joi.string().allow(null).required(),
  history: Joi.string().allow(null).optional(),
  // person can be a UUID string OR a relation object (when included)
  person: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

/**
 * PersonHistory update request schema (for validation testing)
 */
const PersonHistoryUpdateRequestSchema = Joi.object({
  notes: Joi.string().allow(null).required(),
  history: Joi.string().allow(null).optional(),
  // person can be a UUID string OR a relation object (when included)
  person: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  PersonHistoryResponseSchema,
  PersonHistoryListResponseSchema,
  PersonHistoryCreateRequestSchema,
  PersonHistoryUpdateRequestSchema,
};
