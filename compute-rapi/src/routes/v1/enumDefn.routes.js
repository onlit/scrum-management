/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports an Express Router instance that defines routes for CRUD operations on enum definitions.
 * It imports middleware functions for authentication, authorization, error handling, and wrapping asynchronous operations,
 * as well as controller functions for handling enum definition operations.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new enum definition. Requires authentication and protection middleware.
 * - POST '/batch': Route for creating multiple enum definitions in batch. Requires authentication and protection middleware.
 * - GET '/': Route for retrieving all enum definitions. Requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific enum definition by ID. Requires authentication middleware.
 * - PUT '/:id': Route for updating a specific enum definition by ID. Requires authentication and protection middleware.
 * - PATCH '/:id': Route for partially updating a specific enum definition by ID. Requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific enum definition by ID. Requires authentication and protection middleware.
 *
 * The routes are wrapped with the wrapExpressAsync middleware to handle asynchronous operations and properly catch and propagate
 * errors to the error handling middleware.
 *
 *
 * REVISION 1:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 20/02/2024
 * REVISION REASON: Add Standard File Header Comments
 *
 * REVISION 2:
 * REVISED BY: AI Assistant
 * REVISION DATE: 2025-01-27
 * REVISION REASON: Update to comply with ERROR_HANDLING_GUIDELINES.md and TRACE_ID_CONVENTIONS.md
 */

const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  createEnumDefn,
  getAllEnumDefns,
  getEnumDefn,
  updateEnumDefn,
  deleteEnumDefn,
  createEnumDefnsBatch,
} = require('#controllers/enumDefn.controller.js');

const router = Router();

router.post('/', auth, protect, wrapExpressAsync(createEnumDefn, 'enum_defn_create'));

router.post('/batch', auth, protect, wrapExpressAsync(createEnumDefnsBatch, 'enum_defn_create_batch'));

router.get('/', auth, wrapExpressAsync(getAllEnumDefns, 'enum_defn_get_all'));

router.get('/:id', auth, wrapExpressAsync(getEnumDefn, 'enum_defn_get_by_id'));

router.put('/:id', auth, protect, wrapExpressAsync(updateEnumDefn, 'enum_defn_update_put'));

router.patch('/:id', auth, protect, wrapExpressAsync(updateEnumDefn, 'enum_defn_update_patch'));

router.delete('/:id', auth, protect, wrapExpressAsync(deleteEnumDefn, 'enum_defn_delete'));

module.exports = router;
