/**
 * CREATED BY: Claude Code Assistant
 * CREATION DATE: 2025-01-17
 *
 * DESCRIPTION:
 * ------------------
 * Utility functions for validating microservice configurations before generation.
 * This module provides comprehensive validation logic that can be reused across
 * different routes to check microservice, model, and field definitions for errors
 * without requiring the full generation process.
 */

const axios = require('axios');
const { getSystemMenusByMicroserviceURL } = require('#configs/routes.js');
const { withErrorHandling } = require('#utils/shared/errorHandlingUtils.js');
const {
  logWithTrace,
  logOperationStart,
  logOperationSuccess,
  logOperationError,
} = require('#utils/shared/traceUtils.js');
const {
  toStartCaseNoSpaces,
  toCamelCase,
  isSingular: isSingularWord,
} = require('#utils/shared/stringUtils.js');
const {
  ALLOWED_COMPUTE_ROLES,
  SYSTEM_HOST,
  RESERVED_FIELD_NAMES,
} = require('#configs/constants.js');

// Simple in-memory cache for system menus to make validation resilient to
// transient network/auth issues when talking to the System service.
// Keyed by microserviceId + userId so we never cross user boundaries.
const MENUS_CACHE_TTL_MS =
  Number(process.env.MENUS_CACHE_TTL_MS) || 5 * 60 * 1000; // 5 minutes
const menusCache = new Map();

function getMenusCacheKey(microserviceId, user) {
  const userId = user && user.id ? String(user.id) : 'anonymous';
  return `${microserviceId}::${userId}`;
}

function hasComputeAdminAccess(user) {
  const roleNames = Array.isArray(user?.roleNames) ? user.roleNames : [];
  return ALLOWED_COMPUTE_ROLES.some((role) => roleNames.includes(role));
}

/**
 * Validates a microservice configuration including models, fields, and related data
 * @param {Object} params - Validation parameters
 * @param {Object} params.microservice - Microservice data with models and enums
 * @param {Array} params.models - Array of model definitions
 * @param {Array} params.enums - Array of enum definitions
 * @param {Array} params.menus - Array of menu definitions
 * @param {Object} params.user - User object for authentication
 * @param {Object} params.req - Request object for trace ID context (optional)
 * @returns {Object} Validation result with errors and hasErrors flag
 */
