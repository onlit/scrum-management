/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 10/11/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module provides utility functions for evaluating and validating field dependency rules.
 * It handles condition evaluation, rule validation, circular dependency detection,
 * and fetching dependency rules for models.
 */

const prisma = require('#configs/prisma.js');
const { createStandardError } = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES } = require('#configs/constants.js');

/**
 * Evaluates whether rule conditions are met for given data
 * @param {Object} rule - The dependency rule with conditions
 * @param {Object} data - The form/record data to evaluate
 * @returns {boolean} - Whether all/any conditions are met
 */
function evaluateRuleConditions(rule, data) {
  const results = rule.conditions.map((condition) => {
    const sourceFieldName = condition.sourceField.name;
    const fieldValue = data[sourceFieldName] || data[`${sourceFieldName}Id`];

    switch (condition.operator) {
      case 'Equals':
        return fieldValue === condition.compareValue;

      case 'NotEquals':
        return fieldValue !== condition.compareValue;

      case 'In':
        return (
          Array.isArray(condition.compareValue) &&
          condition.compareValue.includes(fieldValue)
        );

      case 'NotIn':
        return (
          Array.isArray(condition.compareValue) &&
          !condition.compareValue.includes(fieldValue)
        );

      case 'IsSet':
        return fieldValue != null && fieldValue !== '';

      case 'IsNotSet':
        return fieldValue == null || fieldValue === '';

      default:
        return false;
    }
  });

  return rule.logicOperator === 'And'
    ? results.every((r) => r)
    : results.some((r) => r);
}

/**
 * Validates dependency rules for a model's data
 * Used during create/update operations
 * @param {string} modelId - The model ID to validate against
 * @param {Object} data - The data being validated
 * @returns {Promise<Array>} - Array of validation errors
 */
async function validateDependencyRules(modelId, data) {
  const rules = await prisma.fieldDependencyRule.findMany({
    where: {
      targetField: {
        modelId,
      },
      deleted: null,
    },
    include: {
      conditions: {
        include: {
          sourceField: true,
        },
      },
      targetField: true,
    },
    orderBy: {
      priority: 'asc',
    },
  });

  const errors = [];
  const evaluatedActions = {};

  for (const rule of rules) {
    const conditionsMet = evaluateRuleConditions(rule, data);

    if (conditionsMet) {
      const targetFieldName = rule.targetField.name;

      // Track which actions apply to each field
      if (!evaluatedActions[targetFieldName]) {
        evaluatedActions[targetFieldName] = [];
      }
      evaluatedActions[targetFieldName].push(rule.action);

      // Validate based on action
      if (rule.action === 'Require') {
        const fieldValue =
          data[targetFieldName] || data[`${targetFieldName}Id`];
        if (!fieldValue) {
          errors.push({
            field: targetFieldName,
            message: `${rule.targetField.label || targetFieldName} is required when ${rule.description || 'condition is met'}`,
          });
        }
      }
    }
  }

  // Validate field groups
  const groups = await prisma.fieldGroup.findMany({
    where: {
      modelId,
      deleted: null,
    },
    include: {
      rules: {
        include: {
          targetField: true,
          conditions: true,
        },
      },
    },
  });

  for (const group of groups) {
    const groupFieldValues = group.rules
      .filter((r) => evaluatedActions[r.targetField.name]?.includes('Require'))
      .map((r) => {
        const fieldName = r.targetField.name;
        return data[fieldName] || data[`${fieldName}Id`];
      })
      .filter((v) => v != null);

    if (
      group.requirementType === 'AtLeastOne' &&
      groupFieldValues.length === 0
    ) {
      errors.push({
        field: group.name,
        message: `At least one field from ${group.label || group.name} group is required`,
      });
    }

    if (
      group.requirementType === 'ExactlyOne' &&
      groupFieldValues.length !== 1
    ) {
      errors.push({
        field: group.name,
        message: `Exactly one field from ${group.label || group.name} group is required`,
      });
    }

    if (group.requirementType === 'All') {
      const allFieldNames = group.rules.map((r) => r.targetField.name);
      const allFilled = allFieldNames.every((fieldName) => {
        const fieldValue = data[fieldName] || data[`${fieldName}Id`];
        return fieldValue != null;
      });

      if (!allFilled) {
        errors.push({
          field: group.name,
          message: `All fields from ${group.label || group.name} group are required`,
        });
      }
    }
  }

  return errors;
}

