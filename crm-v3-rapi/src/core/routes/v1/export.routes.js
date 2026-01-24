/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module exports a factory function that creates an Express Router instance for exporting
 * records of a specified model. It supports dependency injection for the auth middleware,
 * enabling testing with mock authentication.
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

const defaultAuth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/errorHandlingUtils.js');

const { exportRecords } = require('#core/controllers/export.controller.js');

/**
 * Creates export routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createExportRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.get('/:modelName', auth, protect, wrapExpressAsync(exportRecords, 'export_records'));

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createExportRoutes;
module.exports.router = createExportRoutes();
