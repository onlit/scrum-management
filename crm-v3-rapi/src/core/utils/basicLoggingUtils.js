/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module provides a basic logging utility for the application.
 * It is designed to avoid dependencies on other modules to prevent circular imports.
 *
 * The primary function, `logEvent`, allows logging of messages with optional trace IDs.
 * Log entries are timestamped, printed to the console, and appended to a daily log file
 * in a dedicated logs directory. The utility ensures the log directory exists and
 * gracefully handles file write errors without interrupting application flow.
 *
 * This utility is intended for general-purpose logging across the application,
 * especially in shared or foundational code where minimal dependencies are required.
 */
const path = require('path');
const fs = require('fs');

// When true, console prints are suppressed unless explicitly forced.
const manualOnlyConsoleLogging = false;

/**
 * Basic logging utility that doesn't depend on other modules to avoid circular dependencies
 * @param {string} logMessage - The message to log
 * @param {string|null} traceId - Optional trace ID for request tracking
 * @param {boolean} [forcePrint=false] - When true, prints to console even if manual-only mode is enabled
 */
function logEvent(logMessage, traceId = null, forcePrint = false) {
  const logsDir = path.join('/tmp', 'logs');
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const logFilename = `${today}-logs.txt`;
  const logFilePath = path.join(logsDir, logFilename);

  // Format message with traceId if provided
  const formattedMessage = traceId
    ? `[TraceID: ${traceId}] ${logMessage}`
    : logMessage;

  // Ensure the logs directory exists
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Format the timestamp for the log entry
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ${formattedMessage}\n`;

  if (!manualOnlyConsoleLogging || forcePrint) {
    console.log(logEntry);
  }

  // Append the log message to the file (creates the file if it doesn't exist)
  fs.appendFile(logFilePath, logEntry, (err) => {
    if (err) {
      // Don't throw - logging failures should never crash the application
    }
  });
}

module.exports = {
  logEvent,
};
