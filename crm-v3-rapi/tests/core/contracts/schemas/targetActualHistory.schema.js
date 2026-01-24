/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for TargetActualHistory API responses.
 * Defines the expected structure of all TargetActualHistory endpoint responses.
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
 * TargetActualHistory entity response schema
 * Includes all fields that should be present in API responses
 */
const TargetActualHistoryResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  actuals: Joi.number().integer().allow(null).required(),
  // target can be a UUID string OR a relation object (when included)
  target: Joi.alternatives()
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
 * TargetActualHistory list response schema
 */
const TargetActualHistoryListResponseSchema = createListResponseSchema(
  TargetActualHistoryResponseSchema,
);

/**
 * TargetActualHistory create request schema (for validation testing)
 */
const TargetActualHistoryCreateRequestSchema = Joi.object({
  actuals: Joi.number().integer().allow(null).required(),
  // target can be a UUID string OR a relation object (when included)
  target: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

/**
 * TargetActualHistory update request schema (for validation testing)
 */
const TargetActualHistoryUpdateRequestSchema = Joi.object({
  actuals: Joi.number().integer().allow(null).required(),
  // target can be a UUID string OR a relation object (when included)
  target: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  TargetActualHistoryResponseSchema,
  TargetActualHistoryListResponseSchema,
  TargetActualHistoryCreateRequestSchema,
  TargetActualHistoryUpdateRequestSchema,
};
