/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines an Express Router instance that handles routes related to instance logs.
 * It imports middleware functions for authentication, authorization, and wrapping asynchronous operations,
 * as well as controller functions for CRUD operations on instance logs.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new instance log. Requires authentication and protection middleware.
 *   The request body should contain the necessary data for creating the instance log.
 *
 * - GET '/': Route for retrieving all instance logs. Requires authentication middleware.
 *
 * - GET '/:id': Route for retrieving a specific instance log by ID. Requires authentication middleware.
 *
 * - PUT '/:id': Route for updating a specific instance log by ID. Requires authentication and protection middleware.
 *   The request body should contain the updated data for the instance log.
 *
 * - PATCH '/:id': Alternative route for updating a specific instance log by ID. Requires authentication and protection middleware.
 *   This route allows for partial updates, where only specific fields are modified.
 *
 * - DELETE '/:id': Route for deleting a specific instance log by ID. Requires authentication and protection middleware.
 *
 * Each route is wrapped with the wrapAsync middleware to handle asynchronous operations and properly catch and propagate
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
 * REVISION DATE: 2024-06-11
 * REVISION REASON: Verified compliance with ERROR_HANDLING_GUIDELINES.md and TRACE_ID_CONVENTIONS.md
 */

const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  createInstanceLog,
  getAllInstanceLogs,
  getInstanceLog,
  updateInstanceLog,
  deleteInstanceLog,
} = require('#controllers/instanceLog.controller.js');

const router = Router();

router.post('/', auth, protect, wrapExpressAsync(createInstanceLog, 'instance_log_create'));

router.get('/', auth, wrapExpressAsync(getAllInstanceLogs, 'instance_log_get_all'));

router.get('/:id', auth, wrapExpressAsync(getInstanceLog, 'instance_log_get_by_id'));

router.put('/:id', auth, protect, wrapExpressAsync(updateInstanceLog, 'instance_log_update_put'));

router.patch('/:id', auth, protect, wrapExpressAsync(updateInstanceLog, 'instance_log_update_patch'));

router.delete('/:id', auth, protect, wrapExpressAsync(deleteInstanceLog, 'instance_log_delete'));

module.exports = router;
