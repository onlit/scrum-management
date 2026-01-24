/**
 * Queue Status Controller
 *
 * Provides monitoring endpoints for the compute generation queue.
 * Returns queue statistics, active jobs, and stale instance counts.
 */

const prisma = require('#configs/prisma.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
} = require('#utils/shared/traceUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { createErrorWithTrace } = require('#utils/shared/traceUtils.js');
const { hasComputeAdminAccess } = require('#utils/api/microserviceValidationUtils.js');
const {
  COMPUTE_GENERATION_QUEUE_NAME,
  COMPUTE_QUEUE_STALE_THRESHOLD_MS,
} = require('#configs/computeQueue.js');

// Import the queue from computeMicroservice controller
// Note: We need to export computeGenerationQueue from computeMicroservice.controller.js
// For now, we'll create a reference to it here
const queueConfig = require('#configs/bullQueue.js');
const computeGenerationQueue = new queueConfig.Queue(
  COMPUTE_GENERATION_QUEUE_NAME,
  {
    connection: queueConfig.connection,
  }
);

// Stale threshold (shared with staleJobCleanupWorker.js)
const STALE_THRESHOLD_MS = COMPUTE_QUEUE_STALE_THRESHOLD_MS;

/**
 * Get the status of the compute generation queue
 * Returns queue counts, active jobs, and stale instance information
 */
async function getComputeQueueStatus(req, res) {
  const { user } = req;

  logOperationStart('getComputeQueueStatus', req, {
    userId: user?.id,
  });

  try {
    // Check authorization
    if (!hasComputeAdminAccess(user)) {
      throw createErrorWithTrace(
        ERROR_TYPES.AUTHORIZATION,
        'You do not have permission to view queue status.',
        req,
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'get_compute_queue_status',
          details: {
            userRoles: user?.roleNames ?? [],
          },
        }
      );
    }

    // Get queue job counts
    const jobCounts = await computeGenerationQueue.getJobCounts();

    // Get active jobs
    const activeJobs = await computeGenerationQueue.getJobs(['active']);
    const activeJobDetails = activeJobs.map((job) => ({
      jobId: job.id,
      instanceId: job.data?.instanceId,
      microserviceId: job.data?.microserviceId,
      startedAt: job.processedOn ? new Date(job.processedOn) : null,
    }));

    // Get waiting jobs
    const waitingJobs = await computeGenerationQueue.getJobs(['waiting']);
    const waitingJobDetails = waitingJobs.slice(0, 10).map((job) => ({
      jobId: job.id,
      instanceId: job.data?.instanceId,
      microserviceId: job.data?.microserviceId,
      queuedAt: job.timestamp ? new Date(job.timestamp) : null,
    }));

    // Count stale instances (Processing for > threshold)
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);
    const staleInstanceCount = await prisma.instance.count({
      where: {
        status: 'Processing',
        OR: [
          {
            queuedAt: { lt: staleThreshold },
            processingStartedAt: null,
          },
          {
            processingStartedAt: { lt: staleThreshold },
          },
          {
            queuedAt: null,
            processingStartedAt: null,
            createdAt: { lt: staleThreshold },
          },
        ],
      },
    });

    // Get recent completed instances (last 10)
    const recentCompleted = await prisma.instance.findMany({
      where: {
        status: 'Completed',
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 5,
      select: {
        id: true,
        microserviceId: true,
        queuedAt: true,
        processingStartedAt: true,
        updatedAt: true,
      },
    });

    // Get recent failed instances (last 5)
    const recentFailed = await prisma.instance.findMany({
      where: {
        status: 'Failed',
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 5,
      select: {
        id: true,
        microserviceId: true,
        failureReason: true,
        updatedAt: true,
      },
    });

    const result = {
      queue: {
        name: COMPUTE_GENERATION_QUEUE_NAME,
        waiting: jobCounts.waiting || 0,
        active: jobCounts.active || 0,
        delayed: jobCounts.delayed || 0,
        failed: jobCounts.failed || 0,
        completed: jobCounts.completed || 0,
      },
      activeJobs: activeJobDetails,
      waitingJobs: waitingJobDetails,
      staleInstances: {
        count: staleInstanceCount,
        thresholdMinutes: STALE_THRESHOLD_MS / 60000,
      },
      recentCompleted: recentCompleted.map((i) => ({
        ...i,
        durationMinutes: i.processingStartedAt && i.updatedAt
          ? Math.round((new Date(i.updatedAt) - new Date(i.processingStartedAt)) / 60000)
          : null,
      })),
      recentFailed,
      timestamp: new Date().toISOString(),
    };

    logOperationSuccess('getComputeQueueStatus', req, {
      waiting: result.queue.waiting,
      active: result.queue.active,
      staleCount: staleInstanceCount,
    });

    res.status(200).json(result);
  } catch (error) {
    logOperationError('getComputeQueueStatus', req, error);
    throw error;
  }
}

/**
 * Clear the compute generation queue
 * Supports different modes: waiting, failed, completed, all
 */
async function clearComputeQueue(req, res) {
  const { user } = req;
  const { mode = 'waiting' } = req.body;

  logOperationStart('clearComputeQueue', req, {
    userId: user?.id,
    mode,
  });

  try {
    // Check authorization - require System Administrator for queue clearing
    const isSystemAdmin =
      Array.isArray(user?.roleNames) &&
      user.roleNames.includes('System Administrator');

    if (!isSystemAdmin) {
      throw createErrorWithTrace(
        ERROR_TYPES.AUTHORIZATION,
        'Only System Administrators can clear the queue.',
        req,
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'clear_compute_queue',
          details: {
            userRoles: user?.roleNames ?? [],
          },
        }
      );
    }

    const validModes = ['waiting', 'failed', 'completed', 'delayed', 'all'];
    if (!validModes.includes(mode)) {
      throw createErrorWithTrace(
        ERROR_TYPES.BAD_REQUEST,
        `Invalid mode. Must be one of: ${validModes.join(', ')}`,
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'clear_compute_queue',
          details: { providedMode: mode },
        }
      );
    }

    // Get counts before clearing
    const beforeCounts = await computeGenerationQueue.getJobCounts();

    let clearedCounts = {
      waiting: 0,
      failed: 0,
      completed: 0,
      delayed: 0,
    };

    if (mode === 'all') {
      // Drain waiting jobs
      await computeGenerationQueue.drain();
      clearedCounts.waiting = beforeCounts.waiting || 0;

      // Clean completed jobs (0 grace period = all)
      const cleanedCompleted = await computeGenerationQueue.clean(0, 0, 'completed');
      clearedCounts.completed = cleanedCompleted?.length || 0;

      // Clean failed jobs
      const cleanedFailed = await computeGenerationQueue.clean(0, 0, 'failed');
      clearedCounts.failed = cleanedFailed?.length || 0;

      // Clean delayed jobs
      const cleanedDelayed = await computeGenerationQueue.clean(0, 0, 'delayed');
      clearedCounts.delayed = cleanedDelayed?.length || 0;
    } else if (mode === 'waiting') {
      await computeGenerationQueue.drain();
      clearedCounts.waiting = beforeCounts.waiting || 0;
    } else {
      // Clean specific job type
      const cleaned = await computeGenerationQueue.clean(0, 0, mode);
      clearedCounts[mode] = cleaned?.length || 0;
    }

    // Also update database instances that are stuck in Processing with a queue position
    // (meaning they were queued but not yet started processing)
    if (mode === 'waiting' || mode === 'all') {
      const stuckInstances = await prisma.instance.updateMany({
        where: {
          status: 'Processing',
          queuePosition: { not: null },
          processingStartedAt: null, // Not yet started actual processing
        },
        data: {
          status: 'Failed',
          queuePosition: null,
          failureReason: 'Queue was cleared by administrator.',
          errorType: 'QUEUE_CLEARED',
          errorContext: 'clearComputeQueue',
        },
      });
      clearedCounts.stuckInstances = stuckInstances.count;
    }

    // Get counts after clearing
    const afterCounts = await computeGenerationQueue.getJobCounts();

    const result = {
      success: true,
      mode,
      cleared: clearedCounts,
      queueBefore: {
        waiting: beforeCounts.waiting || 0,
        active: beforeCounts.active || 0,
        delayed: beforeCounts.delayed || 0,
        failed: beforeCounts.failed || 0,
        completed: beforeCounts.completed || 0,
      },
      queueAfter: {
        waiting: afterCounts.waiting || 0,
        active: afterCounts.active || 0,
        delayed: afterCounts.delayed || 0,
        failed: afterCounts.failed || 0,
        completed: afterCounts.completed || 0,
      },
      clearedBy: user?.email || user?.id,
      timestamp: new Date().toISOString(),
    };

    logOperationSuccess('clearComputeQueue', req, {
      mode,
      cleared: clearedCounts,
    });

    res.status(200).json(result);
  } catch (error) {
    logOperationError('clearComputeQueue', req, error);
    throw error;
  }
}

module.exports = {
  getComputeQueueStatus,
  clearComputeQueue,
};
