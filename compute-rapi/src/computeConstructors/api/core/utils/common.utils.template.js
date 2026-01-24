/**
 * Common Utilities
 *
 * General-purpose utility functions used across the domain layer.
 * This file is PROTECTED - never overwritten by the generator.
 *
 * @module shared/utils/common.utils
 */

/**
 * Deep clone an object (JSON-safe only).
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Pick specific keys from an object.
 * @param {Object} obj - Source object
 * @param {string[]} keys - Keys to pick
 * @returns {Object} New object with only specified keys
 */
function pick(obj, keys) {
  return keys.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
}

/**
 * Omit specific keys from an object.
 * @param {Object} obj - Source object
 * @param {string[]} keys - Keys to omit
 * @returns {Object} New object without specified keys
 */
function omit(obj, keys) {
  const keySet = new Set(keys);
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !keySet.has(key))
  );
}

/**
 * Check if a value is empty (null, undefined, empty string, empty array/object).
 * @param {*} value - Value to check
 * @returns {boolean}
 */
function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Safely get a nested property value.
 * @param {Object} obj - Source object
 * @param {string} path - Dot-notation path (e.g., 'user.profile.name')
 * @param {*} [defaultValue] - Default if path not found
 * @returns {*}
 */
function get(obj, path, defaultValue = undefined) {
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    if (result === null || result === undefined) {
      return defaultValue;
    }
    result = result[key];
  }
  return result === undefined ? defaultValue : result;
}

/**
 * Group array items by a key.
 * @param {Array} array - Array to group
 * @param {string|Function} keyOrFn - Key name or function returning key
 * @returns {Object} Grouped object
 */
function groupBy(array, keyOrFn) {
  const getKey = typeof keyOrFn === 'function' ? keyOrFn : (item) => item[keyOrFn];
  return array.reduce((groups, item) => {
    const key = getKey(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {});
}

/**
 * Remove duplicate items from an array.
 * @param {Array} array - Array to dedupe
 * @param {string|Function} [keyOrFn] - Optional key for object comparison
 * @returns {Array}
 */
function unique(array, keyOrFn) {
  if (!keyOrFn) {
    return [...new Set(array)];
  }
  const getKey = typeof keyOrFn === 'function' ? keyOrFn : (item) => item[keyOrFn];
  const seen = new Set();
  return array.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Chunk an array into smaller arrays.
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array[]}
 */
function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sleep for a specified duration.
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff.
 * @param {Function} fn - Async function to retry
 * @param {Object} [options]
 * @param {number} [options.maxRetries=3] - Maximum retry attempts
 * @param {number} [options.baseDelay=100] - Base delay in ms
 * @returns {Promise<*>}
 */
async function retry(fn, options = {}) {
  const { maxRetries = 3, baseDelay = 100 } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = baseDelay * (2 ** attempt);
      await sleep(delay);
    }
  }
}

module.exports = {
  deepClone,
  pick,
  omit,
  isEmpty,
  get,
  groupBy,
  unique,
  chunk,
  sleep,
  retry,
};
