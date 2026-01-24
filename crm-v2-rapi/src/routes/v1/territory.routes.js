/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports an Express Router instance that defines routes for handling
 * CRUD operations related to territory. It imports middleware functions for authentication,
 * authorization, and error handling, as well as controller functions for handling specific
 * CRUD operations on territory.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new territory. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all territory. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific territory by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific territory by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific territory by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific territory by ID. It requires authentication and protection middleware.
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
  createTerritory,
  getAllTerritory,
  getTerritory,
  updateTerritory,
  deleteTerritory,
  getTerritoryBarChartData,
} = require('#controllers/territory.controller.js');

const router = Router();

router.post(
  '/',
  auth,
  protect,
  wrapExpressAsync(createTerritory, 'territory_create'),
);

router.get('/', auth, wrapExpressAsync(getAllTerritory, 'territory_get_all'));

router.get(
  '/bar-chart',
  auth,
  wrapExpressAsync(getTerritoryBarChartData, 'territory_bar_chart'),
);

router.get('/:id', auth, wrapExpressAsync(getTerritory, 'territory_get_by_id'));

router.put(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateTerritory, 'territory_update_put'),
);

router.patch(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateTerritory, 'territory_update_patch'),
);

router.delete(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(deleteTerritory, 'territory_delete'),
);

module.exports = router;
