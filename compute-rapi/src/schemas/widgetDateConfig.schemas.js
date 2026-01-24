/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 2024-12-24
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi validation schemas for widget date configurations.
 * Widget date configs provide per-widget date field override settings.
 */

const Joi = require('joi');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');
const { DATE_RANGE_PRESETS } = require('#configs/constants.js');

const widgetDateConfigCreate = visibilityCreate.keys({
  widgetId: Joi.string().uuid().required(),
  dateFieldId: Joi.string().uuid().required(),
  defaultRange: Joi.string()
    .valid(...DATE_RANGE_PRESETS)
    .default('Last30Days'),
  ignoreGlobalFilter: Joi.boolean().default(false),
});

const widgetDateConfigUpdate = visibilityCreate.keys({
  widgetId: Joi.string().uuid().optional(),
  dateFieldId: Joi.string().uuid().optional(),
  defaultRange: Joi.string()
    .valid(...DATE_RANGE_PRESETS)
    .optional(),
  ignoreGlobalFilter: Joi.boolean().optional(),
});

module.exports = {
  widgetDateConfigCreate,
  widgetDateConfigUpdate,
};
