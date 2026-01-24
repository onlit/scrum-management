/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports an Express Router instance that defines a route for exporting records of a specified model.
 * It imports middleware functions for authentication, authorization, error handling, and wrapping asynchronous operations,
 * as well as a controller function for handling the export operation.
 *
 * The router defines the following route:
 * - GET '/:modelName': Route for exporting records of the specified model. Requires authentication and protection middleware.
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

const { exportRecords } = require('#controllers/export.controller.js');

const router = Router();

router.get('/:modelName', auth, protect, wrapExpressAsync(exportRecords, 'export_records'));

module.exports = router;
