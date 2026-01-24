/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 10/11/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines controller functions for managing field dependency rules.
 * It provides CRUD operations for creating, reading, updating, and deleting
 * dependency rules that control field visibility, requirements, and enablement.
 *
 *
 * REVISION 1:
 * REVISED BY: Claude Code
 * REVISION DATE: 10/11/2025
 * REVISION REASON: Verified compliance with ERROR_HANDLING_GUIDELINES.md and TRACE_ID_CONVENTIONS.md
 */

const prisma = require('#configs/prisma.js');
const {
  fieldDependencyRuleCreate,
  fieldDependencyRuleUpdate,
} = require('#schemas/fieldDependencyRule.schemas.js');
const { createStandardError } = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const { getPaginatedList } = require('#utils/shared/databaseUtils.js');
const {
  validateNoCircularDependencies,
} = require('#utils/shared/dependencyRulesUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/shared/traceUtils.js');

async function getAllDependencyRules(req, res) {
  const { user, query } = req;

  logOperationStart('getAllDependencyRules', req, {
    user: user?.id,
    query,
  });
  const searchFields = ['description'];
  const filterFields = [
    ...searchFields,
    'targetFieldId',
    'action',
    'logicOperator',
    'priority',
    'fieldGroupId',
  ];

  let response;
  try {
    logDatabaseStart('get_paginated_dependency_rules', req, {
      searchFields,
      filterFields,
    });

    // Build custom where clause for nested model filter
    const customWhere = {};
    if (query.modelId) {
      customWhere.targetField = {
        modelId: query.modelId,
      };
    }

    response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: fieldDependencyRuleUpdate,
      filterFields,
      searchFields,
      model: 'fieldDependencyRule',
      include: {
        targetField: true,
        fieldGroup: true,
        conditions: {
          include: {
            sourceField: true,
          },
        },
      },
      customWhere,
    });
    logDatabaseSuccess('get_paginated_dependency_rules', req, {
      count: response.data?.length,
    });
  } catch (error) {
    logOperationError('getAllDependencyRules', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Failed to fetch dependency rules',
      req,
      {
        context: 'get_all_dependency_rules',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('getAllDependencyRules', req, {
    count: response.data?.length,
  });
  res.status(200).json(response);
}

async function createDependencyRule(req, res) {
  const { user, body } = req;

  logOperationStart('createDependencyRule', req, {
    user: user?.id,
    bodyKeys: Object.keys(body),
  });

  let values;
  try {
    values = await fieldDependencyRuleCreate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('createDependencyRule', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'create_dependency_rule',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('createDependencyRule', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'create_dependency_rule',
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
    });
  }

  // Validate target field exists
  let targetField;
  try {
    logDatabaseStart('find_target_field', req, {
      targetFieldId: values.targetFieldId,
    });
    targetField = await prisma.fieldDefn.findUnique({
      where: { id: values.targetFieldId },
      select: { modelId: true, name: true },
    });
    logDatabaseSuccess('find_target_field', req, { found: !!targetField });
  } catch (error) {
    logOperationError('createDependencyRule', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_dependency_rule',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!targetField) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Target field not found',
      req,
      {
        context: 'create_dependency_rule',
        severity: ERROR_SEVERITY.LOW,
        details: { targetFieldId: values.targetFieldId },
      }
    );
    logOperationError('createDependencyRule', req, error);
    throw error;
  }

  // Validate all source fields are in same model
  const sourceFieldIds = values.conditions.map((c) => c.sourceFieldId);
  // Deduplicate source field IDs to handle multiple conditions using the same field
  const uniqueSourceFieldIds = [...new Set(sourceFieldIds)];
  let sourceFields;
  try {
    logDatabaseStart('find_source_fields', req, {
      sourceFieldIds: uniqueSourceFieldIds,
      count: uniqueSourceFieldIds.length,
    });
    sourceFields = await prisma.fieldDefn.findMany({
      where: { id: { in: uniqueSourceFieldIds } },
      select: { id: true, modelId: true, dataType: true, name: true },
    });
    logDatabaseSuccess('find_source_fields', req, {
      found: sourceFields.length,
    });
  } catch (error) {
    logOperationError('createDependencyRule', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_dependency_rule',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (sourceFields.length !== uniqueSourceFieldIds.length) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'One or more source fields not found',
      req,
      {
        context: 'create_dependency_rule',
        severity: ERROR_SEVERITY.LOW,
        details: {
          expected: sourceFieldIds.length,
          found: sourceFields.length,
        },
      }
    );
    logOperationError('createDependencyRule', req, error);
    throw error;
  }

  const invalidSources = sourceFields.filter(
    (sf) => sf.modelId !== targetField.modelId
  );

  if (invalidSources.length > 0) {
    const error = createErrorWithTrace(
      ERROR_TYPES.VALIDATION,
      'All source and target fields must belong to the same model',
      req,
      {
        context: 'create_dependency_rule',
        severity: ERROR_SEVERITY.LOW,
        details: {
          invalidFields: invalidSources.map((f) => f.name),
        },
      }
    );
    logOperationError('createDependencyRule', req, error);
    throw error;
  }

  // Check for circular dependencies
  try {
    await validateNoCircularDependencies(
      values.targetFieldId,
      sourceFieldIds,
      targetField.modelId,
      values.fieldGroupId,
      values.conditions
    );
  } catch (error) {
    logOperationError('createDependencyRule', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.VALIDATION,
      error.message || 'Circular dependency detected',
      req,
      {
        context: 'create_dependency_rule',
        severity: ERROR_SEVERITY.MEDIUM,
        originalError: error,
      }
    );
  }

  // Validate field group if provided
  if (values.fieldGroupId) {
    let fieldGroup;
    try {
      logDatabaseStart('find_field_group', req, {
        fieldGroupId: values.fieldGroupId,
      });
      fieldGroup = await prisma.fieldGroup.findUnique({
        where: { id: values.fieldGroupId },
        select: { modelId: true },
      });
      logDatabaseSuccess('find_field_group', req, { found: !!fieldGroup });
    } catch (error) {
      logOperationError('createDependencyRule', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.INTERNAL,
        'Database operation failed',
        req,
        {
          context: 'create_dependency_rule',
          severity: ERROR_SEVERITY.HIGH,
          originalError: error,
        }
      );
    }

    if (!fieldGroup) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Field group not found',
        req,
        {
          context: 'create_dependency_rule',
          severity: ERROR_SEVERITY.LOW,
          details: { fieldGroupId: values.fieldGroupId },
        }
      );
      logOperationError('createDependencyRule', req, error);
      throw error;
    }

    if (fieldGroup.modelId !== targetField.modelId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Field group must belong to the same model as the target field',
        req,
        {
          context: 'create_dependency_rule',
          severity: ERROR_SEVERITY.LOW,
          details: {
            fieldGroupModelId: fieldGroup.modelId,
            targetFieldModelId: targetField.modelId,
          },
        }
      );
      logOperationError('createDependencyRule', req, error);
      throw error;
    }
  }

  // Create the rule with conditions
  let rule;
  try {
    logDatabaseStart('create_dependency_rule', req, {
      targetFieldId: values.targetFieldId,
      conditionsCount: values.conditions.length,
    });
    rule = await prisma.fieldDependencyRule.create({
      data: {
        ...buildCreateRecordPayload({
          validatedValues: values,
          requestBody: body,
          user,
        }),
        conditions: {
          create: values.conditions.map((c) => ({
            sourceFieldId: c.sourceFieldId,
            operator: c.operator,
            compareValue: c.compareValue,
            client: user.client.id,
            createdBy: user.id,
            updatedBy: user.id,
          })),
        },
      },
      include: {
        conditions: {
          include: {
            sourceField: true,
          },
        },
        targetField: true,
        fieldGroup: true,
      },
    });
    logDatabaseSuccess('create_dependency_rule', req, { id: rule.id });
  } catch (error) {
    logOperationError('createDependencyRule', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_dependency_rule',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('createDependencyRule', req, { id: rule.id });
  res.status(201).json(rule);
}

async function getDependencyRule(req, res) {
  const { params, user } = req;

  logOperationStart('getDependencyRule', req, {
    user: user?.id,
    id: params?.id,
  });

  let rule;
  try {
    logDatabaseStart('find_dependency_rule', req, { id: params?.id });
    rule = await prisma.fieldDependencyRule.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: {
        conditions: {
          include: {
            sourceField: true,
          },
        },
        targetField: true,
        fieldGroup: true,
      },
    });
    logDatabaseSuccess('find_dependency_rule', req, { found: !!rule });
  } catch (error) {
    logOperationError('getDependencyRule', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'get_dependency_rule',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!rule) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Dependency rule not found',
      req,
      {
        context: 'get_dependency_rule',
        severity: ERROR_SEVERITY.LOW,
        details: { id: params?.id },
      }
    );
    logOperationError('getDependencyRule', req, error);
    throw error;
  }

  logOperationSuccess('getDependencyRule', req, { id: rule.id });
  res.status(200).json(rule);
}

