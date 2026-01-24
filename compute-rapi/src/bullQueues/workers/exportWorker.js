const fs = require('fs');
const _ = require('lodash');
const { Worker } = require('bullmq');
const { Prisma } = require('@prisma/client');
const fastCsv = require('fast-csv');
const path = require('path');
const prisma = require('#configs/prisma.js');
const queueConfig = require('#configs/bullQueue.js');
const { toPascalCase } = require('#utils/shared/stringUtils.js');
const {
  prepareDataForCsvWriting,
} = require('#utils/shared/importExportUtils.js');
const { logEvent } = require('#utils/shared/loggingUtils.js');

const exportWorker = new Worker(
  'exportQueue',
  async (job) => {
    const {
      user,
      modelName,
      query,
      modelsWithSpecificWhereConditions,
      // prettier
    } = job.data;

    const where = {};
    const whereCondition = modelsWithSpecificWhereConditions[modelName];

    if (whereCondition && query[whereCondition]) {
      where[whereCondition] = query[whereCondition];
    }

    const found = await prisma[modelName].findFirst({
      where: { client: user?.client?.id, ...where },
    });

    const defaultHeader = Prisma.dmmf.datamodel.models
      .find((model) => model.name === toPascalCase(modelName))
      .fields.filter(
        (row) => row.name !== 'deleted' && !('relationName' in row)
      )
      .map(({ name }) => name);

    const header = found ? Object.keys(found) : defaultHeader;

    const exportDate = new Date().toISOString().slice(0, 10);
    const exportFileName = `${modelName}-${exportDate}-export.csv`;
    const exportFilePath = path.join('/tmp', exportFileName);

    const csvStream = fastCsv.format({
      headers: header,
      writeHeaders: true,
    });

    const writableStream = fs.createWriteStream(exportFilePath);

    writableStream.on('finish', () => {
      console.log('CSV file writing completed');
      return exportFilePath;
    });

    writableStream.on('error', (error) => {
      console.log('Stream error:', error);
      return error;
    });

    csvStream.pipe(writableStream);

    if (found) {
      const batchSize = 1000;
      let skip = 0;
      let hasMore = true;

      while (hasMore) {
        const data = await prisma[modelName].findMany({
          take: batchSize,
          skip,
          where: { client: user?.client?.id, ...where },
        });

        if (data.length === 0) {
          hasMore = false;
        } else {
          const withoutDeleted = data.map(prepareDataForCsvWriting);

          withoutDeleted.forEach((record) => {
            csvStream.write(record);
          });

          skip += batchSize;
        }
      }

      csvStream.end();
    } else {
      csvStream.write([]);
    }
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
        status: 'Completed',
        completedAt: Date.now(),
      },
    });
  } catch (err) {
    logEvent(`[Error]: ${err.message} [Stack]: ${err?.stack}`);
  }
});

exportWorker.on('failed', async (job, error) => {
  try {
    await prisma.dataExchangeLog.update({
      where: {
        id: job?.id,
      },
      data: {
        status: 'Failed',
        failureReason: `[Error]: ${error.message} [Stack]: ${error?.stack}`,
        failedAt: Date.now(),
      },
    });
  } catch (err) {
    logEvent(`[Error]: ${err.message} [Stack]: ${err?.stack}`);
  }
});

module.exports = exportWorker;