const validateMicroserviceConfiguration = withErrorHandling(
  async ({ microservice, models, menus, req }) => {
    logOperationStart('validateMicroserviceConfiguration', req, {
      modelCount: models?.length || 0,
      menuCount: menus?.length || 0,
      microserviceName: microservice?.name,
    });

    const validationErrors = {
      modelsWithoutLabels: [],
      modelsWithoutFields: [],
      invalidModelNames: [],
      duplicateModelNames: [],
      missingDisplayValues: [],
      invalidFieldNames: [],
      duplicateFieldNames: [],
      invalidForeignKeys: [],
      invalidExternalForeignKeys: [],
      nonOptionalSelfReferences: [],
      missingUIFields: [],
      invalidUUIDLengthConstraints: [],
      multipleClickableLinks: [],
      missingClickableLinks: [],
      invalidClickableLinkOrders: [],
      invalidIndexCounts: [],
    };
    let hasErrors = false;

    // Helper functions for validation
    const isValidDomainLabel = (name) =>
      /^[a-zA-Z][-a-zA-Z0-9\s]*[a-zA-Z0-9]$|^[a-zA-Z]$/.test(name);

    // Convert an invalid name to a suggested valid domain label
    const suggestValidDomainName = (name) => {
      if (!name || typeof name !== 'string') return null;
      // Remove leading non-letter characters
      let suggested = name.replace(/^[^a-zA-Z]+/, '');
      // Remove trailing non-alphanumeric characters
      suggested = suggested.replace(/[^a-zA-Z0-9]+$/, '');
      // Replace invalid middle characters with hyphens
      suggested = suggested.replace(/[^a-zA-Z0-9\s-]/g, '-');
      // Collapse multiple hyphens/spaces
      suggested = suggested.replace(/[-\s]+/g, ' ');
      return suggested || null;
    };
    const isProperStartCase = (name) =>
      !!name && name === toStartCaseNoSpaces(name);
    const isCamelCase = (name) =>
      !!name && name === toCamelCase(name) && /^[a-z]/.test(name);

    // Use stringUtils for singular check
    const isSingular = (name) => isSingularWord(name);

    // 1. Verify microservice.name doesn't contain characters that are invalid for a domain name.
    if (!microservice.name || !isValidDomainLabel(microservice.name)) {
      const suggestedName = suggestValidDomainName(microservice.name);
      const suggestionText = suggestedName
        ? ` Try renaming it to "${suggestedName}".`
        : '';
      validationErrors.invalidDomainName = {
        name: microservice.name || '',
        issue: `The microservice name "${microservice.name || ''}" contains invalid characters for domain names. Names must start with a letter, contain only letters, numbers, spaces, or hyphens, and end with a letter or number.${suggestionText}`,
        suggestedName,
      };
      hasErrors = true;
    }

    // 2. Verify microservice.label exists.
    if (!microservice.label || microservice.label.trim() === '') {
      validationErrors.missingLabel = true;
      hasErrors = true;
    }

    // 3. Verify microservice has menus.
    if (!menus || menus.length === 0) {
      validationErrors.noMenus = true;
      hasErrors = true;
    }

    // Detect duplicate model names across all provided models
    if (Array.isArray(models) && models.length > 0) {
      const modelNameToModels = {};
      models.forEach((m) => {
        const name = m && m.name ? m.name : null;
        if (!name) return;
        if (!modelNameToModels[name]) modelNameToModels[name] = [];
        modelNameToModels[name].push(m);
      });

      Object.keys(modelNameToModels).forEach((name) => {
        const group = modelNameToModels[name];
        if (Array.isArray(group) && group.length > 1) {
          const duplicateIds = group.map((g) => g.id);
          validationErrors.duplicateModelNames.push({
            name,
            issue: `The model name '${name}' appears ${group.length} times in this microservice. Each model must have a unique name. Rename the duplicate models to proceed.`,
            totalInGroup: group.length,
            duplicateIds,
            help: 'Model names must be unique within a microservice. Rename duplicates to proceed.',
          });
          hasErrors = true;
        }
      });
    }

    models.forEach((model) => {
      // 4. Verify all models have labels (model.label) and fields.
      if (!model.label || model.label.trim() === '') {
        validationErrors.modelsWithoutLabels.push({
          id: model.id,
          name: model.name,
        });
        hasErrors = true;
      }
      if (!model.fieldDefns || model.fieldDefns.length === 0) {
        validationErrors.modelsWithoutFields.push({
          id: model.id,
          name: model.name,
        });
        hasErrors = true;
      }

      // Detect duplicate field names within the same model
      if (Array.isArray(model.fieldDefns) && model.fieldDefns.length > 0) {
        const fieldNameToFields = {};
        model.fieldDefns.forEach((field) => {
          const fname = field && field.name ? field.name : null;
          if (!fname) return;
          if (!fieldNameToFields[fname]) fieldNameToFields[fname] = [];
          fieldNameToFields[fname].push(field);
        });

        Object.keys(fieldNameToFields).forEach((fname) => {
          const group = fieldNameToFields[fname];
          if (Array.isArray(group) && group.length > 1) {
            const duplicateIds = group.map((g) => g.id);
            validationErrors.duplicateFieldNames.push({
              name: fname,
              modelId: model.id,
              modelName: model.name,
              issue: `The field name '${fname}' appears ${group.length} times in the '${model.name}' model. Each field must have a unique name within a model. Rename the duplicate fields to proceed.`,
              totalInGroup: group.length,
              duplicateIds,
              help: 'Field names must be unique within a model. Rename duplicates to proceed.',
            });
            hasErrors = true;
          }
        });
      }

      // 5. Verify all models name (model.name) are in start case and ensure names are singular.
      if (model.name && !isProperStartCase(model.name)) {
        validationErrors.invalidModelNames.push({
          id: model.id,
          name: model.name,
          issue: `The model name '${model.name}' is not in Start Case format (e.g., 'Candidate', 'JobPosting'). Convert it to Start Case with no spaces (capitalize each word).`,
        });
        hasErrors = true;
      }
      if (model.name && !isSingular(model.name)) {
        validationErrors.invalidModelNames.push({
          id: model.id,
          name: model.name,
          issue: `The model name '${model.name}' is plural, but model names must be singular (e.g., 'Candidate' not 'Candidates', 'JobPosting' not 'JobPostings'). Convert it to singular form.`,
        });
        hasErrors = true;
      }

      // 5b. Validate slug if provided (must be lowercase kebab-case with no whitespace)
      if (model.slug != null && model.slug !== '') {
        const trimmedSlug = String(model.slug).trim();
        const kebabCaseRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;

        // Check for any whitespace in the original value
        if (/\s/.test(model.slug)) {
          validationErrors.invalidModelNames.push({
            id: model.id,
            name: model.name,
            slug: model.slug,
            issue: `The slug '${model.slug}' for the '${model.name}' model contains whitespace. Slugs must be lowercase kebab-case with no spaces (e.g., 'persons', 'bank-accounts').`,
          });
          hasErrors = true;
        } else if (!kebabCaseRegex.test(trimmedSlug)) {
          validationErrors.invalidModelNames.push({
            id: model.id,
            name: model.name,
            slug: model.slug,
            issue: `The slug '${model.slug}' for the '${model.name}' model is invalid. Slugs must be lowercase kebab-case (e.g., 'persons', 'bank-accounts'). Only lowercase letters, numbers, and hyphens are allowed.`,
          });
          hasErrors = true;
        }
      }

      // 6. Verify models have display values configured.
      // Two supported modes:
      //   a) Single-field: displayValueId set and points to a non-optional field
      //   b) Template: displayValueTemplate provided with valid field placeholders
      {
        const template = (model.displayValueTemplate || '').trim();

        if (template) {
          // Validate template placeholders map to fields on the model
          const placeholderRegex = /\{([^}]+)\}/g;
          const placeholders = [];
          let match;
          while ((match = placeholderRegex.exec(template)) !== null) {
            const token = String(match[1] || '').trim();
            if (token) placeholders.push(token);
          }

          if (placeholders.length === 0) {
            validationErrors.missingDisplayValues.push({
              id: model.id,
              name: model.name,
              issue: `The '${model.name}' model's display template has no placeholders (e.g., '{fieldName}'). Add field placeholders wrapped in curly braces to create a valid display template.`,
            });
            hasErrors = true;
          } else {
            // Allow dot paths in placeholders; validate the root segment exists as a field
            const fieldsByName = {};
            (model.fieldDefns || []).forEach((f) => {
              fieldsByName[f.name] = f;
            });

            const fieldNames = Object.keys(fieldsByName);
            const rootFields = placeholders.map((p) => p.split('.')[0]);
            const unknowns = rootFields.filter(
              (root) => !fieldNames.includes(root)
            );

            if (unknowns.length > 0) {
              validationErrors.missingDisplayValues.push({
                id: model.id,
                name: model.name,
                issue: `The '${model.name}' model's display template references fields that don't exist: ${[...new Set(unknowns)].join(', ')}. Update the template to use only fields that exist on this model.`,
              });
              hasErrors = true;
            }

            // Validate that fields used in template are required (not optional)
            // Exception: If template has no custom characters (only placeholders and spaces)
            // and the first field is required, allow subsequent fields to be optional.
            const optionalFields = rootFields
              .filter((root) => fieldNames.includes(root))
              .filter((root) => fieldsByName[root].isOptional === true)
              .filter((v, i, arr) => arr.indexOf(v) === i); // Remove duplicates

            if (optionalFields.length > 0) {
              // Check if template contains custom characters (anything except placeholders and spaces)
              // Remove all placeholders from template, then check what remains
              const templateWithoutPlaceholders = template.replace(
                /\{[^}]+\}/g,
                ''
              );
              const hasCustomCharacters = /[^ ]/.test(
                templateWithoutPlaceholders
              );

              // Get the first placeholder's root field name
              const firstRootField = rootFields[0];
              const firstFieldIsRequired =
                firstRootField &&
                fieldNames.includes(firstRootField) &&
                fieldsByName[firstRootField].isOptional !== true;

              // If no custom characters and first field is required, skip validation
              const shouldSkipValidation =
                !hasCustomCharacters && firstFieldIsRequired;

              if (!shouldSkipValidation) {
                validationErrors.missingDisplayValues.push({
                  id: model.id,
                  name: model.name,
                  issue: `The '${model.name}' model's display template uses optional fields: ${optionalFields.join(', ')}. Set these fields to required (isOptional: false) or choose different required fields for the template.`,
                  optionalFields,
                });
                hasErrors = true;
              }
            }
          }
        } else if (!model.displayValueId) {
          // Fall back to single-field validation
          validationErrors.missingDisplayValues.push({
            id: model.id,
            name: model.name,
            issue: `The '${model.name}' model has no display value configured. Set either a display field (displayValueId) or a display template (displayValueTemplate) to proceed.`,
          });
          hasErrors = true;
        } else {
          const displayField = (model.fieldDefns || []).find(
            (f) => f.id === model.displayValueId
          );
          if (!displayField) {
            validationErrors.missingDisplayValues.push({
              id: model.id,
              name: model.name,
              issue: `The '${model.name}' model references a display value field ID '${model.displayValueId}' that doesn't exist in the model's fields. Select a valid field ID or remove the display value configuration.`,
            });
            hasErrors = true;
          } else if (displayField.isOptional === true) {
            validationErrors.missingDisplayValues.push({
              id: model.id,
              name: model.name,
              issue: `The '${displayField.name}' display field in the '${model.name}' model is optional. Make it required (isOptional: false) or choose a different required field.`,
            });
            hasErrors = true;
          }
        }
      }

      // 10. Verify at least one model field has showInTable and showInDetailCard set to true.
      if (model.fieldDefns.length > 0) {
        const hasVisibleField = model.fieldDefns.some(
          (field) =>
            field.showInTable === true && field.showInDetailCard === true
        );
        if (!hasVisibleField) {
          validationErrors.missingUIFields.push({
            id: model.id,
            name: model.name,
            issue: `The '${model.name}' model has no field with both 'showInTable' and 'showInDetailCard' set to true. At least one field must be visible in both the table and detail card views.`,
          });
          hasErrors = true;
        }
      }

      // Verify only one field per model has isClickableLink === true
      if (Array.isArray(model.fieldDefns) && model.fieldDefns.length > 0) {
        const clickableLinkFields = model.fieldDefns.filter(
          (field) => field.isClickableLink === true
        );
        if (clickableLinkFields.length > 1) {
          validationErrors.multipleClickableLinks.push({
            id: model.id,
            name: model.name,
            issue: `The '${model.name}' model has ${clickableLinkFields.length} fields with 'isClickableLink' set to true (${clickableLinkFields.map((f) => `'${f.name}'`).join(', ')}). Only one field per model can be a clickable link. Set 'isClickableLink' to false for all but one field.`,
            totalClickableLinks: clickableLinkFields.length,
            fieldIds: clickableLinkFields.map((f) => f.id),
            fieldNames: clickableLinkFields.map((f) => f.name),
          });
          hasErrors = true;
        }

        // Enforce exactly one clickable link field exists and it is within top 3 (order <= 2)
        if (clickableLinkFields.length === 0) {
          validationErrors.missingClickableLinks.push({
            id: model.id,
            name: model.name,
            issue: `The '${model.name}' model has no field with 'isClickableLink' set to true. Exactly one field must be marked as a clickable link. Set 'isClickableLink' to true for one field.`,
          });
          hasErrors = true;
        } else if (clickableLinkFields.length === 1) {
          const onlyLink = clickableLinkFields[0];
          const orderNum = Number(onlyLink.order);
          if (!Number.isNaN(orderNum) && orderNum > 2) {
            validationErrors.invalidClickableLinkOrders.push({
              id: model.id,
              name: model.name,
              fieldId: onlyLink.id,
              fieldName: onlyLink.name,
              order: onlyLink.order,
              issue: `The '${onlyLink.name}' clickable link field in the '${model.name}' model has order ${onlyLink.order}, but it must be within the top 3 fields (order <= 2). Reduce the order value to 0, 1, or 2.`,
            });
            hasErrors = true;
          }
        }
      }

      // Verify model has at most 30 fields with isIndex set to true
      if (Array.isArray(model.fieldDefns)) {
        const indexedFields = model.fieldDefns.filter(
          (field) => field.isIndex === true
        );
        if (indexedFields.length > 30) {
          validationErrors.invalidIndexCounts.push({
            id: model.id,
            name: model.name,
            issue: `The '${model.name}' model has ${indexedFields.length} indexed fields, but the maximum allowed is 30. Remove the index from some fields to proceed.`,
            count: indexedFields.length,
            indexedFieldNames: indexedFields.map((f) => f.name),
          });
          hasErrors = true;
        }
      }

      model.fieldDefns.forEach((field) => {
        // 7. Verify all modelFields' name (field.name) is in camel case and has no Id postfix.
        if (field.name && !isCamelCase(field.name)) {
          validationErrors.invalidFieldNames.push({
            id: field.id,
            name: field.name,
            modelId: model.id,
            modelName: model.name,
            issue: `The field name '${field.name}' in the '${model.name}' model is not in camelCase format (e.g., 'firstName', 'jobTitle'). Convert it to camelCase starting with a lowercase letter.`,
          });
          hasErrors = true;
        }
        if (
          field.name &&
          field.name.length > 2 &&
          field.name.endsWith('Id') &&
          field.name !== 'id'
        ) {
          validationErrors.invalidFieldNames.push({
            id: field.id,
            name: field.name,
            modelId: model.id,
            modelName: model.name,
            issue: `The field name '${field.name}' in the '${model.name}' model ends with 'Id', which is not allowed (except for the reserved 'id' field). Remove the 'Id' suffix from the field name.`,
          });
          hasErrors = true;
        }
        if (field.name && RESERVED_FIELD_NAMES.includes(field.name)) {
          validationErrors.invalidFieldNames.push({
            id: field.id,
            name: field.name,
            modelId: model.id,
            modelName: model.name,
            issue: `The field name '${field.name}' in the '${model.name}' model is reserved and cannot be used. Reserved field names are automatically added by the system. Choose a different name for this field.`,
          });
          hasErrors = true;
        }

        // 8a. For UUID fields, minLength and maxLength must not be set
        if (
          field.dataType === 'UUID' &&
          ((field.minLength !== undefined &&
            field.minLength !== null &&
            `${field.minLength}`.trim() !== '') ||
            (field.maxLength !== undefined &&
              field.maxLength !== null &&
              `${field.maxLength}`.trim() !== ''))
        ) {
          const constraints = [];
          if (
            field.minLength !== undefined &&
            field.minLength !== null &&
            `${field.minLength}`.trim() !== ''
          ) {
            constraints.push(`minLength: ${field.minLength}`);
          }
          if (
            field.maxLength !== undefined &&
            field.maxLength !== null &&
            `${field.maxLength}`.trim() !== ''
          ) {
            constraints.push(`maxLength: ${field.maxLength}`);
          }
          validationErrors.invalidUUIDLengthConstraints.push({
            id: field.id,
            name: field.name,
            modelId: model.id,
            modelName: model.name,
            issue: `The '${field.name}' UUID field in the '${model.name}' model has length constraints set (${constraints.join(', ')}). UUID fields cannot have length constraints. Remove the minLength and maxLength values (set them to null or blank).`,
            dataType: field.dataType,
            ...(field.minLength !== undefined && {
              minLength: field.minLength,
            }),
            ...(field.maxLength !== undefined && {
              maxLength: field.maxLength,
            }),
          });
          hasErrors = true;
        }

        // 8b. For Enum fields, enumDefnId must be set
        if (field.dataType === 'Enum' && !field.enumDefnId) {
          validationErrors.invalidFieldNames.push({
            id: field.id,
            name: field.name,
            modelId: model.id,
            modelName: model.name,
            issue: `The '${field.name}' field in the '${model.name}' model has data type 'Enum' but is missing the 'enumDefnId' property. Select an enum definition for this field or change the data type.`,
            dataType: field.dataType,
          });
          hasErrors = true;
        }

        // 8. Verify if for a field isForeignKey is set to true.
        if (field.isForeignKey === true) {
          if (field.dataType !== 'UUID') {
            validationErrors.invalidForeignKeys.push({
              id: field.id,
              name: field.name,
              modelId: model.id,
              modelName: model.name,
              issue: `The '${field.name}' foreign key field in the '${model.name}' model has data type '${field.dataType}', but foreign keys must use 'UUID' data type. Change the field's data type to 'UUID'.`,
              dataType: field.dataType,
              isForeignKey: true,
            });
            hasErrors = true;
          }

          if (field.foreignKeyTarget === 'Internal') {
            if (!field.foreignKeyModelId) {
              validationErrors.invalidForeignKeys.push({
                id: field.id,
                name: field.name,
                modelId: model.id,
                modelName: model.name,
                issue: `The '${field.name}' internal foreign key field in the '${model.name}' model is missing the 'foreignKeyModelId' property. Set 'foreignKeyModelId' to reference the target model within this microservice.`,
                isForeignKey: true,
              });
              hasErrors = true;
            }
            if (field.externalModelId || field.externalMicroserviceId) {
              validationErrors.invalidForeignKeys.push({
                id: field.id,
                name: field.name,
                modelId: model.id,
                modelName: model.name,
                issue: `The '${field.name}' internal foreign key field in the '${model.name}' model has external properties set (${[field.externalModelId && 'externalModelId', field.externalMicroserviceId && 'externalMicroserviceId'].filter(Boolean).join(', ')}). Internal foreign keys should only use 'foreignKeyModelId'. Remove the external properties.`,
                isForeignKey: true,
              });
              hasErrors = true;
            }

            // Ensure the referenced internal model belongs to the same microservice
            if (field.foreignKeyModelId) {
              const fkModel = field.foreignKeyModel || null;
              const currentMicroserviceId =
                microservice && microservice.id ? microservice.id : null;
              const fkMicroserviceId =
                (fkModel &&
                  ((fkModel.microservice && fkModel.microservice.id) ||
                    fkModel.microserviceId)) ||
                null;

              if (
                currentMicroserviceId &&
                fkMicroserviceId &&
                fkMicroserviceId !== currentMicroserviceId
              ) {
                validationErrors.invalidForeignKeys.push({
                  id: field.id,
                  name: field.name,
                  modelId: model.id,
                  modelName: model.name,
                  issue: `The '${field.name}' internal foreign key field in the '${model.name}' model points to the '${fkModel && fkModel.name ? fkModel.name : 'unknown'}' model in a different microservice. Internal foreign keys must reference models within the same microservice. Change 'foreignKeyTarget' to 'External' if you need to reference an external model, or select a model from this microservice.`,
                  isForeignKey: true,
                  expectedMicroserviceId: currentMicroserviceId,
                  actualMicroserviceId: fkMicroserviceId,
                  foreignKeyModelId: field.foreignKeyModelId,
                  foreignKeyModelName:
                    fkModel && fkModel.name ? fkModel.name : undefined,
                });
                hasErrors = true;
              }
            }
          } else if (field.foreignKeyTarget === 'External') {
            const missingExternal = [];
            if (!field.externalModelId) {
              missingExternal.push('externalModelId');
            }
            if (!field.externalMicroserviceId) {
              missingExternal.push('externalMicroserviceId');
            }

            if (missingExternal.length > 0) {
              validationErrors.invalidExternalForeignKeys.push({
                id: field.id,
                name: field.name,
                modelId: model.id,
                modelName: model.name,
                issue: `The '${field.name}' external foreign key field in the '${model.name}' model is missing required properties: ${missingExternal.join(', ')}. Set all required external foreign key properties to proceed.`,
                missingFields: missingExternal,
                isForeignKey: true,
                ...(field.externalModelId && {
                  externalModelId: field.externalModelId,
                }),
              });
              hasErrors = true;
            }
            if (field.foreignKeyModelId) {
              validationErrors.invalidExternalForeignKeys.push({
                id: field.id,
                name: field.name,
                modelId: model.id,
                modelName: model.name,
                issue: `The '${field.name}' external foreign key field in the '${model.name}' model has the internal property 'foreignKeyModelId' set. External foreign keys should only use external properties (externalModelId, externalMicroserviceId). Remove 'foreignKeyModelId'.`,
                isForeignKey: true,
              });
              hasErrors = true;
            }
          } else {
            validationErrors.invalidForeignKeys.push({
              id: field.id,
              name: field.name,
              modelId: model.id,
              modelName: model.name,
              issue: `The '${field.name}' foreign key field in the '${model.name}' model has an invalid or missing 'foreignKeyTarget' value ('${field.foreignKeyTarget || 'undefined'}'). Set 'foreignKeyTarget' to either 'Internal' (for models in this microservice) or 'External' (for models in other microservices).`,
              isForeignKey: true,
            });
            hasErrors = true;
          }
        } else if (
          field.dataType === 'UUID' &&
          field.name !== 'id' &&
          !(field.description && field.description.includes('externalRef'))
        ) {
          validationErrors.invalidForeignKeys.push({
            id: field.id,
            name: field.name,
            modelId: model.id,
            modelName: model.name,
            issue: `The '${field.name}' field in the '${model.name}' model has data type 'UUID' but is not configured as a foreign key. If this is intentional (e.g., for external references), add "externalRef" to the field's description. Otherwise, set 'isForeignKey' to true and configure the foreign key properties.`,
            dataType: field.dataType,
          });
          hasErrors = true;
        }

        // 9. Verify that field is set to isOptional true if self foreign key
        if (
          field.isForeignKey === true &&
          field.foreignKeyTarget === 'Internal' &&
          field.modelId === field.foreignKeyModelId &&
          field.isOptional !== true
        ) {
          validationErrors.nonOptionalSelfReferences.push({
            id: field.id,
            name: field.name,
            modelId: model.id,
            modelName: model.name,
            issue: `The '${field.name}' self-referencing foreign key field in the '${model.name}' model is required (isOptional: false), but self-references must be optional. Set 'isOptional' to true for this field.`,
            foreignKeyModelId: field.foreignKeyModelId,
          });
          hasErrors = true;
        }
      });
    });

    // Clean up empty error arrays
    Object.keys(validationErrors).forEach((key) => {
      if (
        Array.isArray(validationErrors[key]) &&
        validationErrors[key].length === 0
      ) {
        delete validationErrors[key];
      }
    });

    const result = {
      validationErrors,
      hasErrors:
        hasErrors ||
        Object.keys(validationErrors).some((key) =>
          Array.isArray(validationErrors[key])
            ? validationErrors[key].length > 0
            : validationErrors[key]
        ),
    };

    logOperationSuccess('validateMicroserviceConfiguration', req, {
      hasErrors: result.hasErrors,
      errorCount: Object.keys(validationErrors).length,
    });

    return result;
  },
  'microservice_configuration_validation'
);

