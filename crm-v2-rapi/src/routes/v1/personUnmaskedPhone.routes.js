const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protectInternal = require('#middlewares/protectInternal.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  getPersonUnmaskedPhone,
} = require('#controllers/personUnmaskedPhone.controller.js');

const router = Router();

// READ ONE - Only internal requests allowed
router.get(
  '/:id',
  auth,
  protectInternal,
  wrapExpressAsync(getPersonUnmaskedPhone, 'person_unmasked_phone_get_by_id')
);

module.exports = router;
