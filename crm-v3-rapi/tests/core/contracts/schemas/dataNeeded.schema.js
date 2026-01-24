/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for DataNeeded API responses.
 * Defines the expected structure of all DataNeeded endpoint responses.
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
 * DataNeeded entity response schema
 * Includes all fields that should be present in API responses
 */
const DataNeededResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  whoFrom: Joi.string().allow(null).required(),
  // opportunity can be a UUID string OR a relation object (when included)
  opportunity: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  infoNeeded: Joi.string().allow(null).required(),
  notes: Joi.string().allow(null).optional(),

  // Visibility fields (common to all models)
  everyoneCanSeeIt: Joi.boolean().optional(),
  everyoneInObjectCompanyCanSeeIt: Joi.boolean().optional(),

  // Computed/display value fields (if any)
  displayValue: Joi.string().allow(null, '').optional(),
}).unknown(true); // Allow additional fields for flexibility

/**
 * DataNeeded list response schema
 */
const DataNeededListResponseSchema = createListResponseSchema(
  DataNeededResponseSchema,
);

/**
 * DataNeeded create request schema (for validation testing)
 */
const DataNeededCreateRequestSchema = Joi.object({
  whoFrom: Joi.string().allow(null).required(),
  // opportunity can be a UUID string OR a relation object (when included)
  opportunity: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  infoNeeded: Joi.string().allow(null).required(),
  notes: Joi.string().allow(null).optional(),
}).unknown(true);

/**
 * DataNeeded update request schema (for validation testing)
 */
const DataNeededUpdateRequestSchema = Joi.object({
  whoFrom: Joi.string().allow(null).required(),
  // opportunity can be a UUID string OR a relation object (when included)
  opportunity: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  infoNeeded: Joi.string().allow(null).required(),
  notes: Joi.string().allow(null).optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  DataNeededResponseSchema,
  DataNeededListResponseSchema,
  DataNeededCreateRequestSchema,
  DataNeededUpdateRequestSchema,
};
