/**
 * CREATED BY: @gen{CREATOR_NAME}
 * CREATOR EMAIL: @gen{CREATOR_EMAIL}
 * CREATION DATE: @gen{NOW}
 *
 *
 * DESCRIPTION:
 * ------------------
 * Embedding Queue Stub (Phase 2)
 *
 * This is a STUB file for future asynchronous embedding generation.
 * Phase 1 (current): Clients generate embeddings synchronously.
 * Phase 2 (future): Server generates embeddings asynchronously via BullMQ.
 *
 * Use cases for async embedding:
 * - Bulk re-embedding when model changes
 * - Background embedding for newly created records
 * - Batch processing for imported data
 * - Retry logic for failed embedding API calls
 *
 * To implement Phase 2:
 * 1. Implement embedding.service.stub.template.js first
 * 2. Uncomment and configure the queue and worker below
 * 3. Add API endpoints to trigger embedding jobs
 * 4. Configure Redis connection in bullQueue.js
 *
 * @module bullQueues/queues/embeddingQueue
 */

// const { Queue } = require('bullmq');
// const queueConfig = require('#configs/bullQueue.js');

/**
 * Embedding Queue Configuration
 * Uncomment when implementing Phase 2
 */
// const EMBEDDING_QUEUE_CONFIG = {
//   name: 'embeddingQueue',
//   options: {
//     connection: queueConfig.connection,
//     defaultJobOptions: {
//       attempts: 3,
//       backoff: {
//         type: 'exponential',
//         delay: 1000,
//       },
//       removeOnComplete: {
//         age: 24 * 3600, // Keep completed jobs for 24 hours
//         count: 1000,    // Keep last 1000 completed jobs
//       },
//       removeOnFail: {
//         age: 7 * 24 * 3600, // Keep failed jobs for 7 days
//       },
//     },
//   },
// };

/**
 * Job types for the embedding queue
 */
const EMBEDDING_JOB_TYPES = {
  GENERATE_SINGLE: 'generate_single',
  GENERATE_BATCH: 'generate_batch',
  REEMBED_MODEL: 'reembed_model',
  REEMBED_FIELD: 'reembed_field',
};

/**
 * Create embedding queue instance
 * Uncomment when implementing Phase 2
 */
// const embeddingQueue = new Queue(
//   EMBEDDING_QUEUE_CONFIG.name,
//   EMBEDDING_QUEUE_CONFIG.options
// );

/**
 * Add a single embedding job to the queue
 *
 * @param {Object} jobData - Job data
 * @param {string} jobData.modelName - Name of the model (e.g., 'Document')
 * @param {string} jobData.recordId - ID of the record to embed
 * @param {string} jobData.fieldName - Vector field name
 * @param {string} jobData.textFieldName - Source text field name
 * @param {Object} [jobData.embeddingOptions] - Provider and model options
 * @returns {Promise<Object>} Job instance
 *
 * @example
 * // Phase 2 usage:
 * await addEmbeddingJob({
 *   modelName: 'Document',
 *   recordId: 'abc123',
 *   fieldName: 'contentEmbedding',
 *   textFieldName: 'content',
 *   embeddingOptions: { provider: 'openai', model: 'text-embedding-3-small' }
 * });
 */
async function addEmbeddingJob(jobData) {
  // STUB: Phase 2 implementation
  throw new Error(
    'Async embedding queue is not yet implemented. ' +
      'Please generate embeddings synchronously client-side. ' +
      'See Phase 2 documentation for implementation details.'
  );

  // Phase 2 implementation:
  // const job = await embeddingQueue.add(
  //   EMBEDDING_JOB_TYPES.GENERATE_SINGLE,
  //   jobData,
  //   {
  //     jobId: `embed_${jobData.modelName}_${jobData.recordId}_${jobData.fieldName}`,
  //   }
  // );
  // return job;
}

/**
 * Add batch embedding job to the queue
 *
 * @param {Object} jobData - Job data
 * @param {string} jobData.modelName - Name of the model
 * @param {string[]} jobData.recordIds - IDs of records to embed
 * @param {string} jobData.fieldName - Vector field name
 * @param {string} jobData.textFieldName - Source text field name
 * @param {Object} [jobData.embeddingOptions] - Provider and model options
 * @returns {Promise<Object>} Job instance
 */
async function addBatchEmbeddingJob(jobData) {
  // STUB: Phase 2 implementation
  throw new Error(
    'Async batch embedding is not yet implemented. ' +
      'See Phase 2 documentation for implementation details.'
  );

  // Phase 2 implementation:
  // const job = await embeddingQueue.add(
  //   EMBEDDING_JOB_TYPES.GENERATE_BATCH,
  //   jobData,
  //   {
  //     jobId: `batch_embed_${jobData.modelName}_${Date.now()}`,
  //   }
  // );
  // return job;
}

/**
 * Add re-embedding job for all records in a model
 * Use when changing embedding model or dimensions
 *
 * @param {Object} jobData - Job data
 * @param {string} jobData.modelName - Name of the model
 * @param {string} jobData.fieldName - Vector field name
 * @param {string} jobData.textFieldName - Source text field name
 * @param {Object} jobData.embeddingOptions - New provider and model options
 * @param {Object} [jobData.filter] - Optional filter for records to re-embed
 * @returns {Promise<Object>} Job instance
 */
async function addReembedModelJob(jobData) {
  // STUB: Phase 2 implementation
  throw new Error(
    'Model re-embedding is not yet implemented. ' +
      'See Phase 2 documentation for implementation details.'
  );

  // Phase 2 implementation:
  // const job = await embeddingQueue.add(
  //   EMBEDDING_JOB_TYPES.REEMBED_MODEL,
  //   jobData,
  //   {
  //     jobId: `reembed_${jobData.modelName}_${jobData.fieldName}_${Date.now()}`,
  //     priority: 10, // Lower priority than regular embeddings
  //   }
  // );
  // return job;
}

/**
 * Get queue status and statistics
 *
 * @returns {Promise<Object>} Queue status
 */
async function getQueueStatus() {
  return {
    phase: 1,
    enabled: false,
    message:
      'Async embedding queue is not yet implemented. ' +
      'Embeddings are generated synchronously client-side.',
    stats: null,
  };

  // Phase 2 implementation:
  // const [waiting, active, completed, failed] = await Promise.all([
  //   embeddingQueue.getWaitingCount(),
  //   embeddingQueue.getActiveCount(),
  //   embeddingQueue.getCompletedCount(),
  //   embeddingQueue.getFailedCount(),
  // ]);
  //
  // return {
  //   phase: 2,
  //   enabled: true,
  //   stats: { waiting, active, completed, failed },
  // };
}

module.exports = {
  // embeddingQueue, // Uncomment in Phase 2
  EMBEDDING_JOB_TYPES,
  addEmbeddingJob,
  addBatchEmbeddingJob,
  addReembedModelJob,
  getQueueStatus,
};
