/**
 * Translation Sync Utilities
 *
 * Enterprise-grade utilities for synchronizing ModelDefn and FieldDefn
 * labels/helpfulHints with Translation records.
 *
 * Features:
 * - Multi-language support (syncs to ALL client languages)
 * - Transaction-safe batch operations
 * - Dry-run mode for preview
 * - Automatic code generation with distributed locking
 */

const {
  generateUniqueCodeWithLock,
} = require('./translationCodeGeneratorUtils.js');

const DEFAULT_NAMESPACE = 'compute';

/**
 * Gets all active languages for a client
 * @param {Object} prisma - Prisma client or transaction
 * @param {string} clientId - Client ID
 * @returns {Promise<Array>} Array of language objects
 */
async function getClientLanguages(prisma, clientId) {
  return prisma.language.findMany({
    where: { client: clientId, deleted: null },
    select: { id: true, code: true, name: true },
  });
}

/**
 * Gets the primary language for a client (for bidirectional sync)
 * @param {Object} prisma - Prisma client or transaction
 * @param {string} clientId - Client ID
 * @returns {Promise<Object|null>} Primary language object or null if none set
 */
async function getPrimaryLanguage(prisma, clientId) {
  return prisma.language.findFirst({
    where: {
      client: clientId,
      isPrimary: true,
      deleted: null,
    },
    select: { id: true, code: true, name: true },
  });
}

/**
 * Syncs a single translation value for a specific language
 * @param {Object} params
 * @param {Object} params.tx - Prisma transaction
 * @param {string} params.translationCode - Translation code (XXXX-XXX)
 * @param {string} params.value - Text value to sync
 * @param {string} params.languageId - Target language ID
 * @param {string} params.clientId - Client ID
 * @param {string} params.userId - User ID for audit
 * @param {boolean} params.dryRun - If true, don't modify database
 * @returns {Promise<Object>} Sync result with action taken
 */
async function syncTranslationForValue({
  tx,
  translationCode,
  value,
  languageId,
  clientId,
  userId,
  dryRun = false,
}) {
  if (!translationCode || !value) {
    return { action: 'skipped', reason: 'missing_code_or_value' };
  }

  // Check for existing translation
  const existing = await tx.translation.findFirst({
    where: {
      translationCode,
      languageId,
      client: clientId,
      deleted: null,
    },
    select: { id: true, value: true },
  });

  if (existing) {
    // Translation exists - check if value changed
    if (existing.value === value) {
      return { action: 'unchanged', translationId: existing.id };
    }

    // Value changed - update
    if (!dryRun) {
      const updated = await tx.translation.update({
        where: { id: existing.id },
        data: { value, updatedBy: userId },
      });
      return { action: 'updated', translationId: updated.id };
    }
    return { action: 'would_update', translationId: existing.id };
  }

  // No existing translation - create new
  if (!dryRun) {
    const created = await tx.translation.create({
      data: {
        translationCode,
        value,
        namespace: DEFAULT_NAMESPACE,
        languageId,
        client: clientId,
        createdBy: userId,
        updatedBy: userId,
        everyoneCanSeeIt: false,
        anonymousCanSeeIt: false,
        everyoneInObjectCompanyCanSeeIt: true,
      },
    });
    return { action: 'created', translationId: created.id };
  }
  return { action: 'would_create' };
}

/**
 * Syncs translations for a ModelDefn to all languages
 * @param {Object} params
 * @param {Object} params.tx - Prisma transaction
 * @param {Object} params.model - ModelDefn record
 * @param {Array} params.languages - Array of language objects
 * @param {string} params.clientId - Client ID
 * @param {string} params.userId - User ID for audit
 * @param {boolean} params.generateMissingCodes - Generate codes if missing
 * @param {boolean} params.dryRun - Preview mode
 * @returns {Promise<Object>} Sync statistics
 */
