/**
 * Domain Middleware Loader
 *
 * Loads and organizes domain-specific middleware.
 * These middlewares are preserved across regeneration.
 *
 * This file is PROTECTED - never overwritten by the generator.
 *
 * @module domain/middlewares/middleware-loader
 */

const fs = require('fs');
const path = require('path');

/**
 * Loaded middleware cache.
 */
const loadedMiddleware = new Map();

/**
 * Load all domain middleware from directory.
 *
 * @param {string} middlewareDir - Path to domain middlewares directory
 * @returns {Map<string, Function>} Map of middleware name to middleware function
 */
function loadDomainMiddleware(middlewareDir) {
  if (!fs.existsSync(middlewareDir)) {
    console.log('[DomainMiddleware] No domain middlewares directory found');
    return loadedMiddleware;
  }

  const files = fs.readdirSync(middlewareDir);
  const middlewareFiles = files.filter(
    (f) => f.endsWith('.middleware.js') || f.endsWith('.js')
  );

  for (const file of middlewareFiles) {
    // Skip loader and README
    if (file === 'middleware-loader.js' || file === 'README.md') {
      continue;
    }

    try {
      const middlewarePath = path.join(middlewareDir, file);
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const middlewareModule = require(middlewarePath);
      const middleware = middlewareModule.default || middlewareModule;

      if (typeof middleware === 'function') {
        const name = file.replace('.middleware.js', '').replace('.js', '');
        loadedMiddleware.set(name, middleware);
        console.log(`[DomainMiddleware] Loaded: ${name}`);
      } else {
        console.warn(`[DomainMiddleware] Invalid middleware module: ${file}`);
      }
    } catch (error) {
      console.error(`[DomainMiddleware] Failed to load ${file}:`, error.message);
    }
  }

  return loadedMiddleware;
}

/**
 * Get a loaded middleware by name.
 *
 * @param {string} name - Middleware name
 * @returns {Function|undefined}
 */
function getMiddleware(name) {
  return loadedMiddleware.get(name);
}

/**
 * Get all loaded middleware.
 *
 * @returns {Map<string, Function>}
 */
function getAllMiddleware() {
  return new Map(loadedMiddleware);
}

/**
 * Initialize domain middleware.
 * Call this during app startup.
 *
 * @returns {Map<string, Function>}
 */
function initializeDomainMiddleware() {
  return loadDomainMiddleware(path.join(__dirname));
}

module.exports = {
  loadDomainMiddleware,
  getMiddleware,
  getAllMiddleware,
  initializeDomainMiddleware,
};
