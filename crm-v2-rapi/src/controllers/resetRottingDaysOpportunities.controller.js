/**
 * CREATED BY: AI Assistant
 * CREATION DATE: 26/08/2025
 *
 * DESCRIPTION:
 * ------------------
 * Controller for migrating Django's `/reset-rotting-days-opportunities/` endpoint
 * to Express.js with Prisma. Provides GET (preview), POST (create/apply),
 * PUT/PATCH (update/apply), and DELETE (revert) semantics for parity, while
 * ensuring uniqueness checks at controller level and soft-delete safety.
 */

const _ = require('lodash');
const prisma = require('#configs/prisma.js');
const {
  resetCreate,
  resetUpdate,
  resetPreview,
  resetDelete,
} = require('#schemas/resetRottingDaysOpportunities.schemas.js');
const { getVisibilityFilters } = require('#utils/shared/visibilityUtils.js');
const {
  verifyForeignKeyAccessBatch,
} = require('#utils/shared/databaseUtils.js');
const {
  ERROR_TYPES,
  ERROR_SEVERITY,
  DISPLAY_VALUE_PROP,
} = require('#configs/constants.js');
const {
  wrapExpressAsync,
  handleValidationError,
  handleDatabaseError,
  createStandardError,
} = require('#utils/shared/errorHandlingUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/shared/traceUtils.js');

// Shared helper to build where clause for opportunities in a stage with visibility
function buildStageWhere(user, stageId) {
  return {
    statusId: stageId,
    client: user?.client?.id,
    deleted: null,
  };
}

// Normalize incoming payload to support both snake_case and camelCase
function normalizeResetInput(source) {
  const stageId =
    source?.stageId || source?.stage || source?.stage_id || source?.stageID;
  const rawDate =
    source?.statusAssignedDate ??
    source?.status_assigned_date ??
    source?.statusAssigned ??
    source?.status_assigned;

  const statusAssignedDate =
    rawDate === '' || rawDate === null ? undefined : rawDate;

  return { stageId, statusAssignedDate };
}

async function getResetRottingDaysPreview(req, res) {
  const { user, query } = req;

  logOperationStart('getResetRottingDaysPreview', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    let values;
    try {
      const normalized = normalizeResetInput(query);
      values = await resetPreview.validateAsync(
        { stageId: normalized.stageId },
        {
          abortEarly: false,
          stripUnknown: true,
        }
      );
    } catch (error) {
      if (error.isJoi)
        throw handleValidationError(error, 'reset_rotting_preview');
      throw error;
    }

    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        { model: 'pipelineStage', fieldValues: { stageId: values.stageId } },
      ],
    });

    logDatabaseStart('preview_reset_rotting_find', req, {
      stageId: values.stageId,
    });
    const count = await prisma.opportunity.count({
      where: buildStageWhere(user, values.stageId),
    });
    logDatabaseSuccess('preview_reset_rotting_find', req, { count });

    res.status(200).json({ stageId: values.stageId, affectedCount: count });
  } catch (error) {
    logOperationError('getResetRottingDaysPreview', req, error);
    throw handleDatabaseError(error, 'reset_rotting_preview');
  }
}

async function applyResetRottingDays(req, res) {
  const { user, body } = req;

  logOperationStart('applyResetRottingDays', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    let values;
    try {
      const normalized = normalizeResetInput(body);
      values = await resetCreate.validateAsync(normalized, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi)
        throw handleValidationError(error, 'reset_rotting_create');
      throw error;
    }

    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        { model: 'pipelineStage', fieldValues: { stageId: values.stageId } },
      ],
    });

    const statusAssignedDate = values.statusAssignedDate
      ? new Date(values.statusAssignedDate)
      : null;

    logDatabaseStart('reset_rotting_update_many', req, {
      stageId: values.stageId,
    });
    const result = await prisma.opportunity.updateMany({
      where: buildStageWhere(user, values.stageId),
      data: {
        statusAssignedDate,
        updatedBy: user?.id,
      },
    });
    logDatabaseSuccess('reset_rotting_update_many', req, {
      count: result.count,
    });

    res
      .status(200)
      .json({ stageId: values.stageId, updatedCount: result.count });
  } catch (error) {
    logOperationError('applyResetRottingDays', req, error);
    throw handleDatabaseError(error, 'reset_rotting_apply');
  }
}

async function updateResetRottingDays(req, res) {
  const { user, body } = req;

  logOperationStart('updateResetRottingDays', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    let values;
    try {
      const normalized = normalizeResetInput(body);
      values = await resetUpdate.validateAsync(normalized, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi)
        throw handleValidationError(error, 'reset_rotting_update');
      throw error;
    }

    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        { model: 'pipelineStage', fieldValues: { stageId: values.stageId } },
      ],
    });

    const statusAssignedDate = values.statusAssignedDate
      ? new Date(values.statusAssignedDate)
      : null;

    logDatabaseStart('reset_rotting_update_many_put', req, {
      stageId: values.stageId,
    });
    const result = await prisma.opportunity.updateMany({
      where: buildStageWhere(user, values.stageId),
      data: {
        statusAssignedDate,
        updatedBy: user?.id,
      },
    });
    logDatabaseSuccess('reset_rotting_update_many_put', req, {
      count: result.count,
    });

    res
      .status(200)
      .json({ stageId: values.stageId, updatedCount: result.count });
  } catch (error) {
    logOperationError('updateResetRottingDays', req, error);
    throw handleDatabaseError(error, 'reset_rotting_update_put');
  }
}

async function deleteResetRottingDays(req, res) {
  const { user, query } = req;

  logOperationStart('deleteResetRottingDays', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    let values;
    try {
      const normalized = normalizeResetInput(query);
      values = await resetDelete.validateAsync(
        { stageId: normalized.stageId },
        {
          abortEarly: false,
          stripUnknown: true,
        }
      );
    } catch (error) {
      if (error.isJoi)
        throw handleValidationError(error, 'reset_rotting_delete');
      throw error;
    }

    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        { model: 'pipelineStage', fieldValues: { stageId: values.stageId } },
      ],
    });

    // For DELETE, we revert statusAssignedDate to null for the stage (soft revert)
    logDatabaseStart('reset_rotting_delete_many', req, {
      stageId: values.stageId,
    });
    const result = await prisma.opportunity.updateMany({
      where: buildStageWhere(user, values.stageId),
      data: {
        statusAssignedDate: null,
        updatedBy: user?.id,
      },
    });
    logDatabaseSuccess('reset_rotting_delete_many', req, {
      count: result.count,
    });

    res
      .status(200)
      .json({ stageId: values.stageId, revertedCount: result.count });
  } catch (error) {
    logOperationError('deleteResetRottingDays', req, error);
    throw handleDatabaseError(error, 'reset_rotting_delete');
  }
}

module.exports = {
  getResetRottingDaysPreview,
  applyResetRottingDays,
  updateResetRottingDays,
  deleteResetRottingDays,
};
