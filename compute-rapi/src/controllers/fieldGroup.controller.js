/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 10/11/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines controller functions for managing field groups.
 * Field groups allow collective validation requirements across multiple fields
 * (e.g., "at least one field must be filled").
 *
 *
 * REVISION 1:
 * REVISED BY: Claude Code
 * REVISION DATE: 10/11/2025
 * REVISION REASON: Verified compliance with ERROR_HANDLING_GUIDELINES.md and TRACE_ID_CONVENTIONS.md
 */

const prisma = require('#configs/prisma.js');
const {
  fieldGroupCreate,
  fieldGroupUpdate,
} = require('#schemas/fieldGroup.schemas.js');
const { createStandardError } = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const { getPaginatedList } = require('#utils/shared/databaseUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/shared/traceUtils.js');

async function getAllFieldGroups(req, res) {
  const { user, query } = req;

  logOperationStart('getAllFieldGroups', req, { user: user?.id, query });
  const searchFields = ['name', 'label', 'description'];
  const filterFields = [...searchFields, 'modelId', 'requirementType'];

  let response;
  try {
    logDatabaseStart('get_paginated_field_groups', req, {
      searchFields,
      filterFields,
    });
    response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: fieldGroupUpdate,
      filterFields,
      searchFields,
      model: 'fieldGroup',
      include: {
        model: true,
        rules: {
          include: {
            targetField: true,
            conditions: true,
          },
        },
      },
    });
    logDatabaseSuccess('get_paginated_field_groups', req, {
      count: response.data?.length,
    });
  } catch (error) {
    logOperationError('getAllFieldGroups', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Failed to fetch field groups',
      req,
      {
        context: 'get_all_field_groups',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('getAllFieldGroups', req, {
    count: response.data?.length,
  });
  res.status(200).json(response);
}

async function createFieldGroup(req, res) {
  const { user, body } = req;

  logOperationStart('createFieldGroup', req, {
    user: user?.id,
    bodyKeys: Object.keys(body),
  });

  let values;
  try {
    values = await fieldGroupCreate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('createFieldGroup', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'create_field_group',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('createFieldGroup', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'create_field_group',
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
    });
  }

  // Validate model exists
  let model;
  try {
    logDatabaseStart('find_model_defn', req, { modelId: values.modelId });
    model = await prisma.modelDefn.findUnique({
      where: { id: values.modelId },
    });
    logDatabaseSuccess('find_model_defn', req, { found: !!model });
  } catch (error) {
    logOperationError('createFieldGroup', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_field_group',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!model) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Model not found',
      req,
      {
        context: 'create_field_group',
        severity: ERROR_SEVERITY.LOW,
        details: { modelId: values.modelId },
      }
    );
    logOperationError('createFieldGroup', req, error);
    throw error;
  }

  // Check for duplicate group name in same model
  let existing;
  try {
    logDatabaseStart('find_existing_field_group', req, {
      modelId: values.modelId,
      name: values.name,
    });
    existing = await prisma.fieldGroup.findFirst({
      where: {
        modelId: values.modelId,
        name: values.name,
        deleted: null,
      },
    });
    logDatabaseSuccess('find_existing_field_group', req, {
      found: !!existing,
    });
  } catch (error) {
    logOperationError('createFieldGroup', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_field_group',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (existing) {
    const error = createErrorWithTrace(
      ERROR_TYPES.CONFLICT,
      'A field group with this name already exists for this model',
      req,
      {
        context: 'create_field_group',
        severity: ERROR_SEVERITY.LOW,
        details: { modelId: values.modelId, name: values.name },
      }
    );
    logOperationError('createFieldGroup', req, error);
    throw error;
  }

  let group;
  try {
    logDatabaseStart('create_field_group', req, {
      name: values.name,
      modelId: values.modelId,
    });
    group = await prisma.fieldGroup.create({
      data: buildCreateRecordPayload({
        validatedValues: values,
        requestBody: body,
        user,
      }),
      include: {
        model: true,
        rules: true,
      },
    });
    logDatabaseSuccess('create_field_group', req, { id: group.id });
  } catch (error) {
    logOperationError('createFieldGroup', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_field_group',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('createFieldGroup', req, { id: group.id });
  res.status(201).json(group);
}

async function getFieldGroup(req, res) {
  const { params, user } = req;

  logOperationStart('getFieldGroup', req, { user: user?.id, id: params?.id });

  let group;
  try {
    logDatabaseStart('find_field_group', req, { id: params?.id });
    group = await prisma.fieldGroup.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: {
        model: true,
        rules: {
          include: {
            targetField: true,
            conditions: {
              include: {
                sourceField: true,
              },
            },
          },
        },
      },
    });
    logDatabaseSuccess('find_field_group', req, { found: !!group });
  } catch (error) {
    logOperationError('getFieldGroup', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'get_field_group',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!group) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Field group not found',
      req,
      {
        context: 'get_field_group',
        severity: ERROR_SEVERITY.LOW,
        details: { id: params?.id },
      }
    );
    logOperationError('getFieldGroup', req, error);
    throw error;
  }

  logOperationSuccess('getFieldGroup', req, { id: group.id });
  res.status(200).json(group);
}

async function updateFieldGroup(req, res) {
  const { params, body, user } = req;

  logOperationStart('updateFieldGroup', req, {
    user: user?.id,
    id: params?.id,
    bodyKeys: Object.keys(body),
  });

  let values;
  try {
    values = await fieldGroupUpdate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('updateFieldGroup', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'update_field_group',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('updateFieldGroup', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'update_field_group',
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
    });
  }

  let existingGroup;
  try {
    logDatabaseStart('find_field_group', req, { id: params?.id });
    existingGroup = await prisma.fieldGroup.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
    });
    logDatabaseSuccess('find_field_group', req, { found: !!existingGroup });
  } catch (error) {
    logOperationError('updateFieldGroup', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'update_field_group',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!existingGroup) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Field group not found',
      req,
      {
        context: 'update_field_group',
        severity: ERROR_SEVERITY.LOW,
        details: { id: params?.id },
      }
    );
    logOperationError('updateFieldGroup', req, error);
    throw error;
  }

  let updated;
  try {
    logDatabaseStart('update_field_group', req, {
      id: params?.id,
      name: values.name,
    });
    updated = await prisma.fieldGroup.update({
      where: { id: params?.id },
      data: {
        name: values.name,
        label: values.label,
        description: values.description,
        requirementType: values.requirementType,
        updatedBy: user.id,
      },
      include: {
        model: true,
        rules: {
          include: {
            targetField: true,
            conditions: true,
          },
        },
      },
    });
    logDatabaseSuccess('update_field_group', req, { id: updated.id });
  } catch (error) {
    logOperationError('updateFieldGroup', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'update_field_group',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('updateFieldGroup', req, { id: updated.id });
  res.status(200).json(updated);
}

async function deleteFieldGroup(req, res) {
  const { params, user } = req;

  logOperationStart('deleteFieldGroup', req, {
    user: user?.id,
    id: params?.id,
  });

  try {
    logDatabaseStart('delete_field_group', req, { id: params?.id });
    await prisma.fieldGroup.deleteMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });
    logDatabaseSuccess('delete_field_group', req, { id: params?.id });
  } catch (error) {
    logOperationError('deleteFieldGroup', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'delete_field_group',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('deleteFieldGroup', req, { deleted: params?.id });
  res.status(200).json({ deleted: params?.id });
}

module.exports = {
  getAllFieldGroups,
  createFieldGroup,
  getFieldGroup,
  updateFieldGroup,
  deleteFieldGroup,
};