/**
 * Validates no circular dependencies exist
 * @param {string} targetFieldId - The target field ID
 * @param {Array<string>} sourceFieldIds - Array of source field IDs
 * @param {string} modelId - The model ID
 * @param {string} [fieldGroupId] - Optional field group ID for ExactlyOne validation
 * @param {Array<Object>} [conditions] - Optional conditions array to check operators
 * @throws {Error} - If circular dependency detected
 */
async function validateNoCircularDependencies(
  targetFieldId,
  sourceFieldIds,
  modelId,
  fieldGroupId = null,
  conditions = null
) {
  // Build dependency graph for this model
  const allRules = await prisma.fieldDependencyRule.findMany({
    where: {
      targetField: {
        modelId,
      },
      deleted: null,
    },
    include: {
      conditions: true,
      fieldGroup: true,
    },
  });

  // Check if this is a safe mutual dependency for ExactlyOne field group
  if (fieldGroupId && sourceFieldIds.length === 1 && conditions) {
    const fieldGroup = await prisma.fieldGroup.findUnique({
      where: { id: fieldGroupId },
      select: { requirementType: true },
    });

    // Allow mutual dependencies for ExactlyOne groups with IsNotSet operator
    if (fieldGroup?.requirementType === 'ExactlyOne') {
      const allUseIsNotSet = conditions.every(
        (c) => c.operator === 'IsNotSet'
      );

      if (allUseIsNotSet) {
        // Find existing rules with same field group
        const reciprocalRule = allRules.find(
          (rule) =>
            rule.fieldGroupId === fieldGroupId &&
            rule.targetFieldId === sourceFieldIds[0] &&
            rule.conditions.some(
              (c) =>
                c.sourceFieldId === targetFieldId && c.operator === 'IsNotSet'
            )
        );

        // If this is a valid reciprocal relationship, allow it
        if (reciprocalRule) {
          return; // Skip cycle detection for safe mutual dependency
        }
      }
    }
  }

  // Create adjacency list
  const graph = {};
  allRules.forEach((rule) => {
    if (!graph[rule.targetFieldId]) {
      graph[rule.targetFieldId] = [];
    }
    rule.conditions.forEach((c) => {
      graph[rule.targetFieldId].push(c.sourceFieldId);
    });
  });

  // Add new rule to graph
  graph[targetFieldId] = sourceFieldIds;

  // DFS to detect cycles
  const visited = new Set();
  const recursionStack = new Set();

  function hasCycle(nodeId) {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = graph[nodeId] || [];
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        if (hasCycle(neighborId)) return true;
      } else if (recursionStack.has(neighborId)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  if (hasCycle(targetFieldId)) {
    throw createStandardError(
      ERROR_TYPES.VALIDATION,
      'Circular dependency detected. Field dependencies cannot form a cycle.',
      { context: 'validateNoCircularDependencies' }
    );
  }
}

/**
 * Fetches all dependency rules for a given model
 * @param {string} modelId - The model ID
 * @returns {Promise<Array>} - Array of dependency rules with conditions
 */
async function getDependencyRulesForModel(modelId) {
  return prisma.fieldDependencyRule.findMany({
    where: {
      targetField: {
        modelId,
      },
      deleted: null,
    },
    include: {
      conditions: {
        include: {
          sourceField: {
            select: {
              id: true,
              name: true,
              dataType: true,
            },
          },
        },
      },
      targetField: {
        select: {
          id: true,
          name: true,
          label: true,
          isOptional: true,
        },
      },
      fieldGroup: true,
    },
    orderBy: {
      priority: 'asc',
    },
  });
}

module.exports = {
  evaluateRuleConditions,
  validateDependencyRules,
  validateNoCircularDependencies,
  getDependencyRulesForModel,
};
