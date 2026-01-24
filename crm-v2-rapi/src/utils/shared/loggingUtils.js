/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains utilities for application logging. It would include functionalities for formatting log messages, setting log levels, and possibly integrating with external logging frameworks or services, aiming to standardize logging practices within the application.
 *
 *
 */
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

module.exports = { logStep, logEvent };
