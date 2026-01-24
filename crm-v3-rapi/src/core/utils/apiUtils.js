/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains functions for interacting with external APIs, including functionalities such as uploading files to a server and fetching additional details from an API. It handles forming requests, processing responses, and error management related to API communications.
 *
 *
 */
const axios = require('axios');
const fs = require('fs').promises;
const { getFilesURL, getLogsURL } = require('#configs/routes.js');
const { UUID_KEY_VALUE_PAIRS, CALENDAR_HOST } = require('#configs/constants.js');
const { logEvent } = require('#utils/basicLoggingUtils.js');
const LRUCache = require('#utils/security/lruCache.js');

// Toggle for verbose [DEBUG] logs within getDetailsFromAPI
const GET_DETAILS_DEBUG = true;
function debugLog(message) {
  if (GET_DETAILS_DEBUG) logEvent(message);
}

// Optional Redis (fallback to LRU if not installed or unavailable)
let Redis;
try {
  // eslint-disable-next-line global-require
  Redis = require('ioredis');
} catch (e) {
  Redis = null;
}

const IS_TEST_ENV = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;

let redisClient = null;
function getRedisClient() {
  if (IS_TEST_ENV) return null;
  if (!Redis) return null;
  if (redisClient) return redisClient;
  try {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'crm-v2-redis',
      port: Number(process.env.REDIS_PORT || 6379),
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    // Avoid noisy logs; we already have app-level logging
    redisClient.on('error', () => {});
    return redisClient;
  } catch (err) {
    return null;
  }
}

// In-memory cache as robust fallback
const apiDetailsCache = new LRUCache(50000, 10 * 60 * 1000); // 50k items, 10 minutes

function getHostKeyPart(host) {
  try {
    const u = new URL(host);
    return u.host || host;
  } catch (e) {
    return host;
  }
}

// Ensure a base host string is a valid absolute URL with protocol and without trailing slash
function normalizeBaseUrl(host) {
  if (!host || typeof host !== 'string') return null;
  const trimmed = host.trim();
  const withScheme = /^(https?:)?\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    // Drop trailing slash for consistent joins
    const base = `${u.protocol}//${u.host}`;
    return base;
  } catch (e) {
    return null;
  }
}

