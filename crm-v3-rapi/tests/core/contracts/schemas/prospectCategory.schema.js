/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for ProspectCategory API responses.
 * Defines the expected structure of all ProspectCategory endpoint responses.
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
 * ProspectCategory entity response schema
 * Includes all fields that should be present in API responses
 */
const ProspectCategoryResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  description: Joi.string().allow(null).optional(),
  name: Joi.string().allow(null).required(),

  // Visibility fields (common to all models)
  everyoneCanSeeIt: Joi.boolean().optional(),
  everyoneInObjectCompanyCanSeeIt: Joi.boolean().optional(),

  // Computed/display value fields (if any)
  displayValue: Joi.string().allow(null, '').optional(),
}).unknown(true); // Allow additional fields for flexibility

/**
 * ProspectCategory list response schema
 */
const ProspectCategoryListResponseSchema = createListResponseSchema(
  ProspectCategoryResponseSchema,
);

/**
 * ProspectCategory create request schema (for validation testing)
 */
const ProspectCategoryCreateRequestSchema = Joi.object({
  description: Joi.string().allow(null).optional(),
  name: Joi.string().allow(null).required(),
}).unknown(true);

/**
 * ProspectCategory update request schema (for validation testing)
 */
const ProspectCategoryUpdateRequestSchema = Joi.object({
  description: Joi.string().allow(null).optional(),
  name: Joi.string().allow(null).required(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  ProspectCategoryResponseSchema,
  ProspectCategoryListResponseSchema,
  ProspectCategoryCreateRequestSchema,
  ProspectCategoryUpdateRequestSchema,
};
