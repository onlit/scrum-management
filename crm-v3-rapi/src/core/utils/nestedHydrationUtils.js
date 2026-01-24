/**
 * Utilities to hydrate nested relation objects with details before computing display values.
 * These helpers batch requests and merge by id to avoid index alignment issues.
 */

const { getDetailsFromAPI } = require('#utils/apiUtils.js');

/**
 * Batch hydrates specified nested relations within a paginated list response.
 * - Collects unique nested records by relation and id
 * - Fetches details in one call per relation
 * - Merges enriched data back into the original response by id
 *
 * @param {object} response - Paginated list response with a 'results' array
 * @param {string[]} relationNames - Relation property names to hydrate (e.g., ['candidate', 'feedback'])
 * @param {string} token - Access token for downstream detail APIs
 */
async function batchHydrateRelationsInList(response, relationNames, token) {
  if (
    !response ||
    !Array.isArray(response.results) ||
    !Array.isArray(relationNames) ||
    relationNames.length === 0
  ) {
    return;
  }

  for (const relation of relationNames) {
    if (typeof relation !== 'string' || !relation.trim()) continue;

    const uniqueById = new Map();
    for (const result of response.results) {
      const rel = result?.[relation];
      if (rel && typeof rel === 'object' && rel.id && !uniqueById.has(rel.id)) {
        uniqueById.set(rel.id, rel);
      }
    }

    if (uniqueById.size === 0) continue;

    const records = Array.from(uniqueById.values());
    const details = await getDetailsFromAPI({ results: records, token });
    const detailsById = new Map(
      (Array.isArray(details) ? details : [])
        .filter((d) => d && d.id)
        .map((d) => [d.id, d])
    );

    if (detailsById.size === 0) continue;

    for (const result of response.results) {
      const rel = result?.[relation];
      if (rel && rel.id && detailsById.has(rel.id)) {
        result[relation] = { ...rel, ...detailsById.get(rel.id) };
      }
    }
  }
}

/**
 * Hydrates specified nested relations on a single record.
 * - Fetches details for each present relation (one call per relation)
 * - Merges enriched data by id
 *
 * @param {object} record - The parent record containing nested relation objects
 * @param {string[]} relationNames - Relation property names to hydrate
 * @param {string} token - Access token for downstream detail APIs
 */
async function hydrateRelationsOnRecord(record, relationNames, token) {
  if (!record || !Array.isArray(relationNames) || relationNames.length === 0) {
    return;
  }

  for (const relation of relationNames) {
    if (typeof relation !== 'string' || !relation.trim()) continue;
    const rel = record?.[relation];
    if (!rel || typeof rel !== 'object' || !rel.id) continue;

    const [enriched] = await getDetailsFromAPI({ results: [rel], token });
    if (enriched && enriched.id === rel.id) {
      record[relation] = { ...rel, ...enriched };
    }
  }
}

module.exports = {
  batchHydrateRelationsInList,
  hydrateRelationsOnRecord,
};


