const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  getPreview,
  applyCreate,
  revertBulk,
} = require('#controllers/createBulkPersonRelationships.controller.js');

const router = Router();

// GET-like preview via POST to support complex body filters; also support GET with query params
router.post('/preview', auth, wrapExpressAsync(getPreview, 'bulk_person_relationship_preview'));
router.get('/preview', auth, wrapExpressAsync(getPreview, 'bulk_person_relationship_preview_get'));

// POST/PUT/PATCH: apply bulk create (idempotent)
router.post('/', auth, protect, wrapExpressAsync(applyCreate, 'bulk_person_relationship_create'));
router.put('/', auth, protect, wrapExpressAsync(applyCreate, 'bulk_person_relationship_update_put'));
router.patch('/', auth, protect, wrapExpressAsync(applyCreate, 'bulk_person_relationship_update_patch'));

// DELETE: soft-delete matching person-relationships
router.delete('/', auth, protect, wrapExpressAsync(revertBulk, 'bulk_person_relationship_delete'));

module.exports = router;


