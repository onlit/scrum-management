/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 10/11/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines an Express Router instance that handles routes related to field dependency rules.
 * It imports middleware functions for authentication, authorization, and wrapping asynchronous operations,
 * as well as controller functions for CRUD operations on field dependency rules.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new field dependency rule. Requires authentication and protection middleware.
 *   The request body should contain the necessary data for creating the dependency rule.
 *
 * - GET '/': Route for retrieving all field dependency rules. Requires authentication middleware.
 *
 * - GET '/:id': Route for retrieving a specific field dependency rule by ID. Requires authentication middleware.
 *
 * - PATCH '/:id': Route for updating a specific field dependency rule by ID. Requires authentication and protection middleware.
 *   The request body should contain the updated data for the dependency rule.
 *
 * - DELETE '/:id': Route for deleting a specific field dependency rule by ID. Requires authentication and protection middleware.
 *
 * Each route is wrapped with the wrapExpressAsync middleware to handle asynchronous operations and properly catch and propagate
 * errors to the error handling middleware.
 *
 *
 * REVISION 1:
 * REVISED BY: Claude Code
 * REVISION DATE: 10/11/2025
 * REVISION REASON: Verified compliance with ERROR_HANDLING_GUIDELINES.md and TRACE_ID_CONVENTIONS.md
 */

const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  getAllDependencyRules,
  createDependencyRule,
  getDependencyRule,
  updateDependencyRule,
  deleteDependencyRule,
} = require('#controllers/fieldDependencyRule.controller.js');

const router = Router();

router.post('/', auth, protect, wrapExpressAsync(createDependencyRule, 'field_dependency_rule_create'));

router.get('/', auth, wrapExpressAsync(getAllDependencyRules, 'field_dependency_rule_get_all'));

router.get('/:id', auth, wrapExpressAsync(getDependencyRule, 'field_dependency_rule_get_by_id'));

router.patch('/:id', auth, protect, wrapExpressAsync(updateDependencyRule, 'field_dependency_rule_update_patch'));

router.delete('/:id', auth, protect, wrapExpressAsync(deleteDependencyRule, 'field_dependency_rule_delete'));

module.exports = router;
