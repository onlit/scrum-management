/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * LRU (Least Recently Used) Cache Implementation
 *
 * Memory-efficient cache with automatic cleanup and size limits using O(1) operations
 */

/* eslint-disable max-classes-per-file */
class Node {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.timestamp = Date.now();
    this.prev = null;
    this.next = null;
  }
}

class LRUCache {
  constructor(maxSize = 1000, maxAge = 15 * 60 * 1000) {
    this.maxSize = maxSize;
    this.maxAge = maxAge;
    this.cache = new Map(); // key -> node mapping for O(1) access

    // Create dummy head and tail nodes for doubly-linked list
    this.head = new Node(null, null);
    this.tail = new Node(null, null);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  /**
   * Add node to the head of the list (most recently used)
   * @param {Node} node - Node to add
   */
  _addToHead(node) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next.prev = node;
    this.head.next = node;
  }

  /**
   * Remove node from the list
   * @param {Node} node - Node to remove
   */
  _removeNode(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  /**
   * Move node to head (mark as most recently used)
   * @param {Node} node - Node to move
   */
  _moveToHead(node) {
    this._removeNode(node);
    this._addToHead(node);
  }

  /**
   * Remove tail node (least recently used)
   * @returns {Node} - Removed node
   */
  _removeTail() {
    const last = this.tail.prev;
    this._removeNode(last);
    return last;
  }

  /**
   * Gets a value from the cache
   * @param {string} key - Cache key
   * @returns {any} - Cached value or undefined
   */
  get(key) {
    const node = this.cache.get(key);

    if (!node) {
      return undefined;
    }

    const now = Date.now();

    // Check if item has expired
    if (now - node.timestamp > this.maxAge) {
      this.delete(key);
      return undefined;
    }

    // Move to head (mark as most recently used) - O(1) operation
    this._moveToHead(node);

    return node.value;
  }

  /**
   * Sets a value in the cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   */
  set(key, value) {
    const existingNode = this.cache.get(key);
    const now = Date.now();

    if (existingNode) {
      // Update existing node
      existingNode.value = value;
      existingNode.timestamp = now;
      this._moveToHead(existingNode);
      return;
    }

    // Create new node
    const newNode = new Node(key, value);
    newNode.timestamp = now;

    // If at capacity, remove least recently used item - O(1) operation
    if (this.cache.size >= this.maxSize) {
      const tail = this._removeTail();
      this.cache.delete(tail.key);
    }

    // Add new node to head and cache - O(1) operations
    this._addToHead(newNode);
    this.cache.set(key, newNode);
  }

  /**
   * Deletes a key from the cache
   * @param {string} key - Cache key to delete
   * @returns {boolean} - True if key existed and was deleted
   */
  delete(key) {
    const node = this.cache.get(key);

    if (!node) {
      return false;
    }

    this._removeNode(node);
    this.cache.delete(key);
    return true;
  }

  /**
   * Checks if a key exists in the cache (without updating access time)
   * @param {string} key - Cache key
   * @returns {boolean} - True if key exists and is not expired
   */
  has(key) {
    const node = this.cache.get(key);

    if (!node) {
      return false;
    }

    const now = Date.now();

    // Check if item has expired
    if (now - node.timestamp > this.maxAge) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Gets the current size of the cache
   * @returns {number} - Number of items in cache
   */
  size() {
    return this.cache.size;
  }

  /**
   * Clears all items from the cache
   */
  clear() {
    this.cache.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  /**
   * Evicts least recently used items to make room - O(1) per item
   * @param {number} count - Number of items to evict (default: 10% of capacity)
   */
  evictLRU(count = Math.max(1, Math.floor(this.maxSize * 0.1))) {
    for (let i = 0; i < count && this.cache.size > 0; i++) {
      const tail = this._removeTail();
      this.cache.delete(tail.key);
    }
  }

  /**
   * Removes expired items from the cache
   * @returns {number} - Number of items removed
   */
  cleanup() {
    const now = Date.now();
    let removedCount = 0;
    const keysToRemove = [];

    // Collect expired keys first to avoid modifying while iterating
    for (const [key, node] of this.cache.entries()) {
      if (now - node.timestamp > this.maxAge) {
        keysToRemove.push(key);
      }
    }

    // Remove expired items
    for (const key of keysToRemove) {
      this.delete(key);
      removedCount++;
    }

    return removedCount;
  }

  /**
   * Gets cache statistics
   * @returns {Object} - Cache statistics
   */
  getStats() {
    const now = Date.now();
    let expiredCount = 0;

    for (const [, node] of this.cache.entries()) {
      if (now - node.timestamp > this.maxAge) {
        expiredCount++;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      expiredCount,
      utilizationPercent: Math.round((this.cache.size / this.maxSize) * 100),
      memoryUsageEstimate: this.estimateMemoryUsage(),
    };
  }

  /**
   * Estimates memory usage of the cache (simplified calculation)
   * @returns {number} - Estimated memory usage in bytes
   */
  estimateMemoryUsage() {
    let totalSize = 0;

    for (const [key, node] of this.cache.entries()) {
      // Rough estimation: key size + value size + node overhead
      totalSize += key.length * 2; // UTF-16 characters

      // Simplified value size estimation without JSON.stringify
      if (typeof node.value === 'string') {
        totalSize += node.value.length * 2;
      } else if (typeof node.value === 'number') {
        totalSize += 8; // 64-bit number
      } else if (Array.isArray(node.value)) {
        totalSize += node.value.length * 24; // rough estimate for array elements
      } else if (typeof node.value === 'object' && node.value !== null) {
        totalSize += Object.keys(node.value).length * 48; // rough estimate for objects
      } else {
        totalSize += 24; // fallback for other types
      }

      totalSize += 96; // Node object overhead estimate (pointers, timestamp, etc.)
    }

    return totalSize;
  }

  /**
   * Gets all keys in the cache (for debugging)
   * @returns {Array} - Array of cache keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Gets all values in the cache (for debugging)
   * @returns {Array} - Array of cache values
   */
  values() {
    return Array.from(this.cache.values()).map((node) => node.value);
  }
}

module.exports = LRUCache;
