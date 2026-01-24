/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
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

const {
  personCreate,
  personUpdate,
} = require('#core/schemas/person.schema.core.js');
const {
  opportunityPipelineCreate,
  opportunityPipelineUpdate,
} = require('#core/schemas/opportunityPipeline.schema.core.js');
const {
  relationshipCreate,
  relationshipUpdate,
} = require('#core/schemas/relationship.schema.core.js');
const {
  personSocialMediaCreate,
  personSocialMediaUpdate,
} = require('#core/schemas/personSocialMedia.schema.core.js');
const {
  prospectCategoryCreate,
  prospectCategoryUpdate,
} = require('#core/schemas/prospectCategory.schema.core.js');
const {
  prospectCreate,
  prospectUpdate,
} = require('#core/schemas/prospect.schema.core.js');
const {
  personRelationshipCreate,
  personRelationshipUpdate,
} = require('#core/schemas/personRelationship.schema.core.js');
const {
  personRelationshipHistoryCreate,
  personRelationshipHistoryUpdate,
} = require('#core/schemas/personRelationshipHistory.schema.core.js');
const {
  companyContactCreate,
  companyContactUpdate,
} = require('#core/schemas/companyContact.schema.core.js');
const {
  accountManagerInCompanyCreate,
  accountManagerInCompanyUpdate,
} = require('#core/schemas/accountManagerInCompany.schema.core.js');
const {
  territoryOwnerCreate,
  territoryOwnerUpdate,
} = require('#core/schemas/territoryOwner.schema.core.js');
const {
  salesPersonTargetCreate,
  salesPersonTargetUpdate,
} = require('#core/schemas/salesPersonTarget.schema.core.js');
const {
  customerEnquiryPurposeCreate,
  customerEnquiryPurposeUpdate,
} = require('#core/schemas/customerEnquiryPurpose.schema.core.js');
const {
  customerEnquiryCreate,
  customerEnquiryUpdate,
} = require('#core/schemas/customerEnquiry.schema.core.js');
const {
  clientCreate,
  clientUpdate,
} = require('#core/schemas/client.schema.core.js');
const {
  clientHistoryCreate,
  clientHistoryUpdate,
} = require('#core/schemas/clientHistory.schema.core.js');
const {
  opportunityInfluencerCreate,
  opportunityInfluencerUpdate,
} = require('#core/schemas/opportunityInfluencer.schema.core.js');
const {
  socialMediaTypeCreate,
  socialMediaTypeUpdate,
} = require('#core/schemas/socialMediaType.schema.core.js');
const {
  companySocialMediaCreate,
  companySocialMediaUpdate,
} = require('#core/schemas/companySocialMedia.schema.core.js');
const {
  actionPlanCreate,
  actionPlanUpdate,
} = require('#core/schemas/actionPlan.schema.core.js');
const {
  dataNeededCreate,
  dataNeededUpdate,
} = require('#core/schemas/dataNeeded.schema.core.js');
const {
  personHistoryCreate,
  personHistoryUpdate,
} = require('#core/schemas/personHistory.schema.core.js');
const {
  callListCreate,
  callListUpdate,
} = require('#core/schemas/callList.schema.core.js');
const {
  callListPipelineStageCreate,
  callListPipelineStageUpdate,
} = require('#core/schemas/callListPipelineStage.schema.core.js');
const {
  callScheduleCreate,
  callScheduleUpdate,
} = require('#core/schemas/callSchedule.schema.core.js');
const {
  companyCreate,
  companyUpdate,
} = require('#core/schemas/company.schema.core.js');
const {
  companyHistoryCreate,
  companyHistoryUpdate,
} = require('#core/schemas/companyHistory.schema.core.js');
const {
  companyInTerritoryCreate,
  companyInTerritoryUpdate,
} = require('#core/schemas/companyInTerritory.schema.core.js');
const {
  targetActualHistoryCreate,
  targetActualHistoryUpdate,
} = require('#core/schemas/targetActualHistory.schema.core.js');
const {
  personInMarketingListCreate,
  personInMarketingListUpdate,
} = require('#core/schemas/personInMarketingList.schema.core.js');
const {
  onlineSignupCreate,
  onlineSignupUpdate,
} = require('#core/schemas/onlineSignup.schema.core.js');
const {
  callListPipelineCreate,
  callListPipelineUpdate,
} = require('#core/schemas/callListPipeline.schema.core.js');
const {
  opportunityProductCreate,
  opportunityProductUpdate,
} = require('#core/schemas/opportunityProduct.schema.core.js');
const {
  callHistoryCreate,
  callHistoryUpdate,
} = require('#core/schemas/callHistory.schema.core.js');
const {
  opportunityHistoryCreate,
  opportunityHistoryUpdate,
} = require('#core/schemas/opportunityHistory.schema.core.js');
const {
  companySpinCreate,
  companySpinUpdate,
} = require('#core/schemas/companySpin.schema.core.js');
const {
  opportunityCreate,
  opportunityUpdate,
} = require('#core/schemas/opportunity.schema.core.js');
const {
  pipelineStageCreate,
  pipelineStageUpdate,
} = require('#core/schemas/pipelineStage.schema.core.js');
const {
  territoryCreate,
  territoryUpdate,
} = require('#core/schemas/territory.schema.core.js');
const {
  channelCreate,
  channelUpdate,
} = require('#core/schemas/channel.schema.core.js');
const {
  customerEnquiryStatusCreate,
  customerEnquiryStatusUpdate,
} = require('#core/schemas/customerEnquiryStatus.schema.core.js');
const {
  prospectPipelineCreate,
  prospectPipelineUpdate,
} = require('#core/schemas/prospectPipeline.schema.core.js');
const {
  prospectProductCreate,
  prospectProductUpdate,
} = require('#core/schemas/prospectProduct.schema.core.js');
const {
  opportunityCategoryCreate,
  opportunityCategoryUpdate,
} = require('#core/schemas/opportunityCategory.schema.core.js');
const {
  prospectPipelineStageCreate,
  prospectPipelineStageUpdate,
} = require('#core/schemas/prospectPipelineStage.schema.core.js');
const {
  marketingListCreate,
  marketingListUpdate,
} = require('#core/schemas/marketingList.schema.core.js');
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
  baseMixins,
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
          },
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
              user,
            );
            updatedCount = updateResult.updatedCount;
            errorRows.push(...updateResult.errors);
            if (updateResult.recordsToCreate.length > 0) {
              const createFromUpdateResult = await importBatch(
                updateResult.recordsToCreate,
                modelName,
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
                },
              ),
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
      },
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
        },
      );
      logOperationError('importRecords', req, error);
      return next(error);
    }

    const models = [
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
        },
      );
      logOperationError('importRecords', req, error);
      return next(error);
    }

    let createSchema = Joi.object({});
    let updateSchema = Joi.object({});

    if (modelName === 'person') {
      createSchema = personCreate;
      updateSchema = personUpdate;
    }
    if (modelName === 'opportunityPipeline') {
      createSchema = opportunityPipelineCreate;
      updateSchema = opportunityPipelineUpdate;
    }
    if (modelName === 'relationship') {
      createSchema = relationshipCreate;
      updateSchema = relationshipUpdate;
    }
    if (modelName === 'personSocialMedia') {
      createSchema = personSocialMediaCreate;
      updateSchema = personSocialMediaUpdate;
    }
    if (modelName === 'prospectCategory') {
      createSchema = prospectCategoryCreate;
      updateSchema = prospectCategoryUpdate;
    }
    if (modelName === 'prospect') {
      createSchema = prospectCreate;
      updateSchema = prospectUpdate;
    }
    if (modelName === 'personRelationship') {
      createSchema = personRelationshipCreate;
      updateSchema = personRelationshipUpdate;
    }
    if (modelName === 'personRelationshipHistory') {
      createSchema = personRelationshipHistoryCreate;
      updateSchema = personRelationshipHistoryUpdate;
    }
    if (modelName === 'companyContact') {
      createSchema = companyContactCreate;
      updateSchema = companyContactUpdate;
    }
    if (modelName === 'accountManagerInCompany') {
      createSchema = accountManagerInCompanyCreate;
      updateSchema = accountManagerInCompanyUpdate;
    }
    if (modelName === 'territoryOwner') {
      createSchema = territoryOwnerCreate;
      updateSchema = territoryOwnerUpdate;
    }
    if (modelName === 'salesPersonTarget') {
      createSchema = salesPersonTargetCreate;
      updateSchema = salesPersonTargetUpdate;
    }
    if (modelName === 'customerEnquiryPurpose') {
      createSchema = customerEnquiryPurposeCreate;
      updateSchema = customerEnquiryPurposeUpdate;
    }
    if (modelName === 'customerEnquiry') {
      createSchema = customerEnquiryCreate;
      updateSchema = customerEnquiryUpdate;
    }
    if (modelName === 'client') {
      createSchema = clientCreate;
      updateSchema = clientUpdate;
    }
    if (modelName === 'clientHistory') {
      createSchema = clientHistoryCreate;
      updateSchema = clientHistoryUpdate;
    }
    if (modelName === 'opportunityInfluencer') {
      createSchema = opportunityInfluencerCreate;
      updateSchema = opportunityInfluencerUpdate;
    }
    if (modelName === 'socialMediaType') {
      createSchema = socialMediaTypeCreate;
      updateSchema = socialMediaTypeUpdate;
    }
    if (modelName === 'companySocialMedia') {
      createSchema = companySocialMediaCreate;
      updateSchema = companySocialMediaUpdate;
    }
    if (modelName === 'actionPlan') {
      createSchema = actionPlanCreate;
      updateSchema = actionPlanUpdate;
    }
    if (modelName === 'dataNeeded') {
      createSchema = dataNeededCreate;
      updateSchema = dataNeededUpdate;
    }
    if (modelName === 'personHistory') {
      createSchema = personHistoryCreate;
      updateSchema = personHistoryUpdate;
    }
    if (modelName === 'callList') {
      createSchema = callListCreate;
      updateSchema = callListUpdate;
    }
    if (modelName === 'callListPipelineStage') {
      createSchema = callListPipelineStageCreate;
      updateSchema = callListPipelineStageUpdate;
    }
    if (modelName === 'callSchedule') {
      createSchema = callScheduleCreate;
      updateSchema = callScheduleUpdate;
    }
    if (modelName === 'company') {
      createSchema = companyCreate;
      updateSchema = companyUpdate;
    }
    if (modelName === 'companyHistory') {
      createSchema = companyHistoryCreate;
      updateSchema = companyHistoryUpdate;
    }
    if (modelName === 'companyInTerritory') {
      createSchema = companyInTerritoryCreate;
      updateSchema = companyInTerritoryUpdate;
    }
    if (modelName === 'targetActualHistory') {
      createSchema = targetActualHistoryCreate;
      updateSchema = targetActualHistoryUpdate;
    }
    if (modelName === 'personInMarketingList') {
      createSchema = personInMarketingListCreate;
      updateSchema = personInMarketingListUpdate;
    }
    if (modelName === 'onlineSignup') {
      createSchema = onlineSignupCreate;
      updateSchema = onlineSignupUpdate;
    }
    if (modelName === 'callListPipeline') {
      createSchema = callListPipelineCreate;
      updateSchema = callListPipelineUpdate;
    }
    if (modelName === 'opportunityProduct') {
      createSchema = opportunityProductCreate;
      updateSchema = opportunityProductUpdate;
    }
    if (modelName === 'callHistory') {
      createSchema = callHistoryCreate;
      updateSchema = callHistoryUpdate;
    }
    if (modelName === 'opportunityHistory') {
      createSchema = opportunityHistoryCreate;
      updateSchema = opportunityHistoryUpdate;
    }
    if (modelName === 'companySpin') {
      createSchema = companySpinCreate;
      updateSchema = companySpinUpdate;
    }
    if (modelName === 'opportunity') {
      createSchema = opportunityCreate;
      updateSchema = opportunityUpdate;
    }
    if (modelName === 'pipelineStage') {
      createSchema = pipelineStageCreate;
      updateSchema = pipelineStageUpdate;
    }
    if (modelName === 'territory') {
      createSchema = territoryCreate;
      updateSchema = territoryUpdate;
    }
    if (modelName === 'channel') {
      createSchema = channelCreate;
      updateSchema = channelUpdate;
    }
    if (modelName === 'customerEnquiryStatus') {
      createSchema = customerEnquiryStatusCreate;
      updateSchema = customerEnquiryStatusUpdate;
    }
    if (modelName === 'prospectPipeline') {
      createSchema = prospectPipelineCreate;
      updateSchema = prospectPipelineUpdate;
    }
    if (modelName === 'prospectProduct') {
      createSchema = prospectProductCreate;
      updateSchema = prospectProductUpdate;
    }
    if (modelName === 'opportunityCategory') {
      createSchema = opportunityCategoryCreate;
      updateSchema = opportunityCategoryUpdate;
    }
    if (modelName === 'prospectPipelineStage') {
      createSchema = prospectPipelineStageCreate;
      updateSchema = prospectPipelineStageUpdate;
    }
    if (modelName === 'marketingList') {
      createSchema = marketingListCreate;
      updateSchema = marketingListUpdate;
    }

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
      baseMixins,
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
        },
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
      }),
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
