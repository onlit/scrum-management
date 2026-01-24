/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file implements a feature to import records from a CSV file into a database,
 * with support for multiple models. It utilizes modules such as fs for file system operations,
 * Joi for data validation, csv-parser for parsing CSV files, and uuid for generating UUIDs.
 *
 * The `importRecords` function is the core functionality, which performs the following steps:
 * - Verifies user permissions for import/export operations.
 * - Validates the requested model against a list of allowed models.
 * - Initializes validation schemas based on the model being imported.
 * - Reads the CSV file using a stream, transforms data, and validates each row against
 *   creation or update schemas.
 * - Processes records in batches for creation or update.
 * - Generates a response summarizing the import process, including information on imported
 *   rows and any errors encountered.
 * - Deletes the temporary CSV file after processing.
 *
 */

const fs = require('fs');
const csv = require('csv-parser');
const Joi = require('joi');

// MODEL_SCHEMA_IMPORTS
const { deleteFileSync } = require('#utils/fileUtils.js');
const {
  transformData,
  importBatch,
  updateBatch,
  hasRequiredRoles,
} = require('#utils/importExportUtils.js');
const { objectKeysToCamelCase } = require('#utils/generalUtils.js');
const {
  createStandardError,
  handleDatabaseError,
} = require('#utils/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
  withTraceLogging,
} = require('#utils/traceUtils.js');

// Helper function to process the stream and return a Promise
function processCsvFile(
  filePath,
  user,
  modelName,
  createSchema,
  updateSchema,
  baseMixins
) {
  return new Promise((resolve, reject) => {
    const recordsToCreate = [];
    const recordsToUpdate = [];
    const errorRows = [];
    let rowCounter = 0;

    const readStream = fs.createReadStream(filePath);

    readStream
      .pipe(csv())
      .on('error', (streamError) => {
        readStream.destroy();
        const error = createStandardError(
          ERROR_TYPES.INTERNAL,
          `Error reading CSV file: ${streamError.message}`,
          {
            severity: ERROR_SEVERITY.HIGH,
            context: 'csv_file_reading',
            originalError: streamError,
          }
        );
        reject(error);
      })
      .on('data', (data) => {
        rowCounter++;
        const currentCsvRow = rowCounter + 1;
        const transformedData = transformData({ ...data });
        const hasId =
          'id' in transformedData &&
          transformedData.id !== null &&
          transformedData.id !== '';

        if (hasId) {
          const { error, value } = updateSchema.validate(transformedData, {
            stripUnknown: true,
            abortEarly: false,
          });
          if (error) {
            errorRows.push({
              rowId: currentCsvRow,
              errors: error.details.map((detail) => detail.message),
              data,
            });
          } else {
            recordsToUpdate.push({
              ...baseMixins,
              ...objectKeysToCamelCase(value),
              id: transformedData.id,
              csvRow: currentCsvRow,
            });
          }
        } else {
          const createMixins = { ...baseMixins, createdBy: user?.id };
          const { error, value } = createSchema.validate(transformedData, {
            stripUnknown: true,
            abortEarly: false,
          });
          if (error) {
            errorRows.push({
              rowId: currentCsvRow,
              errors: error.details.map((detail) => detail.message),
              data,
            });
          } else {
            recordsToCreate.push({
              ...createMixins,
              ...objectKeysToCamelCase(value),
            });
          }
        }
      })
      .on('end', async () => {
        try {
          let createdCount = 0;
          let updatedCount = 0;
          let updateToCreateCount = 0;

          if (recordsToCreate.length > 0) {
            const createResult = await importBatch(recordsToCreate, modelName);
            createdCount = createResult.count;
          }

          if (recordsToUpdate.length > 0) {
            const updateResult = await updateBatch(
              recordsToUpdate,
              modelName,
              createSchema,
              user
            );
            updatedCount = updateResult.updatedCount;
            errorRows.push(...updateResult.errors);
            if (updateResult.recordsToCreate.length > 0) {
              const createFromUpdateResult = await importBatch(
                updateResult.recordsToCreate,
                modelName
              );
              updateToCreateCount = createFromUpdateResult.count;
            }
          }

          const totalImported = createdCount + updateToCreateCount;
          const totalProcessed =
            totalImported + updatedCount + errorRows.length;

          resolve({
            message:
              errorRows.length > 0
                ? `Import process completed with ${errorRows.length} errors.`
                : 'Data imported successfully.',
            totalCsvRows: rowCounter,
            processedRows: totalProcessed,
            createdRowsCount: createdCount,
            updatedRowsCount: updatedCount,
            updateAttemptCreatedRowCount: updateToCreateCount,
            errorRowsCount: errorRows.length,
            errorRows,
            status: errorRows.length ? 422 : 200,
          });
        } catch (processingError) {
          // Handle database errors specifically
          if (
            processingError.code &&
            (processingError.code.startsWith('P') ||
              processingError.name === 'PrismaClientKnownRequestError')
          ) {
            reject(handleDatabaseError(processingError, 'csv_data_processing'));
          } else if (
            processingError.type &&
            Object.values(ERROR_TYPES).includes(processingError.type)
          ) {
            // Already a standardized error, pass it through
            reject(processingError);
          } else {
            // Create a standardized error for unknown errors
            reject(
              createStandardError(
                ERROR_TYPES.INTERNAL,
                processingError.message ||
                  'An error occurred during data processing.',
                {
                  severity: ERROR_SEVERITY.HIGH,
                  context: 'csv_data_processing',
                  originalError: processingError,
                }
              )
            );
          }
        }
      });
  });
}

