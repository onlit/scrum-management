const path = require('path');
const { modifyFile } = require('#utils/shared/fileUtils.js');
const { logWithTrace } = require('#utils/shared/traceUtils.js');

function updateOrAddEnvVarInDockerfile(content, envVar, envValue, context) {
  const envLine = `ENV ${envVar}=${envValue}`;
  const regex = new RegExp(`^ENV\\s+${envVar}=.*`, 'm'); // Regex to find existing ENV variable

  let newDockerfileContents;

  // Check if the ENV variable already exists
  if (regex.test(content)) {
    // If it exists, replace the line
    newDockerfileContents = content.replace(regex, envLine);
    logWithTrace(`Replaced existing ENV variable: ${envVar}`, context);
  } else {
    // Find the last occurrence of an ENV variable and insert the new ENV after it
    const envRegex = /^ENV\s+.*$/gm;
    const matches = [...content.matchAll(envRegex)]; // Get all ENV lines
    if (matches.length > 0) {
      const lastEnvIndex = matches[matches.length - 1].index; // Get the index of the last ENV line
      const insertionPoint =
        lastEnvIndex + matches[matches.length - 1][0].length;

      // Insert the new ENV line after the last ENV
      newDockerfileContents = `${content.slice(0, insertionPoint)}\n${envLine}${content.slice(insertionPoint)}`;
      logWithTrace(
        `Added new ENV variable: ${envVar} after the last ENV`,
        context
      );
    }
  }

  return newDockerfileContents;
}

/**
 * Extracts the highest port number from all "start_and_wait" calls in the script content.
 * @param {string} content The content of the commands.sh file.
 * @returns {number|null} The highest port number found, or null if none are found.
 */
function extractHighestPort(content) {
  const regex = /start_and_wait "[^"]+"\s+(\d+)/g; // Matches the port in start_and_wait calls
  const matches = [...content.matchAll(regex)];
  const portNumbers = matches.map((match) => parseInt(match[1], 10));
  return portNumbers.length > 0 ? Math.max(...portNumbers) : null;
}

/**
 * Updates the commands.sh script to add a new microservice if it doesn't already exist.
 * @param {{ mainApp: { path: string }, microserviceSlug: string }} options
 * @returns {number} The port number for the microservice (either existing or newly assigned).
 */
function updateCommandsSh({ mainApp, microserviceSlug }) {
  let newPort;
  const filePath = path.join(mainApp?.path, 'commands.sh');
  const microservicePath = `apps/${microserviceSlug}`;

  modifyFile(filePath, (content) => {
    // Regular expression to find the line for the specific microservice
    const slugRegex = new RegExp(`start_and_wait "${microservicePath}" (\\d+)`);
    const slugMatch = content.match(slugRegex);

    if (slugMatch) {
      // If the microservice already exists, extract its port and make no changes
      newPort = parseInt(slugMatch[1], 10);
      return content;
    }

    // If the microservice is new, find the highest port and add 1
    const highestPort = extractHighestPort(content);
    newPort = highestPort ? highestPort + 1 : 3001; // Default to 3001 if no services exist yet

    const newLine = `start_and_wait "${microservicePath}" ${newPort}`;
    const insertionMarker =
      '# --- Start the main application in the foreground ---';

    // Insert the new line and a blank line for readability before the main app starts
    return content.replace(insertionMarker, `${newLine}\n\n${insertionMarker}`);
  });

  return newPort;
}

module.exports = {
  updateOrAddEnvVarInDockerfile,
  updateCommandsSh,
};
