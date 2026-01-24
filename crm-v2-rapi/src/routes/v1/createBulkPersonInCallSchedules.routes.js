const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const { applyCreate } = require('#controllers/createBulkPersonInCallSchedules.controller.js');

const router = Router();

router.post('/', auth, protect, wrapExpressAsync(applyCreate, 'bulk_person_in_call_schedules_create'));

module.exports = router;



