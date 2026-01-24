/**
 * Translation Sync Routes
 *
 * REST API routes for translation sync operations.
 */

const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  startTranslationSync,
  getTranslationSyncStatus,
  getTranslationSyncLog,
  listTranslationSyncLogs,
  resumeTranslationSync,
} = require('#controllers/translationSync.controller.js');

const router = Router();

/**
 * POST /api/v1/translation-sync
 * Start a new translation sync job
 * Body: { mode: 'Sync' | 'DryRun' | 'Generate', microserviceId?, modelId? }
 */
router.post(
  '/',
  auth,
  protect,
  wrapExpressAsync(startTranslationSync, 'translation_sync_start')
);

/**
 * GET /api/v1/translation-sync/status
 * Get sync status overview (counts, missing codes, recent syncs)
 */
router.get(
  '/status',
  auth,
  wrapExpressAsync(getTranslationSyncStatus, 'translation_sync_status')
);

/**
 * GET /api/v1/translation-sync/logs
 * List all sync logs with pagination
 * Query: { status?, limit?, offset? }
 */
router.get(
  '/logs',
  auth,
  wrapExpressAsync(listTranslationSyncLogs, 'translation_sync_logs')
);

/**
 * GET /api/v1/translation-sync/:id
 * Get specific sync log details
 */
router.get(
  '/:id',
  auth,
  wrapExpressAsync(getTranslationSyncLog, 'translation_sync_get')
);

/**
 * POST /api/v1/translation-sync/:id/resume
 * Resume a failed sync from its checkpoint
 */
router.post(
  '/:id/resume',
  auth,
  protect,
  wrapExpressAsync(resumeTranslationSync, 'translation_sync_resume')
);

module.exports = router;
