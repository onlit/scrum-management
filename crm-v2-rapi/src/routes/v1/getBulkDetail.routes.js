const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const { getBulkDetail } = require('#controllers/getBulkDetail.controller.js');

const router = Router();

router.post('/', auth, wrapExpressAsync(getBulkDetail, 'bulk_detail_get'));

module.exports = router;