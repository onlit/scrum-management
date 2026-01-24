const { execSync } = require('child_process');
const path = require('path');
const {
  createStandardError,
  withErrorHandling,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { logWithTrace } = require('#utils/shared/traceUtils.js');

const inputFilePath = process.env.ERD_INPUT_FILE;
const outputFilePath = process.env.ERD_OUTPUT_FILE;
const puppeteerConfigFile = process.env.PUPPETEER_CONFIG_FILE;

function validateFilePath(filePath, name) {
  if (!filePath) {
    throw new Error(`${name} environment variable must be set`);
  }

  // Validate that the path doesn't contain dangerous characters
  if (/[;&|`$]/.test(filePath)) {
    throw new Error(`${name} contains invalid characters`);
  }

  // Resolve to absolute path to prevent directory traversal
  return path.resolve(filePath);
}

function validateScale(scale) {
  const numScale = Number(scale);
  if (!Number.isInteger(numScale) || numScale < 1 || numScale > 100) {
    throw new Error('Scale must be an integer between 1 and 100');
  }
  return numScale;
}

const main = withErrorHandling(async ({ traceId = null } = {}) => {
  try {
    const validatedInputPath = validateFilePath(
      inputFilePath,
      'ERD_INPUT_FILE'
    );
    const validatedOutputPath = validateFilePath(
      outputFilePath,
      'ERD_OUTPUT_FILE'
    );
    const validatedConfigPath = puppeteerConfigFile
      ? validateFilePath(puppeteerConfigFile, 'PUPPETEER_CONFIG_FILE')
      : null;
    const scale = validateScale(15);
    const args = [
      '-i',
      validatedInputPath,
      '-o',
      validatedOutputPath,
      '-s',
      scale.toString(),
    ];
    if (validatedConfigPath) {
      args.push('-p', validatedConfigPath);
    }
    require('child_process').execSync('mmdc', args, { stdio: 'inherit' });
    logWithTrace('Mermaid diagram converted successfully', { traceId });
  } catch (error) {
    logWithTrace(
      'Error converting Mermaid diagram',
      { traceId },
      { error: error?.message }
    );
    throw createStandardError(
      ERROR_TYPES.INTERNAL,
      'Error converting Mermaid diagram',
      {
        severity: ERROR_SEVERITY.MEDIUM,
        context: 'convert_mermaid',
        details: { traceId, error: error?.message },
        originalError: error,
      }
    );
  }
}, 'convert_mermaid');

main({ traceId: process.env.TRACE_ID });
