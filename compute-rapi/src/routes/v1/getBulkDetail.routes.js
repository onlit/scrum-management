/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports an Express Router instance that defines a route for retrieving bulk details.
 * It imports middleware functions for authentication and error handling, as well as a controller function
 * for handling bulk detail operations.
 *
 * The router defines the following route:
 * - POST '/': Route for retrieving bulk details. It requires authentication middleware.
 *
 * The route is wrapped with the wrapExpressAsync middleware to handle asynchronous operations and
 * properly catch and propagate errors to the error handling middleware.
 *
 *
 * REVISION 1:
 * REVISED BY: AI Assistant
 * REVISION DATE: 2025-01-27
 * REVISION REASON: Add Standard File Header Comments and update to comply with ERROR_HANDLING_GUIDELINES.md and TRACE_ID_CONVENTIONS.md
 */

const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const { getBulkDetail } = require('#controllers/getBulkDetail.controller.js');

const router = Router();

router.post('/', auth, wrapExpressAsync(getBulkDetail, 'bulk_detail_get'));

module.exports = router;
