/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to callSchedule.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - callScheduleCreate.
 * - callScheduleUpdate.
 *
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const callScheduleBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  callListId: Joi.string().uuid().allow(null).optional(),
  color: Joi.string().max(40).allow('', null).optional(),
});

const callScheduleCreate = callScheduleBase.keys({
  callListPipelineStageId: Joi.string().uuid().required(),
  scheduleDatetime: Joi.string()
    .custom((value, helpers) => {
      const parsedDate = new Date(value);
      if (!isDateValid(parsedDate)) {
        return helpers.message('Invalid Date format');
      }
      return value;
    })
    .required(),
  personId: Joi.string().uuid().required(),
});

const callScheduleUpdate = callScheduleBase.keys({
  callListPipelineStageId: Joi.string().uuid().optional(),
  scheduleDatetime: Joi.string()
    .custom((value, helpers) => {
      const parsedDate = new Date(value);
      if (!isDateValid(parsedDate)) {
        return helpers.message('Invalid Date format');
      }
      return value;
    })
    .optional(),
  personId: Joi.string().uuid().optional(),
});

module.exports = { callScheduleCreate, callScheduleUpdate };
