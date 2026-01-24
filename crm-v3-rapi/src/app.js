/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This Express application is configured to serve as the backend for a microservice architecture, supporting a variety of operations across multiple domains. The application incorporates essential middleware for security, rate limiting, CORS, and error handling, ensuring robust and secure handling of requests.
 *
 * Key features of the application include:
 * - Security Enhancements: Utilizes `helmet` for setting various HTTP headers to secure app traffic, and `express-rate-limit` to prevent abuse by limiting request rates.
 * - Cross-Origin Resource Sharing (CORS): Configured with custom settings to control access and secure cross-origin requests.
 * - Request Parsing: Employs `express.json` and `express.urlencoded` for easy parsing of JSON and URL-encoded payloads.
 * - Custom Middleware: Implements custom middleware such as `setOriginHeader` to manage origin headers, and `cors` with specific options for finer control over CORS policies.
 * - API Rate Limiting: Applies rate limiting to protect against DDoS attacks and ensure service availability, with the flexibility to skip counting successful requests.
 * - Routes Configuration: Defines routes for various microservices and resources such as models, model fields, enumerations, blocks, instances, and logs, facilitating CRUD operations and specialized actions like import, export, and undelete functionalities.
 * - Error Handling: Incorporates custom error handling middleware to catch and respond to not found (404) errors and unexpected server errors, ensuring graceful error responses.
 *
 * The application's structure and middleware stack are designed to provide a secure, scalable, and maintainable backend for complex microservices-based applications.
 */

const express = require('express');
const dotenv = require('dotenv');
const helmet = require('helmet');
const path = require('path');
const internalRequestHandler = require('#middlewares/internalRequestHandler.js');
const { createSchemaOptionsHandler } = require('#core/middlewares/schemaOptionsHandler.js');
const conditionalCors = require('#middlewares/conditionalCors.js');
const notFound = require('#middlewares/notFound.js');
const errorHandler = require('#middlewares/errorHandler.js');
const { createBoundedErrorHandler } = require('#middlewares/errorBoundary.js');
const inputSanitizer = require('#middlewares/inputSanitizer.js');
const { securityLogger } = require('#middlewares/securityLogger.js');
const { smartRateLimiter } = require('#middlewares/rateLimiter.js');
const { logEvent } = require('#utils/loggingUtils.js');
const traceId = require('#middlewares/traceId.js');
const {
  getRegistry,
  initializeRegistry,
} = require('#domain/interceptors/interceptor.registry.js');
const { loadDomainRoutes } = require('#domain/routes/route-loader.js');
const { initializeDomainQueues, shutdownDomainQueues } = require('#domain/bullQueues/queue-loader.js');

