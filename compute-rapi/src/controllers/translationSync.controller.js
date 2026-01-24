/**
 * Translation Sync Controller
 *
 * REST API endpoints for managing translation sync operations.
 * Supports async queue-based processing with job tracking.
 */

const Joi = require('joi');
const prisma = require('#configs/prisma.js');
const {
  translationSyncQueue,
} = require('#bullQueues/queues/translationSyncQueue.js');
const { getVisibilityFilters } = require('#utils/shared/visibilityUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  logOperationStart,
  logOperationSuccess,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/shared/traceUtils.js');

// Validation schemas
const startSyncSchema = Joi.object({
  mode: Joi.string().valid('Sync', 'DryRun', 'Generate').default('Sync'),
  microserviceId: Joi.string().uuid().optional(),
  modelId: Joi.string().uuid().optional(),
});

/**
 * Start a new translation sync job
 * POST /api/v1/translation-sync
 */
async function startTranslationSync(req, res) {
  const { user, body } = req;

  logOperationStart('startTranslationSync', req, { user: user?.id, body });

  // Validate request
  const { error, value } = startSyncSchema.validate(body);
  if (error) {
    throw createErrorWithTrace(
      ERROR_TYPES.VALIDATION,
      error.details.map((d) => d.message).join(', '),
      req,
      { context: 'start_translation_sync', severity: ERROR_SEVERITY.LOW }
    );
  }

  const clientId = user?.client?.id;
  const userId = user?.id;

  // Determine sync type
  let syncType = 'Full';
  if (value.modelId) {
    syncType = 'Model';
  } else if (value.microserviceId) {
    syncType = 'Model'; // Microservice scope is still model-level
  }

  // Create sync log record
  logDatabaseStart('create_translation_sync_log', req, {});
  const syncLog = await prisma.translationSyncLog.create({
    data: {
      type: syncType,
      mode: value.mode,
      status: 'Processing',
      microserviceId: value.microserviceId || null,
      modelId: value.modelId || null,
      client: clientId,
      createdBy: userId,
      updatedBy: userId,
      everyoneCanSeeIt: false,
      anonymousCanSeeIt: false,
      everyoneInObjectCompanyCanSeeIt: true,
    },
  });
  logDatabaseSuccess('create_translation_sync_log', req, { id: syncLog.id });

  // Queue the job
  const jobData = {
    syncLogId: syncLog.id,
    clientId,
    userId,
    mode: value.mode,
    microserviceId: value.microserviceId,
    modelId: value.modelId,
    generateMissingCodes: value.mode === 'Generate',
  };

  await translationSyncQueue.add('translation-sync', jobData, {
    jobId: syncLog.id, // Use sync log ID as job ID for easy tracking
    priority: 1,
  });

  logOperationSuccess('startTranslationSync', req, { syncLogId: syncLog.id });

  res.status(202).json({
    message: 'Translation sync started. Use the syncLogId to track progress.',
    syncLogId: syncLog.id,
    mode: value.mode,
    type: syncType,
    status: 'Processing',
  });
}

/**
 * Get sync status overview
 * GET /api/v1/translation-sync/status
 */
async function getTranslationSyncStatus(req, res) {
  const { user } = req;

  logOperationStart('getTranslationSyncStatus', req, { user: user?.id });

  const clientId = user?.client?.id;
  const visibilityFilters = getVisibilityFilters(user);

  // Count totals
  const [totalModels, totalFields, totalTranslations] = await Promise.all([
    prisma.modelDefn.count({ where: { ...visibilityFilters, deleted: null } }),
    prisma.fieldDefn.count({ where: { ...visibilityFilters, deleted: null } }),
    prisma.translation.count({ where: { client: clientId, deleted: null } }),
  ]);

  // Count items with/without codes
  const [modelsWithCodes, fieldsWithCodes] = await Promise.all([
    prisma.modelDefn.findMany({
      where: { ...visibilityFilters, deleted: null },
      select: {
        id: true,
        labelTranslationCode: true,
        helpfulHintTranslationCode: true,
      },
    }),
    prisma.fieldDefn.findMany({
      where: { ...visibilityFilters, deleted: null },
      select: {
        id: true,
        labelTranslationCode: true,
        helpfulHintTranslationCode: true,
      },
    }),
  ]);

  const modelStats = {
    withLabelCode: modelsWithCodes.filter((m) => m.labelTranslationCode).length,
    withHintCode: modelsWithCodes.filter((m) => m.helpfulHintTranslationCode)
      .length,
    missingLabelCode: modelsWithCodes.filter((m) => !m.labelTranslationCode)
      .length,
    missingHintCode: modelsWithCodes.filter(
      (m) => !m.helpfulHintTranslationCode
    ).length,
  };

  const fieldStats = {
    withLabelCode: fieldsWithCodes.filter((f) => f.labelTranslationCode).length,
    withHintCode: fieldsWithCodes.filter((f) => f.helpfulHintTranslationCode)
      .length,
    missingLabelCode: fieldsWithCodes.filter((f) => !f.labelTranslationCode)
      .length,
    missingHintCode: fieldsWithCodes.filter(
      (f) => !f.helpfulHintTranslationCode
    ).length,
  };

  // Get recent sync logs
  const recentSyncs = await prisma.translationSyncLog.findMany({
    where: { client: clientId, deleted: null },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      type: true,
      mode: true,
      status: true,
      processedModels: true,
      processedFields: true,
      translationsCreated: true,
      translationsUpdated: true,
      codesGenerated: true,
      createdAt: true,
      completedAt: true,
    },
  });

  logOperationSuccess('getTranslationSyncStatus', req, {});

  res.status(200).json({
    totalModels,
    totalFields,
    totalTranslations,
    models: modelStats,
    fields: fieldStats,
    recentSyncs,
  });
}

