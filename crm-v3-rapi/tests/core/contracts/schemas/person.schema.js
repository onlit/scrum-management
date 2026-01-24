/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for Person API responses.
 * Defines the expected structure of all Person endpoint responses.
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
 * Person entity response schema
 * Includes all fields that should be present in API responses
 */
const PersonResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  firstName: Joi.string().allow(null).required(),
  hasWhatsapp: Joi.boolean().allow(null).required(),
  middleName: Joi.string().allow(null).optional(),
  preferredName: Joi.string().allow(null).optional(),
  username: Joi.string().allow(null).optional(),
  homePhone: Joi.string().allow(null).optional(),
  avatar: Joi.string().allow(null).optional(),
  address1: Joi.string().allow(null).optional(),
  address2: Joi.string().allow(null).optional(),
  dob: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
  personalMobile: Joi.string().allow(null).optional(),
  zip: Joi.string().allow(null).optional(),
  // state can be a UUID string OR a relation object (when included)
  state: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // parent can be a UUID string OR a relation object (when included)
  parent: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // companyOwner can be a UUID string OR a relation object (when included)
  companyOwner: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  source: Joi.string().allow(null).optional(),
  sourceNotes: Joi.string().allow(null).optional(),
  owner: Joi.string().allow(null).optional(),
  notes: Joi.string().allow(null).optional(),
  lastName: Joi.string().allow(null).optional(),
  email: Joi.string().email().allow(null).required(),
  status: Joi.string().valid('APPLICANT', 'NEW').allow(null).optional(),
  // country can be a UUID string OR a relation object (when included)
  country: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  user: Joi.string().uuid().allow(null).optional(),
  // city can be a UUID string OR a relation object (when included)
  city: Joi.alternatives()
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
 * Person list response schema
 */
const PersonListResponseSchema = createListResponseSchema(PersonResponseSchema);

/**
 * Person create request schema (for validation testing)
 */
const PersonCreateRequestSchema = Joi.object({
  firstName: Joi.string().allow(null).required(),
  hasWhatsapp: Joi.boolean().allow(null).required(),
  middleName: Joi.string().allow(null).optional(),
  preferredName: Joi.string().allow(null).optional(),
  username: Joi.string().allow(null).optional(),
  homePhone: Joi.string().allow(null).optional(),
  avatar: Joi.string().allow(null).optional(),
  address1: Joi.string().allow(null).optional(),
  address2: Joi.string().allow(null).optional(),
  dob: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
  personalMobile: Joi.string().allow(null).optional(),
  zip: Joi.string().allow(null).optional(),
  // state can be a UUID string OR a relation object (when included)
  state: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // parent can be a UUID string OR a relation object (when included)
  parent: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // companyOwner can be a UUID string OR a relation object (when included)
  companyOwner: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  source: Joi.string().allow(null).optional(),
  sourceNotes: Joi.string().allow(null).optional(),
  owner: Joi.string().allow(null).optional(),
  notes: Joi.string().allow(null).optional(),
  lastName: Joi.string().allow(null).optional(),
  email: Joi.string().email().allow(null).required(),
  status: Joi.string().valid('APPLICANT', 'NEW').allow(null).optional(),
  // country can be a UUID string OR a relation object (when included)
  country: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  user: Joi.string().uuid().allow(null).optional(),
  // city can be a UUID string OR a relation object (when included)
  city: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

/**
 * Person update request schema (for validation testing)
 */
const PersonUpdateRequestSchema = Joi.object({
  firstName: Joi.string().allow(null).required(),
  hasWhatsapp: Joi.boolean().allow(null).required(),
  middleName: Joi.string().allow(null).optional(),
  preferredName: Joi.string().allow(null).optional(),
  username: Joi.string().allow(null).optional(),
  homePhone: Joi.string().allow(null).optional(),
  avatar: Joi.string().allow(null).optional(),
  address1: Joi.string().allow(null).optional(),
  address2: Joi.string().allow(null).optional(),
  dob: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
  personalMobile: Joi.string().allow(null).optional(),
  zip: Joi.string().allow(null).optional(),
  // state can be a UUID string OR a relation object (when included)
  state: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // parent can be a UUID string OR a relation object (when included)
  parent: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // companyOwner can be a UUID string OR a relation object (when included)
  companyOwner: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  source: Joi.string().allow(null).optional(),
  sourceNotes: Joi.string().allow(null).optional(),
  owner: Joi.string().allow(null).optional(),
  notes: Joi.string().allow(null).optional(),
  lastName: Joi.string().allow(null).optional(),
  email: Joi.string().email().allow(null).required(),
  status: Joi.string().valid('APPLICANT', 'NEW').allow(null).optional(),
  // country can be a UUID string OR a relation object (when included)
  country: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  user: Joi.string().uuid().allow(null).optional(),
  // city can be a UUID string OR a relation object (when included)
  city: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  PersonResponseSchema,
  PersonListResponseSchema,
  PersonCreateRequestSchema,
  PersonUpdateRequestSchema,
};
