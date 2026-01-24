/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to actionPlan.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - actionPlanCreate.
 * - actionPlanUpdate.
 *
 *
 */

const Joi = require('joi');
const { validateISODate } = require('#utils/shared/dateValidation.js');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const actionPlanBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  who: Joi.string().allow('', null).optional(),
  when: Joi.string()
    .custom(validateISODate)
    .allow('', null)
    .optional(),
  color: Joi.string().max(40).allow('', null).optional(),
});

const actionPlanCreate = actionPlanBase.keys({
  opportunityId: Joi.string().uuid().required(),
  what: Joi.string().required(),
});

const actionPlanUpdate = actionPlanBase.keys({
  opportunityId: Joi.string().uuid().optional(),
  what: Joi.string().optional(),
});

module.exports = { actionPlanCreate, actionPlanUpdate };
