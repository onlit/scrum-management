/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
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
// {{ROUTE_IMPORTS}}

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

  // {{ROUTE_USES}}
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
