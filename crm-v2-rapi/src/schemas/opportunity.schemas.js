/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to opportunity.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - opportunityCreate.
 * - opportunityUpdate.
 *
 *
 */

const Joi = require('joi');
const {
  validateISODate,
  validateISODateTime,
} = require('#utils/shared/dateValidation.js');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const opportunityBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  companyId: Joi.string().uuid().allow(null).optional(),
  personId: Joi.string().uuid().allow(null).optional(),
  statusId: Joi.string().uuid().allow(null).optional(),
  sentiment: Joi.string().max(12).allow('', null).optional(),
  dataSource: Joi.string().allow('', null).optional(),
  actualValue: Joi.number()
    .integer()
    .min(0)
    .max(2147483647)
    .allow(null)
    .optional(),
  probability: Joi.number()
    .integer()
    .min(0)
    .max(2147483647)
    .allow(null)
    .optional(),
  economicBuyerInfluenceId: Joi.string().uuid().allow(null).optional(),
  salesPersonId: Joi.string().uuid().allow(null).optional(),
  ownerId: Joi.string().uuid().allow(null).optional(),
  companyContactId: Joi.string().uuid().allow(null).optional(),
  color: Joi.string().max(40).allow('', null).optional(),
  notes: Joi.string().allow('', null).optional(),
  technicalBuyerInfluenceId: Joi.string().uuid().allow(null).optional(),
  statusAssignedDate: Joi.string()
    .custom(validateISODateTime)
    .allow('', null)
    .optional(),
  pipelineId: Joi.string().uuid().allow(null).optional(),
  description: Joi.string().allow('', null).optional(),
  estimatedValue: Joi.number()
    .integer()
    .min(0)
    .max(2147483647)
    .allow(null)
    .optional(),
  estimatedCloseDate: Joi.string()
    .custom(validateISODate)
    .allow('', null)
    .optional(),
  userBuyerInfluenceId: Joi.string().uuid().allow(null).optional(),
  customerPriority: Joi.string().max(7).allow('', null).optional(),
  channelId: Joi.string().uuid().allow(null).optional(),
  categoryId: Joi.string().uuid().allow(null).optional(),
  workflowId: Joi.string().uuid().allow(null).optional(),
  tags: Joi.string().allow('', null).optional(),
});

const opportunityCreate = opportunityBase.keys({
  name: Joi.string().max(50).required(),
});

const opportunityUpdate = opportunityBase.keys({
  name: Joi.string().max(50).optional(),
});

// Bulk visibility update payload: visibility fields + ids array
const opportunityBulkVisibilityUpdate = visibilityCreate.keys({
  ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = { opportunityCreate, opportunityUpdate, opportunityBulkVisibilityUpdate };
