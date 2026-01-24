/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports an Express Router instance that defines routes for handling
 * CRUD operations related to client. It imports middleware functions for authentication,
 * authorization, and error handling, as well as controller functions for handling specific
 * CRUD operations on client.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new client. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all client. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific client by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific client by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific client by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific client by ID. It requires authentication and protection middleware.
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
  createClient,
  getAllClient,
  getClient,
  updateClient,
  deleteClient,
  getClientBarChartData,
  createClientFromOpportunity,
  createClientsFromOpportunities,
} = require('#controllers/client.controller.js');

const router = Router();

router.post(
  '/',
  auth,
  protect,
  wrapExpressAsync(createClient, 'client_create'),
);

router.post(
  '/from-opportunity',
  auth,
  protect,
  wrapExpressAsync(createClientFromOpportunity, 'client_create_from_opportunity'),
);

router.post(
  '/from-opportunities',
  auth,
  protect,
  wrapExpressAsync(createClientsFromOpportunities, 'client_create_from_opportunities'),
);

router.get('/', auth, wrapExpressAsync(getAllClient, 'client_get_all'));

router.get(
  '/bar-chart',
  auth,
  wrapExpressAsync(getClientBarChartData, 'client_bar_chart'),
);

router.get('/:id', auth, wrapExpressAsync(getClient, 'client_get_by_id'));

router.put(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateClient, 'client_update_put'),
);

router.patch(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateClient, 'client_update_patch'),
);

router.delete(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(deleteClient, 'client_delete'),
);

module.exports = router;
