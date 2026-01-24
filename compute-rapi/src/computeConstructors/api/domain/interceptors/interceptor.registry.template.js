/**
 * Interceptor Registry
 *
 * Manages lifecycle interceptors for all models.
 * Provides registration, resolution, and hook composition.
 * Supports auto-discovery of interceptor files.
 *
 * @module domain/interceptors/interceptor.registry
 */

const fs = require('fs');
const path = require('path');

const {
  createNoOpInterceptor,
  validateInterceptor,
  LIFECYCLE_HOOKS,
} = require('#core/interfaces/interceptor.interface.js');

/**
 * Registry for model-specific and global interceptors.
 */
class InterceptorRegistry {
  constructor() {
    /** @type {Map<string, Object>} Model-specific interceptors */
    this.interceptors = new Map();

    /** @type {Object[]} Global interceptors applied to all models */
    this.globalInterceptors = [];

    /** @type {Map<string, Object>} Cached resolved interceptors */
    this.resolveCache = new Map();
  }

  /**
   * Register an interceptor for a specific model.
   *
   * @param {string} modelName - Model name (PascalCase)
   * @param {Object} interceptor - Interceptor with lifecycle hooks
   * @throws {Error} If interceptor is invalid
   */
  register(modelName, interceptor) {
    if (!validateInterceptor(interceptor)) {
      throw new Error(`Invalid interceptor for model: ${modelName}`);
    }

    this.interceptors.set(modelName, interceptor);
    this.resolveCache.delete(modelName); // Invalidate cache
  }

  /**
   * Register a global interceptor applied to all models.
   * Global interceptors run before model-specific ones.
   *
   * @param {Object} interceptor - Global interceptor
   * @param {number} [priority=0] - Execution priority (higher = earlier)
   */
  registerGlobal(interceptor, priority = 0) {
    if (!validateInterceptor(interceptor)) {
      throw new Error('Invalid global interceptor');
    }

    this.globalInterceptors.push({ interceptor, priority });
    this.globalInterceptors.sort((a, b) => b.priority - a.priority);
    this.resolveCache.clear(); // Invalidate all caches
  }

  /**
   * Resolve the complete interceptor chain for a model.
   * Returns a lazy proxy that always looks up the current interceptor.
   * This allows interceptors to be registered after controllers are loaded.
   *
   * @param {string} modelName - Model name to resolve
   * @returns {Object} Lazy interceptor proxy with all hooks
   */
  resolve(modelName) {
    // Check cache first
    if (this.resolveCache.has(modelName)) {
      return this.resolveCache.get(modelName);
    }

    // Return a lazy proxy that always delegates to the current interceptor
    // This ensures late-registered interceptors are picked up
    const registry = this;
    const defaults = createNoOpInterceptor();

    const lazyProxy = {};

    for (const hook of LIFECYCLE_HOOKS) {
      lazyProxy[hook] = async function (...args) {
        // Look up current interceptor at execution time, not resolution time
        const modelInterceptor = registry.interceptors.get(modelName) || {};
        const composed = registry._composeHookFn(
          hook,
          modelInterceptor,
          defaults,
          registry.globalInterceptors
        );
        return composed(...args);
      };
    }

    // Special case for synchronous extendSchema - compose global + model
    lazyProxy.extendSchema = function (schema) {
      let result = schema;

      // Apply global interceptors' extendSchema first
      for (const { interceptor } of registry.globalInterceptors) {
        if (typeof interceptor.extendSchema === 'function') {
          result = interceptor.extendSchema(result);
        }
      }

      // Then apply model-specific extendSchema
      const modelInterceptor = registry.interceptors.get(modelName) || {};
      if (typeof modelInterceptor.extendSchema === 'function') {
        result = modelInterceptor.extendSchema(result);
      }

      return result;
    };

    // Cache the lazy proxy
    this.resolveCache.set(modelName, lazyProxy);

    return lazyProxy;
  }

  /**
   * Compose a hook function from global, model, and default interceptors.
   * Used by the lazy proxy to create the actual hook at execution time.
   * @private
   */
  _composeHookFn(hook, modelInterceptor, defaults, globalInterceptors) {
    const globalHooks = globalInterceptors
      .filter((g) => typeof g.interceptor[hook] === 'function')
      .map((g) => g.interceptor[hook]);

    const modelHook = modelInterceptor[hook];
    const defaultHook = defaults[hook];

    // Return composed async function
    return async function composedHook(...args) {
      let result = { data: args[0] };

      // Run global hooks first
      for (const globalHook of globalHooks) {
        result = await globalHook(result.data, ...args.slice(1));
        if (result?.halt) return result;
        args[0] = result.data;
      }

      // Run model hook
      if (typeof modelHook === 'function') {
        result = await modelHook(result.data, ...args.slice(1));
        if (result?.halt) return result;
      } else if (typeof defaultHook === 'function') {
        result = await defaultHook(result.data, ...args.slice(1));
      }

      return result;
    };
  }

