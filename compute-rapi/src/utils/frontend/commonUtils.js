const {
  convertToSlug,
  toStartCaseNoSpaces,
  toStartCaseUpperUnderscore,
  toCamelCase,
} = require('#utils/shared/stringUtils.js');
const { filterDeleted } = require('#utils/shared/generalUtils.js');
const { resolveModelSlug } = require('#utils/api/commonUtils.js');
const { logWithTrace } = require('#utils/shared/traceUtils.js');

function sortModelFields(a, b) {
  return (a?.order ?? 0) - (b?.order ?? 0);
}

function getModelName({ model }) {
  return model?.name ?? '';
}

function getModelFields({ model }) {
  return filterDeleted(model?.fieldDefns ?? []);
}

function generateMicroserviceSubdomains(microserviceName) {
  const slug = convertToSlug(microserviceName);

  return {
    dev: `https://sandbox.${slug}.pullstream.com`,
    staging: `https://${slug}.staging.pullstream.com`,
    prod: `https://${slug}.pullstream.com`,
  };
}

function addForeignKeyToMicroserviceMap(
  foreignKeyModel,
  foreignKeysByMicroservice,
  microserviceSlug
) {
  if (!foreignKeyModel) return;

  const fkModelStartCased = toStartCaseNoSpaces(foreignKeyModel?.name);

  foreignKeysByMicroservice[microserviceSlug] = [
    ...(foreignKeysByMicroservice[microserviceSlug] || []),
    fkModelStartCased,
  ];
}

function isValidModel({ modelName, modelFields }) {
  return modelName && modelFields.length > 0;
}

function generateModelPagesDirPath({ model, frontend }) {
  const slug = resolveModelSlug(model);
  const pagePath = [frontend?.path, 'src', 'pages', slug];
  return pagePath;
}

function processDateAndDateTimeImports(modelFields, includeMoment = true) {
  const containsFieldWithType = (type) => {
    return modelFields.some(({ dataType, foreignKeyModel }) => {
      const resolvedDataType =
        foreignKeyModel?.displayValue?.dataType || dataType;
      return resolvedDataType === type;
    });
  };

  const imports = [];

  const hasDateField = containsFieldWithType('Date');
  const hasDateTimeField = containsFieldWithType('DateTime');

  if (hasDateField || hasDateTimeField) {
    if (includeMoment) {
      imports.push(`import moment, { Moment } from 'moment';`);
    }

    if (hasDateField && hasDateTimeField) {
      imports.push(
        `import { formatToUTCDate, formatToUTCDateTime, formatDate, formatDateTime } from '@ps/shared-core/config/dateUtils';`
      );
    } else if (hasDateField) {
      imports.push(
        `import { formatToUTCDate, formatDate } from '@ps/shared-core/config/dateUtils';`
      );
    } else if (hasDateTimeField) {
      imports.push(
        `import { formatToUTCDateTime, formatDateTime } from '@ps/shared-core/config/dateUtils';`
      );
    }
  }

  return imports;
}