/**
 * Get a specific sync log
 * GET /api/v1/translation-sync/:id
 */
async function getTranslationSyncLog(req, res) {
  const { params, user } = req;

  logOperationStart('getTranslationSyncLog', req, { syncLogId: params?.id });

  const syncLog = await prisma.translationSyncLog.findFirst({
    where: {
      id: params?.id,
      ...getVisibilityFilters(user),
    },
  });

  if (!syncLog) {
    throw createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Translation sync log not found',
      req,
      { context: 'get_translation_sync_log', severity: ERROR_SEVERITY.LOW }
    );
  }

  // Get job status from queue if still processing
  let jobStatus = null;
  if (syncLog.status === 'Processing') {
    try {
      const job = await translationSyncQueue.getJob(syncLog.id);
      if (job) {
        jobStatus = {
          progress: job.progress,
          attemptsMade: job.attemptsMade,
          processedOn: job.processedOn,
        };
      }
    } catch (err) {
      // Queue lookup failed - not critical
    }
  }

  logOperationSuccess('getTranslationSyncLog', req, { id: syncLog.id });

  res.status(200).json({
    ...syncLog,
    jobStatus,
  });
}

/**
 * List all sync logs
 * GET /api/v1/translation-sync/logs
 */
async function listTranslationSyncLogs(req, res) {
  const { user, query } = req;
  const { status, limit = 20, offset = 0 } = query;

  logOperationStart('listTranslationSyncLogs', req, { user: user?.id, status });

  const where = {
    ...getVisibilityFilters(user),
    deleted: null,
  };

  if (status) {
    where.status = status;
  }

  const [logs, total] = await Promise.all([
    prisma.translationSyncLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit, 10),
      skip: parseInt(offset, 10),
    }),
    prisma.translationSyncLog.count({ where }),
  ]);

  logOperationSuccess('listTranslationSyncLogs', req, { count: logs.length });

  res.status(200).json({
    data: logs,
    total,
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
  });
}

/**
 * Resume a failed sync from checkpoint
 * POST /api/v1/translation-sync/:id/resume
 */
async function resumeTranslationSync(req, res) {
  const { params, user } = req;

  logOperationStart('resumeTranslationSync', req, { syncLogId: params?.id });

  const existingLog = await prisma.translationSyncLog.findFirst({
    where: {
      id: params?.id,
      ...getVisibilityFilters(user),
    },
  });

  if (!existingLog) {
    throw createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Translation sync log not found',
      req,
      { context: 'resume_translation_sync', severity: ERROR_SEVERITY.LOW }
    );
  }

  if (existingLog.status !== 'Failed') {
    throw createErrorWithTrace(
      ERROR_TYPES.BAD_REQUEST,
      'Only failed sync jobs can be resumed',
      req,
      { context: 'resume_translation_sync', severity: ERROR_SEVERITY.LOW }
    );
  }

  // Update status back to Processing
  await prisma.translationSyncLog.update({
    where: { id: existingLog.id },
    data: {
      status: 'Processing',
      failureReason: null,
      failedAt: null,
    },
  });

  // Queue resumed job with checkpoints
  const jobData = {
    syncLogId: existingLog.id,
    clientId: existingLog.client,
    userId: user?.id,
    mode: existingLog.mode,
    microserviceId: existingLog.microserviceId,
    modelId: existingLog.modelId,
    generateMissingCodes: existingLog.mode === 'Generate',
    resumeFromModelId: existingLog.lastProcessedModelId,
    resumeFromFieldId: existingLog.lastProcessedFieldId,
  };

  await translationSyncQueue.add('translation-sync-resume', jobData, {
    jobId: `${existingLog.id}-resume-${Date.now()}`,
    priority: 1,
  });

  logOperationSuccess('resumeTranslationSync', req, {
    syncLogId: existingLog.id,
  });

  res.status(202).json({
    message: 'Translation sync resumed from last checkpoint',
    syncLogId: existingLog.id,
    resumeFromModelId: existingLog.lastProcessedModelId,
    resumeFromFieldId: existingLog.lastProcessedFieldId,
  });
}

module.exports = {
  startTranslationSync,
  getTranslationSyncStatus,
  getTranslationSyncLog,
  listTranslationSyncLogs,
  resumeTranslationSync,
};
