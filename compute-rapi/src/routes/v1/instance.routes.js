/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines an Express Router instance that handles routes related to instances.
 * It imports middleware functions for authentication, authorization, and wrapping asynchronous operations,
 * as well as controller functions for CRUD operations on instances.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new instance. Requires authentication and protection middleware.
 *   The request body should contain the necessary data for creating the instance.
 *
 * - GET '/': Route for retrieving all instances. Requires authentication middleware.
 *
 * - GET '/:id': Route for retrieving a specific instance by ID. Requires authentication middleware.
 *
 * - PUT '/:id': Route for updating a specific instance by ID. Requires authentication and protection middleware.
 *   The request body should contain the updated data for the instance.
 *
 * - PATCH '/:id': Alternative route for updating a specific instance by ID. Requires authentication and protection middleware.
 *   This route allows for partial updates, where only specific fields are modified.
 *
 * - DELETE '/:id': Route for deleting a specific instance by ID. Requires authentication and protection middleware.
 *
 * Each route is wrapped with the wrapExpressAsync middleware to handle asynchronous operations and properly catch and propagate
 * errors to the error handling middleware.
 *
 *
 * REVISION 1:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 20/02/2024
 * REVISION REASON: Add Standard File Header Comments
 *
 * REVISION 2:
 * REVISED BY: AI Assistant
 * REVISION DATE: 2025-01-27
 * REVISION REASON: Update to comply with ERROR_HANDLING_GUIDELINES.md and TRACE_ID_CONVENTIONS.md
 */

const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  createInstance,
  getAllInstances,
  getInstance,
  updateInstance,
  deleteInstance,
} = require('#controllers/instance.controller.js');

const router = Router();

router.post('/', auth, protect, wrapExpressAsync(createInstance, 'instance_create'));

router.get('/', auth, wrapExpressAsync(getAllInstances, 'instance_get_all'));

router.get('/:id', auth, wrapExpressAsync(getInstance, 'instance_get_by_id'));

router.put('/:id', auth, protect, wrapExpressAsync(updateInstance, 'instance_update_put'));

router.patch('/:id', auth, protect, wrapExpressAsync(updateInstance, 'instance_update_patch'));

router.delete('/:id', auth, protect, wrapExpressAsync(deleteInstance, 'instance_delete'));

module.exports = router;