const healthRoutes = require('#core/routes/v1/health.routes.js');
const personRoutes = require('#core/routes/v1/person.routes.core.js');
const opportunityPipelineRoutes = require('#core/routes/v1/opportunityPipeline.routes.core.js');
const relationshipRoutes = require('#core/routes/v1/relationship.routes.core.js');
const personSocialMediaRoutes = require('#core/routes/v1/personSocialMedia.routes.core.js');
const prospectCategoryRoutes = require('#core/routes/v1/prospectCategory.routes.core.js');
const prospectRoutes = require('#core/routes/v1/prospect.routes.core.js');
const personRelationshipRoutes = require('#core/routes/v1/personRelationship.routes.core.js');
const personRelationshipHistoryRoutes = require('#core/routes/v1/personRelationshipHistory.routes.core.js');
const companyContactRoutes = require('#core/routes/v1/companyContact.routes.core.js');
const accountManagerInCompanyRoutes = require('#core/routes/v1/accountManagerInCompany.routes.core.js');
const territoryOwnerRoutes = require('#core/routes/v1/territoryOwner.routes.core.js');
const salesPersonTargetRoutes = require('#core/routes/v1/salesPersonTarget.routes.core.js');
const customerEnquiryPurposeRoutes = require('#core/routes/v1/customerEnquiryPurpose.routes.core.js');
const customerEnquiryRoutes = require('#core/routes/v1/customerEnquiry.routes.core.js');
const clientRoutes = require('#core/routes/v1/client.routes.core.js');
const clientHistoryRoutes = require('#core/routes/v1/clientHistory.routes.core.js');
const opportunityInfluencerRoutes = require('#core/routes/v1/opportunityInfluencer.routes.core.js');
const socialMediaTypeRoutes = require('#core/routes/v1/socialMediaType.routes.core.js');
const companySocialMediaRoutes = require('#core/routes/v1/companySocialMedia.routes.core.js');
const actionPlanRoutes = require('#core/routes/v1/actionPlan.routes.core.js');
const dataNeededRoutes = require('#core/routes/v1/dataNeeded.routes.core.js');
const personHistoryRoutes = require('#core/routes/v1/personHistory.routes.core.js');
const callListRoutes = require('#core/routes/v1/callList.routes.core.js');
const callListPipelineStageRoutes = require('#core/routes/v1/callListPipelineStage.routes.core.js');
const callScheduleRoutes = require('#core/routes/v1/callSchedule.routes.core.js');
const companyRoutes = require('#core/routes/v1/company.routes.core.js');
const companyHistoryRoutes = require('#core/routes/v1/companyHistory.routes.core.js');
const companyInTerritoryRoutes = require('#core/routes/v1/companyInTerritory.routes.core.js');
const targetActualHistoryRoutes = require('#core/routes/v1/targetActualHistory.routes.core.js');
const personInMarketingListRoutes = require('#core/routes/v1/personInMarketingList.routes.core.js');
const onlineSignupRoutes = require('#core/routes/v1/onlineSignup.routes.core.js');
const callListPipelineRoutes = require('#core/routes/v1/callListPipeline.routes.core.js');
const opportunityProductRoutes = require('#core/routes/v1/opportunityProduct.routes.core.js');
const callHistoryRoutes = require('#core/routes/v1/callHistory.routes.core.js');
const opportunityHistoryRoutes = require('#core/routes/v1/opportunityHistory.routes.core.js');
const companySpinRoutes = require('#core/routes/v1/companySpin.routes.core.js');
const opportunityRoutes = require('#core/routes/v1/opportunity.routes.core.js');
const pipelineStageRoutes = require('#core/routes/v1/pipelineStage.routes.core.js');
const territoryRoutes = require('#core/routes/v1/territory.routes.core.js');
const channelRoutes = require('#core/routes/v1/channel.routes.core.js');
const customerEnquiryStatusRoutes = require('#core/routes/v1/customerEnquiryStatus.routes.core.js');
const prospectPipelineRoutes = require('#core/routes/v1/prospectPipeline.routes.core.js');
const prospectProductRoutes = require('#core/routes/v1/prospectProduct.routes.core.js');
const opportunityCategoryRoutes = require('#core/routes/v1/opportunityCategory.routes.core.js');
const prospectPipelineStageRoutes = require('#core/routes/v1/prospectPipelineStage.routes.core.js');
const marketingListRoutes = require('#core/routes/v1/marketingList.routes.core.js');
const importRoutes = require('#core/routes/v1/import.routes.js');
const exportRoutes = require('#core/routes/v1/export.routes.js');
const undeleteRoutes = require('#core/routes/v1/undelete.routes.js');
const getBulkDetailRoutes = require('#core/routes/v1/getBulkDetail.routes.js');
const getInternalBulkDetailRoutes = require('#core/routes/v1/getInternalBulkDetail.routes.js');

dotenv.config();

