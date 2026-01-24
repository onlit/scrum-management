const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  getPreview,
  applyCreate,
  revertBulk,
} = require('#controllers/createBulkCompanyInTerritories.controller.js');

const router = Router();

// GET: preview selection, duplicates and counts
router.post('/preview', auth, wrapExpressAsync(getPreview, 'bulk_company_in_territory_preview'));

// POST/PUT/PATCH: apply bulk create (idempotent)
router.post('/', auth, protect, wrapExpressAsync(applyCreate, 'bulk_company_in_territory_create'));
router.put('/', auth, protect, wrapExpressAsync(applyCreate, 'bulk_company_in_territory_update_put'));
router.patch('/', auth, protect, wrapExpressAsync(applyCreate, 'bulk_company_in_territory_update_patch'));

// DELETE: soft-delete matching company-in-territories
router.delete('/', auth, protect, wrapExpressAsync(revertBulk, 'bulk_company_in_territory_delete'));

module.exports = router;


