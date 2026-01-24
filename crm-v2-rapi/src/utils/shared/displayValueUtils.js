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
const { interpolateTemplate } = require('#utils/shared/stringUtils.js');

// Feature flag (opt-out): set FEATURE_DISPLAY_TEMPLATES=false to bypass templates
const FEATURE_DISPLAY_TEMPLATES =
  process.env.FEATURE_DISPLAY_TEMPLATES !== 'false';

/**
 * Normalizes model identifiers to PascalCase for lookups in constants maps.
 * Accepts camelCase, snake_case, kebab-case, or already-pascal inputs.
 */
function normalizeModelName(input) {
  if (typeof input !== 'string' || !input) return input;
  return _.upperFirst(_.camelCase(input));
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
 * @returns {string|undefined}
 */
function computeDisplayValue(record, modelName) {
  if (!record || !modelName) return undefined;

  const template = DISPLAY_VALUE_TEMPLATES?.[modelName];
  const fallbackField = DISPLAY_VALUE_FALLBACK_FIELDS?.[modelName];

  if (
    FEATURE_DISPLAY_TEMPLATES &&
    typeof template === 'string' &&
    template.trim()
  ) {
    try {
      const value = interpolateTemplate(template, record);
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
 * @returns {object}
 */
function enrichRecordDisplayValues(record, modelNameLike) {
  if (!record) return record;

  const normalizedModel = normalizeModelName(modelNameLike);

  // Step 1: attach display values to direct nested relations
  const relationModelPairs = inferRelationModelPairs(record);
  let enriched =
    relationModelPairs.length > 0
      ? attachNestedDisplayValues({ ...record }, relationModelPairs)
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
      enriched.details = attachNestedDisplayValues(detailsClone, detailPairs);
    }
  }

  // Step 2: compute the record's own display value using the enriched relations
  const dv = computeDisplayValue(enriched, normalizedModel);
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
 * @returns {object} The same record reference with nested display values attached
 */
function attachNestedDisplayValues(record, relationModelPairs) {
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

    const relationRecord = record?.[relationName];
    if (!relationRecord || typeof relationRecord !== 'object') continue;

    // Recursively process sub-relations BEFORE interpolating templates.
    // This ensures nested objects like personRelationship.person have __displayValue
    // before we try to use {person} template for personRelationship.
    const subRelationPairs = inferRelationModelPairs(relationRecord);
    if (subRelationPairs.length > 0) {
      attachNestedDisplayValues(relationRecord, subRelationPairs);
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
        dv = interpolateTemplate(template, relationRecord);
      } catch (_err) {
        // fall through to fallback
      }
    }

    // Fallback to configured field (with relation-aware handling)
    if (!dv || (typeof dv === 'string' && !dv.trim())) {
      if (fallbackField) {
        let fallbackValue = relationRecord?.[fallbackField];

        if (_.isPlainObject(fallbackValue)) {
          // Prefer the nested object's own display value if it already exists
          dv = fallbackValue[DISPLAY_VALUE_PROP];

          // If that is missing/blank, attempt to compute and attach a display
          // value for the nested model inferred from the fallback field name.
          if (!dv || (typeof dv === 'string' && !dv.trim())) {
            const nestedModelName = normalizeModelName(fallbackField);
            const nestedDv = computeDisplayValue(
              fallbackValue,
              nestedModelName
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
          dv = fallbackValue;
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
