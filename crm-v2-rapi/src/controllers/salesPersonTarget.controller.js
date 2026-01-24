/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing salesPersonTarget using Prisma.
 * It includes functions for retrieving all salesPersonTarget, creating a new salesPersonTarget, retrieving a single salesPersonTarget,
 * updating an existing salesPersonTarget, and deleting a salesPersonTarget.
 *
 * The `getAllSalesPersonTarget` function retrieves a paginated list of salesPersonTarget based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createSalesPersonTarget` function validates the request body using a Joi schema, generates a unique code
 * for the salesPersonTarget, and creates a new salesPersonTarget in the database with additional metadata.
 *
 * The `getSalesPersonTarget` function retrieves a single salesPersonTarget based on the provided salesPersonTarget ID, with visibility
 * filters applied to ensure the salesPersonTarget is accessible to the requesting user.
 *
 * The `updateSalesPersonTarget` function updates an existing salesPersonTarget in the database based on the provided salesPersonTarget ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteSalesPersonTarget` function deletes a salesPersonTarget from the database based on the provided salesPersonTarget ID, with
 * visibility filters applied to ensure the salesPersonTarget is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  salesPersonTargetCreate,
  salesPersonTargetUpdate,
} = require('#schemas/salesPersonTarget.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const {
  ERROR_TYPES,
  ERROR_SEVERITY,
} = require('#configs/constants.js');
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
} = require('#utils/shared/traceUtils.js');
const {
  handleDatabaseError,
  handleValidationError,
} = require('#utils/shared/errorHandlingUtils.js');
const { findWorkflowAndTrigger } = require('#utils/shared/automataUtils.js');
const {
  enrichRecordDisplayValues,
} = require('#utils/shared/displayValueUtils.js');

async function getAllSalesPersonTarget(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllSalesPersonTarget', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['color', 'notes'];
    const filterFields = [
      ...searchFields,
      'target',
      'targetUnit',
      'pipelineStageId',
      'salesPersonId',
      'pipelineId',
      'expiryDate',
    ];

    const include = {
      pipelineStage: true,
      pipeline: true,
    };

    // Log database operation start
    logDatabaseStart('get_all_sales_person_target', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: salesPersonTargetUpdate,
      filterFields,
      searchFields,
      model: 'salesPersonTarget',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values to all sales person targets
    if (response?.results) {
      response.results = response.results.map((salesPersonTarget) =>
        enrichRecordDisplayValues(salesPersonTarget, 'SalesPersonTarget')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_sales_person_target', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllSalesPersonTarget', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllSalesPersonTarget', req, error);
    throw handleDatabaseError(error, 'get_all_sales_person_target');
  }
}

async function createSalesPersonTarget(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createSalesPersonTarget', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await salesPersonTargetCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createSalesPersonTarget', req, error);
        throw handleValidationError(error, 'sales_person_target_creation');
      }
      logOperationError('createSalesPersonTarget', req, error);
      throw error;
    }

    const modelRelationFields = ['pipelineStageId', 'pipelineId'];

    const include = {
      pipelineStage: true,
      pipeline: true,
    };

    // Verify FK access (soft-delete aware)
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.pipelineId
          ? {
              model: 'pipeline',
              fieldValues: { pipelineId: values.pipelineId },
            }
          : null,
        values?.pipelineStageId
          ? {
              model: 'pipelineStage',
              fieldValues: { pipelineStageId: values.pipelineStageId },
            }
          : null,
      ].filter(Boolean),
    });

    // Controller-level checks
    try {
      // 1) Ensure pipelineStage belongs to pipeline
      const stage = await prisma.pipelineStage.findFirst({
        where: { id: values.pipelineStageId, ...getVisibilityFilters(user) },
        select: { id: true, pipelineId: true },
      });
      if (!stage || stage.pipelineId !== values.pipelineId) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'Selected stage does not belong to the specified pipeline.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'create_sales_person_target_stage_pipeline_check',
            details: {
              pipelineId: values.pipelineId,
              pipelineStageId: values.pipelineStageId,
            },
          }
        );
        throw error;
      }

      // 2) Prevent active duplicate (salesPersonId, pipelineStageId)
      const now = new Date();
      const duplicate = await prisma.salesPersonTarget.findFirst({
        where: {
          client: user?.client?.id,
          deleted: null,
          pipelineStageId: values.pipelineStageId,
          salesPersonId: values.salesPersonId,
          OR: [{ expiryDate: null }, { expiryDate: { gte: now } }],
        },
        select: { id: true },
      });
      if (duplicate) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'This salesperson already has an active target for the selected stage. End the current target or set an earlier expiry date.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'create_sales_person_target_duplicate_check',
            details: {
              pipelineStageId: values.pipelineStageId,
              salesPersonId: values.salesPersonId,
            },
          }
        );
        throw error;
      }
    } catch (_e) {
      // best-effort; proceed
    }

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_sales_person_target', req, {
      name: values.name,
      userId: user?.id,
    });

    const newSalesPersonTarget = await prisma.salesPersonTarget.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_sales_person_target', req, {
      id: newSalesPersonTarget.id,
      code: newSalesPersonTarget.code,
    });

    const [newSalesPersonTargetWithDetails] = await getDetailsFromAPI({
      results: [newSalesPersonTarget],
      token: user?.accessToken,
    });

    // Attach display value
    const salesPersonTargetWithDisplayValue = enrichRecordDisplayValues(
      newSalesPersonTargetWithDetails,
      'SalesPersonTarget'
    );

    // Log operation success
    logOperationSuccess('createSalesPersonTarget', req, {
      id: newSalesPersonTarget.id,
      code: newSalesPersonTarget.code,
    });

    res.status(201).json(salesPersonTargetWithDisplayValue);

    // Fire-and-forget workflow trigger
    setImmediate(() => {
      try {
        findWorkflowAndTrigger(
          prisma,
          newSalesPersonTarget,
          'salesPersonTarget',
          user?.client?.id,
          {},
          user?.accessToken
        );
      } catch (_err) {}
    });
  } catch (error) {
    logOperationError('createSalesPersonTarget', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_sales_person_target');
  }
}

