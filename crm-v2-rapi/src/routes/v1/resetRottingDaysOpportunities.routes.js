/**
 * CREATED BY: AI Assistant
 * CREATION DATE: 26/08/2025
 *
 * DESCRIPTION:
 * ------------------
 * Routes for resetting rotting days on opportunities.
 * Provides GET (preview), POST (apply), PUT/PATCH (apply), DELETE (revert) endpoints.
 */

const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  getResetRottingDaysPreview,
  applyResetRottingDays,
  updateResetRottingDays,
  deleteResetRottingDays,
} = require('#controllers/resetRottingDaysOpportunities.controller.js');

const router = Router();

// READ (Preview) - Requires auth only
router.get(
  '/',
  auth,
  wrapExpressAsync(getResetRottingDaysPreview, 'reset_rotting_days_get_preview'),
);

// CREATE/APPLY - Requires auth + protect
router.post(
  '/',
  auth,
  protect,
  wrapExpressAsync(applyResetRottingDays, 'reset_rotting_days_post_apply'),
);

// UPDATE/APPLY (PUT) - Requires auth + protect
router.put(
  '/',
  auth,
  protect,
  wrapExpressAsync(updateResetRottingDays, 'reset_rotting_days_put_apply'),
);

// UPDATE/APPLY (PATCH) - Requires auth + protect
router.patch(
  '/',
  auth,
  protect,
  wrapExpressAsync(updateResetRottingDays, 'reset_rotting_days_patch_apply'),
);

// DELETE/REVERT - Requires auth + protect
router.delete(
  '/',
  auth,
  protect,
  wrapExpressAsync(deleteResetRottingDays, 'reset_rotting_days_delete_revert'),
);

module.exports = router;


