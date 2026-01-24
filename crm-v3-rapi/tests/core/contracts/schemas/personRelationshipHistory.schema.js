/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for PersonRelationshipHistory API responses.
 * Defines the expected structure of all PersonRelationshipHistory endpoint responses.
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
 * PersonRelationshipHistory entity response schema
 * Includes all fields that should be present in API responses
 */
const PersonRelationshipHistoryResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  // personRelationship can be a UUID string OR a relation object (when included)
  personRelationship: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  notes: Joi.string().allow(null).required(),

  // Visibility fields (common to all models)
  everyoneCanSeeIt: Joi.boolean().optional(),
  everyoneInObjectCompanyCanSeeIt: Joi.boolean().optional(),

  // Computed/display value fields (if any)
  displayValue: Joi.string().allow(null, '').optional(),
}).unknown(true); // Allow additional fields for flexibility

/**
 * PersonRelationshipHistory list response schema
 */
const PersonRelationshipHistoryListResponseSchema = createListResponseSchema(
  PersonRelationshipHistoryResponseSchema,
);

/**
 * PersonRelationshipHistory create request schema (for validation testing)
 */
const PersonRelationshipHistoryCreateRequestSchema = Joi.object({
  // personRelationship can be a UUID string OR a relation object (when included)
  personRelationship: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  notes: Joi.string().allow(null).required(),
}).unknown(true);

/**
 * PersonRelationshipHistory update request schema (for validation testing)
 */
const PersonRelationshipHistoryUpdateRequestSchema = Joi.object({
  // personRelationship can be a UUID string OR a relation object (when included)
  personRelationship: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  notes: Joi.string().allow(null).required(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  PersonRelationshipHistoryResponseSchema,
  PersonRelationshipHistoryListResponseSchema,
  PersonRelationshipHistoryCreateRequestSchema,
  PersonRelationshipHistoryUpdateRequestSchema,
};
