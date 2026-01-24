const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  createLanguage,
  getAllLanguages,
  getLanguage,
  updateLanguage,
  deleteLanguage,
} = require('#controllers/language.controller.js');

const router = Router();

router.post('/', auth, protect, wrapExpressAsync(createLanguage, 'language_create'));

router.get('/', auth, wrapExpressAsync(getAllLanguages, 'language_get_all'));

router.get('/:id', auth, wrapExpressAsync(getLanguage, 'language_get_by_id'));

router.put('/:id', auth, protect, wrapExpressAsync(updateLanguage, 'language_update_put'));

router.patch('/:id', auth, protect, wrapExpressAsync(updateLanguage, 'language_update_patch'));

router.delete('/:id', auth, protect, wrapExpressAsync(deleteLanguage, 'language_delete'));

module.exports = router;

//
// REVISION 2:
// REVISED BY: AI Assistant
// REVISION DATE: 2024-06-11
// REVISION REASON: Verified compliance with ERROR_HANDLING_GUIDELINES.md and TRACE_ID_CONVENTIONS.md
//
