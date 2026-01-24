/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines a Joi schema for validating visibility-related data.
 * It imports Joi for schema validation.
 *
 * The schema, visibilityCreate, defines the following properties:
 * - everyone_can_see_it: A boolean indicating whether everyone can see it.
 * - anonymous_can_see_it: A boolean indicating whether anonymous users can see it.
 * - everyone_in_object_company_can_see_it: A boolean indicating whether everyone in the object company can see it.
 * - only_these_roles_can_see_it: An object representing roles that can see it.
 * - only_these_users_can_see_it: An object representing specific users who can see it.
 * - client: A UUID string representing the client.
 * - created_by: A UUID string representing the user who created it.
 * - updated_by: A UUID string representing the user who updated it.
 *
 * All properties are optional for flexibility in validation.
 *
 *
 */

const Joi = require('joi');

const roleOrUserValidation = Joi.string().pattern(
  new RegExp(
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\|.+'
  )
);

const visibilityCreate = Joi.object({
  color: Joi.string().max(40).allow('', null).optional(),
  tags: Joi.string().allow('', null).optional(),
  workflowId: Joi.string().uuid().allow('', null).optional(),
  everyone_can_see_it: Joi.boolean().falsy(''),
  anonymous_can_see_it: Joi.boolean().falsy(''),
  everyone_in_object_company_can_see_it: Joi.boolean(),
  only_these_roles_can_see_it: Joi.array().items(roleOrUserValidation),
  only_these_users_can_see_it: Joi.array().items(roleOrUserValidation),
}).optional();

module.exports = { visibilityCreate };
