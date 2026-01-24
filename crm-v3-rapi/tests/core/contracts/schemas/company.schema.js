/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for Company API responses.
 * Defines the expected structure of all Company endpoint responses.
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
 * Company entity response schema
 * Includes all fields that should be present in API responses
 */
const CompanyResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  name: Joi.string().allow(null).required(),
  description: Joi.string().allow(null).optional(),
  email: Joi.string().email().allow(null).optional(),
  fax: Joi.string().allow(null).optional(),
  staffUrl: Joi.string().uri().allow(null).optional(),
  contactUrl: Joi.string().uri().allow(null).optional(),
  address1: Joi.string().allow(null).optional(),
  address2: Joi.string().allow(null).optional(),
  // state can be a UUID string OR a relation object (when included)
  state: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  zip: Joi.string().allow(null).optional(),
  size: Joi.string()
    .valid(
      'SIZE_1',
      'SIZE_2_TO_10',
      'SIZE_11_TO_50',
      'SIZE_51_TO_100',
      'SIZE_101_TO_250',
      'SIZE_251_TO_500',
      'SIZE_501_TO_1000',
      'SIZE_1001_TO_10000',
    )
    .allow(null)
    .optional(),
  // industry can be a UUID string OR a relation object (when included)
  industry: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  keywords: Joi.string().allow(null).optional(),
  notes: Joi.string().allow(null).optional(),
  // branchOf can be a UUID string OR a relation object (when included)
  branchOf: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // owner can be a UUID string OR a relation object (when included)
  owner: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  betaPartners: Joi.boolean().allow(null).required(),
  website: Joi.string().uri().allow(null).optional(),
  newsUrl: Joi.string().uri().allow(null).optional(),
  phone: Joi.string().allow(null).optional(),
  // country can be a UUID string OR a relation object (when included)
  country: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // city can be a UUID string OR a relation object (when included)
  city: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  companyIntelligence: Joi.string().allow(null).optional(),

  // Visibility fields (common to all models)
  everyoneCanSeeIt: Joi.boolean().optional(),
  everyoneInObjectCompanyCanSeeIt: Joi.boolean().optional(),

  // Computed/display value fields (if any)
  displayValue: Joi.string().allow(null, '').optional(),
}).unknown(true); // Allow additional fields for flexibility

/**
 * Company list response schema
 */
const CompanyListResponseSchema = createListResponseSchema(
  CompanyResponseSchema,
);

/**
 * Company create request schema (for validation testing)
 */
const CompanyCreateRequestSchema = Joi.object({
  name: Joi.string().allow(null).required(),
  description: Joi.string().allow(null).optional(),
  email: Joi.string().email().allow(null).optional(),
  fax: Joi.string().allow(null).optional(),
  staffUrl: Joi.string().uri().allow(null).optional(),
  contactUrl: Joi.string().uri().allow(null).optional(),
  address1: Joi.string().allow(null).optional(),
  address2: Joi.string().allow(null).optional(),
  // state can be a UUID string OR a relation object (when included)
  state: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  zip: Joi.string().allow(null).optional(),
  size: Joi.string()
    .valid(
      'SIZE_1',
      'SIZE_2_TO_10',
      'SIZE_11_TO_50',
      'SIZE_51_TO_100',
      'SIZE_101_TO_250',
      'SIZE_251_TO_500',
      'SIZE_501_TO_1000',
      'SIZE_1001_TO_10000',
    )
    .allow(null)
    .optional(),
  // industry can be a UUID string OR a relation object (when included)
  industry: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  keywords: Joi.string().allow(null).optional(),
  notes: Joi.string().allow(null).optional(),
  // branchOf can be a UUID string OR a relation object (when included)
  branchOf: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // owner can be a UUID string OR a relation object (when included)
  owner: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  betaPartners: Joi.boolean().allow(null).required(),
  website: Joi.string().uri().allow(null).optional(),
  newsUrl: Joi.string().uri().allow(null).optional(),
  phone: Joi.string().allow(null).optional(),
  // country can be a UUID string OR a relation object (when included)
  country: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // city can be a UUID string OR a relation object (when included)
  city: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  companyIntelligence: Joi.string().allow(null).optional(),
}).unknown(true);

/**
 * Company update request schema (for validation testing)
 */
const CompanyUpdateRequestSchema = Joi.object({
  name: Joi.string().allow(null).required(),
  description: Joi.string().allow(null).optional(),
  email: Joi.string().email().allow(null).optional(),
  fax: Joi.string().allow(null).optional(),
  staffUrl: Joi.string().uri().allow(null).optional(),
  contactUrl: Joi.string().uri().allow(null).optional(),
  address1: Joi.string().allow(null).optional(),
  address2: Joi.string().allow(null).optional(),
  // state can be a UUID string OR a relation object (when included)
  state: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  zip: Joi.string().allow(null).optional(),
  size: Joi.string()
    .valid(
      'SIZE_1',
      'SIZE_2_TO_10',
      'SIZE_11_TO_50',
      'SIZE_51_TO_100',
      'SIZE_101_TO_250',
      'SIZE_251_TO_500',
      'SIZE_501_TO_1000',
      'SIZE_1001_TO_10000',
    )
    .allow(null)
    .optional(),
  // industry can be a UUID string OR a relation object (when included)
  industry: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  keywords: Joi.string().allow(null).optional(),
  notes: Joi.string().allow(null).optional(),
  // branchOf can be a UUID string OR a relation object (when included)
  branchOf: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // owner can be a UUID string OR a relation object (when included)
  owner: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  betaPartners: Joi.boolean().allow(null).required(),
  website: Joi.string().uri().allow(null).optional(),
  newsUrl: Joi.string().uri().allow(null).optional(),
  phone: Joi.string().allow(null).optional(),
  // country can be a UUID string OR a relation object (when included)
  country: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // city can be a UUID string OR a relation object (when included)
  city: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  companyIntelligence: Joi.string().allow(null).optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  CompanyResponseSchema,
  CompanyListResponseSchema,
  CompanyCreateRequestSchema,
  CompanyUpdateRequestSchema,
};