// Main function to import records from a CSV file
const importRecords = async (req, res, next) => {
  const { user, params } = req;
  const filePath = req.file?.path;

  logOperationStart('importRecords', req, {
    user: user?.id,
    modelName: params?.modelName,
  });

  if (!filePath) {
    const error = createErrorWithTrace(
      ERROR_TYPES.BAD_REQUEST,
      'No file uploaded.',
      req,
      {
        severity: ERROR_SEVERITY.LOW,
        context: 'file_upload_validation',
      }
    );
    logOperationError('importRecords', req, error);
    return next(error);
  }

  try {
    if (!hasRequiredRoles(user)) {
      const error = createErrorWithTrace(
        ERROR_TYPES.AUTHORIZATION,
        'Sorry, you do not have permissions to import.',
        req,
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'import_permission_check',
        }
      );
      logOperationError('importRecords', req, error);
      return next(error);
    }

    const models = [
      // MODELS_LIST_CAMEL_CASE
    ];

    const { modelName } = params;

    if (!models.includes(modelName)) {
      const error = createErrorWithTrace(
        ERROR_TYPES.BAD_REQUEST,
        'Invalid model for import.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'model_validation',
          details: { modelName, supportedModels: models },
        }
      );
      logOperationError('importRecords', req, error);
      return next(error);
    }

    let createSchema = Joi.object({});
    let updateSchema = Joi.object({});

    // MODEL_TO_SCHEMA_MAP

    const baseMixins = {
      client: user?.client?.id,
      updatedBy: user?.id,
    };

    logDatabaseStart('process_csv_file', req, { modelName });
    const result = await processCsvFile(
      filePath,
      user,
      modelName,
      createSchema,
      updateSchema,
      baseMixins
    );
    logDatabaseSuccess('process_csv_file', req, { status: result.status });

    if (result.status >= 400) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        result.message,
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'csv_processing',
          details: { validationErrors: result.errorRows },
        }
      );
      logOperationError('importRecords', req, error);
      return next(error);
    }

    logOperationSuccess('importRecords', req, { status: result.status });
    res.status(result.status).json(result);
  } catch (error) {
    logOperationError('importRecords', req, error);
    // Re-throw if it's already a standardized error - Express errorHandler will handle it
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      return next(error);
    }
    // Handle database errors specifically
    if (
      error.code &&
      (error.code.startsWith('P') ||
        error.name === 'PrismaClientKnownRequestError')
    ) {
      return next(handleDatabaseError(error, 'import_operation'));
    }
    // Handle all other errors using centralized error handler
    return next(
      createErrorWithTrace(ERROR_TYPES.INTERNAL, error.message, req, {
        context: 'import_operation',
        originalError: error,
      })
    );
  } finally {
    if (filePath) {
      try {
        deleteFileSync(filePath);
      } catch (delErr) {
        // Logging file deletion error with trace
        logOperationError('importRecords', req, delErr);
      }
    }
  }
};

module.exports = {
  importRecords: withTraceLogging(importRecords, 'importRecords'),
};
