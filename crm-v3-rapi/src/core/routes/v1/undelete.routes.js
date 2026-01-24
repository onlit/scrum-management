/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module exports a factory function that creates an Express Router instance for handling
 * routes related to un-deleting records. It supports dependency injection for the auth middleware,
 * enabling testing with mock authentication.
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

const defaultAuth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/errorHandlingUtils.js');

const { undeleteBatch } = require('#core/controllers/undelete.controller.js');

/**
 * Creates undelete routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createUndeleteRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post('/batch/:model', auth, protect, wrapExpressAsync(undeleteBatch, 'undelete_batch'));

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createUndeleteRoutes;
module.exports.router = createUndeleteRoutes();
