/**
 * Shared utility for computing a record's displayValue in generated APIs.
 * Uses model-scoped template and fallback field baked into configs/constants.js.
 */

const _ = require('lodash');
const {
  DISPLAY_VALUE_TEMPLATES,
  DISPLAY_VALUE_FALLBACK_FIELDS,
  DISPLAY_VALUE_PROP,
} = require('#configs/constants.js');
const {
  interpolateTemplate,
  formatDateForDisplay,
  FORMAT_HINTS,
  toPascalCase,
} = require('#utils/stringUtils.js');
/**
 * Checks if a value is a Date object or an ISO date string (UTC with 'Z' suffix or timezone offset).
 * This pattern matches JavaScript Date objects and ISO 8601 datetime strings that include a time component.
 *
 * @param {*} value - The value to check
 * @returns {boolean} True if the value is a Date object or looks like an ISO datetime string
 */
function isIsoDateTimeString(value) {
  // Handle JavaScript Date objects (returned by Prisma for DateTime fields)
  if (value instanceof Date) {
    return !isNaN(value.getTime());
  }
  if (typeof value !== 'string') return false;
  // Match ISO 8601 datetime with 'Z' suffix or timezone offset (+/-HH:MM or +/-HHMM)
  // Examples: 2026-01-19T09:27:29.000Z, 2026-01-19T09:27:29+05:30
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.test(
    value
  );
}
// Feature flag (opt-out): set FEATURE_DISPLAY_TEMPLATES=false to bypass templates
const FEATURE_DISPLAY_TEMPLATES =
  process.env.FEATURE_DISPLAY_TEMPLATES !== 'false';

/**
 * Normalizes model identifiers to PascalCase for lookups in constants maps.
 * Accepts camelCase, snake_case, kebab-case, or already-pascal inputs.
 */
function normalizeModelName(input) {
  if (typeof input !== 'string' || !input) return input;
  return toPascalCase(input);
}

/**
 * Scans a flat record and builds relation/model pairs for relations that have
 * configured display value fallback fields.
 */
function inferRelationModelPairs(record) {
  if (!record || typeof record !== 'object') return [];

  const pairs = [];
  for (const [key, value] of Object.entries(record)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;

    const normalized = normalizeModelName(key);
    if (DISPLAY_VALUE_FALLBACK_FIELDS?.[normalized]) {
      pairs.push({ relation: key, model: normalized });
    }
  }
  return pairs;
}

/**
 * Computes the display value for a given record and model using baked configuration.
 *
 * Order of precedence:
 * 1) If templates are enabled and a template exists for the model, interpolate it.
 * 2) If interpolation yields a falsy/blank result or templates disabled, fall back to the configured field.
 *
 * @param {object} record - The record object to compute display for
 * @param {string} modelName - The PascalCase model name as baked in constants maps
 * @param {object} [options] - Optional settings
 * @param {string} [options.timezone] - IANA timezone for date formatting
 * @returns {string|undefined}
 */
function computeDisplayValue(record, modelName, options = {}) {
  if (!record || !modelName) return undefined;

  const template = DISPLAY_VALUE_TEMPLATES?.[modelName];
  const fallbackField = DISPLAY_VALUE_FALLBACK_FIELDS?.[modelName];

  if (
    FEATURE_DISPLAY_TEMPLATES &&
    typeof template === 'string' &&
    template.trim()
  ) {
    try {
      const value = interpolateTemplate(template, record, {
        timezone: options.timezone,
      });
      if (value && typeof value === 'string' && value.trim()) {
        return value;
      }
    } catch (_err) {
      // Intentionally swallow interpolation errors and proceed to fallback
    }
  }

  if (!fallbackField) return undefined;

  let fallbackValue = record?.[fallbackField];

  // If the direct field doesn't exist, check if it's available in details
  // This handles cases where relations are populated via getDetailsFromAPI
  if (!fallbackValue && record?.details) {
    const detailsKey = `${fallbackField}Id`;
    fallbackValue = record.details[detailsKey];
  }

  if (_.isPlainObject(fallbackValue)) {
    return fallbackValue[DISPLAY_VALUE_PROP];
  }

  // Format ISO datetime strings with the user's timezone
  if (isIsoDateTimeString(fallbackValue)) {
    return formatDateForDisplay(
      fallbackValue,
      FORMAT_HINTS.DATETIME,
      options.timezone
    );
  }

  return fallbackValue;
}

/**
 * Enriches a record with its own display value and any direct nested relations' display values.
 *
 * Order of operations:
 * 1) Enrich direct nested relations so that relation-based templates can safely use relation.__displayValue.
 * 2) Compute and attach the top-level display value for the record itself.
 *
 * @param {object} record
 * @param {string} modelNameLike - camelCase or PascalCase model identifier
 * @param {object} [options] - Optional settings
 * @param {string} [options.timezone] - IANA timezone for date formatting
 * @returns {object}
 */
