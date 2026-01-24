/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for ProspectProduct API responses.
 * Defines the expected structure of all ProspectProduct endpoint responses.
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
 * ProspectProduct entity response schema
 * Includes all fields that should be present in API responses
 */
const ProspectProductResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  amount: Joi.number().integer().allow(null).optional(),
  estimatedValue: Joi.number().integer().allow(null).optional(),
  // productVariant can be a UUID string OR a relation object (when included)
  productVariant: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // prospect can be a UUID string OR a relation object (when included)
  prospect: Joi.alternatives()
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
 * ProspectProduct list response schema
 */
const ProspectProductListResponseSchema = createListResponseSchema(
  ProspectProductResponseSchema,
);

/**
 * ProspectProduct create request schema (for validation testing)
 */
const ProspectProductCreateRequestSchema = Joi.object({
  amount: Joi.number().integer().allow(null).optional(),
  estimatedValue: Joi.number().integer().allow(null).optional(),
  // productVariant can be a UUID string OR a relation object (when included)
  productVariant: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // prospect can be a UUID string OR a relation object (when included)
  prospect: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

/**
 * ProspectProduct update request schema (for validation testing)
 */
const ProspectProductUpdateRequestSchema = Joi.object({
  amount: Joi.number().integer().allow(null).optional(),
  estimatedValue: Joi.number().integer().allow(null).optional(),
  // productVariant can be a UUID string OR a relation object (when included)
  productVariant: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // prospect can be a UUID string OR a relation object (when included)
  prospect: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  ProspectProductResponseSchema,
  ProspectProductListResponseSchema,
  ProspectProductCreateRequestSchema,
  ProspectProductUpdateRequestSchema,
};
