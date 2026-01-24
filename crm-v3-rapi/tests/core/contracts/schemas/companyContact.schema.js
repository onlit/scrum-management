/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for CompanyContact API responses.
 * Defines the expected structure of all CompanyContact endpoint responses.
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
 * CompanyContact entity response schema
 * Includes all fields that should be present in API responses
 */
const CompanyContactResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  // person can be a UUID string OR a relation object (when included)
  person: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // company can be a UUID string OR a relation object (when included)
  company: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  workEmail: Joi.string().email().allow(null).optional(),
  endDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
  accounts: Joi.boolean().allow(null).optional(),
  startDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
  jobTitle: Joi.string().allow(null).optional(),
  workPhone: Joi.string().allow(null).optional(),
  workMobile: Joi.string().allow(null).optional(),

  // Visibility fields (common to all models)
  everyoneCanSeeIt: Joi.boolean().optional(),
  everyoneInObjectCompanyCanSeeIt: Joi.boolean().optional(),

  // Computed/display value fields (if any)
  displayValue: Joi.string().allow(null, '').optional(),
}).unknown(true); // Allow additional fields for flexibility

/**
 * CompanyContact list response schema
 */
const CompanyContactListResponseSchema = createListResponseSchema(
  CompanyContactResponseSchema,
);

/**
 * CompanyContact create request schema (for validation testing)
 */
const CompanyContactCreateRequestSchema = Joi.object({
  // person can be a UUID string OR a relation object (when included)
  person: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // company can be a UUID string OR a relation object (when included)
  company: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  workEmail: Joi.string().email().allow(null).optional(),
  endDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
  accounts: Joi.boolean().allow(null).optional(),
  startDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
  jobTitle: Joi.string().allow(null).optional(),
  workPhone: Joi.string().allow(null).optional(),
  workMobile: Joi.string().allow(null).optional(),
}).unknown(true);

/**
 * CompanyContact update request schema (for validation testing)
 */
const CompanyContactUpdateRequestSchema = Joi.object({
  // person can be a UUID string OR a relation object (when included)
  person: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // company can be a UUID string OR a relation object (when included)
  company: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  workEmail: Joi.string().email().allow(null).optional(),
  endDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
  accounts: Joi.boolean().allow(null).optional(),
  startDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
  jobTitle: Joi.string().allow(null).optional(),
  workPhone: Joi.string().allow(null).optional(),
  workMobile: Joi.string().allow(null).optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  CompanyContactResponseSchema,
  CompanyContactListResponseSchema,
  CompanyContactCreateRequestSchema,
  CompanyContactUpdateRequestSchema,
};
