/**
 * Translation Sync Worker
 *
 * BullMQ worker that processes translation sync jobs.
 * Supports batch processing, checkpoints for resumability,
 * and progress reporting.
 */

const { Worker } = require('bullmq');
const queueConfig = require('#configs/bullQueue.js');
const prisma = require('#configs/prisma.js');
const {
  getClientLanguages,
  syncModelTranslations,
  syncFieldTranslations,
} = require('#utils/api/translationSyncUtils.js');
const { logEvent } = require('#utils/shared/loggingUtils.js');

const BATCH_SIZE = 100;

/**
 * Main processing function - exported for testing
 */
async function processTranslationSync(job) {
  const {
    syncLogId,
    clientId,
    userId,
    mode,
    microserviceId,
    modelId,
    generateMissingCodes,
    resumeFromModelId,
    resumeFromFieldId,
  } = job.data;

  const dryRun = mode === 'DryRun';
  const shouldGenerateCodes = mode === 'Generate' || generateMissingCodes;

  // Initialize result tracking
  const result = {
    modelsProcessed: 0,
    fieldsProcessed: 0,
    translationsCreated: 0,
    translationsUpdated: 0,
    codesGenerated: 0,
    errors: [],
  };

  // Get client languages
  const languages = await getClientLanguages(prisma, clientId);
  if (languages.length === 0) {
    throw new Error(
      'No languages found for client. Please create at least one language.'
    );
  }

  // Build filters
  const baseFilters = {
    client: clientId,
    deleted: null,
  };

  if (microserviceId) {
    baseFilters.microserviceId = microserviceId;
  }

  // Process Models
  const modelFilters = { ...baseFilters };
  if (modelId) {
    modelFilters.id = modelId;
  }
  if (resumeFromModelId) {
    modelFilters.id = { gt: resumeFromModelId };
  }

  const totalModels = await prisma.modelDefn.count({ where: modelFilters });
  let modelsProcessed = 0;
  let lastModelId = resumeFromModelId;

  // Batch process models
  while (modelsProcessed < totalModels) {
    const models = await prisma.modelDefn.findMany({
      where: {
        ...modelFilters,
        ...(lastModelId ? { id: { gt: lastModelId } } : {}),
      },
      select: {
        id: true,
        label: true,
        helpfulHint: true,
        labelTranslationCode: true,
        helpfulHintTranslationCode: true,
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
    });

    if (models.length === 0) break;

    // Process batch in transaction
    await prisma.$transaction(async (tx) => {
      for (const model of models) {
        try {
          const stats = await syncModelTranslations({
            tx,
            model,
            languages,
            clientId,
            userId,
            generateMissingCodes: shouldGenerateCodes,
            dryRun,
          });

          result.translationsCreated += stats.translationsCreated || 0;
          result.translationsUpdated += stats.translationsUpdated || 0;
          result.codesGenerated += stats.codesGenerated || 0;
          if (stats.errors?.length > 0) {
            result.errors.push(...stats.errors);
          }
        } catch (error) {
          result.errors.push({
            entityType: 'model',
            entityId: model.id,
            error: error.message,
          });
        }

        modelsProcessed += 1;
        lastModelId = model.id;
      }

      // Update checkpoint
      await tx.translationSyncLog.update({
        where: { id: syncLogId },
        data: {
          processedModels: modelsProcessed,
          lastProcessedModelId: lastModelId,
          translationsCreated: result.translationsCreated,
          translationsUpdated: result.translationsUpdated,
          codesGenerated: result.codesGenerated,
        },
      });
    });

    // Report progress
    const progress = Math.round((modelsProcessed / (totalModels + 1)) * 50);
    await job.updateProgress(progress);
  }

  result.modelsProcessed = modelsProcessed;

  // Process Fields
  const fieldFilters = {
    client: clientId,
    deleted: null,
  };

  if (modelId) {
    fieldFilters.modelId = modelId;
  } else if (microserviceId) {
    fieldFilters.model = { microserviceId };
  }

  if (resumeFromFieldId) {
    fieldFilters.id = { gt: resumeFromFieldId };
  }

  const totalFields = await prisma.fieldDefn.count({ where: fieldFilters });
  let fieldsProcessed = 0;
  let lastFieldId = resumeFromFieldId;

  // Batch process fields
  while (fieldsProcessed < totalFields) {
    const fields = await prisma.fieldDefn.findMany({
      where: {
        ...fieldFilters,
        ...(lastFieldId ? { id: { gt: lastFieldId } } : {}),
      },
      select: {
        id: true,
        label: true,
        helpfulHint: true,
        labelTranslationCode: true,
        helpfulHintTranslationCode: true,
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
    });

    if (fields.length === 0) break;

    // Process batch in transaction
    await prisma.$transaction(async (tx) => {
      for (const field of fields) {
        try {
          const stats = await syncFieldTranslations({
            tx,
            field,
            languages,
            clientId,
            userId,
            generateMissingCodes: shouldGenerateCodes,
            dryRun,
          });

          result.translationsCreated += stats.translationsCreated || 0;
          result.translationsUpdated += stats.translationsUpdated || 0;
          result.codesGenerated += stats.codesGenerated || 0;
          if (stats.errors?.length > 0) {
            result.errors.push(...stats.errors);
          }
        } catch (error) {
          result.errors.push({
            entityType: 'field',
            entityId: field.id,
            error: error.message,
          });
        }

        fieldsProcessed += 1;
        lastFieldId = field.id;
      }

      // Update checkpoint
      await tx.translationSyncLog.update({
        where: { id: syncLogId },
        data: {
          processedFields: fieldsProcessed,
          lastProcessedFieldId: lastFieldId,
          translationsCreated: result.translationsCreated,
          translationsUpdated: result.translationsUpdated,
          codesGenerated: result.codesGenerated,
        },
      });
    });

    // Report progress
    const progress =
      50 + Math.round((fieldsProcessed / (totalFields + 1)) * 50);
    await job.updateProgress(progress);
  }

  result.fieldsProcessed = fieldsProcessed;

  return result;
}

// Create worker
const translationSyncWorker = new Worker(
  'translationSyncQueue',
  processTranslationSync,
  {
    connection: queueConfig.connection,
    concurrency: 1, // Process one sync at a time per worker
  }
);

// Handle completion
translationSyncWorker.on('completed', async (job, result) => {
  try {
    await prisma.translationSyncLog.update({
      where: { id: job.data.syncLogId },
      data: {
        status: 'Completed',
        processedModels: result.modelsProcessed,
        processedFields: result.fieldsProcessed,
        translationsCreated: result.translationsCreated,
        translationsUpdated: result.translationsUpdated,
        codesGenerated: result.codesGenerated,
        errorDetails: result.errors.length > 0 ? result.errors : null,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    logEvent(`[TranslationSync] Completion update failed: ${err.message}`);
  }
});

// Handle failure
translationSyncWorker.on('failed', async (job, error) => {
  try {
    await prisma.translationSyncLog.update({
      where: { id: job.data.syncLogId },
      data: {
        status: 'Failed',
        failureReason: `${error.message}\n${error.stack}`,
        failedAt: new Date(),
      },
    });
  } catch (err) {
    logEvent(`[TranslationSync] Failure update failed: ${err.message}`);
  }
});

// Handle progress
translationSyncWorker.on('progress', async (job, progress) => {
  logEvent(`[TranslationSync] Job ${job.id} progress: ${progress}%`);
});

module.exports = {
  translationSyncWorker,
  processTranslationSync, // Export for testing
};