/**
 * Fetches system menus for a microservice
 * @param {string} microserviceId - The microservice ID
 * @param {Object} user - User object for authentication
 * @param {Object} req - Request object for trace ID context (optional)
 * @returns {Array} Array of menu objects
 */
const fetchSystemMenus = withErrorHandling(
  async (microserviceId, user, req = null) => {
    const requestUrl = getSystemMenusByMicroserviceURL({
      query: `?compute_microservice=${microserviceId}`,
    });
    const startTime = Date.now();
    const cacheKey = getMenusCacheKey(microserviceId, user);
    const cachedEntry = menusCache.get(cacheKey);
    const now = Date.now();

    // Fast path: recent cache hit – avoid an external call entirely.
    if (
      cachedEntry &&
      Array.isArray(cachedEntry.menus) &&
      now - cachedEntry.fetchedAt < MENUS_CACHE_TTL_MS
    ) {
      logOperationStart('fetchSystemMenus_cache_hit', req, {
        microserviceId,
        requestUrl,
        systemHost: SYSTEM_HOST,
        cachedMenuCount: cachedEntry.menus.length,
        cacheAgeMs: now - cachedEntry.fetchedAt,
        hasAuthToken: !!user?.accessToken,
      });
      return cachedEntry.menus;
    }

    logOperationStart('fetchSystemMenus', req, {
      microserviceId,
      requestUrl,
      systemHost: SYSTEM_HOST,
      hasAuthToken: !!user?.accessToken,
      authTokenPrefix: `${user?.accessToken?.substring(0, 20)}...`,
    });

    try {
      const axiosConfig = {
        headers: {
          Authorization: user.accessToken,
        },
        timeout: 30000, // 30 second timeout
      };

      logWithTrace('[DEBUG] Making axios request', req, {
        url: requestUrl,
        method: 'GET',
        timeout: axiosConfig.timeout,
        hasHeaders: !!axiosConfig.headers,
      });

      const { data } = await axios.get(requestUrl, axiosConfig);
      const duration = Date.now() - startTime;

      const menus = data || [];

      menusCache.set(cacheKey, {
        menus,
        fetchedAt: now,
      });

      logOperationSuccess('fetchSystemMenus', req, {
        menuCount: menus.length,
        durationMs: duration,
        requestUrl,
        cacheKey,
        fromCache: false,
      });

      return menus;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Extract detailed error information
      const errorDetails = {
        microserviceId,
        requestUrl,
        systemHost: SYSTEM_HOST,
        durationMs: duration,
        // Error message and type
        message: error?.message,
        name: error?.name,
        code: error?.code, // ECONNRESET, ETIMEDOUT, ECONNREFUSED, etc.
        // Network error details
        errno: error?.errno,
        syscall: error?.syscall, // 'connect', 'read', etc.
        address: error?.address,
        port: error?.port,
        // Axios-specific details
        isAxiosError: error?.isAxiosError,
        // Response details (if server responded before hanging up)
        responseStatus: error?.response?.status,
        responseStatusText: error?.response?.statusText,
        responseData: error?.response?.data,
        responseHeaders: error?.response?.headers,
        // Request details from axios config
        configMethod: error?.config?.method,
        configUrl: error?.config?.url,
        configTimeout: error?.config?.timeout,
        // Stack trace (first 500 chars)
        stackTrace: error?.stack?.substring(0, 500),
        hadCachedMenus: !!cachedEntry && Array.isArray(cachedEntry.menus),
        cachedMenuCount:
          cachedEntry && Array.isArray(cachedEntry.menus)
            ? cachedEntry.menus.length
            : 0,
      };

      logOperationError('fetchSystemMenus', req, error);

      // Detailed debug log for socket hang up
      logWithTrace(
        '[DEBUG] fetchSystemMenus detailed error',
        req,
        errorDetails
      );

      // Additional log specifically for connection issues
      if (
        error?.code === 'ECONNRESET' ||
        error?.code === 'ECONNREFUSED' ||
        error?.code === 'ETIMEDOUT' ||
        error?.message?.includes('socket hang up')
      ) {
        let suggestion =
          'Connection was reset - possible network issue or service restart';
        if (error?.code === 'ECONNREFUSED') {
          suggestion = 'Target service may be down or unreachable';
        } else if (error?.code === 'ETIMEDOUT') {
          suggestion =
            'Request timed out - target service may be slow or overloaded';
        }

        logWithTrace('[DEBUG] Connection issue detected', req, {
          errorCode: error?.code,
          errorMessage: error?.message,
          targetHost: SYSTEM_HOST,
          targetUrl: requestUrl,
          suggestion,
        });
      }

      // If we have previously cached menus, fall back to them so that
      // transient failures (network blips, token races) do not surface
      // as "no menus" configuration errors.
      if (cachedEntry && Array.isArray(cachedEntry.menus)) {
        const ageMs = now - cachedEntry.fetchedAt;
        logWithTrace('Using cached system menus after fetch failure', req, {
          microserviceId,
          cachedMenuCount: cachedEntry.menus.length,
          cacheAgeMs: ageMs,
        });
        return cachedEntry.menus;
      }

      logWithTrace('Failed to fetch system menus', req, {
        microserviceId,
        error: error?.response?.data ?? error?.message,
      });

      // Let withErrorHandling() turn this into a standardized INTERNAL error
      // instead of silently returning [] and misclassifying it as "no menus".
      throw error;
    }
  },
  'system_menus_fetch'
);

