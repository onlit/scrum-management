/**
 * Interceptor Interface Definition
 *
 * This file defines the contract for lifecycle interceptors.
 * Generated controllers call these hooks at specific points in the request lifecycle.
 *
 * @module shared/interfaces/interceptor.interface
 */

/**
 * All available lifecycle hooks in execution order.
 */
const LIFECYCLE_HOOKS = [
  'beforeValidate', // Before Joi validation - transform/normalize input
  'extendSchema', // Extend Joi schema with custom rules
  'afterValidate', // After Joi passes - cross-field validation
  'beforeCreate', // Before DB insert - compute fields
  'afterCreate', // After DB insert - notifications, audit
  'beforeUpdate', // Before DB update - protect immutable fields
  'afterUpdate', // After DB update - change notifications
  'beforeDelete', // Before soft delete - referential checks
  'afterDelete', // After soft delete - cleanup
  'beforeList', // Before list query - add filters
  'afterList', // After list retrieval - transform response
  'beforeRead', // Before single read - access control
  'afterRead', // After single read - redact fields
  'onError', // On any error - transform/recover
];

/**
 * @typedef {Object} InterceptorContext
 * @property {Object} req - Express request object
 * @property {Object} user - Authenticated user context
 * @property {string} model - Target model name (PascalCase)
 * @property {string} operation - Current operation (create|read|update|delete|list)
 * @property {Object} [metadata] - Additional operation metadata
 * @property {import('./query-builder.interface.template.js').QueryBuilder} [queryBuilder] - Query builder for list/read operations
 * @property {Object} [transaction] - Prisma transaction client when in transaction
 * @property {string} [recordId] - Record ID for update/delete/read operations
 * @property {Object} [existingRecord] - Existing record for update operations
 */

/**
 * @typedef {Object} InterceptorResult
 * @property {Object} data - Transformed data to continue with
 * @property {boolean} [halt] - If true, stop processing and return response
 * @property {Object} [response] - Response to return if halt=true
 * @property {number} [response.status] - HTTP status code
 * @property {Object} [response.body] - Response body
 */

/**
 * @typedef {Object} ListInterceptorResult
 * @property {import('./query-builder.interface.template.js').QueryBuilder|Object} data - Modified query builder or query object
 * @property {boolean} [halt] - If true, stop processing and return response
 * @property {Object} [response] - Response to return if halt=true
 */

/**
 * Create a no-op interceptor that passes data through unchanged.
 * Used as default when no custom interceptor is defined.
 *
 * @returns {Object} Interceptor with all hooks as passthrough
 */
function createNoOpInterceptor() {
  const passthrough = async (data) => ({ data });

  return LIFECYCLE_HOOKS.reduce((acc, hook) => {
    if (hook === 'extendSchema') {
      acc[hook] = (schema) => schema; // Schema extension is synchronous
    } else {
      acc[hook] = passthrough;
    }
    return acc;
  }, {});
}

/**
 * Validate that an interceptor object has valid hook functions.
 *
 * @param {Object} interceptor - Interceptor to validate
 * @returns {boolean} True if valid
 */
function validateInterceptor(interceptor) {
  if (!interceptor || typeof interceptor !== 'object') {
    return false;
  }

  for (const key of Object.keys(interceptor)) {
    if (
      LIFECYCLE_HOOKS.includes(key) &&
      typeof interceptor[key] !== 'function'
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Merge a partial interceptor with the no-op defaults.
 *
 * @param {Object} partial - Partial interceptor with some hooks
 * @returns {Object} Complete interceptor with all hooks
 */
function mergeWithDefaults(partial) {
  const defaults = createNoOpInterceptor();
  return { ...defaults, ...partial };
}

module.exports = {
  LIFECYCLE_HOOKS,
  createNoOpInterceptor,
  validateInterceptor,
  mergeWithDefaults,
};
