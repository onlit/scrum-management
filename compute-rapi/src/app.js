const express = require('express');
const dotenv = require('dotenv');
const helmet = require('helmet');
const notFound = require('#middlewares/notFound.js');
const errorHandler = require('#middlewares/errorHandler.js');
const { createBoundedErrorHandler } = require('#middlewares/errorBoundary.js');
const inputSanitizer = require('#middlewares/inputSanitizer.js');
const { securityLogger } = require('#middlewares/securityLogger.js');
const { smartRateLimiter } = require('#middlewares/rateLimiter.js');
const { logEvent } = require('#utils/shared/loggingUtils.js');
const traceId = require('#middlewares/traceId.js');
const internalRequestHandler = require('#middlewares/internalRequestHandler.js');
const conditionalCors = require('#middlewares/conditionalCors.js');

const microserviceRoutes = require('#routes/v1/microservice.routes.js');
const modelRoutes = require('#routes/v1/model.routes.js');
const modelFieldRoutes = require('#routes/v1/modelField.routes.js');
const enumDefnRoutes = require('#routes/v1/enumDefn.routes.js');
const enumValueRoutes = require('#routes/v1/enumValue.routes.js');
const computeMicroserviceRoutes = require('#routes/v1/computeMicroservice.routes.js');
const generateMicroserviceErdRoutes = require('#routes/v1/generateMicroserviceErd.routes.js');
const importRoutes = require('#routes/v1/import.routes.js');
const exportRoutes = require('#routes/v1/export.routes.js');
const blockGroupRoutes = require('#routes/v1/blockGroup.routes.js');
const blockRoutes = require('#routes/v1/block.routes.js');
const instanceRoutes = require('#routes/v1/instance.routes.js');
const instanceLogRoutes = require('#routes/v1/instanceLog.routes.js');
const undeleteRoutes = require('#routes/v1/undelete.routes.js');
const menuDefnRoutes = require('#routes/v1/menuDefn.routes.js');
const languageRoutes = require('#routes/v1/language.routes.js');
const translationRoutes = require('#routes/v1/translation.routes.js');
const getBulkDetailRoutes = require('#routes/v1/getBulkDetail.routes.js');
const healthRoutes = require('#routes/v1/health.routes.js');
const fieldDependencyRuleRoutes = require('#routes/v1/fieldDependencyRule.routes.js');
const fieldGroupRoutes = require('#routes/v1/fieldGroup.routes.js');
const translationSyncRoutes = require('#routes/v1/translationSync.routes.js');
const queueStatusRoutes = require('#routes/v1/queueStatus.routes.js');
const dashboardConfigRoutes = require('#routes/v1/dashboardConfig.routes.js');
const dashboardMetricRoutes = require('#routes/v1/dashboardMetric.routes.js');
const dashboardWidgetRoutes = require('#routes/v1/dashboardWidget.routes.js');
const dashboardFilterRoutes = require('#routes/v1/dashboardFilter.routes.js');
const widgetDateConfigRoutes = require('#routes/v1/widgetDateConfig.routes.js');

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

// Routes
app.use('/api/v1/microservices', microserviceRoutes);
app.use('/api/v1/models', modelRoutes);
app.use('/api/v1/model-fields', modelFieldRoutes);
app.use('/api/v1/enum-defns', enumDefnRoutes);
app.use('/api/v1/enum-values', enumValueRoutes);
app.use('/api/v1/compute-microservice', computeMicroserviceRoutes);
app.use('/api/v1/generate-microservice-erd', generateMicroserviceErdRoutes);
app.use('/api/v1/block-groups', blockGroupRoutes);
app.use('/api/v1/blocks', blockRoutes);
app.use('/api/v1/instances', instanceRoutes);
app.use('/api/v1/instance-logs', instanceLogRoutes);
app.use('/api/v1/menu-defns', menuDefnRoutes);
app.use('/api/v1/languages', languageRoutes);
app.use('/api/v1/translations', translationRoutes);
app.use('/api/v1/import', importRoutes);
app.use('/api/v1/export', exportRoutes);
app.use('/api/v1/undelete', undeleteRoutes);
app.use('/api/v1/get-bulk-details', getBulkDetailRoutes);
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/field-dependency-rules', fieldDependencyRuleRoutes);
app.use('/api/v1/field-groups', fieldGroupRoutes);
app.use('/api/v1/translation-sync', translationSyncRoutes);
app.use('/api/v1/queue', queueStatusRoutes);
app.use('/api/v1/dashboard-configs', dashboardConfigRoutes);
app.use('/api/v1/dashboard-metrics', dashboardMetricRoutes);
app.use('/api/v1/dashboard-widgets', dashboardWidgetRoutes);
app.use('/api/v1/dashboard-filters', dashboardFilterRoutes);
app.use('/api/v1/widget-date-configs', widgetDateConfigRoutes);

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
