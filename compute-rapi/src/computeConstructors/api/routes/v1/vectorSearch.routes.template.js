/**
 * CREATED BY: @gen{CREATOR_NAME}
 * CREATOR EMAIL: @gen{CREATOR_EMAIL}
 * CREATION DATE: @gen{NOW}
 *
 *
 * DESCRIPTION:
 * ------------------
 * Vector search routes for @gen{MODEL_NAME|Pascal}.
 * Provides semantic/similarity search using pgvector embeddings.
 *
 * Routes:
 * - POST '/vector-search': Execute vector similarity search
 *
 * This file is only generated for models that have vector fields.
 */

const { Router } = require('express');

const defaultAuth = require('#middlewares/auth.js');
const { wrapExpressAsync } = require('#utils/errorHandlingUtils.js');

const {
  vectorSearch@gen{MODEL_NAME|Pascal},
} = require('#core/controllers/vectorSearch.controller.core.js');

// @gen:start:VECTOR_SEARCH_ROUTE
// This block is conditionally included when model has vector fields
// @gen:end:VECTOR_SEARCH_ROUTE

/**
 * Creates vector search routes for @gen{MODEL_NAME|Pascal}.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function create@gen{MODEL_NAME|Pascal}VectorSearchRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  // Vector similarity search endpoint
  // POST /api/@gen{MODEL_NAME|kebab}/vector-search
  router.post(
    '/vector-search',
    auth,
    wrapExpressAsync(
      vectorSearch@gen{MODEL_NAME|Pascal},
      '@gen{MODEL_NAME|snake}_vector_search'
    )
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = create@gen{MODEL_NAME|Pascal}VectorSearchRoutes;
module.exports.router = create@gen{MODEL_NAME|Pascal}VectorSearchRoutes();
