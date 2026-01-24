/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports an Express Router instance that defines routes for handling
 * CRUD operations related to channel. It imports middleware functions for authentication,
 * authorization, and error handling, as well as controller functions for handling specific
 * CRUD operations on channel.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new channel. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all channel. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific channel by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific channel by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific channel by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific channel by ID. It requires authentication and protection middleware.
 *
 * All routes are wrapped with the wrapExpressAsync middleware to handle asynchronous operations and
 * properly catch and propagate errors to the error handling middleware.
 *
 *
 */

const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  createChannel,
  getAllChannel,
  getChannel,
  updateChannel,
  deleteChannel,
  getChannelBarChartData,
} = require('#controllers/channel.controller.js');

const router = Router();

router.post(
  '/',
  auth,
  protect,
  wrapExpressAsync(createChannel, 'channel_create'),
);

router.get('/', auth, wrapExpressAsync(getAllChannel, 'channel_get_all'));

router.get(
  '/bar-chart',
  auth,
  wrapExpressAsync(getChannelBarChartData, 'channel_bar_chart'),
);

router.get('/:id', auth, wrapExpressAsync(getChannel, 'channel_get_by_id'));

router.put(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateChannel, 'channel_update_put'),
);

router.patch(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateChannel, 'channel_update_patch'),
);

router.delete(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(deleteChannel, 'channel_delete'),
);

module.exports = router;
