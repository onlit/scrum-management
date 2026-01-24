/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
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

const { initializeApp } = require('#src/app.js');
const { registerMicroservice, registerWithSystemV2 } = require('#utils/appRegUtils.js');

const PORT = process.env.PORT ?? 8000;
const host = process.env.APP_HOST ?? '127.0.0.1';

/**
 * Start the server with full initialization.
 */
async function startServer() {
  try {
    // Initialize app (includes interceptor registry)
    const app = await initializeApp();

    // Start listening
    app.listen(PORT, host, async (err) => {
      if (err) {
        console.log('Error starting the server:', err);
        process.exit(1);
        return;
      }

      console.log(
        `Started server on port ${PORT}, url: http://localhost:${PORT}`
      );

      await registerMicroservice();
      await registerWithSystemV2();
    });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
}

startServer();
