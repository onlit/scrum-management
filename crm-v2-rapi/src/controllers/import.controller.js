/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
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
  personRelationshipCreate,
  personRelationshipUpdate,
} = require('#schemas/personRelationship.schemas.js');
const {
  personRelationshipHistoryCreate,
  personRelationshipHistoryUpdate,
} = require('#schemas/personRelationshipHistory.schemas.js');
const {
  companyContactCreate,
  companyContactUpdate,
} = require('#schemas/companyContact.schemas.js');
const {
  accountManagerInCompanyCreate,
  accountManagerInCompanyUpdate,
} = require('#schemas/accountManagerInCompany.schemas.js');
const {
  marketingListCreate,
  marketingListUpdate,
} = require('#schemas/marketingList.schemas.js');
const {
  territoryOwnerCreate,
  territoryOwnerUpdate,
} = require('#schemas/territoryOwner.schemas.js');
const {
  salesPersonTargetCreate,
  salesPersonTargetUpdate,
} = require('#schemas/salesPersonTarget.schemas.js');
const {
  customerEnquiryPurposeCreate,
  customerEnquiryPurposeUpdate,
} = require('#schemas/customerEnquiryPurpose.schemas.js');
const {
  customerEnquiryCreate,
  customerEnquiryUpdate,
} = require('#schemas/customerEnquiry.schemas.js');
const { clientCreate, clientUpdate } = require('#schemas/client.schemas.js');
const {
  clientHistoryCreate,
  clientHistoryUpdate,
} = require('#schemas/clientHistory.schemas.js');
const {
  opportunityInfluencerCreate,
  opportunityInfluencerUpdate,
} = require('#schemas/opportunityInfluencer.schemas.js');
const {
  socialMediaTypeCreate,
  socialMediaTypeUpdate,
} = require('#schemas/socialMediaType.schemas.js');
const {
  companySocialMediaCreate,
  companySocialMediaUpdate,
} = require('#schemas/companySocialMedia.schemas.js');
const {
  actionPlanCreate,
  actionPlanUpdate,
} = require('#schemas/actionPlan.schemas.js');
const {
  dataNeededCreate,
  dataNeededUpdate,
} = require('#schemas/dataNeeded.schemas.js');
const {
  personHistoryCreate,
  personHistoryUpdate,
} = require('#schemas/personHistory.schemas.js');
const {
  callListCreate,
  callListUpdate,
} = require('#schemas/callList.schemas.js');
const {
  callListPipelineStageCreate,
  callListPipelineStageUpdate,
} = require('#schemas/callListPipelineStage.schemas.js');
const {
  callScheduleCreate,
  callScheduleUpdate,
} = require('#schemas/callSchedule.schemas.js');
const { companyCreate, companyUpdate } = require('#schemas/company.schemas.js');
const {
  companyHistoryCreate,
  companyHistoryUpdate,
} = require('#schemas/companyHistory.schemas.js');
const { personCreate, personUpdate } = require('#schemas/person.schemas.js');
const {
  companyInTerritoryCreate,
  companyInTerritoryUpdate,
} = require('#schemas/companyInTerritory.schemas.js');
const {
  pipelineCreate,
  pipelineUpdate,
} = require('#schemas/pipeline.schemas.js');
const {
  targetActualHistoryCreate,
  targetActualHistoryUpdate,
} = require('#schemas/targetActualHistory.schemas.js');
const {
  personInMarketingListCreate,
  personInMarketingListUpdate,
} = require('#schemas/personInMarketingList.schemas.js');
const {
  onlineSignupCreate,
  onlineSignupUpdate,
} = require('#schemas/onlineSignup.schemas.js');
const {
  callListPipelineCreate,
  callListPipelineUpdate,
} = require('#schemas/callListPipeline.schemas.js');
const {
  relationshipCreate,
  relationshipUpdate,
} = require('#schemas/relationship.schemas.js');
const {
  opportunityProductCreate,
  opportunityProductUpdate,
} = require('#schemas/opportunityProduct.schemas.js');
const {
  callHistoryCreate,
  callHistoryUpdate,
} = require('#schemas/callHistory.schemas.js');
const {
  opportunityHistoryCreate,
  opportunityHistoryUpdate,
} = require('#schemas/opportunityHistory.schemas.js');
const {
  companySpinCreate,
  companySpinUpdate,
} = require('#schemas/companySpin.schemas.js');
const {
  opportunityCreate,
  opportunityUpdate,
} = require('#schemas/opportunity.schemas.js');
const {
  pipelineStageCreate,
  pipelineStageUpdate,
} = require('#schemas/pipelineStage.schemas.js');
const {
  territoryCreate,
  territoryUpdate,
} = require('#schemas/territory.schemas.js');
const { channelCreate, channelUpdate } = require('#schemas/channel.schemas.js');
const {
  customerEnquiryStatusCreate,
  customerEnquiryStatusUpdate,
} = require('#schemas/customerEnquiryStatus.schemas.js');
const {
  personSocialMediaCreate,
  personSocialMediaUpdate,
} = require('#schemas/personSocialMedia.schemas.js');
const {
  prospectPipelineStageCreate,
  prospectPipelineStageUpdate,
} = require('#schemas/prospectPipelineStage.schemas.js');
const {
  prospectPipelineCreate,
  prospectPipelineUpdate,
} = require('#schemas/prospectPipeline.schemas.js');
const {
  prospectProductCreate,
  prospectProductUpdate,
} = require('#schemas/prospectProduct.schemas.js');
const {
  prospectCreate,
  prospectUpdate,
} = require('#schemas/prospect.schemas.js');
const {
  prospectCategoryCreate,
  prospectCategoryUpdate,
} = require('#schemas/prospectCategory.schemas.js');
const {
  opportunityCategoryCreate,
  opportunityCategoryUpdate,
} = require('#schemas/opportunityCategory.schemas.js');
const { deleteFileSync } = require('#utils/shared/fileUtils.js');
const {
  transformData,
  importBatch,
  updateBatch,
  hasRequiredRoles,
} = require('#utils/shared/importExportUtils.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const {
  createStandardError,
  handleDatabaseError,
} = require('#utils/shared/errorHandlingUtils.js');
const {
  ERROR_TYPES,
  ERROR_SEVERITY,
  DISPLAY_VALUE_PROP,
} = require('#configs/constants.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
  withTraceLogging,
} = require('#utils/shared/traceUtils.js');

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
      'personRelationship',
      'personRelationshipHistory',
      'companyContact',
      'accountManagerInCompany',
      'marketingList',
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
      'person',
      'companyInTerritory',
      'pipeline',
      'targetActualHistory',
      'personInMarketingList',
      'onlineSignup',
      'callListPipeline',
      'relationship',
      'opportunityProduct',
      'callHistory',
      'opportunityHistory',
      'companySpin',
      'opportunity',
      'pipelineStage',
      'territory',
      'channel',
      'customerEnquiryStatus',
      'personSocialMedia',
      'prospectPipelineStage',
      'prospectPipeline',
      'prospectProduct',
      'prospect',
      'prospectCategory',
      'opportunityCategory',
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
    if (modelName === 'marketingList') {
      createSchema = marketingListCreate;
      updateSchema = marketingListUpdate;
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
    if (modelName === 'person') {
      createSchema = personCreate;
      updateSchema = personUpdate;
    }
    if (modelName === 'companyInTerritory') {
      createSchema = companyInTerritoryCreate;
      updateSchema = companyInTerritoryUpdate;
    }
    if (modelName === 'pipeline') {
      createSchema = pipelineCreate;
      updateSchema = pipelineUpdate;
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
    if (modelName === 'relationship') {
      createSchema = relationshipCreate;
      updateSchema = relationshipUpdate;
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
    if (modelName === 'personSocialMedia') {
      createSchema = personSocialMediaCreate;
      updateSchema = personSocialMediaUpdate;
    }
    if (modelName === 'prospectPipelineStage') {
      createSchema = prospectPipelineStageCreate;
      updateSchema = prospectPipelineStageUpdate;
    }
    if (modelName === 'prospectPipeline') {
      createSchema = prospectPipelineCreate;
      updateSchema = prospectPipelineUpdate;
    }
    if (modelName === 'prospectProduct') {
      createSchema = prospectProductCreate;
      updateSchema = prospectProductUpdate;
    }
    if (modelName === 'prospect') {
      createSchema = prospectCreate;
      updateSchema = prospectUpdate;
    }
    if (modelName === 'prospectCategory') {
      createSchema = prospectCategoryCreate;
      updateSchema = prospectCategoryUpdate;
    }
    if (modelName === 'opportunityCategory') {
      createSchema = opportunityCategoryCreate;
      updateSchema = opportunityCategoryUpdate;
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
