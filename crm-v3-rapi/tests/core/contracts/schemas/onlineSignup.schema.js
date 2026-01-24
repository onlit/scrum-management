/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for OnlineSignup API responses.
 * Defines the expected structure of all OnlineSignup endpoint responses.
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
 * OnlineSignup entity response schema
 * Includes all fields that should be present in API responses
 */
const OnlineSignupResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  source: Joi.string().allow(null).optional(),
  fields: Joi.string().allow(null).optional(),
  owner: Joi.string().allow(null).required(),
  emailconfirmed: Joi.boolean().allow(null).optional(),

  // Visibility fields (common to all models)
  everyoneCanSeeIt: Joi.boolean().optional(),
  everyoneInObjectCompanyCanSeeIt: Joi.boolean().optional(),

  // Computed/display value fields (if any)
  displayValue: Joi.string().allow(null, '').optional(),
}).unknown(true); // Allow additional fields for flexibility

/**
 * OnlineSignup list response schema
 */
const OnlineSignupListResponseSchema = createListResponseSchema(
  OnlineSignupResponseSchema,
);

/**
 * OnlineSignup create request schema (for validation testing)
 */
const OnlineSignupCreateRequestSchema = Joi.object({
  source: Joi.string().allow(null).optional(),
  fields: Joi.string().allow(null).optional(),
  owner: Joi.string().allow(null).required(),
  emailconfirmed: Joi.boolean().allow(null).optional(),
}).unknown(true);

/**
 * OnlineSignup update request schema (for validation testing)
 */
const OnlineSignupUpdateRequestSchema = Joi.object({
  source: Joi.string().allow(null).optional(),
  fields: Joi.string().allow(null).optional(),
  owner: Joi.string().allow(null).required(),
  emailconfirmed: Joi.boolean().allow(null).optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  OnlineSignupResponseSchema,
  OnlineSignupListResponseSchema,
  OnlineSignupCreateRequestSchema,
  OnlineSignupUpdateRequestSchema,
};