/**
 * Apply automatic fixes for fixable validation errors
 * @param {Object} params - Parameters
 * @param {Object} params.validationErrors - Validation errors from validateMicroserviceConfiguration
 * @param {string} params.microserviceId - The microservice ID
 * @param {Object} params.prisma - Prisma client (optional, defaults to global)
 * @param {Object} params.req - Request object for trace ID context (optional)
 * @returns {Object} Result with appliedFixes array and success boolean
 */
const applyValidationAutoFixes = withErrorHandling(
  async ({ validationErrors, microserviceId, prisma: prismaClient, req }) => {
    const prismaDefault = require('#configs/prisma.js');
    const appliedFixes = [];
    const db = prismaClient || prismaDefault;

    logOperationStart('applyValidationAutoFixes', req, {
      microserviceId,
      errorCategories: Object.keys(validationErrors || {}),
    });

    await db.$transaction(async (tx) => {
      // 0. Fix invalid domain name (microservice name)
      if (validationErrors.invalidDomainName?.suggestedName) {
        const issue = validationErrors.invalidDomainName;
        await tx.microservice.update({
          where: { id: microserviceId },
          data: { name: issue.suggestedName },
        });
        appliedFixes.push({
          type: 'microservice_name_fixed',
          microserviceId,
          from: issue.name,
          to: issue.suggestedName,
          reason: 'Fixed invalid domain name characters',
        });
      }

      // 1. Fix model names (StartCase format issues only)
      for (const issue of validationErrors.invalidModelNames || []) {
        // Only fix format issues (not plural issues which require semantic understanding)
        if (issue.issue?.includes('Start Case')) {
          const fixedName = toStartCaseNoSpaces(issue.name);
          await tx.modelDefn.update({
            where: { id: issue.id },
            data: { name: fixedName },
          });
          appliedFixes.push({
            type: 'model_name_fixed',
            modelId: issue.id,
            modelName: issue.name,
            from: issue.name,
            to: fixedName,
            reason: 'Converted to StartCase format',
          });
        }
      }

      // 2. Fix field names (camelCase format + remove Id suffix)
      for (const issue of validationErrors.invalidFieldNames || []) {
        let fixedName = issue.name;
        const fixes = [];

        if (issue.issue?.includes('camelCase')) {
          fixedName = toCamelCase(fixedName);
          fixes.push('converted to camelCase');
        }
        if (issue.issue?.includes("ends with 'Id'")) {
          fixedName = fixedName.replace(/Id$/, '');
          fixes.push("removed 'Id' suffix");
        }

        if (fixes.length > 0 && fixedName !== issue.name) {
          await tx.fieldDefn.update({
            where: { id: issue.id },
            data: { name: fixedName },
          });
          appliedFixes.push({
            type: 'field_name_fixed',
            fieldId: issue.id,
            modelId: issue.modelId,
            modelName: issue.modelName,
            from: issue.name,
            to: fixedName,
            reason: fixes.join(', '),
          });
        }
      }

      // 3. Fix UUID length constraints (clear minLength/maxLength)
      for (const issue of validationErrors.invalidUUIDLengthConstraints || []) {
        await tx.fieldDefn.update({
          where: { id: issue.id },
          data: { minLength: null, maxLength: null },
        });
        appliedFixes.push({
          type: 'uuid_constraints_cleared',
          fieldId: issue.id,
          modelId: issue.modelId,
          modelName: issue.modelName,
          fieldName: issue.name,
          reason: 'UUID fields cannot have length constraints',
        });
      }

      // 3.5. Fix foreign key data types (must be UUID)
      for (const issue of validationErrors.invalidForeignKeys || []) {
        // Only fix data type issues for confirmed foreign keys
        if (issue.isForeignKey === true && issue.dataType && issue.dataType !== 'UUID') {
          await tx.fieldDefn.update({
            where: { id: issue.id },
            data: { dataType: 'UUID' },
          });
          appliedFixes.push({
            type: 'foreign_key_datatype_fixed',
            fieldId: issue.id,
            modelId: issue.modelId,
            modelName: issue.modelName,
            fieldName: issue.name,
            from: issue.dataType,
            to: 'UUID',
            reason: 'Foreign key fields must use UUID data type',
          });
        }
      }

      // 4. Fix self-referencing FKs (make optional)
      for (const issue of validationErrors.nonOptionalSelfReferences || []) {
        await tx.fieldDefn.update({
          where: { id: issue.id },
          data: { isOptional: true },
        });
        appliedFixes.push({
          type: 'self_ref_made_optional',
          fieldId: issue.id,
          modelId: issue.modelId,
          modelName: issue.modelName,
          fieldName: issue.name,
          reason: 'Self-referencing foreign keys must be optional',
        });
      }

      // 5. Fix clickable link order (move to top 3)
      for (const issue of validationErrors.invalidClickableLinkOrders || []) {
        await tx.fieldDefn.update({
          where: { id: issue.fieldId },
          data: { order: 0 },
        });
        appliedFixes.push({
          type: 'clickable_link_reordered',
          fieldId: issue.fieldId,
          modelId: issue.id,
          modelName: issue.name,
          fieldName: issue.fieldName,
          fromOrder: issue.order,
          toOrder: 0,
          reason: 'Clickable link must be within top 3 fields (order <= 2)',
        });
      }

      // 6. Fix missing clickable links (set displayValue field as clickable)
      for (const issue of validationErrors.missingClickableLinks || []) {
        // Get the model's displayValueId to use as clickable link
        const model = await tx.modelDefn.findUnique({
          where: { id: issue.id },
          select: { displayValueId: true, displayValueTemplate: true },
        });

        if (model?.displayValueId) {
          await tx.fieldDefn.update({
            where: { id: model.displayValueId },
            data: { isClickableLink: true, order: 0 },
          });
          appliedFixes.push({
            type: 'clickable_link_set',
            fieldId: model.displayValueId,
            modelId: issue.id,
            modelName: issue.name,
            reason: 'Set display value field as clickable link',
          });
        } else if (!model?.displayValueTemplate) {
          // Cannot auto-fix if no displayValueId and no template
          logWithTrace(
            'Cannot auto-fix missing clickable link - no displayValueId configured',
            req,
            { modelId: issue.id, modelName: issue.name }
          );
        }
      }
    });

    logOperationSuccess('applyValidationAutoFixes', req, {
      microserviceId,
      fixesApplied: appliedFixes.length,
    });

    return { appliedFixes, success: true };
  },
  'apply_validation_auto_fixes'
);