async function getSalesPersonTarget(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getSalesPersonTarget', req, {
    user: user?.id,
    salesPersonTargetId: params?.id,
  });

  try {
    const include = {
      pipelineStage: true,
      pipeline: true,
    };

    // Log database operation start
    logDatabaseStart('get_sales_person_target', req, {
      salesPersonTargetId: params?.id,
      userId: user?.id,
    });

    const foundSalesPersonTarget = await prisma.salesPersonTarget.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_sales_person_target', req, {
      found: !!foundSalesPersonTarget,
      salesPersonTargetId: params?.id,
    });

    if (!foundSalesPersonTarget) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'SalesPersonTarget not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_sales_person_target',
          details: { salesPersonTargetId: params?.id },
        }
      );
      logOperationError('getSalesPersonTarget', req, error);
      throw error;
    }

    const [foundSalesPersonTargetWithDetails] = await getDetailsFromAPI({
      results: [foundSalesPersonTarget],
      token: user?.accessToken,
    });

    // Attach display value
    const salesPersonTargetWithDisplayValue = enrichRecordDisplayValues(
      foundSalesPersonTargetWithDetails,
      'SalesPersonTarget'
    );

    // Log operation success
    logOperationSuccess('getSalesPersonTarget', req, {
      id: foundSalesPersonTarget.id,
      code: foundSalesPersonTarget.code,
    });

    res.status(200).json(salesPersonTargetWithDisplayValue);
  } catch (error) {
    logOperationError('getSalesPersonTarget', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_sales_person_target');
  }
}