async function syncModelTranslations({
  tx,
  model,
  languages,
  clientId,
  userId,
  generateMissingCodes = false,
  dryRun = false,
}) {
  const stats = {
    translationsCreated: 0,
    translationsUpdated: 0,
    translationsUnchanged: 0,
    codesGenerated: 0,
    wouldCreate: 0,
    wouldUpdate: 0,
    errors: [],
  };

  let labelCode = model.labelTranslationCode;
  let hintCode = model.helpfulHintTranslationCode;

  // Generate missing codes if requested (optimized to use single lock for both)
  if (generateMissingCodes && !dryRun) {
    const needsLabelCode = !labelCode && model.label;
    const needsHintCode = !hintCode && model.helpfulHint;

    if (needsLabelCode || needsHintCode) {
      // Acquire lock once and generate both codes if needed
      const redlock = require('#configs/redlock.js');
      const lockKey = `lock:translation-code:${clientId}`;
      const LOCK_TTL_MS = 5000;
      let lock = null;

      try {
        lock = await redlock.acquire([lockKey], LOCK_TTL_MS);

        const updateData = {};

        if (needsLabelCode) {
          const { generateUniqueCode } = require('./translationCodeGeneratorUtils.js');
          labelCode = await generateUniqueCode(tx, clientId);
          updateData.labelTranslationCode = labelCode;
          stats.codesGenerated += 1;
        }

        if (needsHintCode) {
          const { generateUniqueCode } = require('./translationCodeGeneratorUtils.js');
          hintCode = await generateUniqueCode(tx, clientId);
          updateData.helpfulHintTranslationCode = hintCode;
          stats.codesGenerated += 1;
        }

        // Update model with both codes in single query
        if (Object.keys(updateData).length > 0) {
          await tx.modelDefn.update({
            where: { id: model.id },
            data: updateData,
          });
        }
      } finally {
        if (lock) {
          try {
            await lock.release();
          } catch (releaseError) {
            // Log but don't throw - lock will auto-expire
            console.error('[REDLOCK] Failed to release lock:', releaseError.message);
          }
        }
      }
    }
  } else if (generateMissingCodes && dryRun) {
    // Dry run mode - just count what would be generated
    if (!labelCode && model.label) stats.codesGenerated += 1;
    if (!hintCode && model.helpfulHint) stats.codesGenerated += 1;
  }

  // Sync to all languages
  for (const lang of languages) {
    // Sync label
    if (labelCode && model.label) {
      try {
        const result = await syncTranslationForValue({
          tx,
          translationCode: labelCode,
          value: model.label,
          languageId: lang.id,
          clientId,
          userId,
          dryRun,
        });

        if (result.action === 'created') stats.translationsCreated += 1;
        else if (result.action === 'updated') stats.translationsUpdated += 1;
        else if (result.action === 'unchanged') stats.translationsUnchanged += 1;
        else if (result.action === 'would_create') stats.wouldCreate += 1;
        else if (result.action === 'would_update') stats.wouldUpdate += 1;
      } catch (error) {
        stats.errors.push({
          entityType: 'model',
          entityId: model.id,
          field: 'label',
          languageId: lang.id,
          error: error.message,
        });
      }
    }

    // Sync helpfulHint
    if (hintCode && model.helpfulHint) {
      try {
        const result = await syncTranslationForValue({
          tx,
          translationCode: hintCode,
          value: model.helpfulHint,
          languageId: lang.id,
          clientId,
          userId,
          dryRun,
        });

        if (result.action === 'created') stats.translationsCreated += 1;
        else if (result.action === 'updated') stats.translationsUpdated += 1;
        else if (result.action === 'unchanged') stats.translationsUnchanged += 1;
        else if (result.action === 'would_create') stats.wouldCreate += 1;
        else if (result.action === 'would_update') stats.wouldUpdate += 1;
      } catch (error) {
        stats.errors.push({
          entityType: 'model',
          entityId: model.id,
          field: 'helpfulHint',
          languageId: lang.id,
          error: error.message,
        });
      }
    }
  }

  return stats;
}

/**
 * Syncs translations for a FieldDefn to all languages
 * @param {Object} params - Same as syncModelTranslations but for field
 * @returns {Promise<Object>} Sync statistics
 */
