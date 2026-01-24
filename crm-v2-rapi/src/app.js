/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
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
const internalRequestHandler = require('#middlewares/internalRequestHandler.js');
const conditionalCors = require('#middlewares/conditionalCors.js');
const notFound = require('#middlewares/notFound.js');
const errorHandler = require('#middlewares/errorHandler.js');
const { createBoundedErrorHandler } = require('#middlewares/errorBoundary.js');
const inputSanitizer = require('#middlewares/inputSanitizer.js');
const { securityLogger } = require('#middlewares/securityLogger.js');
const { smartRateLimiter } = require('#middlewares/rateLimiter.js');
const { logEvent } = require('#utils/shared/loggingUtils.js');
const traceId = require('#middlewares/traceId.js');

const personRelationshipRoutes = require('#routes/v1/personRelationship.routes.js');
const personRelationshipHistoryRoutes = require('#routes/v1/personRelationshipHistory.routes.js');
const companyContactRoutes = require('#routes/v1/companyContact.routes.js');
const accountManagerInCompanyRoutes = require('#routes/v1/accountManagerInCompany.routes.js');
const marketingListRoutes = require('#routes/v1/marketingList.routes.js');
const territoryOwnerRoutes = require('#routes/v1/territoryOwner.routes.js');
const salesPersonTargetRoutes = require('#routes/v1/salesPersonTarget.routes.js');
const customerEnquiryPurposeRoutes = require('#routes/v1/customerEnquiryPurpose.routes.js');
const customerEnquiryRoutes = require('#routes/v1/customerEnquiry.routes.js');
const clientRoutes = require('#routes/v1/client.routes.js');
const clientHistoryRoutes = require('#routes/v1/clientHistory.routes.js');
const opportunityInfluencerRoutes = require('#routes/v1/opportunityInfluencer.routes.js');
const socialMediaTypeRoutes = require('#routes/v1/socialMediaType.routes.js');
const companySocialMediaRoutes = require('#routes/v1/companySocialMedia.routes.js');
const actionPlanRoutes = require('#routes/v1/actionPlan.routes.js');
const dataNeededRoutes = require('#routes/v1/dataNeeded.routes.js');
const personHistoryRoutes = require('#routes/v1/personHistory.routes.js');
const callListRoutes = require('#routes/v1/callList.routes.js');
const callListPipelineStageRoutes = require('#routes/v1/callListPipelineStage.routes.js');
const callScheduleRoutes = require('#routes/v1/callSchedule.routes.js');
const companyRoutes = require('#routes/v1/company.routes.js');
const companyHistoryRoutes = require('#routes/v1/companyHistory.routes.js');
const personRoutes = require('#routes/v1/person.routes.js');
const companyInTerritoryRoutes = require('#routes/v1/companyInTerritory.routes.js');
const pipelineRoutes = require('#routes/v1/pipeline.routes.js');
const targetActualHistoryRoutes = require('#routes/v1/targetActualHistory.routes.js');
const personInMarketingListRoutes = require('#routes/v1/personInMarketingList.routes.js');
const onlineSignupRoutes = require('#routes/v1/onlineSignup.routes.js');
const callListPipelineRoutes = require('#routes/v1/callListPipeline.routes.js');
const relationshipRoutes = require('#routes/v1/relationship.routes.js');
const createBulkCompanyInTerritoriesRoutes = require('#routes/v1/createBulkCompanyInTerritories.routes.js');
const createBulkPersonInMarketingListsRoutes = require('#routes/v1/createBulkPersonInMarketingLists.routes.js');
const createBulkPersonRelationshipsRoutes = require('#routes/v1/createBulkPersonRelationships.routes.js');
const createBulkPersonInCallSchedulesRoutes = require('#routes/v1/createBulkPersonInCallSchedules.routes.js');
const opportunityProductRoutes = require('#routes/v1/opportunityProduct.routes.js');
const callHistoryRoutes = require('#routes/v1/callHistory.routes.js');
const opportunityHistoryRoutes = require('#routes/v1/opportunityHistory.routes.js');
const companySpinRoutes = require('#routes/v1/companySpin.routes.js');
const opportunityRoutes = require('#routes/v1/opportunity.routes.js');
const pipelineStageRoutes = require('#routes/v1/pipelineStage.routes.js');
const territoryRoutes = require('#routes/v1/territory.routes.js');
const channelRoutes = require('#routes/v1/channel.routes.js');
const customerEnquiryStatusRoutes = require('#routes/v1/customerEnquiryStatus.routes.js');
const personSocialMediaRoutes = require('#routes/v1/personSocialMedia.routes.js');
const importRoutes = require('#routes/v1/import.routes.js');
const exportRoutes = require('#routes/v1/export.routes.js');
const undeleteRoutes = require('#routes/v1/undelete.routes.js');
const getBulkDetailRoutes = require('#routes/v1/getBulkDetail.routes.js');
const resetRottingDaysOpportunitiesRoutes = require('#routes/v1/resetRottingDaysOpportunities.routes.js');
const getInternalBulkDetailRoutes = require('#routes/v1/getInternalBulkDetail.routes.js');
const createBulkOpportunitiesRoutes = require('#routes/v1/createBulkOpportunities.routes.js');
const getOrCreatePersonRoutes = require('#routes/v1/getOrCreatePerson.routes.js');
const personUnmaskedPhoneRoutes = require('#routes/v1/personUnmaskedPhone.routes.js');
const healthRoutes = require('#routes/v1/health.routes.js');
const prospectPipelineStageRoutes = require('#routes/v1/prospectPipelineStage.routes.js');
const prospectPipelineRoutes = require('#routes/v1/prospectPipeline.routes.js');
const prospectProductRoutes = require('#routes/v1/prospectProduct.routes.js');
const prospectRoutes = require('#routes/v1/prospect.routes.js');
const prospectCategoryRoutes = require('#routes/v1/prospectCategory.routes.js');
const opportunityCategoryRoutes = require('#routes/v1/opportunityCategory.routes.js');