function enrichRecordDisplayValues(record, modelNameLike, options = {}) {
  if (!record) return record;

  const normalizedModel = normalizeModelName(modelNameLike);

  // Step 1: attach display values to direct nested relations
  const relationModelPairs = inferRelationModelPairs(record);
  let enriched =
    relationModelPairs.length > 0
      ? attachNestedDisplayValues({ ...record }, relationModelPairs, options)
      : { ...record };

  // Step 1.5: attach display values to objects in details (if any)
  if (enriched.details && typeof enriched.details === 'object') {
    const detailPairs = [];
    for (const [key, value] of Object.entries(enriched.details)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;

      // Infer model from key (e.g. 'countryId' -> 'Country', 'accountManagerId' -> 'AccountManager')
      // We strip 'Id' suffix if present to guess the model name
      const modelGuess = key.endsWith('Id') ? key.slice(0, -2) : key;
      const normalized = normalizeModelName(modelGuess);

      // Check if we have config for this model
      if (
        DISPLAY_VALUE_FALLBACK_FIELDS?.[normalized] ||
        DISPLAY_VALUE_TEMPLATES?.[normalized]
      ) {
        detailPairs.push({ relation: key, model: normalized });
      }
    }

    if (detailPairs.length > 0) {
      const detailsClone = _.cloneDeep(enriched.details);
      enriched.details = attachNestedDisplayValues(
        detailsClone,
        detailPairs,
        options
      );
    }
  }

  // Step 2: compute the record's own display value using the enriched relations
  const dv = computeDisplayValue(enriched, normalizedModel, options);
  if (dv && typeof dv === 'string' && dv.trim()) {
    enriched = { ...enriched, [DISPLAY_VALUE_PROP]: dv };
  }

  return enriched;
}

/**
 * Attaches computed display values on specified nested relation objects of a record.
 *
 * @param {object} record - The parent record that contains nested relation objects
 * @param {Array<{relation: string, model: string}>} relationModelPairs - Pairs of relation prop and PascalCase model name
 * @param {object} [options] - Optional settings
 * @param {string} [options.timezone] - IANA timezone for date formatting
 * @returns {object} The same record reference with nested display values attached
 */
function attachNestedDisplayValues(record, relationModelPairs, options = {}) {
  if (
    !record ||
    !Array.isArray(relationModelPairs) ||
    relationModelPairs.length === 0
  ) {
    return record;
  }

  for (const pair of relationModelPairs) {
    const relationName = pair?.relation;
    const modelName = pair?.model;
    if (!relationName || !modelName) continue;

    let relationRecord = record?.[relationName];
    if (!relationRecord || typeof relationRecord !== 'object') continue;

    // Recursively process nested relations within this relation first
    // This ensures nested objects have __displayValue attached before we compute the parent's
    const nestedPairs = inferRelationModelPairs(relationRecord);
    if (nestedPairs.length > 0) {
      relationRecord = attachNestedDisplayValues(
        relationRecord,
        nestedPairs,
        options
      );
      record[relationName] = relationRecord;
    }

    const template = DISPLAY_VALUE_TEMPLATES?.[modelName];
    const fallbackField = DISPLAY_VALUE_FALLBACK_FIELDS?.[modelName];
    let dv;
    let nextRelationRecord = relationRecord;

    // Try model-scoped template first (if enabled)
    if (
      FEATURE_DISPLAY_TEMPLATES &&
      typeof template === 'string' &&
      template.trim()
    ) {
      try {
        dv = interpolateTemplate(template, relationRecord, {
          timezone: options.timezone,
        });
      } catch (_err) {
        // fall through to fallback
      }
    }

    // Fallback to configured field (with relation-aware handling)
    if (!dv || (typeof dv === 'string' && !dv.trim())) {
      if (fallbackField) {
        let fallbackValue = relationRecord?.[fallbackField];

        // If the direct field doesn't exist, check if it's available in details
        // This handles cases where relations are populated via getDetailsFromAPI
        if (!fallbackValue && relationRecord?.details) {
          const detailsKey = `${fallbackField}Id`;
          fallbackValue = relationRecord.details[detailsKey];
        }

        if (_.isPlainObject(fallbackValue)) {
          // Prefer the nested object's own display value if it already exists
          dv = fallbackValue[DISPLAY_VALUE_PROP];

          // If that is missing/blank, attempt to compute and attach a display
          // value for the nested model inferred from the fallback field name.
          if (!dv || (typeof dv === 'string' && !dv.trim())) {
            const nestedModelName = normalizeModelName(fallbackField);
            const nestedDv = computeDisplayValue(
              fallbackValue,
              nestedModelName,
              options
            );

            if (nestedDv != null && typeof nestedDv !== 'object') {
              fallbackValue = {
                ...fallbackValue,
                [DISPLAY_VALUE_PROP]: nestedDv,
              };
              dv = nestedDv;
            }
          }

          // Ensure the (potentially) enriched nested object is written back
          nextRelationRecord = {
            ...relationRecord,
            [fallbackField]: fallbackValue,
          };
        } else {
          // Format ISO datetime strings with the user's timezone
          dv = isIsoDateTimeString(fallbackValue)
            ? formatDateForDisplay(
                fallbackValue,
                FORMAT_HINTS.DATETIME,
                options.timezone
              )
            : fallbackValue;
        }
      }
    }

    // Only attach a __displayValue when it resolves to a non-object value
    if (dv != null && typeof dv !== 'object') {
      record[relationName] = {
        ...nextRelationRecord,
        [DISPLAY_VALUE_PROP]: dv,
      };
    }
  }

  return record;
}

module.exports = {
  computeDisplayValue,
  DISPLAY_VALUE_PROP,
  attachNestedDisplayValues,
  normalizeModelName,
  inferRelationModelPairs,
  enrichRecordDisplayValues,
};
