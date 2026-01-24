/**
 * Domain Queue Loader
 *
 * Auto-discovers and loads custom Bull queues and workers from domain/bullQueues.
 * These queues are preserved across regeneration.
 *
 * This file is PROTECTED - never overwritten by the generator.
 *
 * @module domain/bullQueues/queue-loader
 */

const fs = require('fs');
const path = require('path');

/**
 * Loaded queues and workers for cleanup.
 */
const loadedQueues = new Map();
const loadedWorkers = new Map();

/**
 * Load all domain queues.
 *
 * @param {string} queuesDir - Path to domain queues directory
 * @returns {Map<string, Queue>} Map of queue name to Queue instance
 */
function loadDomainQueues(queuesDir) {
  if (!fs.existsSync(queuesDir)) {
    console.log('[DomainQueues] No domain queues directory found');
    return loadedQueues;
  }

  const files = fs.readdirSync(queuesDir);
  const queueFiles = files.filter((f) => f.endsWith('.queue.js'));

  for (const file of queueFiles) {
    try {
      const queuePath = path.join(queuesDir, file);
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const queueModule = require(queuePath);
      const queue = queueModule.default || queueModule.queue || queueModule;

      if (queue && typeof queue.add === 'function') {
        const queueName = file.replace('.queue.js', '');
        loadedQueues.set(queueName, queue);
        console.log(`[DomainQueues] Loaded queue: ${queueName}`);
      } else {
        console.warn(`[DomainQueues] Invalid queue module: ${file}`);
      }
    } catch (error) {
      console.error(`[DomainQueues] Failed to load ${file}:`, error.message);
    }
  }

  return loadedQueues;
}

/**
 * Load all domain workers.
 *
 * @param {string} workersDir - Path to domain workers directory
 * @returns {Map<string, Worker>} Map of worker name to Worker instance
 */
function loadDomainWorkers(workersDir) {
  if (!fs.existsSync(workersDir)) {
    console.log('[DomainWorkers] No domain workers directory found');
    return loadedWorkers;
  }

  const files = fs.readdirSync(workersDir);
  const workerFiles = files.filter((f) => f.endsWith('.worker.js'));

  for (const file of workerFiles) {
    try {
      const workerPath = path.join(workersDir, file);
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const workerModule = require(workerPath);
      const worker = workerModule.default || workerModule.worker || workerModule;

      if (worker && typeof worker.on === 'function') {
        const workerName = file.replace('.worker.js', '');
        loadedWorkers.set(workerName, worker);
        console.log(`[DomainWorkers] Loaded worker: ${workerName}`);
      } else {
        console.warn(`[DomainWorkers] Invalid worker module: ${file}`);
      }
    } catch (error) {
      console.error(`[DomainWorkers] Failed to load ${file}:`, error.message);
    }
  }

  return loadedWorkers;
}

/**
 * Initialize all domain queues and workers.
 *
 * @returns {Promise<{queues: Map, workers: Map}>}
 */
async function initializeDomainQueues() {
  const baseDir = path.join(__dirname);

  const queues = loadDomainQueues(path.join(baseDir, 'queues'));
  const workers = loadDomainWorkers(path.join(baseDir, 'workers'));

  return { queues, workers };
}

/**
 * Gracefully shutdown all domain queues and workers.
 *
 * @returns {Promise<void>}
 */
async function shutdownDomainQueues() {
  // Close all workers first
  for (const [name, worker] of loadedWorkers) {
    try {
      await worker.close();
      console.log(`[DomainWorkers] Closed worker: ${name}`);
    } catch (error) {
      console.error(`[DomainWorkers] Failed to close ${name}:`, error.message);
    }
  }

  // Then close all queues
  for (const [name, queue] of loadedQueues) {
    try {
      await queue.close();
      console.log(`[DomainQueues] Closed queue: ${name}`);
    } catch (error) {
      console.error(`[DomainQueues] Failed to close ${name}:`, error.message);
    }
  }

  loadedQueues.clear();
  loadedWorkers.clear();
}

/**
 * Get a loaded queue by name.
 *
 * @param {string} name - Queue name
 * @returns {Queue|undefined}
 */
function getQueue(name) {
  return loadedQueues.get(name);
}

/**
 * Get a loaded worker by name.
 *
 * @param {string} name - Worker name
 * @returns {Worker|undefined}
 */
function getWorker(name) {
  return loadedWorkers.get(name);
}

module.exports = {
  loadDomainQueues,
  loadDomainWorkers,
  initializeDomainQueues,
  shutdownDomainQueues,
  getQueue,
  getWorker,
};
