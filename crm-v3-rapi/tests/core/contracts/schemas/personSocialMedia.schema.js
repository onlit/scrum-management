/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for PersonSocialMedia API responses.
 * Defines the expected structure of all PersonSocialMedia endpoint responses.
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
 * PersonSocialMedia entity response schema
 * Includes all fields that should be present in API responses
 */
const PersonSocialMediaResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  // person can be a UUID string OR a relation object (when included)
  person: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // socialMedia can be a UUID string OR a relation object (when included)
  socialMedia: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  url: Joi.string().uri().allow(null).required(),
  username: Joi.string().allow(null).required(),

  // Visibility fields (common to all models)
  everyoneCanSeeIt: Joi.boolean().optional(),
  everyoneInObjectCompanyCanSeeIt: Joi.boolean().optional(),

  // Computed/display value fields (if any)
  displayValue: Joi.string().allow(null, '').optional(),
}).unknown(true); // Allow additional fields for flexibility

/**
 * PersonSocialMedia list response schema
 */
const PersonSocialMediaListResponseSchema = createListResponseSchema(
  PersonSocialMediaResponseSchema,
);

/**
 * PersonSocialMedia create request schema (for validation testing)
 */
const PersonSocialMediaCreateRequestSchema = Joi.object({
  // person can be a UUID string OR a relation object (when included)
  person: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // socialMedia can be a UUID string OR a relation object (when included)
  socialMedia: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  url: Joi.string().uri().allow(null).required(),
  username: Joi.string().allow(null).required(),
}).unknown(true);

/**
 * PersonSocialMedia update request schema (for validation testing)
 */
const PersonSocialMediaUpdateRequestSchema = Joi.object({
  // person can be a UUID string OR a relation object (when included)
  person: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // socialMedia can be a UUID string OR a relation object (when included)
  socialMedia: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  url: Joi.string().uri().allow(null).required(),
  username: Joi.string().allow(null).required(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  PersonSocialMediaResponseSchema,
  PersonSocialMediaListResponseSchema,
  PersonSocialMediaCreateRequestSchema,
  PersonSocialMediaUpdateRequestSchema,
};
