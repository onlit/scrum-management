const { getDetailsFromAPI } = require('#utils/shared/apiUtils.js');
const { getFormattedFieldName } = require('#utils/api/commonUtils.js');
const {
  isExternalForeignKey,
} = require('#utils/api/fieldTypeValidationUtils.js');
const {
  createStandardError,
  withErrorHandling,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  logWithTrace,
  logOperationStart,
  logOperationSuccess,
  logOperationError,
} = require('#utils/shared/traceUtils.js');
const prisma = require('#configs/prisma.js');

/**
 * Fetches fieldDefns for external models from compute-rapi's database
 * by looking up models using microservice name and model name.
 *
 * This enables dependency resolution for external FK fields by providing
 * the target model's field definitions needed to find the correct filter key.
 *
 * @param {Array} externalFkResults - Array of external FK details with resolved names
 * @param {Object} [req] - Request object for trace ID context
 * @returns {Promise<Map>} Map of "microserviceName:modelName" to fieldDefns array
 */
async function fetchExternalModelFieldDefnsByName(externalFkResults, req = null) {
  // Collect unique microservice/model name pairs from results that have resolved details
  const namePairs = externalFkResults
    .filter(
      (r) =>
        r.details?.externalMicroserviceId?.name &&
        r.details?.externalModelId?.name
    )
    .map((r) => ({
      msName: r.details.externalMicroserviceId.name,
      modelName: r.details.externalModelId.name,
    }));

  if (namePairs.length === 0) {
    logWithTrace('No external FK name pairs to look up', req);
    return new Map();
  }

  // Deduplicate name pairs
  const uniquePairs = [
    ...new Map(
      namePairs.map((p) => [`${p.msName}:${p.modelName}`, p])
    ).values(),
  ];

  logWithTrace('Looking up external model fieldDefns by name', req, {
    pairCount: uniquePairs.length,
  });

  try {
    // Query ModelDefn records matching these microservice/model name pairs
    const models = await prisma.modelDefn.findMany({
      where: {
        deleted: null,
        OR: uniquePairs.map(({ msName, modelName }) => ({
          name: modelName,
          microservice: { name: msName },
        })),
      },
      include: {
        microservice: { select: { name: true } },
        fieldDefns: {
          where: { deleted: null },
          select: {
            id: true,
            name: true,
            isForeignKey: true,
            foreignKeyModelId: true,
          },
        },
      },
    });

    logWithTrace('Found external models with fieldDefns', req, {
      foundCount: models.length,
    });

    // Build map of "microserviceName:modelName" -> fieldDefns
    return new Map(
      models.map((m) => [`${m.microservice.name}:${m.name}`, m.fieldDefns])
    );
  } catch (error) {
    logOperationError('fetchExternalModelFieldDefnsByName', req, error);
    logWithTrace('Failed to fetch external model fieldDefns, returning empty map', req);
    return new Map(); // Graceful degradation
  }
}

/**
 * Retrieves and enriches external foreign key relationships from domain models
 * @async
 * @param {Array<Model>} models - Array of domain models to process
 * @param {User} [user] - Authenticated user context for API access
 * @param {Object} [req] - Request object for trace ID context
 * @returns {Promise<Array<ExternalForeignKeyDetail>>} Array of enriched foreign key relationships
 * @throws {TypeError} If models parameter is not provided
 */
const getExternalForeignKeys = withErrorHandling(
  async (models, user, req = null) => {
    if (!models) {
      throw createStandardError(
        ERROR_TYPES.VALIDATION,
        'Models collection is required',
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'external_foreign_keys_validation',
          details: { modelsProvided: !!models },
        }
      );
    }

    logOperationStart('getExternalForeignKeys', req, {
      modelCount: models.length,
    });

    // Track all valid foreign key fields and unique API requests
    const { allExternalForeignKeyFields, uniqueExternalKeyRequests } =
      collectExternalForeignKeys(models, req);

    logWithTrace('Collected external foreign keys', req, {
      totalFields: allExternalForeignKeyFields.length,
      uniqueRequests: uniqueExternalKeyRequests.length,
    });

    // Fetch details once for each unique external reference
    const externalDetailsMap = await fetchExternalForeignKeyDetails(
      uniqueExternalKeyRequests,
      user,
      req
    );

    // Assemble initial results with API details
    const initialResults = assembleExternalForeignKeyResults(
      allExternalForeignKeyFields,
      externalDetailsMap,
      req
    );

    // Fetch fieldDefns from compute-rapi by name lookup for dependency resolution
    const fieldDefnsMap = await fetchExternalModelFieldDefnsByName(
      initialResults,
      req
    );

    // Enrich results with fieldDefns
    const results = initialResults.map((result) => {
      const key =
        result.details?.externalMicroserviceId?.name &&
        result.details?.externalModelId?.name
          ? `${result.details.externalMicroserviceId.name}:${result.details.externalModelId.name}`
          : null;

      return {
        ...result,
        fieldDefns: key ? fieldDefnsMap.get(key) || [] : [],
      };
    });

    logOperationSuccess('getExternalForeignKeys', req, {
      processedFields: results.length,
    });

    return results;
  },
  'external_foreign_keys_processing'
);

