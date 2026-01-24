/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract schema for Opportunity API responses.
 * Defines the expected structure of all Opportunity endpoint responses.
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
 * Opportunity entity response schema
 * Includes all fields that should be present in API responses
 */
const OpportunityResponseSchema = BaseEntitySchema.keys({
  // Core fields from model definition
  // company can be a UUID string OR a relation object (when included)
  company: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // person can be a UUID string OR a relation object (when included)
  person: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // companyContact can be a UUID string OR a relation object (when included)
  companyContact: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  actualValue: Joi.number().integer().allow(null).optional(),
  probability: Joi.number().integer().allow(null).optional(),
  // owner can be a UUID string OR a relation object (when included)
  owner: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // salesPerson can be a UUID string OR a relation object (when included)
  salesPerson: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // channel can be a UUID string OR a relation object (when included)
  channel: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  dataSource: Joi.string().allow(null).optional(),
  sentiment: Joi.string()
    .valid(
      'FEARFUL',
      'DISTRESSED',
      'CONCERNED',
      'OK',
      'GOOD',
      'SECURE',
      'ECSTATIC',
    )
    .allow(null)
    .optional(),
  // economicBuyerInfluence can be a UUID string OR a relation object (when included)
  economicBuyerInfluence: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // technicalBuyerInfluence can be a UUID string OR a relation object (when included)
  technicalBuyerInfluence: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  customerPriority: Joi.string()
    .valid('URGENT', 'ASAP', 'LATER')
    .allow(null)
    .optional(),
  notes: Joi.string().allow(null).optional(),
  name: Joi.string().allow(null).required(),
  description: Joi.string().allow(null).optional(),
  // pipeline can be a UUID string OR a relation object (when included)
  pipeline: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  estimatedValue: Joi.number().integer().allow(null).optional(),
  // userBuyerInfluence can be a UUID string OR a relation object (when included)
  userBuyerInfluence: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  estimatedCloseDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
  // category can be a UUID string OR a relation object (when included)
  category: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // status can be a UUID string OR a relation object (when included)
  status: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  statusAssignedDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),

  // Visibility fields (common to all models)
  everyoneCanSeeIt: Joi.boolean().optional(),
  everyoneInObjectCompanyCanSeeIt: Joi.boolean().optional(),

  // Computed/display value fields (if any)
  displayValue: Joi.string().allow(null, '').optional(),
}).unknown(true); // Allow additional fields for flexibility

/**
 * Opportunity list response schema
 */
const OpportunityListResponseSchema = createListResponseSchema(
  OpportunityResponseSchema,
);

/**
 * Opportunity create request schema (for validation testing)
 */
const OpportunityCreateRequestSchema = Joi.object({
  // company can be a UUID string OR a relation object (when included)
  company: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // person can be a UUID string OR a relation object (when included)
  person: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // companyContact can be a UUID string OR a relation object (when included)
  companyContact: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  actualValue: Joi.number().integer().allow(null).optional(),
  probability: Joi.number().integer().allow(null).optional(),
  // owner can be a UUID string OR a relation object (when included)
  owner: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // salesPerson can be a UUID string OR a relation object (when included)
  salesPerson: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // channel can be a UUID string OR a relation object (when included)
  channel: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  dataSource: Joi.string().allow(null).optional(),
  sentiment: Joi.string()
    .valid(
      'FEARFUL',
      'DISTRESSED',
      'CONCERNED',
      'OK',
      'GOOD',
      'SECURE',
      'ECSTATIC',
    )
    .allow(null)
    .optional(),
  // economicBuyerInfluence can be a UUID string OR a relation object (when included)
  economicBuyerInfluence: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // technicalBuyerInfluence can be a UUID string OR a relation object (when included)
  technicalBuyerInfluence: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  customerPriority: Joi.string()
    .valid('URGENT', 'ASAP', 'LATER')
    .allow(null)
    .optional(),
  notes: Joi.string().allow(null).optional(),
  name: Joi.string().allow(null).required(),
  description: Joi.string().allow(null).optional(),
  // pipeline can be a UUID string OR a relation object (when included)
  pipeline: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  estimatedValue: Joi.number().integer().allow(null).optional(),
  // userBuyerInfluence can be a UUID string OR a relation object (when included)
  userBuyerInfluence: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  estimatedCloseDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
  // category can be a UUID string OR a relation object (when included)
  category: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // status can be a UUID string OR a relation object (when included)
  status: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  statusAssignedDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
}).unknown(true);

/**
 * Opportunity update request schema (for validation testing)
 */
const OpportunityUpdateRequestSchema = Joi.object({
  // company can be a UUID string OR a relation object (when included)
  company: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // person can be a UUID string OR a relation object (when included)
  person: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // companyContact can be a UUID string OR a relation object (when included)
  companyContact: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  actualValue: Joi.number().integer().allow(null).optional(),
  probability: Joi.number().integer().allow(null).optional(),
  // owner can be a UUID string OR a relation object (when included)
  owner: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // salesPerson can be a UUID string OR a relation object (when included)
  salesPerson: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // channel can be a UUID string OR a relation object (when included)
  channel: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  dataSource: Joi.string().allow(null).optional(),
  sentiment: Joi.string()
    .valid(
      'FEARFUL',
      'DISTRESSED',
      'CONCERNED',
      'OK',
      'GOOD',
      'SECURE',
      'ECSTATIC',
    )
    .allow(null)
    .optional(),
  // economicBuyerInfluence can be a UUID string OR a relation object (when included)
  economicBuyerInfluence: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // technicalBuyerInfluence can be a UUID string OR a relation object (when included)
  technicalBuyerInfluence: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  customerPriority: Joi.string()
    .valid('URGENT', 'ASAP', 'LATER')
    .allow(null)
    .optional(),
  notes: Joi.string().allow(null).optional(),
  name: Joi.string().allow(null).required(),
  description: Joi.string().allow(null).optional(),
  // pipeline can be a UUID string OR a relation object (when included)
  pipeline: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  estimatedValue: Joi.number().integer().allow(null).optional(),
  // userBuyerInfluence can be a UUID string OR a relation object (when included)
  userBuyerInfluence: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  estimatedCloseDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
  // category can be a UUID string OR a relation object (when included)
  category: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  // status can be a UUID string OR a relation object (when included)
  status: Joi.alternatives()
    .try(Joi.string().uuid(), RelationObjectSchema)
    .allow(null)
    .optional(),
  statusAssignedDate: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .allow(null)
    .optional(),
}).unknown(true);

module.exports = {
  RelationObjectSchema,
  OpportunityResponseSchema,
  OpportunityListResponseSchema,
  OpportunityCreateRequestSchema,
  OpportunityUpdateRequestSchema,
};