// Join base URL and path ensuring single slash separator
function joinUrl(base, path) {
  if (!base || !path) return null;
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

// Safe string for logging a URL without throwing on malformed input
function safeUrlDisplay(maybeUrl) {
  try {
    const u = new URL(maybeUrl);
    return `${u.origin}${u.pathname}`;
  } catch (e) {
    return String(maybeUrl || '');
  }
}

function buildDetailsCacheKey(host, fieldName, model, id) {
  const hostKey = getHostKeyPart(host);
  return `api_details:${hostKey}:${fieldName}:${model}:${id}`;
}

async function exportDBLogs(payloads) {
  payloads.map(async (payload) => {
    try {
      const response = await axios.post(getLogsURL(), payload);
      return response;
    } catch (error) {
      // Log sanitized error without exposing sensitive response data
      logEvent(`[DB_LOG_ERROR] Failed to export logs: ${error.message}`);
      return null;
    }
  });
}

async function uploadLocalFile(tempFilePath, accessToken) {
  const formData = new FormData();
  formData.append('anonymous_can_see_it', 'true');
  formData.append('file', fs.createReadStream(tempFilePath));

  const { data } = await axios.post(getFilesURL(), formData, {
    headers: { Authorization: accessToken },
  });

  return data?.fileUrl;
}

/**
 * Retrieves additional details from an API based on given results.
 *
 * When a token is provided, it calls the external route with the Authorization header.
 * When no token is provided, it will call the internal route—but only for fields that have one.
 * If a field doesn't have an internal route and no token is provided, that field is skipped.
 *
 * @async
 * @function getDetailsFromAPI
 *
 * @param {Object} options - The options object.
 * @param {Array} options.results - The results array.
 * @param {String} [options.token] - The user auth token.
 * @returns {Promise<Array>} The updated results array with additional details.
 */
async function getDetailsFromAPI({ results, token }) {
  // If results is not an array or is empty, immediately return an empty array.
  if (!Array.isArray(results) || !results.length) {
    return [];
  }

  // Object to store additional details keyed by field name.
  const fieldDataMap = {};

  // Build a reverse index from field name to an array of configs { host, route, model }
  // Multiple models can legitimately map to the same field name (e.g., roleId)
  const FIELD_TO_CONFIG = (() => {
    const map = {};
    const pairs = UUID_KEY_VALUE_PAIRS || {};
    for (const host of Object.keys(pairs)) {
      const hostCfg = pairs[host];
      if (!hostCfg || !hostCfg.models) continue;
      const { route } = hostCfg;
      for (const model of Object.keys(hostCfg.models)) {
        const fieldsObj = hostCfg.models[model] || {};
        for (const fieldName of Object.keys(fieldsObj)) {
          if (!map[fieldName]) map[fieldName] = [];
          map[fieldName].push({ host, route, model });
        }
      }
    }
    return map;
  })();

  // Object to group fields by their host. Each host will map to an array of field configurations.
  const fieldsByHost = {};

  // Process keys from the first record to determine which fields to query for additional details.
  // We filter keys that end with 'Id' and have a corresponding configuration in UUID_KEY_VALUE_PAIRS.
  Object.keys(results[0])
    .filter(
      (key) =>
        key.endsWith('Id') &&
        FIELD_TO_CONFIG[key] &&
        FIELD_TO_CONFIG[key].length
    )
    .forEach((key) => {
      const configs = FIELD_TO_CONFIG[key];
      // For model awareness, enqueue one request per model that claims this field
      configs.forEach(({ host, route, model }) => {
        if (!fieldsByHost[host]) {
          fieldsByHost[host] = [];
        }
        fieldsByHost[host].push({ id: key, fieldName: key, route, model });
      });
    });

  // Loop through each host group to fetch additional details.
  for (const host in fieldsByHost) {
    const fields = fieldsByHost[host];

    // Using host-level routes only; no internal route filtering required
    // Skip the current host if there are no fields to process.
    if (fields.length === 0) continue;

    // Determine the API endpoint URL using the host-level route
    const baseHost = normalizeBaseUrl(host);
    if (!baseHost) {
      logEvent(`[API_CALL_SKIP] Invalid base URL for host: ${String(host)}`);
      continue;
    }
    const routePath = fields[0].route;
    if (!routePath) {
      logEvent(`[API_CALL_SKIP] Missing route for host ${String(host)}`);
      continue;
    }
    const url = joinUrl(baseHost, routePath);

    // Build a map for each field containing unique IDs from the results
    // This groups the IDs to be sent for each field in the API request.
    const idMaps = fields.reduce((map, field) => {
      // Use Set to automatically deduplicate IDs for this field
      map[field.fieldName] = Array.from(
        results.reduce((uniqueIds, record) => {
          const value = record?.[field.fieldName];
          if (value) {
            uniqueIds.add(value);
          }
          return uniqueIds;
        }, new Set()) // Initialize with empty Set
      );
      return map;
    }, {});

    // Resolve cached values first to avoid unnecessary API calls
    const redis = getRedisClient();
    const TTL_SECONDS = 10 * 60; // 10 minutes

    // Tracks IDs still missing after cache lookups
    const missingIdMaps = {};

    debugLog(
      `[DEBUG] Starting cache lookup for ${
        fields.length
      } fields from host: ${getHostKeyPart(host)}`
    );

    for (const field of fields) {
      const { fieldName, model } = field;
      const ids = idMaps[fieldName] || [];

      // Nothing to do for this field
      if (!ids.length) {
        missingIdMaps[fieldName] = [];
        debugLog(`[DEBUG] Field '${fieldName}' has no IDs to process`);
        continue;
      }

      debugLog(
        `[DEBUG] Processing field '${fieldName}' (${model}): ${ids.length} unique IDs`
      );

      // 1) In-memory LRU lookup
      const stillMissingAfterLRU = [];
      const cachedDetailsForField = {};

      for (const id of ids) {
        const cacheKey = buildDetailsCacheKey(host, fieldName, model, id);
        const cached = apiDetailsCache.get(cacheKey);
        if (cached !== undefined) {
          cachedDetailsForField[id] = cached;
        } else {
          stillMissingAfterLRU.push(id);
        }
      }

      const lruHits = ids.length - stillMissingAfterLRU.length;
      debugLog(
        `[DEBUG] LRU Cache - Field '${fieldName}': ${lruHits} hits, ${stillMissingAfterLRU.length} misses`
      );

      // 2) Redis lookup (if available) for those still missing
      let stillMissing = stillMissingAfterLRU;
      if (redis && stillMissingAfterLRU.length) {
        const keys = stillMissingAfterLRU.map((id) =>
          buildDetailsCacheKey(host, fieldName, model, id)
        );
        try {
          // mget returns array aligned with keys
          const values = await redis.mget(keys);
          const notFound = [];
          for (let i = 0; i < keys.length; i += 1) {
            const val = values[i];
            if (val !== null && val !== undefined) {
              try {
                const parsed = JSON.parse(val);
                const id = stillMissingAfterLRU[i];
                cachedDetailsForField[id] = parsed;
                // Warm the LRU with Redis hit
                apiDetailsCache.set(keys[i], parsed);
              } catch (e) {
                notFound.push(stillMissingAfterLRU[i]);
              }
            } else {
              notFound.push(stillMissingAfterLRU[i]);
            }
          }
          stillMissing = notFound;
          const redisHits = stillMissingAfterLRU.length - notFound.length;
          debugLog(
            `[DEBUG] Redis Cache - Field '${fieldName}': ${redisHits} hits, ${notFound.length} misses`
          );
        } catch (e) {
          // On Redis error, proceed as if nothing found
          stillMissing = stillMissingAfterLRU;
          debugLog(
            `[DEBUG] Redis error for field '${fieldName}': ${e.message}`
          );
        }
      }

      // Merge cached details into fieldDataMap for later attachment
      if (Object.keys(cachedDetailsForField).length) {
        const existing = fieldDataMap[fieldName] || {};
        existing[model] = Object.assign(
          existing[model] || {},
          cachedDetailsForField
        );
        fieldDataMap[fieldName] = existing;
        debugLog(
          `[DEBUG] Merged ${
            Object.keys(cachedDetailsForField).length
          } cached details for field '${fieldName}'`
        );
      }

      // Record remaining IDs to fetch from API
      missingIdMaps[fieldName] = stillMissing;
      debugLog(
        `[DEBUG] Field '${fieldName}' requires API fetch for ${stillMissing.length} IDs`
      );
    }

    // Construct payload only for fields that still have missing IDs
    const data = fields
      .filter((field) => (missingIdMaps[field.fieldName] || []).length > 0)
      .map((field) => ({
        field_name: field.fieldName,
        model: field.model,
        ids: missingIdMaps[field.fieldName],
      }));

    try {
      // Build the Axios request configuration.
      // Include the Authorization header if a token is provided.
      const config = token ? { headers: { Authorization: token } } : {};

      // Log only essential information for debugging (no sensitive data)
      logEvent(`[API_CALL] Fetching details from: ${safeUrlDisplay(url)}`);
      logEvent(`[API_CALL] Field count: ${fields.length}`);

      // If there is nothing to fetch after cache hits, skip the request
      if (!Array.isArray(data) || data.length === 0) {
        logEvent(
          '[API_CALL] Skipping request: all IDs resolved from cache or empty'
        );
        continue;
      }

      // Guard: do not call API if every field's ids are empty arrays
      const totalIdsToFetch = data.reduce(
        (acc, item) => acc + (item.ids?.length || 0),
        0
      );
      if (totalIdsToFetch === 0) {
        logEvent('[API_CALL] Skipping request: no IDs to fetch');
        continue;
      }

      // Execute a POST request to the determined URL with the payload and config.
      debugLog(
        `[DEBUG] Sending API request with ${data.length} field(s) and ${totalIdsToFetch} total IDs`
      );
      const response = await axios.post(url, { data }, config);

      // Log only success indicator without sensitive data
      logEvent(
        `[API_CALL] Success: Received ${response.data?.length || 0} records`
      );
      debugLog(
        `[DEBUG] API Response structure: ${JSON.stringify(
          response.data?.map((d) => ({
            field: d.field_name,
            model: d.model,
            detailCount: Object.keys(d.details || {}).length,
          }))
        )}`
      );

      // Process the response data.
      // Each response entry contains details for a field; store them in the fieldDataMap.
      response.data.forEach((details) => {
        const fieldName = details.field_name;
        const detailsMap = details.details || {};

        // Resolve the model: if the API omitted it, default to configured model(s)
        let resolvedModel = details.model;
        if (!resolvedModel || resolvedModel === 'undefined') {
          const configs = FIELD_TO_CONFIG[fieldName] || [];
          if (configs.length === 1) {
            resolvedModel = configs[0].model;
            logEvent(
              `[API_CALL_WARN] Missing model for field '${fieldName}' - defaulting to configured model '${resolvedModel}'`
            );
          } else if (configs.length > 1) {
            resolvedModel = configs[0].model;
            logEvent(
              `[API_CALL_WARN] Missing model for field '${fieldName}' with ${
                configs.length
              } configured models [${configs
                .map((c) => c.model)
                .join(', ')}]; defaulting to first '${resolvedModel}'`
            );
          } else {
            logEvent(
              `[API_CALL_WARN] Missing model for field '${fieldName}' and no configured models; skipping details attachment for this field`
            );
            return; // Skip processing this details block
          }
        }

        debugLog(
          `[DEBUG] Processing API response for field '${fieldName}' (${resolvedModel}): ${
            Object.keys(detailsMap).length
          } details received`
        );

        // Update in-memory map used to attach to records later
        const existing = fieldDataMap[fieldName] || {};
        existing[resolvedModel] = Object.assign(
          existing[resolvedModel] || {},
          detailsMap
        );
        fieldDataMap[fieldName] = existing;

        debugLog(
          `[DEBUG] Updated fieldDataMap for '${fieldName}': now contains ${
            Object.keys(existing[resolvedModel] || {}).length
          } total entries`
        );

        // Persist each id detail in caches
        const redis = getRedisClient();
        const ttl = TTL_SECONDS;
        let cachedCount = 0;
        for (const [id, value] of Object.entries(detailsMap)) {
          const cacheKey = buildDetailsCacheKey(
            host,
            fieldName,
            resolvedModel,
            id
          );
          apiDetailsCache.set(cacheKey, value);
          cachedCount += 1;
          if (redis) {
            try {
              // fire-and-forget; do not block on set
              void redis.set(cacheKey, JSON.stringify(value), 'EX', ttl);
            } catch (e) {
              // ignore cache set errors
            }
          }
        }
        debugLog(
          `[DEBUG] Cached ${cachedCount} entries for field '${fieldName}' (LRU + Redis)`
        );
      });
    } catch (error) {
      // Log only sanitized error information without exposing sensitive data
      logEvent(
        `[API_CALL_ERROR] Failed to fetch from ${safeUrlDisplay(url)}: ${
          error.message
        }`
      );
      // Optionally, throw standardized error if this should be fatal:
      // throw createStandardError(ERROR_TYPES.INTERNAL, 'Failed to fetch details from API', { severity: ERROR_SEVERITY.MEDIUM, context: 'get_details_from_api', originalError: error });
    }
  }

  // After fetching details, attach them to each record in the original results.
  debugLog(`[DEBUG] Starting to attach details to ${results.length} records`);
  debugLog(
    `[DEBUG] fieldDataMap summary: ${JSON.stringify(
      Object.keys(fieldDataMap).map((field) => ({
        field,
        models: Object.keys(fieldDataMap[field] || {}),
        totalDetails: Object.values(fieldDataMap[field] || {}).reduce(
          (sum, modelMap) => sum + Object.keys(modelMap).length,
          0
        ),
      }))
    )}`
  );

  let totalDetailsAttached = 0;
  let recordsWithDetailsCount = 0;

  const recordsWithDetails = results.map((record, index) => {
    const detailsData = {};
    let detailsAttachedForRecord = 0;

    // For each field in the record that ends with 'Id' and has configuration data,
    // attempt to attach the corresponding additional details. Multiple models may map to the same field.
    Object.keys(record)
      .filter(
        (key) =>
          key.endsWith('Id') &&
          FIELD_TO_CONFIG[key] &&
          FIELD_TO_CONFIG[key].length
      )
      .forEach((key) => {
        const fieldKey = key;
        const fieldData = fieldDataMap[fieldKey];
        const idValue = record?.[key];
        if (fieldData && idValue) {
          const configs = FIELD_TO_CONFIG[key];
          let found;
          let usedModel;
          for (const cfg of configs) {
            const { model } = cfg;
            const modelMap = fieldData[model];
            const maybe = modelMap ? modelMap[idValue] : undefined;
            if (maybe !== undefined) {
              found = maybe;
              usedModel = model;
              break;
            }
          }
          detailsData[fieldKey] = found;
          if (found !== undefined) {
            detailsAttachedForRecord += 1;
            debugLog(
              `[DEBUG] Record ${index}: Attached details for '${fieldKey}' (ID: ${idValue}, Model: ${usedModel})`
            );
          } else {
            const modelsTried = configs.map((c) => c.model).join(', ');
            debugLog(
              `[DEBUG] Record ${index}: No details found for '${fieldKey}' (ID: ${idValue}, Models tried: ${modelsTried})`
            );
          }
        }
      });

    totalDetailsAttached += detailsAttachedForRecord;
    if (detailsAttachedForRecord > 0) {
      recordsWithDetailsCount += 1;
    }

    if (index < 3) {
      debugLog(
        `[DEBUG] Sample Record ${index} details keys: ${Object.keys(
          detailsData
        ).join(', ')}`
      );
    }

    // Return the record with an additional 'details' property containing the fetched details.
    return { ...record, details: detailsData };
  });

  debugLog(
    `[DEBUG] Attachment complete: ${totalDetailsAttached} details attached across ${recordsWithDetailsCount}/${results.length} records`
  );

  // Return the updated records array with attached additional details.
  return recordsWithDetails;
}

/**
 * Retrieves INA (Internal Notes/Activities) count for entities from the calendar service.
 *
 * @async
 * @function getInaCount
 *
 * @param {String} microservice - The microservice name (e.g., 'CRM')
 * @param {String} model - The model name (e.g., 'Opportunity')
 * @param {Array} ids - Array of entity IDs
 * @param {String} accessToken - User access token for authorization
 * @returns {Promise<Object>} Object mapping entity IDs to their INA counts
 */
async function getInaCount(microservice, model, ids, accessToken) {
  if (!CALENDAR_HOST) {
    logEvent(
      '[INA_COUNT] CALENDAR_HOST not configured, skipping INA count fetch'
    );
    return {};
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return {};
  }

  try {
    const response = await axios.post(
      `${CALENDAR_HOST}/api/bulk-action-reminder-counts/`,
      {
        entity_microservice: microservice,
        entity: model,
        entity_ids: ids,
      },
      {
        headers: {
          Authorization: accessToken,
        },
      }
    );

    if (response.status === 200) {
      logEvent(
        `[INA_COUNT] Successfully fetched INA counts for ${ids.length} entities`
      );
      return response.data || {};
    }

    logEvent(
      `[INA_COUNT] Failed to fetch INA counts: ${response.status} ${response.statusText}`
    );
    return {};
  } catch (error) {
    logEvent(`[INA_COUNT_ERROR] Failed to fetch INA counts: ${error.message}`);
    return {};
  }
}

module.exports = {
  exportDBLogs,
  uploadLocalFile,
  getDetailsFromAPI,
  getInaCount,
};
