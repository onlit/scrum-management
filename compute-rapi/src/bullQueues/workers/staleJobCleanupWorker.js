/**
 * Stale Job Cleanup Worker
 *
 * BullMQ worker that periodically checks for and marks stale compute generation instances.
 * An instance is considered stale if it has been in 'Processing' status for longer than
 * the configured threshold (default: 15 minutes).
 *
 * This helps ensure visibility into stuck jobs and prevents instances from being
 * permanently stuck in 'Processing' state.
 */

const { Worker, Queue } = require('bullmq');
const queueConfig = require('#configs/bullQueue.js');
const prisma = require('#configs/prisma.js');
const {
  COMPUTE_QUEUE_STALE_THRESHOLD_MS,
} = require('#configs/computeQueue.js');
const {
  logWithTrace,
  logOperationStart,
  logOperationSuccess,
  logOperationError,
} = require('#utils/shared/traceUtils.js');

// Stale threshold (default 15 minutes)
const STALE_THRESHOLD_MS = COMPUTE_QUEUE_STALE_THRESHOLD_MS;

// Cleanup interval (default 5 minutes)
const CLEANUP_INTERVAL_MS =
  Number(process.env.STALE_CLEANUP_INTERVAL_MS) || 5 * 60 * 1000;

// Queue name
const QUEUE_NAME = 'staleJobCleanupQueue';

/**
 * Main processing function - finds and marks stale instances
 */
async function processStaleJobCleanup(job) {
  const traceId = `stale-cleanup-${job.id}`;
  const reqCtx = { traceId };

  logOperationStart('staleJobCleanup', reqCtx, {
    staleThresholdMs: STALE_THRESHOLD_MS,
  });

  try {
    // Calculate the threshold timestamp
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);

    // Find instances that are stuck in Processing status
    const staleInstances = await prisma.instance.findMany({
      where: {
        status: 'Processing',
        OR: [
          // Stuck in queue (has queuedAt but no processingStartedAt)
          {
            queuedAt: { lt: staleThreshold },
            processingStartedAt: null,
          },
          // Started processing but never completed
          {
            processingStartedAt: { lt: staleThreshold },
          },
          // Legacy: no tracking fields but old createdAt
          {
            queuedAt: null,
            processingStartedAt: null,
            createdAt: { lt: staleThreshold },
          },
        ],
      },
      select: {
        id: true,
        microserviceId: true,
        queuedAt: true,
        processingStartedAt: true,
        createdAt: true,
      },
    });

    if (staleInstances.length === 0) {
      logWithTrace('No stale instances found', reqCtx);
      return { staleCount: 0, cleanedUp: 0 };
    }

    logWithTrace('Found stale instances', reqCtx, {
      count: staleInstances.length,
      instanceIds: staleInstances.map((i) => i.id),
    });

    // Mark each stale instance as Failed
    let cleanedUp = 0;
    for (const instance of staleInstances) {
      try {
        // Determine the age for the failure reason
        const staleStartTime =
          instance.processingStartedAt ||
          instance.queuedAt ||
          instance.createdAt;
        const ageMs = Date.now() - new Date(staleStartTime).getTime();
        const ageMinutes = Math.round(ageMs / 60000);

        await prisma.instance.update({
          where: { id: instance.id },
          data: {
            status: 'Failed',
            failureReason: `Stale job timeout: Instance was in Processing state for ${ageMinutes} minutes without completion. This may indicate a worker crash or timeout.`,
            queuePosition: null,
          },
        });

        cleanedUp++;

        logWithTrace('Marked instance as stale', reqCtx, {
          instanceId: instance.id,
          ageMinutes,
        });
      } catch (updateError) {
        logWithTrace('Failed to update stale instance', reqCtx, {
          instanceId: instance.id,
          error: updateError.message,
        });
      }
    }

    logOperationSuccess('staleJobCleanup', reqCtx, {
      staleCount: staleInstances.length,
      cleanedUp,
    });

    return { staleCount: staleInstances.length, cleanedUp };
  } catch (error) {
    logOperationError('staleJobCleanup', reqCtx, error);
    throw error;
  }
}

// Create the queue for stale job cleanup
const staleJobCleanupQueue = new Queue(QUEUE_NAME, {
  connection: queueConfig.connection,
});

// Create the worker
const staleJobCleanupWorker = new Worker(QUEUE_NAME, processStaleJobCleanup, {
  connection: queueConfig.connection,
  concurrency: 1,
});

// Handle worker events
staleJobCleanupWorker.on('completed', (job, result) => {
  logWithTrace('Stale job cleanup completed', { traceId: `stale-cleanup-${job.id}` }, result);
});

staleJobCleanupWorker.on('failed', (job, error) => {
  logWithTrace('Stale job cleanup failed', { traceId: `stale-cleanup-${job?.id}` }, {
    error: error.message,
  });
});

/**
 * Initialize the repeatable cleanup job
 * This should be called once when the application starts
 */
async function initializeStaleJobCleanup() {
  try {
    // Remove any existing repeatable jobs (in case interval changed)
    const existingJobs = await staleJobCleanupQueue.getRepeatableJobs();
    for (const job of existingJobs) {
      await staleJobCleanupQueue.removeRepeatableByKey(job.key);
    }

    // Add the repeatable job
    await staleJobCleanupQueue.add(
      'cleanup',
      {},
      {
        repeat: {
          every: CLEANUP_INTERVAL_MS,
        },
        removeOnComplete: true,
        removeOnFail: true,
      }
    );

    logWithTrace('Stale job cleanup scheduled', { traceId: 'stale-cleanup-init' }, {
      intervalMs: CLEANUP_INTERVAL_MS,
      thresholdMs: STALE_THRESHOLD_MS,
    });
  } catch (error) {
    logWithTrace('Failed to initialize stale job cleanup', { traceId: 'stale-cleanup-init' }, {
      error: error.message,
    });
  }
}

module.exports = {
  staleJobCleanupQueue,
  staleJobCleanupWorker,
  processStaleJobCleanup,
  initializeStaleJobCleanup,
  STALE_THRESHOLD_MS,
  CLEANUP_INTERVAL_MS,
};
