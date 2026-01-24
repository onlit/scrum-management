/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports an Express Router instance that defines routes for handling
 * CRUD operations related to person. It imports middleware functions for authentication,
 * authorization, and error handling, as well as controller functions for handling specific
 * CRUD operations on person.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new person. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all person. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific person by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific person by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific person by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific person by ID. It requires authentication and protection middleware.
 *
 * All routes are wrapped with the wrapExpressAsync middleware to handle asynchronous operations and
 * properly catch and propagate errors to the error handling middleware.
 *
 *
 */

const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const protectOrInternal = require('#middlewares/protectOrInternal.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  createPerson,
  getAllPerson,
  getPerson,
  getPersonByEmail,
  updatePerson,
  deletePerson,
  getPersonBarChartData,
} = require('#controllers/person.controller.js');

const router = Router();

router.post('/', auth, protectOrInternal, wrapExpressAsync(createPerson, 'person_create'));

router.get('/', auth, wrapExpressAsync(getAllPerson, 'person_get_all'));

router.get(
  '/bar-chart',
  auth,
  wrapExpressAsync(getPersonBarChartData, 'person_bar_chart'),
);

// GET by email before generic :id route to avoid conflict
router.get('/email/:email', auth, protectOrInternal, wrapExpressAsync(getPersonByEmail, 'person_get_by_email'));

// Standard ID route remains '/:id' (email route is defined above to avoid conflicts)
router.get('/:id', auth, protectOrInternal, wrapExpressAsync(getPerson, 'person_get_by_id'));

router.put(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updatePerson, 'person_update_put'),
);

router.patch(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updatePerson, 'person_update_patch'),
);

router.delete(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(deletePerson, 'person_delete'),
);

module.exports = router;
