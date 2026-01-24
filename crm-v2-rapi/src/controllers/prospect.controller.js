/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 09/10/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing prospect using Prisma.
 * It includes functions for retrieving all prospect, creating a new prospect, retrieving a single prospect,
 * updating an existing prospect, and deleting a prospect.
 *
 * The `getAllProspect` function retrieves a paginated list of prospect based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createProspect` function validates the request body using a Joi schema, generates a unique code
 * for the prospect, and creates a new prospect in the database with additional metadata.
 *
 * The `getProspect` function retrieves a single prospect based on the provided prospect ID, with visibility
 * filters applied to ensure the prospect is accessible to the requesting user.
 *
 * The `updateProspect` function updates an existing prospect in the database based on the provided prospect ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteProspect` function deletes a prospect from the database based on the provided prospect ID, with
 * visibility filters applied to ensure the prospect is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  prospectCreate,
  prospectUpdate,
} = require('#schemas/prospect.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const {
  getPaginatedList,
  verifyForeignKeyAccessBatch,
} = require('#utils/shared/databaseUtils.js');
const { getDetailsFromAPI } = require('#utils/shared/apiUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
  logWithTrace,
} = require('#utils/shared/traceUtils.js');
const {
  handleDatabaseError,
  handleValidationError,
} = require('#utils/shared/errorHandlingUtils.js');
const {
  findWorkflowAndTrigger,
  triggerAutomata,
} = require('#utils/shared/automataUtils.js');
const {
  attachNestedDisplayValues,
  enrichRecordDisplayValues,
} = require('#utils/shared/displayValueUtils.js');

async function getAllProspect(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllProspect', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['interestSummary', 'tags', 'color'];
    const filterFields = [
      ...searchFields,
      'personId',
      'ownerId',
      'sourceCampaignId',
      'categoryId',
      'statusId',
      'prospectPipelineId',
      'qualificationScore',
      'temperature',
      'disqualificationReason',
    ];

    const include = {
      person: true,
      category: true,
      status: true,
      prospectPipeline: true,
    };

    // Log database operation start
    logDatabaseStart('get_all_prospect', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: prospectUpdate,
      filterFields,
      searchFields,
      model: 'prospect',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values to all prospects (including nested relations)
    if (response?.results) {
      response.results = response.results.map((prospect) =>
        enrichRecordDisplayValues(
          attachNestedDisplayValues(prospect, [
            { relation: 'category', model: 'ProspectCategory' },
            { relation: 'status', model: 'ProspectPipelineStage' },
          ]),
          'Prospect'
        )
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_prospect', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllProspect', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllProspect', req, error);
    throw handleDatabaseError(error, 'get_all_prospect');
  }
}

async function createProspect(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createProspect', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await prospectCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createProspect', req, error);
        throw handleValidationError(error, 'prospect_creation');
      }
      logOperationError('createProspect', req, error);
      throw error;
    }

    const modelRelationFields = [
      'personId',
      'categoryId',
      'statusId',
      'prospectPipelineId',
      'sourceCampaignId',
    ];

    const include = {
      person: true,
      category: true,
      status: true,
      prospectPipeline: true,
    };

    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.personId
          ? { model: 'person', fieldValues: { personId: values.personId } }
          : null,
        values?.categoryId
          ? {
              model: 'prospectCategory',
              fieldValues: { categoryId: values.categoryId },
            }
          : null,
        values?.statusId
          ? {
              model: 'prospectPipelineStage',
              fieldValues: { statusId: values.statusId },
            }
          : null,
        values?.prospectPipelineId
          ? {
              model: 'prospectPipeline',
              fieldValues: { prospectPipelineId: values.prospectPipelineId },
            }
          : null,
      ].filter(Boolean),
    });

    // Log database operation start
    logDatabaseStart('create_prospect', req, {
      personId: values.personId,
      userId: user?.id,
    });

    const newProspect = await prisma.prospect.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_prospect', req, {
      id: newProspect.id,
    });

    let [newProspectWithDetails] = [newProspect];
    try {
      [newProspectWithDetails] = await getDetailsFromAPI({
        results: [newProspect],
        token: user?.accessToken,
      });
    } catch (_e) {
      [newProspectWithDetails] = [newProspect];
    }

    // Attach display value
    const prospectWithDisplayValue = enrichRecordDisplayValues(
      attachNestedDisplayValues(newProspectWithDetails, [
        { relation: 'category', model: 'ProspectCategory' },
        { relation: 'status', model: 'ProspectPipelineStage' },
      ]),
      'Prospect'
    );

    // Log operation success
    logOperationSuccess('createProspect', req, {
      id: newProspect.id,
    });

    res.status(201).json(prospectWithDisplayValue);

    // Fire-and-forget workflow trigger AFTER response for lower latency
    (async () => {
      try {
        const requestedWorkflowId = values?.workflowId;

        const payloadData = {
          ...newProspect,
          // Person info
          person_id: newProspect?.person?.id || '',
          person_first_name: newProspect?.person?.firstName || '',
          person_middle_name: newProspect?.person?.middleName || '',
          person_last_name: newProspect?.person?.lastName || '',
          person_email: newProspect?.person?.email || '',
          person_personal_mobile: newProspect?.person?.personalMobile || '',
          person_home_phone: newProspect?.person?.homePhone || '',

          // Prospect info
          category_id: newProspect?.category?.id || '',
          category_name: newProspect?.category?.name || '',
          status_id: newProspect?.status?.id || '',
          status_name: newProspect?.status?.name || '',
          prospect_pipeline_id: newProspect?.prospectPipeline?.id || '',
          prospect_pipeline_name: newProspect?.prospectPipeline?.name || '',
          qualification_score: newProspect?.qualificationScore || 0,
          interest_summary: newProspect?.interestSummary || '',
          temperature: newProspect?.temperature || '',
          disqualification_reason: newProspect?.disqualificationReason || '',
        };

        if (requestedWorkflowId) {
          // Direct workflow trigger when workflowId is provided
          const automataResponse = await triggerAutomata(
            user?.accessToken,
            requestedWorkflowId,
            '',
            false,
            payloadData
          );

          if (automataResponse?.instance) {
            await prisma.prospect.updateMany({
              where: { id: newProspect.id },
              data: {
                workflowId: requestedWorkflowId,
                workflowInstanceId: automataResponse.instance,
              },
            });
            logWithTrace('Automata workflow triggered (prospect)', req, {
              workflowId: requestedWorkflowId,
              prospectId: newProspect.id,
            });
          } else {
            logWithTrace('Automata workflow trigger failed (prospect)', req, {
              prospectId: newProspect.id,
            });
          }
        } else {
          // Fallback: discover and trigger workflow
          await findWorkflowAndTrigger(
            prisma,
            newProspect,
            'prospect',
            user?.client?.id,
            payloadData,
            user?.accessToken
          );
        }
      } catch (_e) {
        // swallow to avoid impacting the request lifecycle
      }
    })();
  } catch (error) {
    logOperationError('createProspect', req, error);

    // DEBUG: Log actual error details for investigation
    console.error('[DEBUG createProspect] Actual error:', JSON.stringify({
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 5),
    }));

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_prospect');
  }
}

