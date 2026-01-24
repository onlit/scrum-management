/**
 * Queue Status Routes
 *
 * Provides endpoints for monitoring and managing the compute generation queue.
 * All endpoints require authentication and protection middleware.
 */

const { Router } = require('express');

const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');
const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const {
  getComputeQueueStatus,
  clearComputeQueue,
} = require('#controllers/queueStatus.controller.js');

const router = Router();

// GET /queue/compute-generation/status - Get queue status
// Requires Compute Admin access
router.get(
  '/compute-generation/status',
  auth,
  protect,
  wrapExpressAsync(getComputeQueueStatus, 'get_compute_queue_status')
);

// POST /queue/compute-generation/clear - Clear queue jobs
// Requires System Administrator access
// Body: { mode: 'waiting' | 'failed' | 'completed' | 'delayed' | 'all' }
router.post(
  '/compute-generation/clear',
  auth,
  protect,
  wrapExpressAsync(clearComputeQueue, 'clear_compute_queue')
);

module.exports = router;
