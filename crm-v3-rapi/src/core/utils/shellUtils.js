/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file includes utilities for executing shell commands and managing subprocesses. It could provide abstraction over complex shell operations, facilitating the integration of shell commands into application logic.
 *
 *
 */
const path = require('path');
const { spawn } = require('child_process');
const { logStep, logEvent } = require('#utils/loggingUtils.js');
const { createStandardError } = require('#utils/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');

// Whitelist of allowed commands for security
const ALLOWED_COMMANDS = new Set(['npx', 'yarn', 'npm', 'node', 'git']);

// Input sanitization function
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    logEvent('[SHELL_UTILS_ERROR] Input must be a string');
    throw createStandardError(
      ERROR_TYPES.BAD_REQUEST,
      'Input must be a string',
      {
        severity: ERROR_SEVERITY.LOW,
        context: 'sanitize_input',
      }
    );
  }

  // Remove dangerous characters and sequences
  const sanitized = input
    .replace(/[;&|`$(){}[\]\\]/g, '') // Remove shell metacharacters
    .replace(/\.\./g, '') // Remove directory traversal attempts
    .trim();

  if (sanitized !== input) {
    logEvent(
      '[SHELL_UTILS_ERROR] Input contains potentially dangerous characters'
    );
    throw createStandardError(
      ERROR_TYPES.BAD_REQUEST,
      'Input contains potentially dangerous characters',
      {
        severity: ERROR_SEVERITY.LOW,
        context: 'sanitize_input',
      }
    );
  }

  return sanitized;
}

// Validate file paths
function validatePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    logEvent('[SHELL_UTILS_ERROR] Invalid file path');
    throw createStandardError(ERROR_TYPES.BAD_REQUEST, 'Invalid file path', {
      severity: ERROR_SEVERITY.LOW,
      context: 'validate_path',
    });
  }

  const normalizedPath = path.normalize(filePath);

  // Prevent directory traversal - only block relative paths with ..
  if (normalizedPath.includes('..')) {
    logEvent('[SHELL_UTILS_ERROR] Path traversal attempt detected');
    throw createStandardError(
      ERROR_TYPES.BAD_REQUEST,
      'Path traversal attempt detected',
      {
        severity: ERROR_SEVERITY.MEDIUM,
        context: 'validate_path',
      }
    );
  }

  return normalizedPath;
}

function runCommand(command, args, options = {}, logOutput = false) {
  return new Promise((resolve, reject) => {
    try {
      // Validate command is in whitelist
      if (!ALLOWED_COMMANDS.has(command)) {
        logEvent(`[SHELL_UTILS_ERROR] Command '${command}' is not allowed`);
        throw createStandardError(
          ERROR_TYPES.BAD_REQUEST,
          `Command '${command}' is not allowed`,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'run_command',
          }
        );
      }

      // Sanitize all arguments
      const sanitizedArgs = args.map((arg) => {
        if (typeof arg === 'string') {
          return sanitizeInput(arg);
        }
        return arg;
      });

      // Validate working directory if provided
      if (options.cwd) {
        options.cwd = validatePath(options.cwd);
      }

      const childProcess = spawn(command, sanitizedArgs, options);

      if (options?.stdio) {
        resolve(null);
        return;
      }

      let stdoutData = '';
      let stderrData = '';

      childProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
        if (logOutput) {
          logEvent(`[SHELL_STDOUT]: ${data.toString().trim()}`);
        }
      });

      childProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        if (logOutput) {
          logEvent(`[SHELL_STDERR]: ${data.toString().trim()}`);
        }
      });

      childProcess.on('exit', (code) => {
        if (code === 0) {
          resolve(stdoutData);
        } else {
          const error = new Error(
            `Command failed with code ${code}: ${stderrData}`
          );
          error.success = false;
          error.code = code;
          error.stdoutData = stdoutData;
          error.stderrData = stderrData;
          reject(error);
        }
      });

      childProcess.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      logEvent(`[SHELL_UTILS_ERROR] ${error.message}`);
      reject(error);
    }
  });
}

async function installPackagesWithLog(
  autoAPIPath,
  packages,
  description,
  isDev = false
) {
  const flags = isDev ? ['add', '-D'] : ['add'];
  await logStep(description, async () => {
    return runCommand('yarn', [...flags, ...packages], {
      cwd: autoAPIPath,
    });
  });
}

module.exports = {
  runCommand,
  installPackagesWithLog,
  sanitizeInput,
  validatePath,
};