async function getProspect(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getProspect', req, {
    user: user?.id,
    prospectId: params?.id,
  });

  try {
    const include = {
      person: true,
      category: true,
      status: true,
      prospectPipeline: true,
    };

    // Log database operation start
    logDatabaseStart('get_prospect', req, {
      prospectId: params?.id,
      userId: user?.id,
    });

    const foundProspect = await prisma.prospect.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_prospect', req, {
      found: !!foundProspect,
      prospectId: params?.id,
    });

    if (!foundProspect) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Prospect not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_prospect',
          details: { prospectId: params?.id },
        }
      );
      logOperationError('getProspect', req, error);
      throw error;
    }

    let [foundProspectWithDetails] = [foundProspect];
    try {
      [foundProspectWithDetails] = await getDetailsFromAPI({
        results: [foundProspect],
        token: user?.accessToken,
      });
    } catch (_e) {
      [foundProspectWithDetails] = [foundProspect];
    }

    // Attach display value
    const prospectWithDisplayValue = enrichRecordDisplayValues(
      attachNestedDisplayValues(foundProspectWithDetails, [
        { relation: 'category', model: 'ProspectCategory' },
        { relation: 'status', model: 'ProspectPipelineStage' },
      ]),
      'Prospect'
    );

    // Log operation success
    logOperationSuccess('getProspect', req, {
      id: foundProspect.id,
    });

    res.status(200).json(prospectWithDisplayValue);
  } catch (error) {
    logOperationError('getProspect', req, error);

    // DEBUG: Log actual error details for investigation
    console.error('[DEBUG getProspect] Actual error:', JSON.stringify({
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 5),
    }));

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_prospect');
  }
}

async function updateProspect(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateProspect', req, {
    prospectId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await prospectUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateProspect', req, error);
        throw handleValidationError(error, 'prospect_update');
      }
      logOperationError('updateProspect', req, error);
      throw error;
    }

    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.personId
          ? { model: 'person', fieldValues: { personId: values.personId } }
          : null,
        values?.categoryId
          ? {
              model: 'prospectCategory',
              fieldValues: { categoryId: values.categoryId },
            }
          : null,
        values?.statusId
          ? {
              model: 'prospectPipelineStage',
              fieldValues: { statusId: values.statusId },
            }
          : null,
        values?.prospectPipelineId
          ? {
              model: 'prospectPipeline',
              fieldValues: { prospectPipelineId: values.prospectPipelineId },
            }
          : null,
      ].filter(Boolean),
    });

    // Log database operation start
    logDatabaseStart('update_prospect', req, {
      prospectId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.prospect.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Prospect not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_prospect',
          details: { prospectId: params?.id },
        }
      );
      logOperationError('updateProspect', req, error);
      throw error;
    }

    // Fetch the updated record for response
    const updatedProspect = await prisma.prospect.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });

    // Attach display value
    const prospectWithDisplayValue = enrichRecordDisplayValues(
      attachNestedDisplayValues(updatedProspect, [
        { relation: 'category', model: 'ProspectCategory' },
        { relation: 'status', model: 'ProspectPipelineStage' },
      ]),
      'Prospect'
    );

    // Log database operation success
    logDatabaseSuccess('update_prospect', req, {
      id: updatedProspect.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateProspect', req, {
      id: updatedProspect.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(prospectWithDisplayValue);
  } catch (error) {
    logOperationError('updateProspect', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_prospect');
  }
}

async function deleteProspect(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteProspect', req, {
    user: user?.id,
    prospectId: params?.id,
  });

  try {
    // Cascade delete related records first
    await prisma.prospectProduct.updateMany({
      where: { prospectId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_prospect', req, {
      prospectId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.prospect.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_prospect', req, {
      deletedCount: result.count,
      prospectId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Prospect not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_prospect',
          details: { prospectId: params?.id },
        }
      );
      logOperationError('deleteProspect', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteProspect', req, {
      deletedCount: result.count,
      prospectId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteProspect', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_prospect');
  }
}

async function getProspectBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for prospect',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllProspect,
  createProspect,
  getProspect,
  updateProspect,
  deleteProspect,
  getProspectBarChartData,
};