/**
 * Processes models to collect external foreign key references
 * @param {Array<Model>} models - Domain models to process
 * @param {Object} req - Request object for trace ID context
 * @returns {Object} Contains:
 * - allExternalForeignKeyFields: All valid foreign key fields
 * - uniqueExternalKeyRequests: Deduplicated API request parameters
 */
function collectExternalForeignKeys(models = null) {
  const allExternalForeignKeyFields = [];
  const uniqueExternalKeyRequests = [];
  const processedCompositeKeys = new Set();

  models.forEach((model) => {
    // Skip processing deleted models
    if (model.deleted) return;

    model.fieldDefns.forEach((field) => {
      // Validate field as external foreign key
      if (!isExternalForeignKey(field)) return;

      // Create unique identifier for external reference
      const compositeKey = createExternalKeyCompositeId(field);

      // Track all fields regardless of duplicates
      allExternalForeignKeyFields.push({
        sourceModel: model,
        field,
        compositeKey,
      });

      // Deduplicate API requests while preserving all field references
      if (!processedCompositeKeys.has(compositeKey)) {
        processedCompositeKeys.add(compositeKey);
        uniqueExternalKeyRequests.push(createExternalKeyApiRequest(field));
      }
    });
  });

  return { allExternalForeignKeyFields, uniqueExternalKeyRequests };
}

/**
 * Fetches external system details from microservice API
 * @async
 * @param {Array<ExternalKeyRequest>} requests - API request parameters
 * @param {User} [user] - Authentication context
 * @param {Object} [req] - Request object for trace ID context
 * @returns {Promise<Map>} Map of composite keys to API response details
 */
const fetchExternalForeignKeyDetails = withErrorHandling(
  async (requests, user, req = null) => {
    logWithTrace('Fetching external foreign key details', req, {
      requestCount: requests.length,
    });

    try {
      const apiResponse = await getDetailsFromAPI({
        results: requests,
        token: user?.accessToken,
      });

      // Convert API response to Map for efficient lookup
      const detailsMap = new Map(
        apiResponse.map((detail) => [
          createExternalKeyCompositeId(detail),
          detail.details,
        ])
      );

      logWithTrace('Successfully fetched external details', req, {
        responseCount: apiResponse.length,
      });

      return detailsMap;
    } catch (error) {
      logOperationError('fetchExternalForeignKeyDetails', req, error);
      logWithTrace('API fetch failed, returning empty map', req, {
        error: error.message,
      });
      return new Map(); // Graceful degradation
    }
  },
  'external_fk_details_fetch'
);

/**
 * Assembles final results with merged API details
 * @param {Array<ExternalKeyField>} fields - Valid foreign key fields
 * @param {Map} detailsMap - External details from API
 * @param {Object} req - Request object for trace ID context
 * @returns {Array<ExternalForeignKeyDetail>} Enriched results
 */
function assembleExternalForeignKeyResults(fields, detailsMap, req = null) {
  const results = fields.map(({ sourceModel, field, compositeKey }) => {
    const details = detailsMap.get(compositeKey);

    if (!details) {
      logWithTrace('Missing details for external key', req, {
        compositeKey,
        fieldName: field.name,
        modelName: sourceModel.name,
      });
    }

    return {
      modelId: sourceModel.id,
      fieldId: field.id,
      fieldName: getFormattedFieldName(field.name, true),
      externalMicroserviceId: field.externalMicroserviceId,
      externalModelId: field.externalModelId,
      details: details || null, // Maintain null for missing details
    };
  });

  return results;
}

/* -------------------- External Key Utilities -------------------- */

/**
 * Creates a composite identifier for external key tracking
 * @param {Object} keySource - Object containing external IDs
 * @returns {string} Colon-separated composite identifier
 */
function createExternalKeyCompositeId(keySource) {
  return `${keySource.externalMicroserviceId}:${keySource.externalModelId}`;
}

/**
 * Creates an API request payload for external key resolution
 * @param {FieldDef} field - Validated foreign key field
 * @returns {ExternalKeyRequest} API request parameters
 */
function createExternalKeyApiRequest(field) {
  return {
    externalMicroserviceId: field.externalMicroserviceId,
    externalModelId: field.externalModelId,
  };
}

module.exports = { getExternalForeignKeys };
