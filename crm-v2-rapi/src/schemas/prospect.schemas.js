/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 09/10/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to prospect.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - prospectCreate.
 * - prospectUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const prospectBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  personId: Joi.string().uuid().allow(null).optional(),
  ownerId: Joi.string().uuid().allow(null).optional(),
  sourceCampaignId: Joi.string().uuid().allow(null).optional(),
  categoryId: Joi.string().uuid().allow(null).optional(),
  statusId: Joi.string().uuid().allow(null).optional(),
  prospectPipelineId: Joi.string().uuid().allow(null).optional(),
  qualificationScore: Joi.number()
    .integer()
    .min(0)
    .max(100)
    .allow(null)
    .optional(),
  interestSummary: Joi.string().allow('', null).optional(),
  disqualificationReason: Joi.string()
    .allow(null)
    .valid(
      'NO_BUDGET',
      'WRONG_TIMING',
      'LOST_TO_COMPETITOR',
      'UNRESPONSIVE',
      'NOT_A_FIT',
      'OTHER',
      null
    )
    .empty('')
    .optional(),
  color: Joi.string().max(40).allow('', null).optional(),
  tags: Joi.string().allow('', null).optional(),
  workflowId: Joi.string().uuid().allow(null).optional(),
});

const prospectCreate = prospectBase.keys({
  personId: Joi.string().uuid().required(),
  ownerId: Joi.string().uuid().required(),
  sourceCampaignId: Joi.string().uuid().allow(null).optional(),
  categoryId: Joi.string().uuid().required(),
  temperature: Joi.string()
    .valid('COLD', 'WARM', 'HOT')
    .default('COLD')
    .required(),
  qualificationScore: Joi.number()
    .integer()
    .min(0)
    .max(100)
    .default(0)
    .required(),
});

const prospectUpdate = prospectBase.keys({
  personId: Joi.string().uuid().optional(),
  ownerId: Joi.string().uuid().optional(),
  sourceCampaignId: Joi.string().uuid().allow(null).optional(),
  categoryId: Joi.string().uuid().optional(),
  temperature: Joi.string().valid('COLD', 'WARM', 'HOT').optional(),
  qualificationScore: Joi.number().integer().min(0).max(100).optional(),
});

module.exports = { prospectCreate, prospectUpdate };
