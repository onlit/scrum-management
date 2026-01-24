/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for ModelName API responses.
 * Defines the expected structure of all ModelName endpoint responses.
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
 * ModelName entity response schema
 * Includes all fields that should be present in API responses
 */
const ModelNameResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  // @gen:RESPONSE_SCHEMA_FIELDS

  // Visibility fields (common to all models)
  everyoneCanSeeIt: Joi.boolean().optional(),
  everyoneInObjectCompanyCanSeeIt: Joi.boolean().optional(),

  // Computed/display value fields (if any)
  displayValue: Joi.string().allow(null, '').optional(),
}).unknown(true); // Allow additional fields for flexibility

/**
 * ModelName list response schema
 */
const ModelNameListResponseSchema = createListResponseSchema(ModelNameResponseSchema);

/**
 * ModelName create request schema (for validation testing)
 */
const ModelNameCreateRequestSchema = Joi.object({
  // @gen:CREATE_REQUEST_SCHEMA_FIELDS
}).unknown(true);

/**
 * ModelName update request schema (for validation testing)
 */
const ModelNameUpdateRequestSchema = Joi.object({
  // @gen:UPDATE_REQUEST_SCHEMA_FIELDS
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  ModelNameResponseSchema,
  ModelNameListResponseSchema,
  ModelNameCreateRequestSchema,
  ModelNameUpdateRequestSchema,
};
