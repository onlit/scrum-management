/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file defines business logic related to export queue using bullmq.
 *
 *
 */

const fs = require('fs');
const _ = require('lodash');
const { Worker } = require('bullmq');
const { Prisma } = require('@prisma/client');
const fastCsv = require('fast-csv');
const path = require('path');
const prisma = require('#configs/prisma.js');
const queueConfig = require('#configs/bullQueue.js');
const {
  prepareDataForCsvWriting,
} = require('#utils/importExportUtils.js');
const { logEvent } = require('#utils/loggingUtils.js');
const { toPascalCase } = require('#utils/stringUtils.js');

const exportWorker = new Worker(
  'exportQueue',
  async (job) => {
    const { user, modelName, query, modelsWithSpecificWhereConditions } =
      job.data;

    // Initialize where condition for database query
    const where = {};
    // Get specific where condition for the model if it exists
    const whereCondition = modelsWithSpecificWhereConditions[modelName];

    // Apply the specific where condition from query parameters if available
    if (whereCondition && query[whereCondition]) {
      where[whereCondition] = query[whereCondition];
    }

    // Find the first record to determine if there are any records to export and to define headers
    const found = await prisma[modelName].findFirst({
      where: { client: user?.client?.id, ...where }, // Apply filtering based on client and any additional conditions
    });

    // Determine default headers for CSV file based on model's datamodel
    const defaultHeader = Prisma.dmmf.datamodel.models
      .find((model) => model.name === toPascalCase(modelName)) // Find the model in Prisma's datamodel
      .fields.filter((r) => r.name !== 'deleted' && !('relationName' in r)) // Exclude 'deleted' field and relation fields
      .map(({ name }) => name); // Map to field names

    // Set headers based on found record or default headers
    const header = found ? Object.keys(found) : defaultHeader;

    // Prepare file name for CSV export
    const exportDate = new Date().toISOString().slice(0, 10); // Get current date in YYYY-MM-DD format
    const exportFilePath = path.join(
      '/tmp',
      `${modelName}-${exportDate}-export.csv`
    ); // Construct file name

    // Set up CSV stream with headers
    const csvStream = fastCsv.format({
      headers: header,
      writeHeaders: true,
    });

    // Create a writable stream for the export file
    const writableStream = fs.createWriteStream(exportFilePath);

    const writeCSV = new Promise((resolve, reject) => {
      // Event listener for when CSV file writing is completed
      writableStream.on('finish', () => {
        resolve(exportFilePath); // Resolve the promise when writing is finished
      });

      // Handle stream errors
      writableStream.on('error', (error) => {
        reject(error); // Reject the promise on error
      });

      // Pipe CSV stream to writable stream
      csvStream.pipe(writableStream);

      // If records are found, fetch and write data in batches
      if (found) {
        const batchSize = 1000; // Define batch size for data fetching
        let skip = 0; // Initialize skip for pagination
        let hasMore = true; // Flag to control loop

        const writeDataInBatches = async () => {
          // Loop to fetch and write data until no more records
          while (hasMore) {
            const data = await prisma[modelName].findMany({
              take: batchSize, // Number of records to fetch
              skip, // Number of records to skip for pagination
              where: { client: user?.client?.id, ...where }, // Apply filtering
            });

            // If no data is returned, end loop
            if (data.length === 0) {
              hasMore = false;
            } else {
              // Prepare data for CSV writing
              const withoutDeleted = data.map(prepareDataForCsvWriting);

              // Write each record to the CSV stream
              withoutDeleted.forEach((record) => {
                csvStream.write(record);
              });

              // Increment skip by batch size for next iteration
              skip += batchSize;
            }
          }

          // End the CSV stream outside the loop once all data has been written
          csvStream.end();
        };

        // Call the function to write data in batches
        writeDataInBatches().catch(reject); // Catch and forward any errors to the Promise's reject function
      } else {
        // If no records are found, write an empty array to the CSV
        csvStream.write([]);
      }
    });

    const result = await writeCSV;

    return result;
  },
  {
    connection: queueConfig.connection,
  }
);

exportWorker.on('completed', async (job, returnvalue) => {
  try {
    await prisma.dataExchangeLog.update({
      where: {
        id: job?.id,
      },
      data: {
        filePath: returnvalue,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  } catch (err) {
    logEvent(`[Error]: ${err.message} [Stack]: ${err?.stack}`);
  }
});

// exportWorker.on('progress', (job, progress) => {});

exportWorker.on('failed', async (job, error) => {
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

module.exports = exportWorker;
