/**
 * Translation Sync Queue
 *
 * BullMQ queue for processing translation sync jobs asynchronously.
 * Mirrors the import/export queue pattern.
 */

const queueConfig = require('#configs/bullQueue.js');

const translationSyncQueue = new queueConfig.Queue('translationSyncQueue', {
  connection: queueConfig.connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 60 * 60, // Keep for 24 hours
    },
    removeOnFail: {
      count: 500, // Keep more failed jobs for debugging
    },
  },
});

module.exports = {
  translationSyncQueue,
};
