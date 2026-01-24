/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains a controller function for un-deleting multiple records of various models in the database using Prisma.
 * It includes support for un-deleting records from models such as microservice, model definition, field definition, enum definition,
 * enum value, block group, block, instance, and instance log.
 *
 * The `undeleteBatch` function validates the request body to ensure it contains the necessary parameters, including the model name
 * and an array of record IDs to undelete. It then checks if the provided model is valid and proceeds to undelete the specified records
 * by setting their `deleted` field to null. The function returns the count of undeleted records in the response.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const { undeleteCreate } = require('#core/schemas/undelete.schemas.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { getVisibilityFilters } = require('#utils/visibilityUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/traceUtils.js');

async function undeleteBatch(req, res) {
  const { params, body, user } = req;

  logOperationStart('undeleteBatch', req, {
    model: params?.model,
    user: user?.id,
  });

  const models = [
    'person', 'opportunityPipeline', 'relationship', 'personSocialMedia', 'prospectCategory', 'prospect', 'personRelationship', 'personRelationshipHistory', 'companyContact', 'accountManagerInCompany', 'territoryOwner', 'salesPersonTarget', 'customerEnquiryPurpose', 'customerEnquiry', 'client', 'clientHistory', 'opportunityInfluencer', 'socialMediaType', 'companySocialMedia', 'actionPlan', 'dataNeeded', 'personHistory', 'callList', 'callListPipelineStage', 'callSchedule', 'company', 'companyHistory', 'companyInTerritory', 'targetActualHistory', 'personInMarketingList', 'onlineSignup', 'callListPipeline', 'opportunityProduct', 'callHistory', 'opportunityHistory', 'companySpin', 'opportunity', 'pipelineStage', 'territory', 'channel', 'customerEnquiryStatus', 'prospectPipeline', 'prospectProduct', 'opportunityCategory', 'prospectPipelineStage', 'marketingList'
  ];

  if (!models.includes(params?.model)) {
    const error = createErrorWithTrace(
      ERROR_TYPES.VALIDATION,
      'Invalid model.',
      req,
      {
        context: 'undelete_batch',
        severity: ERROR_SEVERITY.LOW,
        details: { model: params?.model },
      }
    );
    logOperationError('undeleteBatch', req, error);
    throw error;
  }

  let values;
  try {
    values = await undeleteCreate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('undeleteBatch', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'undelete_batch',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('undeleteBatch', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'undelete_batch',
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
    });
  }

  let result;
  try {
    logDatabaseStart('undelete_batch', req, {
      model: params?.model,
      ids: values?.ids,
    });
    const promises = values?.ids?.map((id) =>
      prisma[params.model].update({
        where: {
          id,
          ...getVisibilityFilters(user),
        },
        data: {
          deleted: null,
        },
      })
    );
    result = await prisma.$transaction(promises);
    logDatabaseSuccess('undelete_batch', req, {
      undeleted: result?.length ?? 0,
    });
  } catch (error) {
    logOperationError('undeleteBatch', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'undelete_batch',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('undeleteBatch', req, { undeleted: result?.length ?? 0 });
  res.status(200).json({ undeleted: result?.length ?? 0 });
}

module.exports = { undeleteBatch };
