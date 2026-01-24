/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module exports a factory function that creates an Express Router instance for handling
 * internal bulk detail retrieval routes. It supports dependency injection for the auth middleware,
 * enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - GET '/': Route for retrieving internal bulk details via query parameter. Requires authentication middleware.
 * - POST '/': Route for retrieving internal bulk details via request body. Requires authentication middleware.
 * - PUT/PATCH/DELETE '/': Explicitly handled to return method not allowed.
 *
 * The routes are wrapped with the wrapExpressAsync middleware to handle asynchronous operations
 * and properly catch and propagate errors to the error handling middleware.
 *
 *
 */

const { Router } = require('express');

const defaultAuth = require('#middlewares/auth.js');
const { wrapExpressAsync } = require('#utils/errorHandlingUtils.js');

const {
  getInternalBulkDetail,
  methodNotAllowed,
} = require('#core/controllers/getInternalBulkDetail.controller.js');

/**
 * Creates internal bulk detail routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createGetInternalBulkDetailRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  // Read collection via GET with ?payload={} (internal parity)
  router.get('/', auth, wrapExpressAsync(getInternalBulkDetail, 'internal_bulk_detail_get'));

  // Read collection via POST body
  router.post('/', auth, wrapExpressAsync(getInternalBulkDetail, 'internal_bulk_detail_post'));

  // Explicitly handle unsupported verbs to provide clear guidance
  router.put('/', auth, methodNotAllowed);
  router.patch('/', auth, methodNotAllowed);
  router.delete('/', auth, methodNotAllowed);

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createGetInternalBulkDetailRoutes;
module.exports.router = createGetInternalBulkDetailRoutes();
