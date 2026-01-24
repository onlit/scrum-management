/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for PersonRelationship API responses.
 * Defines the expected structure of all PersonRelationship endpoint responses.
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
 * PersonRelationship entity response schema
 * Includes all fields that should be present in API responses
 */
const PersonRelationshipResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  // relationship can be a UUID string OR a relation object (when included)
  relationship: Joi.alternatives()
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
 * PersonRelationship list response schema
 */
const PersonRelationshipListResponseSchema = createListResponseSchema(
  PersonRelationshipResponseSchema,
);

/**
 * PersonRelationship create request schema (for validation testing)
 */
const PersonRelationshipCreateRequestSchema = Joi.object({
  // relationship can be a UUID string OR a relation object (when included)
  relationship: Joi.alternatives()
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
 * PersonRelationship update request schema (for validation testing)
 */
const PersonRelationshipUpdateRequestSchema = Joi.object({
  // relationship can be a UUID string OR a relation object (when included)
  relationship: Joi.alternatives()
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
  PersonRelationshipResponseSchema,
  PersonRelationshipListResponseSchema,
  PersonRelationshipCreateRequestSchema,
  PersonRelationshipUpdateRequestSchema,
};
