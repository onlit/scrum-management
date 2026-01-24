const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  createTranslation,
  getAllTranslations,
  getTranslation,
  updateTranslation,
  deleteTranslation,
  getTranslationsByLangCode,
  generateTranslationCodes,
} = require('#controllers/translation.controller.js');

const router = Router();

router.post(
  '/',
  auth,
  protect,
  wrapExpressAsync(createTranslation, 'translation_create')
);

router.post(
  '/generate-codes',
  auth,
  protect,
  wrapExpressAsync(generateTranslationCodes, 'translation_generate_codes')
);

router.get('/', auth, wrapExpressAsync(getAllTranslations, 'translation_list'));

router.get(
  '/lang/:langCode/:namespace',
  auth,
  wrapExpressAsync(getTranslationsByLangCode, 'translation_by_lang')
);

router.get('/:id', auth, wrapExpressAsync(getTranslation, 'translation_get'));

router.put(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateTranslation, 'translation_update')
);

router.patch(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateTranslation, 'translation_patch')
);

router.delete(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(deleteTranslation, 'translation_delete')
);

module.exports = router;
