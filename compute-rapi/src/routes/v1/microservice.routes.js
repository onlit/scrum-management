/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines an Express Router instance that handles routes related to microservices.
 * It imports middleware functions for authentication, authorization, and wrapping asynchronous operations,
 * as well as controller functions for CRUD operations on microservices.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new microservice. Requires authentication and protection middleware.
 *   The request body should contain the necessary data for creating the microservice.
 *
 * - GET '/': Route for retrieving all microservices. Requires authentication middleware.
 *
 * - GET '/:id': Route for retrieving a specific microservice by ID. Requires authentication middleware.
 *
 * - PUT '/:id': Route for updating a specific microservice by ID. Requires authentication and protection middleware.
 *   The request body should contain the updated data for the microservice.
 *
 * - PATCH '/:id': Alternative route for updating a specific microservice by ID. Requires authentication and protection middleware.
 *   This route allows for partial updates, where only specific fields are modified.
 *
 * - DELETE '/:id': Route for deleting a specific microservice by ID. Requires authentication and protection middleware.
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
 *
 * REVISION 2:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 21/02/2024
 * REVISION REASON: Convert ESM to CJS
 *
 * REVISION 3:
 * REVISED BY: AI Assistant
 * REVISION DATE: 2024-06-11
 * REVISION REASON: Verified compliance with ERROR_HANDLING_GUIDELINES.md and TRACE_ID_CONVENTIONS.md
 */

const { Router } = require('express');
const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const protectOrInternal = require('#middlewares/protectOrInternal.js');
// MIGRATED: Using wrapExpressAsync instead of legacy wrapAsync
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');
const {
  createMicroservice,
  getAllMicroservices,
  getMicroservice,
  updateMicroservice,
  deleteMicroservice,
} = require('#controllers/microservice.controller.js');

const router = Router();

router.post('/', auth, protectOrInternal, wrapExpressAsync(createMicroservice, 'microservice_create'));

router.get('/', auth, wrapExpressAsync(getAllMicroservices, 'microservice_list'));

router.get('/:id', auth, wrapExpressAsync(getMicroservice, 'microservice_get'));

router.put('/:id', auth, protect, wrapExpressAsync(updateMicroservice, 'microservice_update'));

router.patch('/:id', auth, protect, wrapExpressAsync(updateMicroservice, 'microservice_patch'));

router.delete('/:id', auth, protect, wrapExpressAsync(deleteMicroservice, 'microservice_delete'));

module.exports = router;
