const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  getPreview,
  applyCreate,
  revertBulk,
} = require('#controllers/createBulkPersonInMarketingLists.controller.js');

const router = Router();

router.post('/preview', auth, wrapExpressAsync(getPreview, 'bulk_person_in_marketing_list_preview'));
router.post('/', auth, protect, wrapExpressAsync(applyCreate, 'bulk_person_in_marketing_list_create'));
router.put('/', auth, protect, wrapExpressAsync(applyCreate, 'bulk_person_in_marketing_list_update_put'));
router.patch('/', auth, protect, wrapExpressAsync(applyCreate, 'bulk_person_in_marketing_list_update_patch'));
router.delete('/', auth, protect, wrapExpressAsync(revertBulk, 'bulk_person_in_marketing_list_delete'));

module.exports = router;


