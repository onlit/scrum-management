/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for CompanySocialMedia API responses.
 * Defines the expected structure of all CompanySocialMedia endpoint responses.
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
 * CompanySocialMedia entity response schema
 * Includes all fields that should be present in API responses
 */
const CompanySocialMediaResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  url: Joi.string().uri().allow(null).required(),
  // company can be a UUID string OR a relation object (when included)
  company: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // socialMedia can be a UUID string OR a relation object (when included)
  socialMedia: Joi.alternatives()
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
 * CompanySocialMedia list response schema
 */
const CompanySocialMediaListResponseSchema = createListResponseSchema(
  CompanySocialMediaResponseSchema,
);

/**
 * CompanySocialMedia create request schema (for validation testing)
 */
const CompanySocialMediaCreateRequestSchema = Joi.object({
  url: Joi.string().uri().allow(null).required(),
  // company can be a UUID string OR a relation object (when included)
  company: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // socialMedia can be a UUID string OR a relation object (when included)
  socialMedia: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

/**
 * CompanySocialMedia update request schema (for validation testing)
 */
const CompanySocialMediaUpdateRequestSchema = Joi.object({
  url: Joi.string().uri().allow(null).required(),
  // company can be a UUID string OR a relation object (when included)
  company: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // socialMedia can be a UUID string OR a relation object (when included)
  socialMedia: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  CompanySocialMediaResponseSchema,
  CompanySocialMediaListResponseSchema,
  CompanySocialMediaCreateRequestSchema,
  CompanySocialMediaUpdateRequestSchema,
};