async function updateSalesPersonTarget(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateSalesPersonTarget', req, {
    salesPersonTargetId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await salesPersonTargetUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateSalesPersonTarget', req, error);
        throw handleValidationError(error, 'sales_person_target_update');
      }
      logOperationError('updateSalesPersonTarget', req, error);
      throw error;
    }

    // Load current record
    const current = await prisma.salesPersonTarget.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: {
        id: true,
        pipelineStageId: true,
        pipelineId: true,
        salesPersonId: true,
        expiryDate: true,
        client: true,
      },
    });

    if (!current) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'SalesPersonTarget not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_sales_person_target',
          details: { salesPersonTargetId: params?.id },
        }
      );
      logOperationError('updateSalesPersonTarget', req, error);
      throw error;
    }

    const effPipelineId = values?.pipelineId ?? current.pipelineId;
    const effPipelineStageId =
      values?.pipelineStageId ?? current.pipelineStageId;
    const effSalesPersonId = values?.salesPersonId ?? current.salesPersonId;
    const effExpiryDate =
      values?.expiryDate !== undefined ? values.expiryDate : current.expiryDate;

    // Verify FK access when provided
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.pipelineId
          ? {
              model: 'pipeline',
              fieldValues: { pipelineId: values.pipelineId },
            }
          : null,
        values?.pipelineStageId
          ? {
              model: 'pipelineStage',
              fieldValues: { pipelineStageId: values.pipelineStageId },
            }
          : null,
      ].filter(Boolean),
    });

    // Stage belongs to pipeline check
    try {
      const stage = await prisma.pipelineStage.findFirst({
        where: { id: effPipelineStageId, ...getVisibilityFilters(user) },
        select: { id: true, pipelineId: true },
      });
      if (!stage || stage.pipelineId !== effPipelineId) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'Selected stage does not belong to the specified pipeline.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'update_sales_person_target_stage_pipeline_check',
            details: {
              pipelineId: effPipelineId,
              pipelineStageId: effPipelineStageId,
            },
          }
        );
        throw error;
      }

      // Active duplicate prevention
      const willBeActive =
        !effExpiryDate || new Date(effExpiryDate) >= new Date();
      if (willBeActive) {
        const duplicate = await prisma.salesPersonTarget.findFirst({
          where: {
            id: { not: current.id },
            client: user?.client?.id,
            deleted: null,
            pipelineStageId: effPipelineStageId,
            salesPersonId: effSalesPersonId,
            OR: [{ expiryDate: null }, { expiryDate: { gte: new Date() } }],
          },
          select: { id: true },
        });
        if (duplicate) {
          const error = createErrorWithTrace(
            ERROR_TYPES.VALIDATION,
            'This salesperson already has an active target for the selected stage. End the current target or set an earlier expiry date.',
            req,
            {
              severity: ERROR_SEVERITY.LOW,
              context: 'update_sales_person_target_duplicate_check',
              details: {
                pipelineStageId: effPipelineStageId,
                salesPersonId: effSalesPersonId,
              },
            }
          );
          throw error;
        }
      }
    } catch (_e) {}

    // Log database operation start
    logDatabaseStart('update_sales_person_target', req, {
      salesPersonTargetId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.salesPersonTarget.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'SalesPersonTarget not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_sales_person_target',
          details: { salesPersonTargetId: params?.id },
        }
      );
      logOperationError('updateSalesPersonTarget', req, error);
      throw error;
    }

    const updatedSalesPersonTarget = await prisma.salesPersonTarget.findFirst({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
    });

    const [updatedSalesPersonTargetWithDetails] = await getDetailsFromAPI({
      results: [updatedSalesPersonTarget],
      token: user?.accessToken,
    });

    // Attach display value
    const salesPersonTargetWithDisplayValue = enrichRecordDisplayValues(
      updatedSalesPersonTargetWithDetails,
      'SalesPersonTarget'
    );

    // Log database operation success
    logDatabaseSuccess('update_sales_person_target', req, {
      id: updatedSalesPersonTarget.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateSalesPersonTarget', req, {
      id: updatedSalesPersonTarget.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(salesPersonTargetWithDisplayValue);
  } catch (error) {
    logOperationError('updateSalesPersonTarget', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_sales_person_target');
  }
}

async function deleteSalesPersonTarget(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteSalesPersonTarget', req, {
    user: user?.id,
    salesPersonTargetId: params?.id,
  });

  try {
    await prisma.targetActualHistory.updateMany({
      where: { targetId: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_sales_person_target', req, {
      salesPersonTargetId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.salesPersonTarget.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_sales_person_target', req, {
      deletedCount: result.count,
      salesPersonTargetId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'SalesPersonTarget not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_sales_person_target',
          details: { salesPersonTargetId: params?.id },
        }
      );
      logOperationError('deleteSalesPersonTarget', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteSalesPersonTarget', req, {
      deletedCount: result.count,
      salesPersonTargetId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteSalesPersonTarget', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_sales_person_target');
  }
}

async function getSalesPersonTargetBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for salesPersonTarget',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllSalesPersonTarget,
  createSalesPersonTarget,
  getSalesPersonTarget,
  updateSalesPersonTarget,
  deleteSalesPersonTarget,
  getSalesPersonTargetBarChartData,
};
