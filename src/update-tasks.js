/**
 * Update Tasks — Patch fields on existing tasks from a JSON file.
 *
 * Usage:
 *   npm run update-tasks -- --file updates.json
 *
 * Input JSON format:
 *   [
 *     {
 *       "id": "task-uuid",
 *       "status": "IN_PROGRESS",
 *       "description": "Updated description",
 *       "duration_estimate": 180,
 *       "duration_actual": 150,
 *       "owner": "Hamza"
 *     }
 *   ]
 *
 * - Status accepts key names (IN_PROGRESS) or raw UUIDs.
 * - Owner accepts names (Hamza) resolved to UUIDs.
 * - All durations in minutes, ceiled to integers, unit forced to "Minutes".
 * - Only included fields are patched (sparse update).
 */

const path = require('path');
const api = require('./lib/api-client');
const { DURATION_UNIT } = require('./lib/constants');
const { validateOwnerInput, resolveStatus } = require('./lib/validators');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  let file;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) file = args[++i];
  }
  if (!file) {
    console.error('Usage: npm run update-tasks -- --file <path>');
    process.exit(1);
  }
  return { file };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();
  const filePath = path.resolve(opts.file);
  const updates = require(filePath);

  if (!Array.isArray(updates) || updates.length === 0) {
    console.error('Input JSON must be a non-empty array of update objects.');
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log(`Updating ${updates.length} task(s)`);
  console.log('='.repeat(70));

  let success = 0;
  let fail = 0;

  for (const update of updates) {
    if (!update.id) {
      console.error('  SKIP: entry missing "id" field');
      fail++;
      continue;
    }

    const patch = {};

    if (update.status) patch.status = resolveStatus(update.status);
    if (update.owner) patch.owner = validateOwnerInput(update.owner);
    if (update.description !== undefined) patch.description = update.description;
    if (update.name !== undefined) patch.name = update.name;
    if (update.order !== undefined) patch.order = update.order;

    if (update.duration_estimate != null) {
      patch.duration_estimate = Math.ceil(update.duration_estimate);
      patch.duration_unit = DURATION_UNIT;
    }
    if (update.duration_actual != null) {
      patch.duration_actual = Math.ceil(update.duration_actual);
      patch.duration_unit = DURATION_UNIT;
    }

    if (Object.keys(patch).length === 0) {
      console.log(`  SKIP: ${update.id} — nothing to patch`);
      continue;
    }

    try {
      await api.patch(`/tasks/${update.id}/`, patch);
      console.log(`  OK: ${update.id} ${update.name || ''}`);
      success++;
    } catch (error) {
      console.error(
        `  FAIL: ${update.id} — ${error.response?.data?.message || error.response?.status || error.message}`,
      );
      fail++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`Done. Success: ${success}, Failed: ${fail}`);
  console.log('='.repeat(70));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