/**
 * Build a human-readable summary of validation errors for display to users
 * @param {Object} validationErrors - The validation errors object from validateMicroserviceConfiguration
 * @returns {string} - A formatted summary string with all validation issues
 */
function buildValidationErrorSummary(validationErrors) {
  if (!validationErrors || typeof validationErrors !== 'object') {
    return 'Microservice validation failed';
  }

  const errorMessages = [];

  // Handle microservice-level errors
  if (validationErrors.invalidDomainName) {
    const item =
      typeof validationErrors.invalidDomainName === 'object'
        ? validationErrors.invalidDomainName
        : null;
    errorMessages.push(
      item?.issue ||
        'Microservice name contains invalid characters for domain names'
    );
  }
  if (validationErrors.missingLabel) {
    const item =
      typeof validationErrors.missingLabel === 'object'
        ? validationErrors.missingLabel
        : null;
    errorMessages.push(item?.issue || 'Microservice label is missing');
  }
  if (validationErrors.noMenus) {
    const item =
      typeof validationErrors.noMenus === 'object'
        ? validationErrors.noMenus
        : null;
    errorMessages.push(item?.issue || 'Microservice has no menus defined');
  }

  // Handle array-based errors with their issue field
  const arrayErrorKeys = [
    'modelsWithoutLabels',
    'modelsWithoutFields',
    'invalidModelNames',
    'duplicateModelNames',
    'missingDisplayValues',
    'invalidFieldNames',
    'duplicateFieldNames',
    'invalidForeignKeys',
    'invalidExternalForeignKeys',
    'nonOptionalSelfReferences',
    'missingUIFields',
    'invalidUUIDLengthConstraints',
    'multipleClickableLinks',
    'missingClickableLinks',
    'invalidClickableLinkOrders',
    'invalidIndexCounts',
    'migrationIssues',
  ];

  arrayErrorKeys.forEach((key) => {
    if (Array.isArray(validationErrors[key])) {
      validationErrors[key].forEach((item) => {
        if (item?.issue) {
          errorMessages.push(item.issue);
        } else if (item?.name) {
          // Fallback for items without issue field
          errorMessages.push(
            `${key}: ${item.name}${item.modelName ? ` in ${item.modelName}` : ''}`
          );
        }
      });
    }
  });

  if (errorMessages.length === 0) {
    return 'Microservice validation failed';
  }

  // Limit to first 10 errors for readability, with count of remaining
  const displayErrors = errorMessages.slice(0, 10);
  const remaining = errorMessages.length - displayErrors.length;

  let summary = `Validation failed with ${errorMessages.length} error(s):\n• ${displayErrors.join('\n• ')}`;
  if (remaining > 0) {
    summary += `\n... and ${remaining} more error(s). See errorDetails for full list.`;
  }

  return summary;
}

module.exports = {
  validateMicroserviceConfiguration,
  fetchSystemMenus,
  hasComputeAdminAccess,
  buildValidationErrorSummary,
  applyValidationAutoFixes,
};
