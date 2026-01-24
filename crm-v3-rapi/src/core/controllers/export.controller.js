/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file implements a feature to export database records to CSV files,
 * focusing on systems that handle diverse models with specific query conditions.
 * It incorporates modules for file operations (fs), utility functions (lodash),
 * CSV handling (fast-csv), and database interaction (Prisma).
 *
 * The `exportRecords` function encapsulates the core functionality, performing steps to:
 * - Verify user permissions for data export.
 * - Validate the requested model against a list of eligible models.
 * - Construct and execute a database query based on model and request parameters.
 * - Determine CSV headers from the model's data model or queried records.
 * - Setup and manage a CSV stream linked to a file stream, including error handling.
 * - Batch fetch and write records to the CSV, utilizing pagination for efficiency.
 * - Close the CSV stream once data export is completed.
 *
 *
 */

const fs = require('fs');
const _ = require('lodash');
const path = require('path');
const fastCsv = require('fast-csv');
const { Prisma } = require('@prisma/client');
const prisma = require('#configs/prisma.js');
const {
  prepareDataForCsvWriting,
  hasRequiredRoles,
} = require('#utils/importExportUtils.js');
const { handleDatabaseError } = require('#utils/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { toPascalCase } = require('#utils/stringUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  logWithTrace,
  createErrorWithTrace,
} = require('#utils/traceUtils.js');

const MODELS_WITH_SPECIFIC_WHERE_CONDITIONS = {
  // {{MODELS_WITH_SPECIFIC_WHERE_CONDITIONS}}
};

const EXPORTABLE_MODELS = [
  ...Object.keys(MODELS_WITH_SPECIFIC_WHERE_CONDITIONS),
  'person',
  'opportunityPipeline',
  'relationship',
  'personSocialMedia',
  'prospectCategory',
  'prospect',
  'personRelationship',
  'personRelationshipHistory',
  'companyContact',
  'accountManagerInCompany',
  'territoryOwner',
  'salesPersonTarget',
  'customerEnquiryPurpose',
  'customerEnquiry',
  'client',
  'clientHistory',
  'opportunityInfluencer',
  'socialMediaType',
  'companySocialMedia',
  'actionPlan',
  'dataNeeded',
  'personHistory',
  'callList',
  'callListPipelineStage',
  'callSchedule',
  'company',
  'companyHistory',
  'companyInTerritory',
  'targetActualHistory',
  'personInMarketingList',
  'onlineSignup',
  'callListPipeline',
  'opportunityProduct',
  'callHistory',
  'opportunityHistory',
  'companySpin',
  'opportunity',
  'pipelineStage',
  'territory',
  'channel',
  'customerEnquiryStatus',
  'prospectPipeline',
  'prospectProduct',
  'opportunityCategory',
  'prospectPipelineStage',
  'marketingList',
];

