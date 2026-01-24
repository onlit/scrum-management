/**
 * Migration Issues Handler
 *
 * Core logic for analyzing schema changes between generations,
 * classifying risks, and applying auto-fixes for new required fields.
 *
 * @module utils/api/migrationIssuesHandler
 */

const prisma = require('#configs/prisma.js');
const {
  withErrorHandling,
  createStandardError,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  loadManifest,
} = require('#utils/api/migrationManifestUtils.js');
const { getConversionRisk } = require('#configs/migrationRiskClassification.js');

/**
 * Create an empty migration issues report
 * @param {boolean} isFirstGeneration - Whether this is first generation
 * @returns {Object} Empty report structure
 */
function createEmptyReport(isFirstGeneration = false) {
  return {
    isFirstGeneration,
    hasIssues: false,
    hasDangerousChanges: false,
    hasFixableChanges: false,
    hasNonSafeIssues: false,
    issues: {
      safeChanges: [],
      safeTypeConversions: [],
      requiredFieldOnExistingModel: [],
      typeChangeWarnings: [],
      stringLengthReductions: [],
      destructiveTypeChanges: [],
      optionalToRequired: [],
      fieldRemovals: [],
      modelRemovals: [],
      manualMigrationsDetected: [],
    },
    summary: {
      totalIssues: 0,
      safeCount: 0,
      fixableCount: 0,
      warningCount: 0,
      dangerousCount: 0,
      modelsAffected: [],
    },
  };
}

/**
 * Calculate summary from issues
 */
function calculateSummary(issues) {
  const modelsAffected = new Set();

  const safeCount = issues.safeChanges.length;
  // requiredFieldOnExistingModel issues are auto-fixable (made optional automatically)
  const fixableCount = issues.requiredFieldOnExistingModel.length;
  const warningCount = issues.stringLengthReductions.length;
  // Field/model removals and safe type conversions are informational, not blocking
  const infoCount =
    issues.fieldRemovals.length +
    issues.modelRemovals.length +
    (issues.safeTypeConversions?.length || 0);
  // requiredFieldOnExistingModel is NOT dangerous - it's auto-fixable
  const dangerousCount =
    issues.typeChangeWarnings.length +
    issues.destructiveTypeChanges.length +
    issues.optionalToRequired.length;

  // Collect affected models
  for (const issue of [
    ...issues.safeChanges,
    ...(issues.safeTypeConversions || []),
    ...issues.requiredFieldOnExistingModel,
    ...issues.typeChangeWarnings,
    ...issues.stringLengthReductions,
    ...issues.destructiveTypeChanges,
    ...issues.optionalToRequired,
    ...issues.fieldRemovals,
    ...issues.modelRemovals,
    ...issues.manualMigrationsDetected,
  ]) {
    if (issue.model) modelsAffected.add(issue.model);
  }

  return {
    totalIssues: safeCount + fixableCount + warningCount + dangerousCount + infoCount,
    safeCount,
    fixableCount,
    warningCount,
    dangerousCount,
    infoCount,
    modelsAffected: Array.from(modelsAffected),
  };
}

/**
 * Analyze migration issues by comparing incoming models to manifest state
 */
