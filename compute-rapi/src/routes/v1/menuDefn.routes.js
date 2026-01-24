const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  createMenuDefn,
  getAllMenuDefns,
  getMenuDefn,
  updateMenuDefn,
  deleteMenuDefn,
} = require('#controllers/menuDefn.controller.js');

const router = Router();

router.post('/', auth, protect, wrapExpressAsync(createMenuDefn, 'menu_defn_create'));

router.get('/', auth, wrapExpressAsync(getAllMenuDefns, 'menu_defn_get_all'));

router.get('/:id', auth, wrapExpressAsync(getMenuDefn, 'menu_defn_get_by_id'));

router.put('/:id', auth, protect, wrapExpressAsync(updateMenuDefn, 'menu_defn_update_put'));

router.patch('/:id', auth, protect, wrapExpressAsync(updateMenuDefn, 'menu_defn_update_patch'));

router.delete('/:id', auth, protect, wrapExpressAsync(deleteMenuDefn, 'menu_defn_delete'));

module.exports = router;

//
// REVISION 2:
// REVISED BY: AI Assistant
// REVISION DATE: 2024-06-11
// REVISION REASON: Verified compliance with ERROR_HANDLING_GUIDELINES.md and TRACE_ID_CONVENTIONS.md
//
