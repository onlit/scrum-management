/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports an Express Router instance that defines a route for creating a new compute microservice.
 * It imports middleware functions for authentication, authorization, and error handling, as well as a controller function
 * for handling the creation of compute microservices.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new compute microservice. It requires authentication and protection middleware.
 * - POST '/validate': Route for validating microservice configuration without generation. It requires authentication and protection middleware.
 * - POST '/prisma-schema': Route for generating and returning only the Prisma model schema string. It requires authentication and protection middleware.
 * - POST '/models-fields': Route for retrieving models and their fields in JSON format. It requires authentication and protection middleware.
 * - POST '/models-fields-compact': Route for retrieving models and fields in compact format optimized for LLM token efficiency. It requires authentication and protection middleware.
 * - POST '/models': Route for retrieving models only. It requires authentication and protection middleware.
 * - DELETE '/cleanup/:microserviceId': Route for cleaning up a microservice. It requires authentication and protection middleware.
 * - POST '/autofix': Route for automatically fixing fixable validation errors in a microservice configuration. It requires authentication and protection middleware.
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
const protectOrInternal = require('#middlewares/protectOrInternal.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  createComputeMicroservice,
  validateComputeMicroservice,
  cleanupComputeMicroservice,
  generatePrismaSchemaString,
  getModelsFields,
  getModelsFieldsCompact,
  getModels,
  autofixComputeMicroservice,
} = require('#controllers/computeMicroservice.controller.js');

const router = Router();

router.post(
  '/',
  auth,
  protect,
  wrapExpressAsync(createComputeMicroservice, 'compute_microservice_create')
);

router.post(
  '/validate',
  auth,
  protect,
  wrapExpressAsync(validateComputeMicroservice, 'compute_microservice_validate')
);

router.post(
  '/prisma-schema',
  auth,
  protect,
  wrapExpressAsync(
    generatePrismaSchemaString,
    'compute_microservice_prisma_schema'
  )
);

router.post(
  '/models-fields',
  auth,
  protect,
  wrapExpressAsync(getModelsFields, 'compute_microservice_models_fields')
);

router.post(
  '/models-fields-compact',
  auth,
  protectOrInternal,
  wrapExpressAsync(
    getModelsFieldsCompact,
    'compute_microservice_models_fields_compact'
  )
);

router.post(
  '/models',
  auth,
  protect,
  wrapExpressAsync(getModels, 'compute_microservice_models')
);

router.delete(
  '/cleanup/:microserviceId',
  auth,
  protect,
  wrapExpressAsync(cleanupComputeMicroservice, 'compute_microservice_cleanup')
);

router.post(
  '/autofix',
  auth,
  protect,
  wrapExpressAsync(autofixComputeMicroservice, 'compute_microservice_autofix')
);

module.exports = router;
