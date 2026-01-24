const path = require('path');
const fs = require('fs');

// When true, console prints are suppressed unless explicitly forced.
let manualOnlyConsoleLogging = false;

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
  logEvent
};