async function syncFieldTranslations({
  tx,
  field,
  languages,
  clientId,
  userId,
  generateMissingCodes = false,
  dryRun = false,
}) {
  const stats = {
    translationsCreated: 0,
    translationsUpdated: 0,
    translationsUnchanged: 0,
    codesGenerated: 0,
    wouldCreate: 0,
    wouldUpdate: 0,
    errors: [],
  };

  let labelCode = field.labelTranslationCode;
  let hintCode = field.helpfulHintTranslationCode;

  // Generate missing codes if requested (optimized to use single lock for both)
  if (generateMissingCodes && !dryRun) {
    const needsLabelCode = !labelCode && field.label;
    const needsHintCode = !hintCode && field.helpfulHint;

    if (needsLabelCode || needsHintCode) {
      // Acquire lock once and generate both codes if needed
      const redlock = require('#configs/redlock.js');
      const lockKey = `lock:translation-code:${clientId}`;
      const LOCK_TTL_MS = 5000;
      let lock = null;

      try {
        lock = await redlock.acquire([lockKey], LOCK_TTL_MS);

        const updateData = {};

        if (needsLabelCode) {
          const { generateUniqueCode } = require('./translationCodeGeneratorUtils.js');
          labelCode = await generateUniqueCode(tx, clientId);
          updateData.labelTranslationCode = labelCode;
          stats.codesGenerated += 1;
        }

        if (needsHintCode) {
          const { generateUniqueCode } = require('./translationCodeGeneratorUtils.js');
          hintCode = await generateUniqueCode(tx, clientId);
          updateData.helpfulHintTranslationCode = hintCode;
          stats.codesGenerated += 1;
        }

        // Update field with both codes in single query
        if (Object.keys(updateData).length > 0) {
          await tx.fieldDefn.update({
            where: { id: field.id },
            data: updateData,
          });
        }
      } finally {
        if (lock) {
          try {
            await lock.release();
          } catch (releaseError) {
            // Log but don't throw - lock will auto-expire
            console.error('[REDLOCK] Failed to release lock:', releaseError.message);
          }
        }
      }
    }
  } else if (generateMissingCodes && dryRun) {
    // Dry run mode - just count what would be generated
    if (!labelCode && field.label) stats.codesGenerated += 1;
    if (!hintCode && field.helpfulHint) stats.codesGenerated += 1;
  }

  // Sync to all languages
  for (const lang of languages) {
    if (labelCode && field.label) {
      try {
        const result = await syncTranslationForValue({
          tx,
          translationCode: labelCode,
          value: field.label,
          languageId: lang.id,
          clientId,
          userId,
          dryRun,
        });

        if (result.action === 'created') stats.translationsCreated += 1;
        else if (result.action === 'updated') stats.translationsUpdated += 1;
        else if (result.action === 'unchanged') stats.translationsUnchanged += 1;
        else if (result.action === 'would_create') stats.wouldCreate += 1;
        else if (result.action === 'would_update') stats.wouldUpdate += 1;
      } catch (error) {
        stats.errors.push({
          entityType: 'field',
          entityId: field.id,
          field: 'label',
          languageId: lang.id,
          error: error.message,
        });
      }
    }

    if (hintCode && field.helpfulHint) {
      try {
        const result = await syncTranslationForValue({
          tx,
          translationCode: hintCode,
          value: field.helpfulHint,
          languageId: lang.id,
          clientId,
          userId,
          dryRun,
        });

        if (result.action === 'created') stats.translationsCreated += 1;
        else if (result.action === 'updated') stats.translationsUpdated += 1;
        else if (result.action === 'unchanged') stats.translationsUnchanged += 1;
        else if (result.action === 'would_create') stats.wouldCreate += 1;
        else if (result.action === 'would_update') stats.wouldUpdate += 1;
      } catch (error) {
        stats.errors.push({
          entityType: 'field',
          entityId: field.id,
          field: 'helpfulHint',
          languageId: lang.id,
          error: error.message,
        });
      }
    }
  }

  return stats;
}

module.exports = {
  getClientLanguages,
  getPrimaryLanguage,
  syncTranslationForValue,
  syncModelTranslations,
  syncFieldTranslations,
  DEFAULT_NAMESPACE,
};
