/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for CustomerEnquiry API responses.
 * Defines the expected structure of all CustomerEnquiry endpoint responses.
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
 * CustomerEnquiry entity response schema
 * Includes all fields that should be present in API responses
 */
const CustomerEnquiryResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  // person can be a UUID string OR a relation object (when included)
  person: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  firstName: Joi.string().allow(null).optional(),
  lastName: Joi.string().allow(null).optional(),
  sourceNotes: Joi.string().allow(null).optional(),
  // status can be a UUID string OR a relation object (when included)
  status: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  message: Joi.string().allow(null).optional(),
  // purpose can be a UUID string OR a relation object (when included)
  purpose: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  source: Joi.string().allow(null).optional(),
  phone: Joi.string().allow(null).optional(),

  // Visibility fields (common to all models)
  everyoneCanSeeIt: Joi.boolean().optional(),
  everyoneInObjectCompanyCanSeeIt: Joi.boolean().optional(),

  // Computed/display value fields (if any)
  displayValue: Joi.string().allow(null, '').optional(),
}).unknown(true); // Allow additional fields for flexibility

/**
 * CustomerEnquiry list response schema
 */
const CustomerEnquiryListResponseSchema = createListResponseSchema(
  CustomerEnquiryResponseSchema,
);

/**
 * CustomerEnquiry create request schema (for validation testing)
 */
const CustomerEnquiryCreateRequestSchema = Joi.object({
  // person can be a UUID string OR a relation object (when included)
  person: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  firstName: Joi.string().allow(null).optional(),
  lastName: Joi.string().allow(null).optional(),
  sourceNotes: Joi.string().allow(null).optional(),
  // status can be a UUID string OR a relation object (when included)
  status: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  message: Joi.string().allow(null).optional(),
  // purpose can be a UUID string OR a relation object (when included)
  purpose: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  source: Joi.string().allow(null).optional(),
  phone: Joi.string().allow(null).optional(),
}).unknown(true);

/**
 * CustomerEnquiry update request schema (for validation testing)
 */
const CustomerEnquiryUpdateRequestSchema = Joi.object({
  // person can be a UUID string OR a relation object (when included)
  person: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  firstName: Joi.string().allow(null).optional(),
  lastName: Joi.string().allow(null).optional(),
  sourceNotes: Joi.string().allow(null).optional(),
  // status can be a UUID string OR a relation object (when included)
  status: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  message: Joi.string().allow(null).optional(),
  // purpose can be a UUID string OR a relation object (when included)
  purpose: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  source: Joi.string().allow(null).optional(),
  phone: Joi.string().allow(null).optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  CustomerEnquiryResponseSchema,
  CustomerEnquiryListResponseSchema,
  CustomerEnquiryCreateRequestSchema,
  CustomerEnquiryUpdateRequestSchema,
};
