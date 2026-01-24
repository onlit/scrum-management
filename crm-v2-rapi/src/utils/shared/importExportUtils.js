/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file is expected to handle functionalities related to importing and exporting data, which may involve parsing files, converting data formats, and managing the transfer of data between different systems or formats.
 *
 *
 */
const { Prisma } = require('@prisma/client');
const prisma = require('#configs/prisma.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const { logEvent } = require('#utils/shared/loggingUtils.js');
const {
  createStandardError,
  handleDatabaseError,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');

function prepareDataForCsvWriting(row) {
  const { deleted, ...newRow } = row;
  for (const [key, value] of Object.entries(newRow)) {
    const dateColumns = ['createdAt', 'updatedAt'];

    if (dateColumns.includes(key)) {
      newRow[key] = new Date(value).toISOString();
    } else if (Array.isArray(value)) {
      newRow[key] = value.map((v) =>
        typeof v === 'object' && v !== null ? JSON.stringify(v) : v
      );
    } else if (typeof value === 'object' && value !== null) {
      newRow[key] = JSON.stringify(value);
    }
  }
  return newRow;
}

function transformData(data) {
  for (const key in data) {
    const value = data[key];

    // Remove keys where the key is 'id' and the value is an empty string
    if ((key === 'id' || key.endsWith('Id')) && value === '') {
      delete data[key];
      continue; // Skip further processing for this key
    }

    // Convert 'TRUE' and 'FALSE' strings to boolean values
    if (value === 'TRUE') {
      data[key] = true;
    } else if (value === 'FALSE') {
      data[key] = false;
    }

    if (value === 'null' || value === 'NULL' || value === 'Null') {
      data[key] = null;
    }

    // Convert stringified objects and arrays to actual objects and arrays
    if (
      typeof value === 'string' &&
      (value.startsWith('{') || value.startsWith('['))
    ) {
      try {
        const parsedValue = JSON.parse(value);
        if (Array.isArray(parsedValue) || typeof parsedValue === 'object') {
          data[key] = parsedValue;
        } else {
          data[key] = value; // Keep as string if parsing doesn't result in obj/array
        }
      } catch {
        data[key] = value; // Keep original string if parsing fails
      }
    }

    const isKeyLikert = key === 'likertLabels' || key === 'likertScores';

    if (isKeyLikert && typeof value === 'string') {
      // Check if string before split
      if (value.length) {
        let valueArr = value.split(',');

        if (key === 'likertScores') {
          valueArr = valueArr.map((r) => +r).filter((n) => !Number.isNaN(n)); // Convert to number, filter out NaN
        }

        if (valueArr.length > 5) {
          valueArr = valueArr.slice(0, 5); // Take only the first 5 items
        }

        data[key] = valueArr;
      } else {
        data[key] = [];
      }
    } else if (isKeyLikert && !Array.isArray(value)) {
      // Handle cases where it might already be parsed incorrectly or is not a string
      data[key] = [];
    }
  }
  return data;
}

async function importBatch(recordsToCreate, modelName) {
  let count = 0;
  if (!Array.isArray(recordsToCreate) || recordsToCreate.length === 0) {
    return { count: 0 }; // Return 0 if no records
  }
  if (typeof modelName !== 'string' || !modelName.trim()) {
    logEvent('[IMPORT_EXPORT_ERROR] modelName must be a non-empty string');
    throw createStandardError(
      ERROR_TYPES.BAD_REQUEST,
      'modelName must be a non-empty string',
      {
        severity: ERROR_SEVERITY.LOW,
        context: 'import_batch',
      }
    );
  }
  if (
    !prisma[modelName] ||
    typeof prisma[modelName].createMany !== 'function'
  ) {
    logEvent(
      `[IMPORT_EXPORT_ERROR] Invalid model name or model does not support createMany: ${modelName}`
    );
    throw createStandardError(
      ERROR_TYPES.BAD_REQUEST,
      `Invalid model name or model does not support createMany: ${modelName}`,
      {
        severity: ERROR_SEVERITY.LOW,
        context: 'import_batch',
      }
    );
  }
  try {
    const result = await prisma[modelName].createMany({
      data: recordsToCreate,
      skipDuplicates: true,
    });
    count = result.count;
    logEvent(
      `Batch create for ${modelName} successful: ${count} records created.`
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logEvent(
        `[IMPORT_EXPORT_ERROR] Prisma Known Error during createMany [${modelName}, Code: ${error.code}]: ${error.message}`
      );
    } else {
      logEvent(
        `[IMPORT_EXPORT_ERROR] Error during createMany [${modelName}]: ${error}`
      );
    }
    throw handleDatabaseError(error, `import_batch_${modelName}`);
  }
  recordsToCreate.length = 0;
  return { count };
}

async function updateBatch(recordsToUpdate, modelName, createSchema, user) {
  const recordsToCreateFromFailedUpdates = [];
  const updateErrors = []; // Store specific errors encountered here
  let successfulUpdateCount = 0;

  if (!Array.isArray(recordsToUpdate) || recordsToUpdate.length === 0) {
    return { updatedCount: 0, recordsToCreate: [], errors: [] };
  }

  if (!prisma[modelName] || typeof prisma[modelName].update !== 'function') {
    // Ensure the model exists and has the 'update' method (used individually now)
    throw new Error(
      `Invalid model name or model does not support update: ${modelName}`
    );
  }

  // Process updates individually to catch "Not Found" errors
  const updatePromises = recordsToUpdate.map(async (record) => {
    const { id, csvRow, ...dataToUpdate } = record; // Destructure id and csvRow (added earlier)

    // Clean data: remove fields not suitable for update (like createdBy if it exists)
    // Prisma's update often ignores fields not in the schema, but explicit cleaning is safer.
    const cleanData = { ...dataToUpdate };
    delete cleanData.createdBy; // Ensure createdBy is not in the update payload

    try {
      await prisma[modelName].update({
        where: { id },
        data: cleanData,
      });
      return { status: 'updated', id };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        // Record not found, prepare for creation
        return {
          status: 'notFound',
          id,
          originalData: record,
          csvRow,
        };
      }

      // Handle foreign key constraint violations
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        return {
          status: 'foreignKeyError',
          id,
          error: new Error(
            'Foreign key constraint failed: Please verify all referenced IDs exist'
          ),
          csvRow,
          originalData: record,
        };
      }

      // Handle unique constraint violations
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return {
          status: 'uniqueConstraintError',
          id,
          error: new Error(
            'Unique constraint violation: Record with these values already exists'
          ),
          csvRow,
          originalData: record,
        };
      }

      // Other update error
      console.log(
        `Error updating record ID ${id} for model ${modelName}:`,
        error?.message
      );
      return {
        status: 'error',
        id,
        error,
        csvRow,
        originalData: record,
      }; // Include original data and row number
    }
  });

  const results = await Promise.allSettled(updatePromises);

  // Process results
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const outcome = result.value;
      if (outcome.status === 'updated') {
        successfulUpdateCount++;
      } else if (outcome.status === 'notFound') {
        // Prepare data for creation
        const { id, csvRow, ...originalRecordData } = outcome.originalData; // Get original data, exclude id/csvRow

        // Validate this prepared data against the CREATE schema
        const { error: createValidationError, value: validatedCreateValue } =
          createSchema.validate(originalRecordData, {
            stripUnknown: true, // Important: remove fields not in create schema
            abortEarly: false,
          });

        if (createValidationError) {
          // Failed validation for creation attempt
          updateErrors.push({
            rowId: csvRow, // Use original CSV row number
            errors: [
              `Update failed (ID ${id} not found), and subsequent create validation failed: ${createValidationError.details
                .map((d) => d.message)
                .join(', ')}`,
            ],
            data: originalRecordData, // Show the data that failed create validation
          });
        } else {
          // Add successfully prepared and validated record to the list for batch creation
          recordsToCreateFromFailedUpdates.push({
            id,
            client: user?.client?.id,
            updatedBy: user?.id, // Always set updatedBy for update attempts
            createdBy: user?.id, // Set createdBy
            ...objectKeysToCamelCase(validatedCreateValue), // Ensure camelCase one last time
          });
        }
      } else if (outcome.status === 'foreignKeyError') {
        // Handle foreign key constraint violations
        updateErrors.push({
          rowId: outcome.csvRow,
          errors: [
            `Update failed for ID ${outcome.id}: ${
              outcome.error?.message || 'Foreign key constraint violation'
            }`,
          ],
          data: outcome.originalData,
        });
      } else if (outcome.status === 'uniqueConstraintError') {
        // Handle unique constraint violations
        updateErrors.push({
          rowId: outcome.csvRow,
          errors: [
            `Update failed for ID ${outcome.id}: ${
              outcome.error?.message || 'Unique constraint violation'
            }`,
          ],
          data: outcome.originalData,
        });
      } else if (outcome.status === 'error') {
        // Handle other errors encountered during update
        updateErrors.push({
          rowId: outcome.csvRow,
          errors: [
            `Update failed for ID ${outcome.id}: ${
              outcome.error?.message || 'Unknown error'
            }`,
          ],
          data: outcome.originalData,
        });
      }
    } else {
      // Promise itself rejected (unexpected issue)
      console.log(
        'Unexpected error during update promise settlement:',
        result.reason
      );
      // Try to find which record caused this, if possible (might be hard without more context)
      updateErrors.push({
        rowId: 'Unknown', // Cannot easily determine row ID here
        errors: [
          `An unexpected error occurred during update processing: ${
            result.reason?.message || 'Unknown reason'
          }`,
        ],
        data: {},
      });
    }
  }

  // Clear the original array
  recordsToUpdate.length = 0;

  return {
    updatedCount: successfulUpdateCount,
    recordsToCreate: recordsToCreateFromFailedUpdates,
    errors: updateErrors,
  };
}

function hasRequiredRoles(user) {
  if (!user || !Array.isArray(user.roleNames)) {
    throw new Error('Invalid user object');
  }
  const requiredRoles = ['Can Import/Export', 'Can Import/Export [Compute]'];
  if (user.roleNames.includes('System Administrator')) {
    return true;
  }
  return requiredRoles.some((role) => user.roleNames.includes(role));
}

module.exports = {
  prepareDataForCsvWriting,
  transformData,
  importBatch,
  updateBatch,
  hasRequiredRoles,
};
