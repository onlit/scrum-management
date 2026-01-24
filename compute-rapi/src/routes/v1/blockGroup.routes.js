/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports an Express Router instance that defines routes for handling
 * CRUD operations related to block groups. It imports middleware functions for authentication,
 * authorization, and error handling, as well as controller functions for handling specific
 * CRUD operations on block groups.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new block group. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all block groups. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific block group by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific block group by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific block group by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific block group by ID. It requires authentication and protection middleware.
 *
 * All routes are wrapped with the wrapExpressAsync middleware to handle asynchronous operations and
 * properly catch and propagate errors to the error handling middleware.
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
  createBlockGroup,
  getAllBlockGroups,
  getBlockGroup,
  updateBlockGroup,
  deleteBlockGroup,
} = require('#controllers/blockGroup.controller.js');

const router = Router();

router.post('/', auth, protect, wrapExpressAsync(createBlockGroup, 'block_group_create'));

router.get('/', auth, wrapExpressAsync(getAllBlockGroups, 'block_group_get_all'));

router.get('/:id', auth, wrapExpressAsync(getBlockGroup, 'block_group_get_by_id'));

router.put('/:id', auth, protect, wrapExpressAsync(updateBlockGroup, 'block_group_update_put'));

router.patch('/:id', auth, protect, wrapExpressAsync(updateBlockGroup, 'block_group_update_patch'));

router.delete('/:id', auth, protect, wrapExpressAsync(deleteBlockGroup, 'block_group_delete'));

module.exports = router;
