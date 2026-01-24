/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 * DESCRIPTION:
 * ------------------
 * Central registry for OPTIONS schema responses.
 * Maps normalized paths to schema configurations.
 *
 * Follows Single Responsibility Principle: only handles path normalization and storage.
 * Follows Law of Demeter: exposes minimal API surface.
 */

const UUID_REGEX = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const registry = new Map();

/**
 * Normalizes a path by replacing UUID segments with :id placeholder
 * and removing trailing slashes.
 * @param {string} path - The URL path to normalize
 * @returns {string} Normalized path
 */
function normalizePath(path) {
  return path
    .replace(UUID_REGEX, '/:id')
    .replace(/\/+$/, '') || '/';
}

/**
 * Registers a schema configuration for a path.
 * @param {string} path - The route path (will be normalized)
 * @param {Object} config - Schema configuration object
 */
function register(path, config) {
  registry.set(normalizePath(path), config);
}

/**
 * Retrieves a schema configuration for a path.
 * @param {string} path - The route path (will be normalized for lookup)
 * @returns {Object|undefined} Schema configuration or undefined
 */
function get(path) {
  return registry.get(normalizePath(path));
}

/**
 * Clears all registered schemas. For testing only.
 */
function clear() {
  registry.clear();
}

/**
 * Returns all registered path-config pairs.
 * @returns {Array<[string, Object]>} Array of [path, config] entries
 */
function getAll() {
  return Array.from(registry.entries());
}

module.exports = {
  register,
  get,
  getAll,
  normalizePath,
  clear,
};