const exportRecords = async (req, res, next) => {
  const { user, params, query } = req;

  logOperationStart('exportRecords', req, {
    user: user?.id,
    modelName: params?.modelName,
    queryKeys: Object.keys(query),
  });

  try {
    // Check user permissions
    if (!hasRequiredRoles(user)) {
      const error = createErrorWithTrace(
        ERROR_TYPES.AUTHORIZATION,
        'Sorry, you do not have permissions to export.',
        req,
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'export_permission_check',
          details: { user: user?.id },
        },
      );
      logOperationError('exportRecords', req, error);
      throw error;
    }

    const { modelName } = params;

    if (!EXPORTABLE_MODELS.includes(modelName)) {
      const error = createErrorWithTrace(
        ERROR_TYPES.BAD_REQUEST,
        'Invalid model for export.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'export_model_validation',
          details: { modelName, supportedModels: EXPORTABLE_MODELS },
        },
      );
      logOperationError('exportRecords', req, error);
      throw error;
    }

    const where = {};
    const whereCondition = MODELS_WITH_SPECIFIC_WHERE_CONDITIONS[modelName];

    if (whereCondition && query[whereCondition]) {
      where[whereCondition] = query[whereCondition];
    }

    logDatabaseStart('export_find_first_record', req, {
      modelName,
      whereCondition,
      user: user?.id,
    });

    const found = await prisma[modelName].findFirst({
      where: { client: user?.client?.id, ...where },
    });

    logDatabaseSuccess('export_find_first_record', req, {
      found: !!found,
      modelName,
    });

    const defaultHeader = Prisma.dmmf.datamodel.models
      .find((model) => model.name === toPascalCase(modelName))
      .fields.filter(
        (row) => row.name !== 'deleted' && !('relationName' in row),
      )
      .map(({ name }) => name);

    const header = found ? Object.keys(found) : defaultHeader;

    const exportDate = new Date().toISOString().slice(0, 10);
    const exportFileName = `${modelName}-${exportDate}-export.csv`;
    const exportFilePath = path.join('/tmp', exportFileName);

    logWithTrace('Setting up CSV export stream', req, {
      fileName: exportFileName,
      headerCount: header.length,
    });

    const writableStream = fs.createWriteStream(exportFilePath);

    writableStream.on('finish', () => {
      logWithTrace('CSV file write completed', req, {
        fileName: exportFileName,
        filePath: exportFilePath,
      });

      res.download(exportFilePath, (err) => {
        if (err) {
          const error = createErrorWithTrace(
            ERROR_TYPES.INTERNAL,
            'Error sending the file.',
            req,
            {
              severity: ERROR_SEVERITY.HIGH,
              context: 'file_download',
              originalError: err,
            },
          );
          logOperationError('exportRecords', req, error);
          next(error);
        }
        // Clean up the file after sending
        fs.unlink(exportFilePath, () => {
          logWithTrace('Export file cleaned up', req, {
            fileName: exportFileName,
          });
        });
      });
    });

    writableStream.on('error', (err) => {
      const error = createErrorWithTrace(
        ERROR_TYPES.INTERNAL,
        `An error occurred while exporting data to CSV: ${err.message}`,
        req,
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'csv_export_stream',
          originalError: err,
        },
      );
      logOperationError('exportRecords', req, error);
      next(error);
    });

    if (found) {
      const csvStream = fastCsv.format({
        headers: header,
        writeHeaders: true,
      });

      csvStream.pipe(writableStream);

      const batchSize = 1000;
      let skip = 0;
      let hasMore = true;
      let totalProcessed = 0;

      logWithTrace('Starting batch data export', req, {
        batchSize,
        modelName,
      });

      while (hasMore) {
        logDatabaseStart('export_batch_fetch', req, {
          modelName,
          skip,
          batchSize,
        });

        const data = await prisma[modelName].findMany({
          take: batchSize,
          skip,
          where: { client: user?.client?.id, ...where },
        });

        logDatabaseSuccess('export_batch_fetch', req, {
          modelName,
          batchSize: data.length,
          skip,
        });

        if (data.length === 0) {
          hasMore = false;
        } else {
          const withoutDeleted = data.map(prepareDataForCsvWriting);
          withoutDeleted.forEach((record) => {
            csvStream.write(record);
          });
          totalProcessed += data.length;
          skip += batchSize;

          logWithTrace('Batch processed', req, {
            modelName,
            batchSize: data.length,
            totalProcessed,
          });
        }
      }

      logWithTrace('Data export completed', req, {
        modelName,
        totalProcessed,
      });

      csvStream.end();
    } else {
      // No records found: write header-only CSV and end stream
      const headerLine = `${header.join(',')}\n`;
      writableStream.write(headerLine);
      writableStream.end();
    }

    logOperationSuccess('exportRecords', req, {
      modelName,
      fileName: exportFileName,
      totalProcessed: found ? 'batch-processed' : 0,
    });
  } catch (error) {
    logOperationError('exportRecords', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    // Handle database-specific errors
    throw handleDatabaseError(error, 'export_operation');
  }
};

module.exports = { exportRecords };
