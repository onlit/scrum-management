/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to modelName.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - modelNameCreate.
 * - modelNameUpdate.
 *
 *
 */

const Joi = require('joi');
const { visibilityCreate } = require('#core/schemas/visibility.schemas.js');
// IMPORTS

const modelNameBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  // BASE_KEY_VALUE_USES
});

const modelNameCreate = modelNameBase.keys(CREATE_KEY_VALUE_USES);

const modelNameUpdate = modelNameBase.keys(UPDATE_KEY_VALUE_USES);

// Bulk visibility update payload: visibility fields + ids array
const modelNameBulkVisibilityUpdate = visibilityCreate.keys({
  ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  modelNameCreate,
  modelNameUpdate,
  modelNameBulkVisibilityUpdate,
};
