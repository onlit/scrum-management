/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file defines business logic related to import queue using bullmq.
 *
 *
 */

const { Worker } = require('bullmq');
const fs = require('fs');
const csv = require('csv-parser');
const { v4: uuidv4 } = require('uuid');
const queueConfig = require('#configs/bullQueue.js');
const { objectKeysToCamelCase } = require('#utils/generalUtils.js');
const {
  parseAndAssignVisibilityAttributes,
} = require('#utils/visibilityUtils.js');
const { deleteFileSync } = require('#utils/fileUtils.js');
const {
  transformData,
  importBatch,
  updateBatch,
} = require('#utils/importExportUtils.js');
const prisma = require('#configs/prisma.js');
const { logEvent } = require('#utils/loggingUtils.js');

const importWorker = new Worker(
  'importQueue',
  async (job) => {
    const { user, filePath, schema, updateSchema, modelName } = job.data;

    // Initialize arrays to hold records for creation, update, and errors
    const recordsToCreate = [];
    const recordsToUpdate = [];
    const errorRows = [];
    const batchSize = 100; // Define batch size for processing records

    const importCSV = new Promise((resolve, reject) => {
      // Create a read stream from the CSV file and pipe it through csv-parser
      const stream = fs
        .createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          // Callback for each row of data in the CSV file
          const transformedData = transformData(data); // Transform data before validation
          const hasId = 'id' in data && data.id !== null && data.id !== ''; // Check if the record has an ID for updating
          const mixins = {
            // Common fields to mix into every record
            client: user?.client?.id,
            createdBy: user?.id,
            updatedBy: user?.id,
          };

          if (hasId) {
            // If record has an ID, validate against the update schema
            const { error, value } = updateSchema.validate(transformedData, {
              stripUnknown: true,
              abortEarly: false,
            });

            if (error) {
              // If validation fails, add the record to errorRows
              errorRows.push({
                rowId: errorRows.length + recordsToUpdate.length + 1,
                errors: error.details.map((detail) => detail.message),
                data: transformedData,
              });
            } else {
              // If validation passes, add the record to recordsToUpdate
              recordsToUpdate.push({
                ...mixins,
                ...objectKeysToCamelCase(value),
                id: transformedData.id,
              });
            }
          } else {
            // If record does not have an ID, validate against the creation schema
            const { error, value } = schema.validate(transformedData, {
              stripUnknown: true,
              abortEarly: false,
            });

            if (error) {
              // If validation fails, add the record to errorRows
              errorRows.push({
                rowId: errorRows.length + recordsToCreate.length + 1,
                errors: error.details.map((detail) => detail.message),
                data: transformedData,
              });
            } else {
              // If validation passes, add the record to recordsToCreate with additional processing
              recordsToCreate.push({
                ...mixins,
                ...objectKeysToCamelCase(value),
                ...parseAndAssignVisibilityAttributes({
                  body: transformedData,
                  user,
                  noDefaults: false,
                }),
                id: uuidv4(), // Generate a new UUID for the record
              });
            }
          }

          // Process records in batches for creation
          if (recordsToCreate.length >= batchSize) {
            importBatch(recordsToCreate, modelName);
          }
          // Process records in batches for update
          if (recordsToUpdate.length >= batchSize) {
            updateBatch(recordsToUpdate, modelName);
          }
        })
        .on('end', async () => {
          // Once the stream ends, process any remaining records
          if (recordsToCreate.length > 0) {
            importBatch(recordsToCreate, modelName);
          }
          if (recordsToUpdate.length > 0) {
            updateBatch(recordsToUpdate, modelName);
          }

          // Clean up by deleting the temporary file
          deleteFileSync(filePath);

          // Once all processing is done, resolve the Promise with a summary
          resolve({
            message: errorRows.length
              ? 'Failed to import some rows'
              : 'Data imported successfully',
            importedRowsCount: recordsToCreate.length + recordsToUpdate.length,
            errorsRowsCount: errorRows.length,
            errorRows,
          });
        });

      stream.on('error', (error) => {
        // Ensure temporary file is deleted on error
        deleteFileSync(filePath);
        // Handle any errors during the streaming process
        reject(error);
      });
    });

    const result = await importCSV;

    return result;
  },
  {
    connection: queueConfig.connection,
  }
);

importWorker.on('completed', async (job, returnvalue) => {
  try {
    await prisma.dataExchangeLog.update({
      where: {
        id: job?.id,
      },
      data: {
        status: 'COMPLETED',
        importedRowsCount: returnvalue?.importedRowsCount,
        errorsRowsCount: returnvalue?.errorsRowsCount,
        metaData: returnvalue?.metaData,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    logEvent(`[Error]: ${err.message} [Stack]: ${err?.stack}`);
  }
});

// importWorker.on('progress', (job, progress) => {});

importWorker.on('failed', async (job, error) => {
  try {
    await prisma.dataExchangeLog.update({
      where: {
        id: job?.id,
      },
      data: {
        status: 'FAILED',
        failureReason: `[Error]: ${error.message} [Stack]: ${error?.stack}`,
        failedAt: new Date(),
      },
    });
  } catch (err) {
    logEvent(`[Error]: ${err.message} [Stack]: ${err?.stack}`);
  }
});

module.exports = importWorker;
