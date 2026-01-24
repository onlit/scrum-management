/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This script is designed to initiate the server for a microservices-based application, leveraging an Express app configuration. It dynamically configures the server's port and host settings based on environment variables, ensuring flexibility and adaptability to different deployment environments.
 *
 * The startup process involves:
 * - Dynamic Configuration: Utilizes environment variables to set the server's port (`PORT`) and host (`APP_HOST`), with defaults for local development environments.
 * - Server Initialization: Starts the Express server on the configured port and host. It listens for incoming connections, making the application accessible over the network.
 * - Error Handling: Implements basic error handling during server startup. If the server fails to start, the process exits with a non-zero status code, and an error message is logged.
 * - Microservice Registration: Calls `registerMicroservice()` to perform any necessary initial setup or registration processes for the microservice. This could involve setting up connections to external services, registering the service with a service discovery mechanism, or other initialization tasks specific to the microservice's functionality.
 *
 * This script contains the code required to get an express microservice app running and ready to serve requests, highlighting the separation of concerns by keeping the server configuration and startup logic modular and separate from the application's business logic.
 */

const app = require('#src/app.js');
const { registerMicroservice } = require('#utils/shared/appRegUtils.js');
const prisma = require('#configs/prisma.js');
const { logEvent } = require('#utils/shared/loggingUtils.js');

const PORT = process.env.PORT ?? 8000;
const host = process.env.APP_HOST ?? '127.0.0.1';

const server = app.listen(PORT, host, async (err) => {
  if (err) {
    process.exit(1); // Exit if the server cannot start
    return console.log('Error starting the server:', err);
  }

  console.log(`Started server on port ${PORT}, url: http://localhost:${PORT}`);

  await registerMicroservice();
});

async function gracefulShutdown(signal) {
  try {
    logEvent(`[APP_SHUTDOWN] Received ${signal}, shutting down gracefully`);
  } catch (e) {
    // fallback to console if logger fails
    console.log(`[APP_SHUTDOWN] Received ${signal}, shutting down gracefully`);
  }

  const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS || 10000);

  // Stop accepting new connections
  const closeServer = new Promise((resolve) => {
    try {
      server.close(() => resolve());
    } catch (e) {
      resolve();
    }
  });

  // Force-continue after timeout
  const timeout = new Promise((resolve) =>
    setTimeout(resolve, SHUTDOWN_TIMEOUT_MS)
  );

  try {
    await Promise.race([closeServer, timeout]);
  } catch (_) {}

  // Disconnect Prisma
  try {
    await prisma.$disconnect();
  } catch (_) {}

  process.exit(0);
}

process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.once('SIGINT', () => gracefulShutdown('SIGINT'));
