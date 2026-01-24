/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for CallListPipeline API responses.
 * Defines the expected structure of all CallListPipeline endpoint responses.
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
 * CallListPipeline entity response schema
 * Includes all fields that should be present in API responses
 */
const CallListPipelineResponseSchema = BaseEntitySchema.keys({
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
 * CallListPipeline list response schema
 */
const CallListPipelineListResponseSchema = createListResponseSchema(
  CallListPipelineResponseSchema,
);

/**
 * CallListPipeline create request schema (for validation testing)
 */
const CallListPipelineCreateRequestSchema = Joi.object({
  description: Joi.string().allow(null).optional(),
  name: Joi.string().allow(null).required(),
}).unknown(true);

/**
 * CallListPipeline update request schema (for validation testing)
 */
const CallListPipelineUpdateRequestSchema = Joi.object({
  description: Joi.string().allow(null).optional(),
  name: Joi.string().allow(null).required(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  CallListPipelineResponseSchema,
  CallListPipelineListResponseSchema,
  CallListPipelineCreateRequestSchema,
  CallListPipelineUpdateRequestSchema,
};