const buildApp = ({ authMiddleware } = {}) => {
  const app = express();

  // Set auth middleware before route registration
  app.locals.authMiddleware = authMiddleware || require('#middlewares/auth.js');

  app.set('trust proxy', true);

  // Middleware
  app.use(traceId); // Add trace ID to all requests
  app.use(express.json({ limit: '10mb' })); // to convert request body to JSON with size limit
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(
    securityLogger({
      logAllRequests: process.env.NODE_ENV === 'development',
      logFailedAuth: true,
      logSuccessfulAuth: false,
      logSuspiciousActivity: true,
      logFileUploads: true,
    })
  ); // security logging and monitoring
  app.use(smartRateLimiter); // tiered rate limiting
  app.use(internalRequestHandler); // handle internal server requests
  app.use(createSchemaOptionsHandler({ authMiddleware: app.locals.authMiddleware })); // OPTIONS schema handler (protected, before CORS)
  app.use(conditionalCors); // enable CORS conditionally
  app.use(
    inputSanitizer({
      skipPaths: ['/api/v1/imports'], // Skip sanitization for file uploads
    })
  ); // input sanitization
  // secure app by setting various HTTP headers
  app.use(helmet.dnsPrefetchControl());
  app.use(helmet.frameguard());
  app.use(helmet.hidePoweredBy());
  app.use(helmet.hsts());
  app.use(helmet.ieNoOpen());
  app.use(helmet.noSniff());
  app.use(helmet.originAgentCluster());
  app.use(helmet.permittedCrossDomainPolicies());
  app.use(helmet.referrerPolicy());
  app.use(helmet.xssFilter());

  app.use('/api/v1/people', personRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/opportunity-pipelines', opportunityPipelineRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/relationships', relationshipRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/person-social-medias', personSocialMediaRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/prospect-categories', prospectCategoryRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/prospects', prospectRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/person-relationships', personRelationshipRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/person-relationship-histories', personRelationshipHistoryRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/company-contacts', companyContactRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/account-manager-in-companies', accountManagerInCompanyRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/territory-owners', territoryOwnerRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/sales-person-targets', salesPersonTargetRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/customer-enquiry-purposes', customerEnquiryPurposeRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/customer-enquiries', customerEnquiryRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/clients', clientRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/client-histories', clientHistoryRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/opportunity-influencers', opportunityInfluencerRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/social-media-types', socialMediaTypeRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/company-social-medias', companySocialMediaRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/action-plans', actionPlanRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/data-neededs', dataNeededRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/person-histories', personHistoryRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/call-lists', callListRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/call-list-pipeline-stages', callListPipelineStageRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/call-schedules', callScheduleRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/companies', companyRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/company-histories', companyHistoryRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/company-in-territories', companyInTerritoryRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/target-actual-histories', targetActualHistoryRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/person-in-marketing-lists', personInMarketingListRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/online-signups', onlineSignupRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/call-list-pipelines', callListPipelineRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/opportunity-products', opportunityProductRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/call-histories', callHistoryRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/opportunity-histories', opportunityHistoryRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/company-spins', companySpinRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/opportunities', opportunityRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/pipeline-stages', pipelineStageRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/territories', territoryRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/channels', channelRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/customer-enquiry-statuses', customerEnquiryStatusRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/prospect-pipelines', prospectPipelineRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/prospect-products', prospectProductRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/opportunity-categories', opportunityCategoryRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/prospect-pipeline-stages', prospectPipelineStageRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/marketing-lists', marketingListRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/imports', importRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/exports', exportRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/undeletes', undeleteRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/get-bulk-details', getBulkDetailRoutes({ auth: app.locals.authMiddleware }));
app.use('/api/v1/get-internal-bulk-details', getInternalBulkDetailRoutes({ auth: app.locals.authMiddleware }));
  app.use('/health', healthRoutes);
  app.use('/api/v1/health', healthRoutes);

  // Load custom domain routes (auto-discovered from src/domain/routes/v1)
  app.use('/api/v1', loadDomainRoutes(path.join(__dirname, 'domain/routes/v1'), { auth: app.locals.authMiddleware }));

  // Handle 404 routes
  app.use(notFound);

  // Enhanced error boundary middleware
  app.use(createBoundedErrorHandler(1000));

  // Legacy error handler (as fallback)
  app.use(errorHandler);

  return app;
};

const app = buildApp();

process.on('unhandledRejection', (reason, promise) => {
  logEvent(`[UNHANDLED_REJECTION]: ${reason} at promise: ${promise}`);
  // Don't exit the process in production, but log it
});

process.on('uncaughtException', (error) => {
  logEvent(`[UNCAUGHT_EXCEPTION]: ${error.message} Stack: ${error.stack}`);
  // Gracefully shutdown if needed
  process.exit(1);
});

process.on('SIGTERM', async () => {
  logEvent('[APP_SHUTDOWN] Received SIGTERM, shutting down gracefully');
  try {
    await shutdownDomainQueues();
  } catch (error) {
    logEvent(`[APP_SHUTDOWN] Queue shutdown error: ${error.message}`);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logEvent('[APP_SHUTDOWN] Received SIGINT, shutting down gracefully');
  try {
    await shutdownDomainQueues();
  } catch (error) {
    logEvent(`[APP_SHUTDOWN] Queue shutdown error: ${error.message}`);
  }
  process.exit(0);
});

/**
 * Initialize the application with interceptor registry.
 * Call this before starting the server.
 *
 * @param {Object} options
 * @param {Function} [options.authMiddleware] - Custom auth middleware (for testing)
 * @returns {Promise<Express>} Initialized Express app
 */
async function initializeApp(options = {}) {
  const initializedApp = buildApp({
    authMiddleware: options.authMiddleware,
  });

  try {
    // Initialize interceptor registry with auto-discovery
    const registry = await initializeRegistry();
    const registeredModels = registry.getRegisteredModels();

    if (registeredModels.length > 0) {
      logEvent(
        `[INTERCEPTORS] Registered models: ${registeredModels.join(', ')}`
      );
    } else {
      logEvent('[INTERCEPTORS] No model interceptors registered');
    }
  } catch (error) {
    logEvent(`[INTERCEPTORS] Registry initialization failed: ${error.message}`);
    // Continue without interceptors - they're optional
  }

  // Initialize domain queues and workers (for async processing)
  try {
    const { queues, workers } = await initializeDomainQueues();
    if (queues.size > 0 || workers.size > 0) {
      logEvent(
        `[DOMAIN_QUEUES] Initialized ${queues.size} queues, ${workers.size} workers`
      );
    }
  } catch (error) {
    logEvent(`[DOMAIN_QUEUES] Initialization failed: ${error.message}`);
    // Continue without queues - they gracefully fall back to sync processing
  }

  return initializedApp;
}

module.exports = app;
module.exports.initializeApp = initializeApp;
module.exports.getRegistry = getRegistry;
