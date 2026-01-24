const axios = require('axios');
const fs = require('fs').promises;
const { getFilesURL, getLogsURL } = require('#configs/routes.js');
const { UUID_KEY_VALUE_PAIRS } = require('#configs/constants.js');
const { logEvent } = require('#utils/shared/basicLoggingUtils.js');
const LRUCache = require('#utils/security/lruCache.js');

// Optional Redis (fallback to LRU if not installed or unavailable)
let Redis;
try {
  // Prefer ioredis if present (not required dependency)
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  Redis = require('ioredis');
} catch (e) {
  Redis = null;
}

let redisClient = null;
function getRedisClient() {
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

  // Build a reverse index from field name to its config { host, route, model }
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
          map[fieldName] = { host, route, model };
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
    .filter((key) => key.endsWith('Id') && FIELD_TO_CONFIG[key])
    .forEach((key) => {
      const { host, route, model } = FIELD_TO_CONFIG[key];
      if (!fieldsByHost[host]) {
        fieldsByHost[host] = [];
      }
      fieldsByHost[host].push({ id: key, fieldName: key, route, model });
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

    for (const field of fields) {
      const { fieldName, model } = field;
      const ids = idMaps[fieldName] || [];

      // Nothing to do for this field
      if (!ids.length) {
        missingIdMaps[fieldName] = [];
        continue;
      }

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

      // 2) Redis lookup (if available) for those still missing
      let stillMissing = stillMissingAfterLRU;
      if (redis && stillMissingAfterLRU.length) {
        const keys = stillMissingAfterLRU.map((id) =>
          buildDetailsCacheKey(host, fieldName, model, id)
        );
        try {
          // mget returns array aligned with keys
          // eslint-disable-next-line no-await-in-loop
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
        } catch (e) {
          // On Redis error, proceed as if nothing found
          stillMissing = stillMissingAfterLRU;
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
      }

      // Record remaining IDs to fetch from API
      missingIdMaps[fieldName] = stillMissing;
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
      const response = await axios.post(url, { data }, config);

      // Log only success indicator without sensitive data
      logEvent(
        `[API_CALL] Success: Received ${response.data?.length || 0} records`
      );

      // Process the response data.
      // Each response entry contains details for a field; store them in the fieldDataMap.
      response.data.forEach((details) => {
        const fieldName = details.field_name;
        const { model } = details;
        const detailsMap = details.details || {};

        // Update in-memory map used to attach to records later
        const existing = fieldDataMap[fieldName] || {};
        existing[model] = Object.assign(existing[model] || {}, detailsMap);
        fieldDataMap[fieldName] = existing;

        // Persist each id detail in caches
        const redis = getRedisClient();
        const ttl = TTL_SECONDS;
        for (const [id, value] of Object.entries(detailsMap)) {
          const cacheKey = buildDetailsCacheKey(host, fieldName, model, id);
          apiDetailsCache.set(cacheKey, value);
          if (redis) {
            try {
              // fire-and-forget; do not block on set
              // eslint-disable-next-line no-void
              void redis.set(cacheKey, JSON.stringify(value), 'EX', ttl);
            } catch (e) {
              // ignore cache set errors
            }
          }
        }
      });
    } catch (error) {
      // Log only sanitized error information without exposing sensitive data
      logEvent(
        `[API_CALL_ERROR] Failed to fetch from ${safeUrlDisplay(url)}: ${error.message}`
      );
      // Optionally, throw standardized error if this should be fatal:
      // throw createStandardError(ERROR_TYPES.INTERNAL, 'Failed to fetch details from API', { severity: ERROR_SEVERITY.MEDIUM, context: 'get_details_from_api', originalError: error });
    }
  }

  // After fetching details, attach them to each record in the original results.
  const recordsWithDetails = results.map((record) => {
    const detailsData = {};

    // For each field in the record that ends with 'Id' and has configuration data,
    // attempt to attach the corresponding additional details.
    Object.keys(record)
      .filter((key) => key.endsWith('Id') && FIELD_TO_CONFIG[key])
      .forEach((key) => {
        // Determine the lookup key consistent with the field naming strategy used in the API call.
        const fieldKey = key;
        const fieldData = fieldDataMap[fieldKey];
        if (fieldData && record?.[key]) {
          // Extract the model from the configuration to correctly index into fieldData.
          const { model } = FIELD_TO_CONFIG[key];
          // Attach the details to the record using the model name (converted to lowercase).
          // If no details are found for this model and record, assign undefined.
          detailsData[fieldKey] = fieldData[model]
            ? fieldData[model][record[key]]
            : undefined;
        }
      });

    // Return the record with an additional 'details' property containing the fetched details.
    return { ...record, details: detailsData };
  });

  // Return the updated records array with attached additional details.
  return recordsWithDetails;
}

module.exports = { exportDBLogs, uploadLocalFile, getDetailsFromAPI };