const analyzeMigrationIssues = withErrorHandling(
  async ({ microservice, models, restAPI }) => {
    const manifest = await loadManifest(restAPI?.path);

    // First generation - no issues
    if (!manifest) {
      return createEmptyReport(true);
    }

    if (
      manifest.microserviceId &&
      microservice?.id &&
      manifest.microserviceId !== microservice.id
    ) {
      throw createStandardError(
        ERROR_TYPES.MIGRATION_ISSUES,
        'Migration manifest does not match microservice',
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'analyze_migration_issues',
          details: {
            manifestMicroserviceId: manifest.microserviceId,
            microserviceId: microservice.id,
          },
        }
      );
    }

    const report = createEmptyReport(false);
    const previousModels = manifest.models || {};
    const currentModelNames = new Set(models.map((m) => m.name));
    const previousModelNames = new Set(Object.keys(previousModels));

    // Detect new models (safe)
    for (const model of models) {
      if (!previousModelNames.has(model.name)) {
        report.issues.safeChanges.push({
          type: 'new_model',
          model: model.name,
          issue: `New model '${model.name}' will be created.`,
          severity: 'info',
        });
      }
    }

    // Detect removed models (informational - does not block generation)
    for (const modelName of previousModelNames) {
      if (!currentModelNames.has(modelName)) {
        report.issues.modelRemovals.push({
          model: modelName,
          modelId: modelName,
          issue: `Model '${modelName}' has been removed and will be dropped from the database.`,
          severity: 'info',
        });
      }
    }

    // Analyze existing models for field changes
    for (const model of models) {
      const prevModel = previousModels[model.name];
      if (!prevModel) continue;

      const prevFields = prevModel.fields || {};
      const currentFieldNames = new Set(
        (model.fieldDefns || []).map((f) => f.name)
      );
      const prevFieldNames = new Set(Object.keys(prevFields));

      // Detect new required fields (dangerous - manual review required)
      for (const field of model.fieldDefns || []) {
        if (!prevFieldNames.has(field.name) && !field.isOptional) {
          if (!field.id) {
            throw createStandardError(
              ERROR_TYPES.MIGRATION_ISSUES,
              'Field ID is required to apply migration auto-fix',
              {
                severity: ERROR_SEVERITY.HIGH,
                context: 'analyze_migration_issues',
                details: { model: model.name, field: field.name },
              }
            );
          }

          report.issues.requiredFieldOnExistingModel.push({
            model: model.name,
            modelId: model.id,
            field: field.name,
            fieldId: field.id,
            issue: `New required field '${field.name}' on '${model.name}' would fail for existing rows.`,
            severity: 'error',
          });
        }
      }

      // Detect removed fields (informational - does not block generation)
      for (const fieldName of prevFieldNames) {
        if (!currentFieldNames.has(fieldName)) {
          report.issues.fieldRemovals.push({
            model: model.name,
            field: fieldName,
            fieldId: `${model.name}.${fieldName}`,
            issue: `Field '${fieldName}' on model '${model.name}' has been removed and will be dropped.`,
            severity: 'info',
          });
        }
      }

      // Detect type changes
      for (const field of model.fieldDefns || []) {
        const prevField = prevFields[field.name];
        if (!prevField) continue;

        if (prevField.dataType !== field.dataType) {
          const risk = getConversionRisk(prevField.dataType, field.dataType);

          if (risk === 'safe') {
            // Track safe type conversions for informational display
            report.issues.safeTypeConversions.push({
              model: model.name,
              field: field.name,
              fieldId: field.id || `${model.name}.${field.name}`,
              fromType: prevField.dataType,
              toType: field.dataType,
              issue: `Type updated from '${prevField.dataType}' to '${field.dataType}'.`,
              severity: 'info',
            });
          } else if (risk === 'warning') {
            report.issues.typeChangeWarnings.push({
              model: model.name,
              field: field.name,
              fromType: prevField.dataType,
              toType: field.dataType,
              issue: `Type change from '${prevField.dataType}' to '${field.dataType}' may cause data loss.`,
              severity: 'warning',
            });
          } else if (risk === 'blocking') {
            report.issues.destructiveTypeChanges.push({
              model: model.name,
              field: field.name,
              fromType: prevField.dataType,
              toType: field.dataType,
              issue: `Incompatible type change from '${prevField.dataType}' to '${field.dataType}'.`,
              severity: 'error',
            });
          }
        }

        // Detect optional → required (blocking)
        if (prevField.isOptional && !field.isOptional) {
          const confirmationToken = buildConfirmationToken({
            action: 'REQUIRE',
            model: model.name,
            field: field.name,
          });
          report.issues.optionalToRequired.push({
            model: model.name,
            field: field.name,
            fieldId: field.id || `${model.name}.${field.name}`,
            issue: `Field '${field.name}' changed from optional to required. Existing NULL values will cause failures.`,
            requiresExplicitConfirmation: true,
            confirmationPrompt: `Type '${confirmationToken}' to confirm`,
            severity: 'error',
          });
        }
      }
    }

    // Calculate summary
    report.summary = calculateSummary(report.issues);
    report.hasIssues = report.summary.totalIssues > 0;
    report.hasDangerousChanges = report.summary.dangerousCount > 0;
    report.hasFixableChanges = report.summary.fixableCount > 0;
    // hasNonSafeIssues: true if there are dangerous or warning issues
    // Safe changes (new models, new optional fields) should NOT require confirmation
    report.hasNonSafeIssues =
      report.hasDangerousChanges || report.summary.warningCount > 0;

    return report;
  },
  'analyze_migration_issues'
);

/**
 * Apply auto-fixes to FieldDefn records
 */
const applyMigrationFixes = withErrorHandling(
  async ({ report, prisma: prismaClient }) => {
    const appliedFixes = [];
    const fieldsToFix = report.issues.requiredFieldOnExistingModel || [];

    if (fieldsToFix.length === 0) {
      return { appliedFixes: [], success: true };
    }

    const db = prismaClient || prisma;

    await db.$transaction(async (tx) => {
      for (const issue of fieldsToFix) {
        const { fieldId, field, model } = issue;

        if (!fieldId) {
          throw createStandardError(
            ERROR_TYPES.MIGRATION_ISSUES,
            'Field ID is required to apply migration auto-fix',
            {
              severity: ERROR_SEVERITY.HIGH,
              context: 'apply_migration_fixes',
              details: { model, field },
            }
          );
        }

        await tx.fieldDefn.update({
          where: { id: fieldId },
          data: { isOptional: true },
        });

        appliedFixes.push({
          appliedAt: new Date().toISOString(),
          model,
          field,
          fieldId,
          fix: 'made_optional',
          reason: issue.issue,
        });
      }
    });

    return { appliedFixes, success: true };
  },
  'apply_migration_fixes'
);

