/**
 * CREATED BY: AI Assistant
 * CREATION DATE: 26/08/2025
 *
 * DESCRIPTION:
 * ------------------
 * Joi schemas for validating requests to reset rotting days on opportunities
 * by updating `statusAssignedDate` for all opportunities in a given stage.
 */

const Joi = require('joi');
const validator = require('validator');

const resetBase = Joi.object({
  stageId: Joi.string().uuid().required(),
  statusAssignedDate: Joi.alternatives()
    .try(
      Joi.string().custom((value, helpers) => {
        if (!validator.isISO8601(value, { strict: false })) {
          return helpers.message('statusAssignedDate must be an ISO8601 datetime string');
        }
        return value;
      }),
      Joi.date()
    )
    .optional(),
});

const resetCreate = resetBase; // POST
const resetUpdate = resetBase; // PUT/PATCH

const resetPreview = Joi.object({
  stageId: Joi.string().uuid().required(),
});

const resetDelete = Joi.object({
  stageId: Joi.string().uuid().required(),
});

module.exports = {
  resetCreate,
  resetUpdate,
  resetPreview,
  resetDelete,
};