  /**
   * Compose a single hook from global, model, and default interceptors.
   * @private
   */
  _composeHook(hook, modelInterceptor, defaults) {
    const globalHooks = this.globalInterceptors
      .filter((g) => typeof g.interceptor[hook] === 'function')
      .map((g) => g.interceptor[hook]);

    const modelHook = modelInterceptor[hook];
    const defaultHook = defaults[hook];

    if (hook === 'extendSchema') {
      // Schema extension is synchronous and composable
      return (schema, context) => {
        let result = schema;
        for (const fn of globalHooks) {
          result = fn(result, context);
        }
        if (typeof modelHook === 'function') {
          result = modelHook(result, context);
        }
        return result;
      };
    }

    // Async hooks with potential halt
    return async (...args) => {
      // Run global hooks first
      let data = args[0];
      const restArgs = args.slice(1);

      for (const fn of globalHooks) {
        const result = await fn(data, ...restArgs);
        if (result.halt) {
          return result;
        }
        data = result.data;
      }

      // Run model-specific hook
      if (typeof modelHook === 'function') {
        const result = await modelHook(data, ...restArgs);
        if (result.halt) {
          return result;
        }
        data = result.data;
      } else {
        // Use default passthrough
        const result = await defaultHook(data, ...restArgs);
        data = result.data;
      }

      return { data };
    };
  }

  /**
   * Get list of all registered model names.
   * @returns {string[]}
   */
  getRegisteredModels() {
    return Array.from(this.interceptors.keys());
  }

  /**
   * Check if a model has a registered interceptor.
   * @param {string} modelName
   * @returns {boolean}
   */
  hasInterceptor(modelName) {
    return this.interceptors.has(modelName);
  }

  /**
   * Clear all registrations (useful for testing).
   */
  clear() {
    this.interceptors.clear();
    this.globalInterceptors = [];
    this.resolveCache.clear();
  }
}

// Singleton instance for the application
let registryInstance = null;

/**
 * Get the singleton registry instance.
 * @returns {InterceptorRegistry}
 */
function getRegistry() {
  if (!registryInstance) {
    registryInstance = new InterceptorRegistry();
  }
  return registryInstance;
}

/**
 * Reset the singleton registry (for testing).
 */
function resetRegistry() {
  if (registryInstance) {
    registryInstance.clear();
  }
  registryInstance = null;
}

/**
 * Auto-discover interceptor files in a directory.
 * Looks for files matching *.interceptor.js pattern.
 *
 * @param {string} interceptorsDir - Path to interceptors directory
 * @returns {Promise<Map<string, Object>>} Map of modelName -> interceptor
 */
async function discoverInterceptors(interceptorsDir) {
  const discovered = new Map();

  if (!fs.existsSync(interceptorsDir)) {
    return discovered;
  }

  const files = fs.readdirSync(interceptorsDir);
  const interceptorFiles = files.filter((f) => f.endsWith('.interceptor.js'));

  for (const file of interceptorFiles) {
    // Convert filename to PascalCase model name
    // e.g., 'employee.interceptor.js' -> 'Employee'
    // e.g., 'sales-order.interceptor.js' -> 'SalesOrder'
    const baseName = file.replace('.interceptor.js', '');
    const modelName = baseName
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');

    try {
      const interceptorPath = path.join(interceptorsDir, file);
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const interceptor = require(interceptorPath);

      // Handle both default exports and named exports
      const interceptorObj = interceptor.default || interceptor;

      if (validateInterceptor(interceptorObj)) {
        discovered.set(modelName, interceptorObj);
        console.log(`[Interceptor] Discovered: ${modelName}`);
      } else {
        console.warn(`[Interceptor] Invalid interceptor in ${file}`);
      }
    } catch (error) {
      console.error(`[Interceptor] Failed to load ${file}:`, error.message);
    }
  }

  return discovered;
}

/**
 * Initialize registry with auto-discovered interceptors.
 * Called during application startup.
 *
 * @param {string} [interceptorsPath] - Path to interceptors directory
 * @returns {Promise<InterceptorRegistry>}
 */
async function initializeRegistry(interceptorsPath) {
  const registry = getRegistry();

  // Default path if not provided
  const dir = interceptorsPath || path.join(process.cwd(), 'src', 'domain', 'interceptors');

  // Auto-discover interceptors
  const discovered = await discoverInterceptors(dir);

  // Register discovered interceptors
  for (const [modelName, interceptor] of discovered) {
    registry.register(modelName, interceptor);
  }

  if (discovered.size > 0) {
    console.log(`[Interceptor] Registry initialized with ${discovered.size} interceptors`);
  }

  return registry;
}

module.exports = {
  InterceptorRegistry,
  getRegistry,
  resetRegistry,
  initializeRegistry,
  discoverInterceptors,
};
