const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protectOrInternal = require('#middlewares/protectOrInternal.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  createGetOrCreatePerson,
} = require('#controllers/getOrCreatePerson.controller.js');

const router = Router();

// POST: get-or-create (parity with Django); allow internal or protected
router.post('/', auth, protectOrInternal, wrapExpressAsync(createGetOrCreatePerson, 'get_or_create_person_post'));

module.exports = router;