/**
 * Validate that all dangerous changes have explicit confirmations
 * @param {Object} report - Migration issues report
 * @param {Object} explicitConfirmations - Map of ID to confirmation string
 * @returns {Array} Missing confirmations
 */
function validateExplicitConfirmations(report, explicitConfirmations = {}) {
  const missing = [];

  // NOTE: field_removal and model_removal no longer require confirmation
  // They are now informational and do not block generation
  const confirmationChecks = [
    {
      type: 'optional_to_required',
      issues: report.issues.optionalToRequired || [],
      idKey: 'fieldId',
      action: 'REQUIRE',
      hasField: true,
    },
  ];

  for (const check of confirmationChecks) {
    for (const issue of check.issues) {
      const expected = buildConfirmationToken({
        action: check.action,
        model: issue.model,
        field: check.hasField ? issue.field : undefined,
      });

      if (explicitConfirmations[issue[check.idKey]] !== expected) {
        missing.push({
          type: check.type,
          [check.idKey]: issue[check.idKey],
          expectedConfirmation: expected,
        });
      }
    }
  }

  return missing;
}

function buildMigrationValidationErrors(report) {
  if (!report || !report.issues) return null;

  const issues = [];

  const addIssues = (items, changeType) => {
    (items || []).forEach((item) => {
      // Build a clear message with model.field prefix
      const location = item?.model && item?.field
        ? `${item.model}.${item.field}: `
        : item?.model
          ? `${item.model}: `
          : '';
      const baseMessage =
        item?.issue ||
        item?.message ||
        'Migration change requires manual review.';
      // Prefix with location if not already included in message
      const message = baseMessage.includes(item?.model) && baseMessage.includes(item?.field)
        ? baseMessage
        : `${location}${baseMessage}`;
      issues.push({
        issue: message,
        model: item?.model,
        field: item?.field,
        changeType,
        severity: 'error',
      });
    });
  };

  // Only blocking errors - field/model removals are now informational
  // NOTE: requiredFieldOnExistingModel is NOT included here because it's auto-fixable
  // (the field will be made optional automatically during generation)
  addIssues(report.issues.typeChangeWarnings, 'type_change');
  addIssues(report.issues.destructiveTypeChanges, 'type_change_destructive');
  addIssues(report.issues.optionalToRequired, 'optional_to_required');
  // NOTE: fieldRemovals and modelRemovals are intentionally NOT included here
  // They are informational and displayed in the UI, but do not block generation

  if (issues.length === 0) return null;

  return { migrationIssues: issues };
}

/**
 * Get informational migration messages for display in UI
 * These do not block generation but should be shown to the user
 * Includes: field removals, model removals, and safe type conversions
 */
function getMigrationInfoMessages(report) {
  if (!report || !report.issues) return null;

  const removalMessages = [];
  const typeConversionMessages = [];

  const addRemovalMessages = (items, changeType) => {
    (items || []).forEach((item) => {
      removalMessages.push({
        message: item?.issue || 'Schema change detected.',
        model: item?.model,
        field: item?.field,
        changeType,
        severity: 'info',
      });
    });
  };

  const addTypeConversionMessages = (items) => {
    (items || []).forEach((item) => {
      typeConversionMessages.push({
        message: item?.issue || 'Type conversion applied.',
        model: item?.model,
        field: item?.field,
        fieldId: item?.fieldId,
        fromType: item?.fromType,
        toType: item?.toType,
        changeType: 'safe_type_conversion',
        severity: 'info',
      });
    });
  };

  addRemovalMessages(report.issues.fieldRemovals, 'field_removal');
  addRemovalMessages(report.issues.modelRemovals, 'model_removal');
  addTypeConversionMessages(report.issues.safeTypeConversions);

  if (removalMessages.length === 0 && typeConversionMessages.length === 0) {
    return null;
  }

  return {
    removalMessages: removalMessages.length > 0 ? removalMessages : undefined,
    typeConversionMessages: typeConversionMessages.length > 0 ? typeConversionMessages : undefined,
  };
}

function escapeConfirmationValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildConfirmationToken({ action, model, field }) {
  const safeModel = escapeConfirmationValue(model);
  if (field) {
    const safeField = escapeConfirmationValue(field);
    return `${action} "${safeModel}"."${safeField}"`;
  }
  return `${action} "${safeModel}"`;
}

module.exports = {
  analyzeMigrationIssues,
  applyMigrationFixes,
  validateExplicitConfirmations,
  buildMigrationValidationErrors,
  getMigrationInfoMessages,
  createEmptyReport,
};
