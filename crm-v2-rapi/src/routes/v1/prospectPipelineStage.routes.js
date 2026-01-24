/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 09/10/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports an Express Router instance that defines routes for handling
 * CRUD operations related to prospectPipelineStage. It imports middleware functions for authentication,
 * authorization, and error handling, as well as controller functions for handling specific
 * CRUD operations on prospectPipelineStage.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new prospectPipelineStage. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all prospectPipelineStage. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific prospectPipelineStage by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific prospectPipelineStage by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific prospectPipelineStage by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific prospectPipelineStage by ID. It requires authentication and protection middleware.
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
  createProspectPipelineStage,
  getAllProspectPipelineStage,
  getProspectPipelineStage,
  updateProspectPipelineStage,
  deleteProspectPipelineStage,
  getProspectPipelineStageBarChartData,
} = require('#controllers/prospectPipelineStage.controller.js');

const router = Router();

router.post(
  '/',
  auth,
  protect,
  wrapExpressAsync(createProspectPipelineStage, 'prospect_pipeline_stage_create'),
);

router.get('/', auth, wrapExpressAsync(getAllProspectPipelineStage, 'prospect_pipeline_stage_get_all'));

router.get(
  '/bar-chart',
  auth,
  wrapExpressAsync(getProspectPipelineStageBarChartData, 'prospect_pipeline_stage_bar_chart'),
);

router.get('/:id', auth, wrapExpressAsync(getProspectPipelineStage, 'prospect_pipeline_stage_get_by_id'));

router.put(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateProspectPipelineStage, 'prospect_pipeline_stage_update_put'),
);

router.patch(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateProspectPipelineStage, 'prospect_pipeline_stage_update_patch'),
);

router.delete(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(deleteProspectPipelineStage, 'prospect_pipeline_stage_delete'),
);

module.exports = router;
