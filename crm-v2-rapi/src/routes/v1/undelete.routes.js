/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module exports an Express Router instance that handles routes related to un-deleting records.
 * It imports middleware functions for authentication, authorization, and wrapping asynchronous operations,
 * as well as the controller function for un-deleting records in batch.
 *
 * The router defines the following route:
 * - POST '/batch/:model': Route for un-deleting records in batch for a specific model.
 *   Requires authentication and protection middleware. The request body should contain
 *   the IDs of the records to be undeleted, and the model parameter specifies the model
 *   for which the undelete operation is performed.
 *
 * The route is wrapped with the wrapExpressAsync middleware to handle asynchronous operations and properly catch and propagate
 * errors to the error handling middleware.
 *
 *
 */

const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const { undeleteBatch } = require('#controllers/undelete.controller.js');

const router = Router();

router.post('/batch/:model', auth, protect, wrapExpressAsync(undeleteBatch, 'undelete_batch'));

module.exports = router;
