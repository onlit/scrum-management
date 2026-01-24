/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 07/31/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports an Express Router instance that defines a route for generating ERD (Entity Relationship Diagram)
 * for a microservice. It imports middleware functions for authentication, authorization, and error handling, as well as
 * a controller function for handling ERD generation operations.
 *
 * The router defines the following route:
 * - POST '/:id': Route for generating ERD for a specific microservice by ID. Requires authentication and protection middleware.
 *
 * The route is wrapped with the wrapExpressAsync middleware to handle asynchronous operations and properly catch and propagate
 * errors to the error handling middleware.
 *
 *
 * REVISION 1:
 * REVISED BY: AI Assistant
 * REVISION DATE: 2025-01-27
 * REVISION REASON: Add Standard File Header Comments and update to comply with ERROR_HANDLING_GUIDELINES.md and TRACE_ID_CONVENTIONS.md
 */

const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  generateERD,
} = require('#controllers/generateMicroserviceErd.controller.js');

const router = Router();

router.post('/:id', auth, protect, wrapExpressAsync(generateERD, 'microservice_erd_generate'));

module.exports = router;
