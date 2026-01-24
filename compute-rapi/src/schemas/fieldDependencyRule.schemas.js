/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 10/11/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi validation schemas for field dependency rules.
 * Field dependency rules control visibility, requirement, and enablement of fields
 * based on conditions evaluated against other fields' values.
 *
 * The schemas validate:
 * - fieldDependencyConditionSchema: Individual conditions within a rule
 * - fieldDependencyRuleCreate: Creating new dependency rules
 * - fieldDependencyRuleUpdate: Updating existing dependency rules
 */

const Joi = require('joi');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');
const {
  DEPENDENCY_ACTION_TYPES,
  DEPENDENCY_CONDITION_OPERATORS,
  DEPENDENCY_LOGIC_OPERATORS,
} = require('#configs/constants.js');

const fieldDependencyConditionSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  sourceFieldId: Joi.string().uuid().required(),
  operator: Joi.string()
    .valid(...DEPENDENCY_CONDITION_OPERATORS)
    .required(),
  compareValue: Joi.any().optional().allow(null),
});

const fieldDependencyRuleCreate = visibilityCreate.keys({
  targetFieldId: Joi.string().uuid().required(),
  action: Joi.string()
    .valid(...DEPENDENCY_ACTION_TYPES)
    .required(),
  logicOperator: Joi.string()
    .valid(...DEPENDENCY_LOGIC_OPERATORS)
    .default('And'),
  priority: Joi.number().integer().min(0).default(0),
  fieldGroupId: Joi.string().uuid().optional().allow(null),
  description: Joi.string().optional().allow(null, ''),
  conditions: Joi.array().items(fieldDependencyConditionSchema).min(1).required(),
});

const fieldDependencyRuleUpdate = visibilityCreate.keys({
  targetFieldId: Joi.string().uuid().optional(),
  action: Joi.string()
    .valid(...DEPENDENCY_ACTION_TYPES)
    .optional(),
  logicOperator: Joi.string()
    .valid(...DEPENDENCY_LOGIC_OPERATORS)
    .optional(),
  priority: Joi.number().integer().min(0).optional(),
  fieldGroupId: Joi.string().uuid().optional().allow(null),
  description: Joi.string().optional().allow(null, ''),
  conditions: Joi.array().items(fieldDependencyConditionSchema).min(1).optional(),
});

module.exports = {
  fieldDependencyRuleCreate,
  fieldDependencyRuleUpdate,
  fieldDependencyConditionSchema,
};
