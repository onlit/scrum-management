const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  getInternalBulkDetail,
  methodNotAllowed,
} = require('#controllers/getInternalBulkDetail.controller.js');

const router = Router();

// Read collection via GET with ?payload={} (internal parity)
router.get('/', auth, wrapExpressAsync(getInternalBulkDetail, 'internal_bulk_detail_get'));

// Read collection via POST body
router.post('/', auth, wrapExpressAsync(getInternalBulkDetail, 'internal_bulk_detail_post'));

// Explicitly handle unsupported verbs to provide clear guidance
router.put('/', auth, methodNotAllowed);
router.patch('/', auth, methodNotAllowed);
router.delete('/', auth, methodNotAllowed);

module.exports = router;