function consolidateImports(imports, context) {
  const importsMap = new Map();
  const importPattern =
    /^import\s*(?:(\w+)(?:\s*,\s*{([\w\s,]*)}\s*)?|{([\w\s,]*)})\s+from\s+['"](.*?)['"];?$/;
  const namespacePattern =
    /^import\s*(?:(\w+)\s*,\s*)?\*\s+as\s+(\w+)\s+from\s+['"](.*?)['"];?$/;

  // Normalize and dedupe raw import strings up-front
  const uniqueImports = Array.from(
    new Set(
      (imports || [])
        .filter((imp) => typeof imp === 'string' && imp.trim().length > 0)
        .map((imp) => imp.trim().replace(/;+$/, ''))
    )
  );

  uniqueImports.forEach((normalized) => {
    try {
      let defaultImport = null;
      let namedWithDefault = null;
      let namedOnly = null;
      let namespaceImport = null;
      let cleanPath = null;

      const nsMatch = normalized.match(namespacePattern);
      if (nsMatch) {
        // Handles: import default?, * as NS from 'path'
        // nsMatch: [full, default?, namespace, path]
        [, defaultImport, namespaceImport, cleanPath] = nsMatch;
      } else {
        const match = normalized.match(importPattern);
        if (!match) {
          logWithTrace(`Invalid import format: ${normalized}`, context, {
            imp: normalized,
          });
          return;
        }
        [, defaultImport, namedWithDefault, namedOnly, cleanPath] = match;
      }

      cleanPath = cleanPath?.trim();

      if (!cleanPath) {
        logWithTrace(`Missing path in import: ${normalized}`, context, {
          imp: normalized,
        });
        return;
      }

      // Initialize path entry
      if (!importsMap.has(cleanPath)) {
        importsMap.set(cleanPath, {
          default: null,
          named: new Set(),
          namespaces: new Set(),
        });
      }

      const entry = importsMap.get(cleanPath);

      // Process default import
      if (defaultImport) {
        if (entry.default && entry.default !== defaultImport) {
          logWithTrace(
            `Default import conflict for ${cleanPath}: ${entry.default} vs ${defaultImport}`,
            context,
            { cleanPath, defaultImport, existing: entry.default }
          );
        }
        entry.default = entry.default || defaultImport;
      }

      if (namespaceImport) {
        entry.namespaces.add(namespaceImport);
      }

      // Process named imports
      const namedItems = (namedWithDefault || namedOnly || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      namedItems.forEach((item) => entry.named.add(item));
    } catch (error) {
      logWithTrace(`Failed to process import: ${normalized}`, context, {
        error,
      });
    }
  });

  // Generate consolidated imports
  const consolidatedList = Array.from(importsMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([path, { default: defaultImp, named, namespaces }]) => {
      const lines = [];
      if (namespaces.size) {
        // If there are namespace imports for this path, emit them each.
        Array.from(namespaces)
          .sort()
          .forEach((ns) => lines.push(`import * as ${ns} from '${path}';`));
      }
      const parts = [];
      if (defaultImp) parts.push(defaultImp);
      if (named.size) parts.push(`{ ${Array.from(named).sort().join(', ')} }`);
      if (parts.length) {
        lines.push(`import ${parts.join(', ')} from '${path}';`);
      }
      return lines;
    });

  // Ensure final result is unique as well (defensive)
  return Array.from(new Set(consolidatedList));
}

function escapeStringForJSX(str) {
  const value = str == null ? '' : String(str);

  return value
    .replace(/\\/g, '\\\\') // escape backslash
    .replace(/`/g, '\\`') // escape backtick (template literal)
    .replace(/\$\{/g, '\\${') // escape template interpolation
    .replace(/\r/g, '\\r') // escape carriage returns
    .replace(/\n/g, '\\n') // escape newlines
    .replace(/'/g, "\\'") // escape single quotes (safe for '...')
    .replace(/"/g, '\\"'); // escape double quotes (safe for "...")
}

function getReminderEntityModelKey(microserviceName, modelName) {
  const msConstant = toStartCaseUpperUnderscore(microserviceName);
  const modelConstant = toStartCaseUpperUnderscore(modelName);
  return `${msConstant}_${modelConstant}`;
}

function getReminderEntityModelValue(modelName) {
  return toCamelCase(modelName);
}

/**
 * Resolves the correct URL filter parameter name for a dependent FK field.
 *
 * When field A depends on field B:
 * - field A's foreignKeyModel is the target model being filtered (e.g., ProspectPipelineStage)
 * - field B's foreignKeyModel is the model to filter by (e.g., ProspectPipeline)
 *
 * The filter should use the FK field name from the TARGET model that points to
 * the dependency's FK model, not the source field's name.
 *
 * For external FK fields, the target model's fieldDefns are fetched from compute-rapi's
 * database (via name lookup) and passed as the third parameter.
 *
 * @param {Object} field - The dependent field (e.g., Prospect.status)
 * @param {Object} dependencyField - The field it depends on (e.g., Prospect.prospectPipeline)
 * @param {Array} [externalFieldDefns] - Optional fieldDefns for external FK models
 * @returns {string|null} The correct filter field name with 'Id' suffix (e.g., 'pipelineId')
 */
function resolveDependencyFilterKey(field, dependencyField, externalFieldDefns = null) {
  if (!dependencyField) return null;

  // Get the target model's fields - check internal FK first, then external
  const targetModelFields =
    field?.foreignKeyModel?.fieldDefns || externalFieldDefns;
  // Get the dependency field's FK model ID (the model to filter by)
  const dependencyFkModelId =
    dependencyField?.foreignKeyModel?.id || dependencyField?.foreignKeyModelId;

  if (targetModelFields && dependencyFkModelId) {
    // Find the FK field in the target model that points to the dependency's FK model
    const matchingFkField = targetModelFields.find(
      (f) => f.isForeignKey && f.foreignKeyModelId === dependencyFkModelId
    );

    if (matchingFkField?.name) {
      return `${toCamelCase(matchingFkField.name)}Id`;
    }
  }

  // Fallback: use the dependency field's name (original behavior)
  return dependencyField?.name ? `${toCamelCase(dependencyField.name)}Id` : null;
}

module.exports = {
  getModelName,
  getModelFields,
  generateMicroserviceSubdomains,
  addForeignKeyToMicroserviceMap,
  isValidModel,
  generateModelPagesDirPath,
  processDateAndDateTimeImports,
  consolidateImports,
  sortModelFields,
  escapeStringForJSX,
  getReminderEntityModelKey,
  getReminderEntityModelValue,
  resolveDependencyFilterKey,
};