dotenv.config();

const app = express();

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
app.use(conditionalCors); // enable CORS conditionally
app.use(
  inputSanitizer({
    skipPaths: ['/api/v1/import'], // Skip sanitization for file uploads
  })
); // input sanitization
// secure app by setting various HTTP headers
app.use(helmet.dnsPrefetchControl());
app.use(helmet.hidePoweredBy());
app.use(helmet.hsts());
app.use(helmet.ieNoOpen());
app.use(helmet.noSniff());
app.use(helmet.originAgentCluster());
app.use(helmet.permittedCrossDomainPolicies());
app.use(helmet.referrerPolicy());
app.use(helmet.xssFilter());

app.use('/api/v1/person-relationships', personRelationshipRoutes);
app.use(
  '/api/v1/person-relationship-histories',
  personRelationshipHistoryRoutes
);
app.use('/api/v1/company-contacts', companyContactRoutes);
app.use('/api/v1/account-manager-in-companies', accountManagerInCompanyRoutes);
// Legacy Django path parity
app.use('/api/v1/company-account-managers', accountManagerInCompanyRoutes);
app.use('/api/v1/marketing-lists', marketingListRoutes);
app.use('/api/v1/territory-owners', territoryOwnerRoutes);
app.use('/api/v1/sales-person-targets', salesPersonTargetRoutes);
app.use('/api/v1/customer-enquiry-purposes', customerEnquiryPurposeRoutes);
app.use('/api/v1/customer-enquiries', customerEnquiryRoutes);
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/client-histories', clientHistoryRoutes);
app.use('/api/v1/opportunity-influencers', opportunityInfluencerRoutes);
app.use('/api/v1/social-media-types', socialMediaTypeRoutes);
app.use('/api/v1/company-social-medias', companySocialMediaRoutes);
app.use('/api/v1/action-plans', actionPlanRoutes);
app.use('/api/v1/data-neededs', dataNeededRoutes);
app.use('/api/v1/person-histories', personHistoryRoutes);
app.use('/api/v1/call-lists', callListRoutes);
app.use('/api/v1/call-list-pipeline-stages', callListPipelineStageRoutes);
app.use('/api/v1/call-schedules', callScheduleRoutes);
app.use('/api/v1/companies', companyRoutes);
app.use('/api/v1/company-histories', companyHistoryRoutes);
app.use('/api/v1/persons', personRoutes);
app.use('/api/v1/company-in-territories', companyInTerritoryRoutes);
// Alias to match legacy Django path naming
app.use('/api/v1/company-territories', companyInTerritoryRoutes);
app.use('/api/v1/pipelines', pipelineRoutes);
app.use('/api/v1/target-actual-histories', targetActualHistoryRoutes);
app.use('/api/v1/person-in-marketing-lists', personInMarketingListRoutes);
// Alias to match legacy Django naming
app.use('/api/v1/person-marketing-lists', personInMarketingListRoutes);
app.use('/api/v1/online-signups', onlineSignupRoutes);
app.use('/api/v1/call-list-pipelines', callListPipelineRoutes);
app.use('/api/v1/relationships', relationshipRoutes);
app.use(
  '/api/v1/create-bulk-company-in-territories',
  createBulkCompanyInTerritoriesRoutes
);
app.use(
  '/api/v1/create-bulk-person-in-marketing-lists',
  createBulkPersonInMarketingListsRoutes
);
app.use(
  '/api/v1/create-bulk-person-relationships',
  createBulkPersonRelationshipsRoutes
);
app.use(
  '/api/v1/bulk-person-in-call-schedules',
  createBulkPersonInCallSchedulesRoutes
);
app.use('/api/v1/create-bulk-opportunities', createBulkOpportunitiesRoutes);
app.use('/api/v1/opportunity-products', opportunityProductRoutes);
app.use('/api/v1/call-histories', callHistoryRoutes);
app.use('/api/v1/opportunity-histories', opportunityHistoryRoutes);
app.use('/api/v1/company-spins', companySpinRoutes);
app.use('/api/v1/opportunities', opportunityRoutes);
app.use('/api/v1/pipeline-stages', pipelineStageRoutes);
app.use('/api/v1/territories', territoryRoutes);
app.use('/api/v1/channels', channelRoutes);
app.use('/api/v1/customer-enquiry-statuses', customerEnquiryStatusRoutes);
app.use('/api/v1/person-social-medias', personSocialMediaRoutes);
app.use('/api/v1/imports', importRoutes);
app.use('/api/v1/exports', exportRoutes);
app.use('/api/v1/undeletes', undeleteRoutes);
app.use('/api/v1/get-bulk-details', getBulkDetailRoutes);
// Legacy Django internal parity path
app.use('/api/v1/get-internal-bulk-details', getInternalBulkDetailRoutes);
// Legacy Django path parity
app.use(
  '/api/v1/reset-rotting-days-opportunities',
  resetRottingDaysOpportunitiesRoutes
);
// Legacy Django parity: /get-or-create-person/
app.use('/api/v1/get-or-create-person', getOrCreatePersonRoutes);
app.use('/api/v1/person-unmasked-phone', personUnmaskedPhoneRoutes);
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/prospect-pipeline-stages', prospectPipelineStageRoutes);
app.use('/api/v1/prospect-pipelines', prospectPipelineRoutes);
app.use('/api/v1/prospect-products', prospectProductRoutes);
app.use('/api/v1/prospects', prospectRoutes);
app.use('/api/v1/prospect-categories', prospectCategoryRoutes);
app.use('/api/v1/opportunity-categories', opportunityCategoryRoutes);

// Handle 404 routes
app.use(notFound);

// Enhanced error boundary middleware
app.use(createBoundedErrorHandler(1000));

// Legacy error handler (as fallback)
app.use(errorHandler);

process.on('unhandledRejection', (reason, promise) => {
  logEvent(`[UNHANDLED_REJECTION]: ${reason} at promise: ${promise}`);
  // Don't exit the process in production, but log it
});

process.on('uncaughtException', (error) => {
  logEvent(`[UNCAUGHT_EXCEPTION]: ${error.message} Stack: ${error.stack}`);
  // Gracefully shutdown if needed
  process.exit(1);
});

module.exports = app;
