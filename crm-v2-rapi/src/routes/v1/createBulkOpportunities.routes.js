const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  getPreview,
  applyCreate,
  revertBulk,
} = require('#controllers/createBulkOpportunities.controller.js');

const router = Router();

// GET/POST preview: return counts and duplicates for selection
router.post('/preview', auth, wrapExpressAsync(getPreview, 'bulk_opportunity_preview'));

// POST/PUT/PATCH: apply bulk create (idempotent)
router.post('/', auth, protect, wrapExpressAsync(applyCreate, 'bulk_opportunity_create'));
router.put('/', auth, protect, wrapExpressAsync(applyCreate, 'bulk_opportunity_update_put'));
router.patch('/', auth, protect, wrapExpressAsync(applyCreate, 'bulk_opportunity_update_patch'));

// DELETE: soft-delete matching opportunities
router.delete('/', auth, protect, wrapExpressAsync(revertBulk, 'bulk_opportunity_delete'));

module.exports = router;


