/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module exports a factory function that creates an Express Router instance for handling
 * bulk detail retrieval routes. It supports dependency injection for the auth middleware,
 * enabling testing with mock authentication.
 *
 * The router defines the following route:
 * - POST '/': Route for retrieving bulk details. Requires authentication middleware.
 *
 * The route is wrapped with the wrapExpressAsync middleware to handle asynchronous operations
 * and properly catch and propagate errors to the error handling middleware.
 *
 *
 */

const { Router } = require('express');

const defaultAuth = require('#middlewares/auth.js');
const { wrapExpressAsync } = require('#utils/errorHandlingUtils.js');

const { getBulkDetail } = require('#core/controllers/getBulkDetail.controller.js');

/**
 * Creates bulk detail routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createGetBulkDetailRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post('/', auth, wrapExpressAsync(getBulkDetail, 'bulk_detail_get'));

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createGetBulkDetailRoutes;
module.exports.router = createGetBulkDetailRoutes();