async function updateDependencyRule(req, res) {
  const { params, body, user } = req;

  logOperationStart('updateDependencyRule', req, {
    user: user?.id,
    id: params?.id,
    bodyKeys: Object.keys(body),
  });

  let values;
  try {
    values = await fieldDependencyRuleUpdate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('updateDependencyRule', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'update_dependency_rule',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('updateDependencyRule', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'update_dependency_rule',
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
    });
  }

  let existingRule;
  try {
    logDatabaseStart('find_dependency_rule', req, { id: params?.id });
    existingRule = await prisma.fieldDependencyRule.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: {
        targetField: {
          select: { modelId: true },
        },
      },
    });
    logDatabaseSuccess('find_dependency_rule', req, {
      found: !!existingRule,
    });
  } catch (error) {
    logOperationError('updateDependencyRule', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'update_dependency_rule',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!existingRule) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Dependency rule not found',
      req,
      {
        context: 'update_dependency_rule',
        severity: ERROR_SEVERITY.LOW,
        details: { id: params?.id },
      }
    );
    logOperationError('updateDependencyRule', req, error);
    throw error;
  }

  // If updating conditions, validate circular dependencies
  if (values.conditions) {
    const sourceFieldIds = values.conditions.map((c) => c.sourceFieldId);
    try {
      await validateNoCircularDependencies(
        existingRule.targetFieldId,
        sourceFieldIds,
        existingRule.targetField.modelId,
        values.fieldGroupId || existingRule.fieldGroupId,
        values.conditions
      );
    } catch (error) {
      logOperationError('updateDependencyRule', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        error.message || 'Circular dependency detected',
        req,
        {
          context: 'update_dependency_rule',
          severity: ERROR_SEVERITY.MEDIUM,
          originalError: error,
        }
      );
    }

    // Delete existing conditions and create new ones
    try {
      logDatabaseStart('delete_existing_conditions', req, {
        ruleId: params?.id,
      });
      await prisma.fieldDependencyCondition.deleteMany({
        where: { ruleId: params?.id },
      });
      logDatabaseSuccess('delete_existing_conditions', req, {
        ruleId: params?.id,
      });
    } catch (error) {
      logOperationError('updateDependencyRule', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.INTERNAL,
        'Failed to delete existing conditions',
        req,
        {
          context: 'update_dependency_rule',
          severity: ERROR_SEVERITY.HIGH,
          originalError: error,
        }
      );
    }
  }

  let updated;
  try {
    logDatabaseStart('update_dependency_rule', req, {
      id: params?.id,
      hasNewConditions: !!values.conditions,
    });
    updated = await prisma.fieldDependencyRule.update({
      where: { id: params?.id },
      data: {
        action: values.action,
        logicOperator: values.logicOperator,
        priority: values.priority,
        fieldGroupId: values.fieldGroupId,
        description: values.description,
        updatedBy: user.id,
        ...(values.conditions
          ? {
              conditions: {
                create: values.conditions.map((c) => ({
                  sourceFieldId: c.sourceFieldId,
                  operator: c.operator,
                  compareValue: c.compareValue,
                  client: user.client.id,
                  createdBy: user.id,
                  updatedBy: user.id,
                })),
              },
            }
          : {}),
      },
      include: {
        conditions: {
          include: {
            sourceField: true,
          },
        },
        targetField: true,
        fieldGroup: true,
      },
    });
    logDatabaseSuccess('update_dependency_rule', req, { id: updated.id });
  } catch (error) {
    logOperationError('updateDependencyRule', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'update_dependency_rule',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('updateDependencyRule', req, { id: updated.id });
  res.status(200).json(updated);
}

async function deleteDependencyRule(req, res) {
  const { params, user } = req;

  logOperationStart('deleteDependencyRule', req, {
    user: user?.id,
    id: params?.id,
  });

  try {
    logDatabaseStart('delete_dependency_rule', req, { id: params?.id });
    await prisma.fieldDependencyRule.deleteMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });
    logDatabaseSuccess('delete_dependency_rule', req, { id: params?.id });
  } catch (error) {
    logOperationError('deleteDependencyRule', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'delete_dependency_rule',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  logOperationSuccess('deleteDependencyRule', req, { deleted: params?.id });
  res.status(200).json({ deleted: params?.id });
}

module.exports = {
  getAllDependencyRules,
  createDependencyRule,
  getDependencyRule,
  updateDependencyRule,
  deleteDependencyRule,
};
