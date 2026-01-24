/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for AccountManagerInCompany API responses.
 * Defines the expected structure of all AccountManagerInCompany endpoint responses.
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
 * AccountManagerInCompany entity response schema
 * Includes all fields that should be present in API responses
 */
const AccountManagerInCompanyResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  // company can be a UUID string OR a relation object (when included)
  company: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  expiryDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
  // accountManager can be a UUID string OR a relation object (when included)
  accountManager: Joi.alternatives()
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
 * AccountManagerInCompany list response schema
 */
const AccountManagerInCompanyListResponseSchema = createListResponseSchema(
  AccountManagerInCompanyResponseSchema,
);

/**
 * AccountManagerInCompany create request schema (for validation testing)
 */
const AccountManagerInCompanyCreateRequestSchema = Joi.object({
  // company can be a UUID string OR a relation object (when included)
  company: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  expiryDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
  // accountManager can be a UUID string OR a relation object (when included)
  accountManager: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

/**
 * AccountManagerInCompany update request schema (for validation testing)
 */
const AccountManagerInCompanyUpdateRequestSchema = Joi.object({
  // company can be a UUID string OR a relation object (when included)
  company: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  expiryDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
  // accountManager can be a UUID string OR a relation object (when included)
  accountManager: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  AccountManagerInCompanyResponseSchema,
  AccountManagerInCompanyListResponseSchema,
  AccountManagerInCompanyCreateRequestSchema,
  AccountManagerInCompanyUpdateRequestSchema,
};
