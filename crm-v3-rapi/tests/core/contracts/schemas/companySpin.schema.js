/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for CompanySpin API responses.
 * Defines the expected structure of all CompanySpin endpoint responses.
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
 * CompanySpin entity response schema
 * Includes all fields that should be present in API responses
 */
const CompanySpinResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  situation: Joi.string().allow(null).required(),
  implication: Joi.string().allow(null).required(),
  // company can be a UUID string OR a relation object (when included)
  company: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  need: Joi.string().allow(null).required(),
  buyerInfluence: Joi.string()
    .valid('USER', 'TECHNICAL', 'ECONOMIC')
    .allow(null)
    .required(),
  notes: Joi.string().allow(null).optional(),
  problem: Joi.string().allow(null).required(),

  // Visibility fields (common to all models)
  everyoneCanSeeIt: Joi.boolean().optional(),
  everyoneInObjectCompanyCanSeeIt: Joi.boolean().optional(),

  // Computed/display value fields (if any)
  displayValue: Joi.string().allow(null, '').optional(),
}).unknown(true); // Allow additional fields for flexibility

/**
 * CompanySpin list response schema
 */
const CompanySpinListResponseSchema = createListResponseSchema(
  CompanySpinResponseSchema,
);

/**
 * CompanySpin create request schema (for validation testing)
 */
const CompanySpinCreateRequestSchema = Joi.object({
  situation: Joi.string().allow(null).required(),
  implication: Joi.string().allow(null).required(),
  // company can be a UUID string OR a relation object (when included)
  company: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  need: Joi.string().allow(null).required(),
  buyerInfluence: Joi.string()
    .valid('USER', 'TECHNICAL', 'ECONOMIC')
    .allow(null)
    .required(),
  notes: Joi.string().allow(null).optional(),
  problem: Joi.string().allow(null).required(),
}).unknown(true);

/**
 * CompanySpin update request schema (for validation testing)
 */
const CompanySpinUpdateRequestSchema = Joi.object({
  situation: Joi.string().allow(null).required(),
  implication: Joi.string().allow(null).required(),
  // company can be a UUID string OR a relation object (when included)
  company: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  need: Joi.string().allow(null).required(),
  buyerInfluence: Joi.string()
    .valid('USER', 'TECHNICAL', 'ECONOMIC')
    .allow(null)
    .required(),
  notes: Joi.string().allow(null).optional(),
  problem: Joi.string().allow(null).required(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  CompanySpinResponseSchema,
  CompanySpinListResponseSchema,
  CompanySpinCreateRequestSchema,
  CompanySpinUpdateRequestSchema,
};
