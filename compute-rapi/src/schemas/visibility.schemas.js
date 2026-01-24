/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
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
 * REVISION 1:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 20/02/2024
 * REVISION REASON: Add Standard File Header Comments
 *
 *
 * REVISION 2:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 28/02/2024
 * REVISION REASON: Update JSON format for only_these_roles_can_see_it and only_these_users_can_see_it
 */

const Joi = require('joi');

const roleOrUserValidation = Joi.string().pattern(
  new RegExp(
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\|.+'
  )
);

const visibilityCreate = Joi.object({
  everyone_can_see_it: Joi.boolean().falsy(''),
  anonymous_can_see_it: Joi.boolean().falsy(''),
  everyone_in_object_company_can_see_it: Joi.boolean(),
  only_these_roles_can_see_it: Joi.array().items(roleOrUserValidation),
  only_these_users_can_see_it: Joi.array().items(roleOrUserValidation),
}).optional();

module.exports = { visibilityCreate };
