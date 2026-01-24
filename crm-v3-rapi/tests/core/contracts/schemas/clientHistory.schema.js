/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for ClientHistory API responses.
 * Defines the expected structure of all ClientHistory endpoint responses.
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
 * ClientHistory entity response schema
 * Includes all fields that should be present in API responses
 */
const ClientHistoryResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  // clientRef can be a UUID string OR a relation object (when included)
  clientRef: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  url: Joi.string().uri().allow(null).required(),

  // Visibility fields (common to all models)
  everyoneCanSeeIt: Joi.boolean().optional(),
  everyoneInObjectCompanyCanSeeIt: Joi.boolean().optional(),

  // Computed/display value fields (if any)
  displayValue: Joi.string().allow(null, '').optional(),
}).unknown(true); // Allow additional fields for flexibility

/**
 * ClientHistory list response schema
 */
const ClientHistoryListResponseSchema = createListResponseSchema(
  ClientHistoryResponseSchema,
);

/**
 * ClientHistory create request schema (for validation testing)
 */
const ClientHistoryCreateRequestSchema = Joi.object({
  // clientRef can be a UUID string OR a relation object (when included)
  clientRef: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  url: Joi.string().uri().allow(null).required(),
}).unknown(true);

/**
 * ClientHistory update request schema (for validation testing)
 */
const ClientHistoryUpdateRequestSchema = Joi.object({
  // clientRef can be a UUID string OR a relation object (when included)
  clientRef: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  url: Joi.string().uri().allow(null).required(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  ClientHistoryResponseSchema,
  ClientHistoryListResponseSchema,
  ClientHistoryCreateRequestSchema,
  ClientHistoryUpdateRequestSchema,
};
