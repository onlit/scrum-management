const prisma = require('#configs/prisma.js');
const { createStandardError } = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
} = require('#utils/shared/visibilityUtils.js');
const { logEvent } = require('./basicLoggingUtils.js');

/**
 * Asynchronously logs a process step by executing an action and logging the outcome.
 * It validates the step code before executing the provided action and logs the result as 'Completed' or 'Failed'.
 *
 * @param {Object} options An object containing stepCode, instanceId, body, and user information.
 * @param {Function} action The asynchronous action to be executed.
 * @throws {Error} Throws an error if the step code is invalid or if the action execution fails.
 * @returns {Promise<*>} The result of the executed action if successful.
 */
async function logStep(options, action) {
  // Destructuring options with default empty object to prevent accessing properties on undefined.
  const { stepCode, instanceId, body = {}, user } = options ?? {};

  // Find the block using the provided step code
  const found = await prisma.block.findFirst({
    where: {
      code: stepCode,
    },
  });

  // Throw an error if no block is found for the step code
  if (!found) {
    throw createStandardError(
      ERROR_TYPES.VALIDATION,
      `Invalid step code: ${stepCode}.`,
      {
        severity: ERROR_SEVERITY.LOW,
        context: 'logging_step_validation',
        details: { stepCode },
      }
    );
  }

  try {
    // Execute the provided action
    const result = await action();

    // Log the successful execution of the action
    await prisma.instanceLog.create({
      data: buildCreateRecordPayload({
        validatedValues: {
          instanceId,
          blockId: found.id,
          status: 'Completed',
        },
        requestBody: body,
        user,
      }),
    });

    return result;
  } catch (error) {
    // Log the failed execution of the action along with the error message
    await prisma.instanceLog.create({
      data: buildCreateRecordPayload({
        validatedValues: {
          instanceId,
          blockId: found.id,
          status: 'Failed',
          message: error.message,
        },
        requestBody: body,
        user,
      }),
    });

    // Re-throw the error for further handling
    throw error;
  }
}

/**
 * Log a generation phase with detailed tracking.
 * Creates an InstanceLog entry for phase-level tracking.
 * This is a best-effort operation - failures are logged but don't propagate.
 *
 * @param {Object} options - Logging options
 * @param {string} options.instanceId - Instance ID
 * @param {string} options.phase - Phase name (API_GENERATION, FRONTEND_GENERATION, DEVOPS_GENERATION, GIT_OPERATIONS)
 * @param {string} options.status - Status (Started, InProgress, Completed, Failed)
 * @param {Object} options.user - User object for visibility
 * @param {string} options.traceId - Trace ID for log correlation
 * @param {Object} [options.metadata] - Additional metadata to include in the log
 */
async function logPhase({ instanceId, phase, status, user, traceId, metadata = {} }) {
  const phaseCode = `PHASE-${phase.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;

  try {
    // Find the block for this phase (if it exists)
    let block = await prisma.block.findFirst({
      where: { code: phaseCode },
    });

    // If block exists, create InstanceLog entry
    if (block) {
      const processStatus = status === 'Completed' ? 'Completed' :
                            status === 'Failed' ? 'Failed' : 'Processing';

      await prisma.instanceLog.create({
        data: buildCreateRecordPayload({
          validatedValues: {
            instanceId,
            blockId: block.id,
            status: processStatus,
            message: JSON.stringify({
              phase,
              status,
              traceId,
              timestamp: new Date().toISOString(),
              ...metadata,
            }),
          },
          requestBody: {},
          user,
        }),
      });
    }

    // Also log to file with traceId for correlation
    const errorInfo = metadata.error ? ` - ${metadata.error}` : '';
    logEvent(`[PHASE:${phase}] ${status}${errorInfo}`, traceId);
  } catch (logError) {
    // Best-effort logging - don't fail the generation if logging fails
    logEvent(`[PHASE:${phase}] Failed to create InstanceLog: ${logError?.message}`, traceId);
  }
}

module.exports = { logStep, logEvent, logPhase };
