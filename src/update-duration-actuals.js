/**
 * Distribute Time — Proportionally distribute total minutes across leaf subtasks.
 *
 * Usage:
 *   npm run update-actuals -- --minutes 660 --from 60 --to 75
 *
 * - Input is total minutes, parent order range (from/to).
 * - Reads tasks-imported.json, filters leaf subtasks by full_order range.
 * - Distributes total minutes proportionally based on each task's duration_estimate.
 * - Patches each task via PATCH /tasks/{id}/ with duration_actual + duration_unit.
 */

const path = require('path');
const api = require('./lib/api-client');
const { DURATION_UNIT } = require('./lib/constants');

// ---------------------------------------------------------------------------
// Proportional distribution algorithm
// ---------------------------------------------------------------------------

function calculateProportionalDistribution(totalMinutes, subtasks) {
  const totalEstimate = subtasks.reduce((sum, t) => sum + (t.duration_estimate || 0), 0);

  if (totalEstimate === 0) {
    // Fallback to even distribution if no estimates exist
    const base = Math.floor(totalMinutes / subtasks.length);
    const remainder = totalMinutes % subtasks.length;
    return subtasks.map((t, i) => ({
      ...t,
      actual: i < remainder ? base + 1 : base,
    }));
  }

  // Proportional: floor each, then distribute remainder by largest fractional part
  const raw = subtasks.map((t) => {
    const estimate = t.duration_estimate || 0;
    const exact = (estimate / totalEstimate) * totalMinutes;
    return { ...t, exact, floored: Math.floor(exact), frac: exact - Math.floor(exact) };
  });

  let distributed = raw.reduce((sum, r) => sum + r.floored, 0);
  let remainder = totalMinutes - distributed;

  // Sort by fractional part descending to give +1 to those closest to rounding up
  const sorted = raw.map((r, i) => ({ ...r, idx: i })).sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < remainder; i++) {
    sorted[i].floored += 1;
  }

  // Restore original order
  sorted.sort((a, b) => a.idx - b.idx);
  return sorted.map((r) => ({ ...r, actual: r.floored }));
}

function printDistribution(totalMinutes, results) {
  const totalEstimate = results.reduce((sum, r) => sum + (r.duration_estimate || 0), 0);
  console.log('='.repeat(60));
  console.log('PROPORTIONAL DURATION DISTRIBUTION');
  console.log('='.repeat(60));
  console.log(`Total Minutes:  ${totalMinutes}`);
  console.log(`Total Estimate: ${totalEstimate}m`);
  console.log(`Num Tasks:      ${results.length}`);
  console.log('');
  console.log('Task breakdown:');
  for (const r of results) {
    const pct = totalEstimate > 0 ? ((r.duration_estimate / totalEstimate) * 100).toFixed(0) : '?';
    console.log(`  [${r.full_order}] est=${r.duration_estimate}m (${pct}%) → actual=${r.actual}m`);
  }
  const totalActual = results.reduce((sum, r) => sum + r.actual, 0);
  console.log('');
  console.log(`Verification: ${totalActual}m (should equal ${totalMinutes}m)`);
  console.log('='.repeat(60));
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--minutes' && args[i + 1]) opts.minutes = parseInt(args[++i], 10);
    else if (args[i] === '--from' && args[i + 1]) opts.from = parseFloat(args[++i]);
    else if (args[i] === '--to' && args[i + 1]) opts.to = parseFloat(args[++i]);
  }
  if (!opts.minutes || !opts.from || !opts.to) {
    console.error('Usage: npm run update-actuals -- --minutes <total> --from <order> --to <order>');
    console.error('Example: npm run update-actuals -- --minutes 660 --from 60 --to 75');
    process.exit(1);
  }
  if (isNaN(opts.minutes) || isNaN(opts.from) || isNaN(opts.to)) {
    console.error('Error: all arguments must be integers');
    process.exit(1);
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();

  const dataPath = path.resolve(__dirname, '..', 'tasks-imported.json');
  const data = require(dataPath);
  const items = Array.isArray(data) && data[0]?.items ? data[0].items : data.items || data;

  // Filter leaf subtasks within the full_order range
  const subtasks = items.filter((item) => {
    if (!item.full_order) return false;
    const order = parseFloat(item.full_order);
    if (isNaN(order)) return false;
    if (order < opts.from || order > opts.to) return false;
    // Only include leaf tasks (no children with this prefix)
    const isLeaf = !items.some(
      (other) => other.full_order && other.full_order !== item.full_order && other.full_order.startsWith(item.full_order + '.'),
    );
    return isLeaf;
  });

  if (subtasks.length === 0) {
    console.error(`No subtasks found for parent orders ${opts.from}-${opts.to}`);
    process.exit(1);
  }

  const results = calculateProportionalDistribution(opts.minutes, subtasks);
  printDistribution(opts.minutes, results);

  const totalActual = results.reduce((sum, r) => sum + r.actual, 0);
  console.log(`\nUpdating ${results.length} tasks via API (unit: ${DURATION_UNIT})...`);
  console.log('='.repeat(60));

  let success = 0;
  let fail = 0;

  for (const task of results) {
    try {
      await api.patch(`/tasks/${task.id}/`, {
        duration_actual: task.actual,
        duration_unit: DURATION_UNIT,
      });
      console.log(`  OK: [${task.full_order}] ${task.name} = ${task.actual}m`);
      success++;
    } catch (error) {
      console.error(
        `  FAIL: [${task.full_order}] ${task.name} — ${error.response?.data?.message || error.response?.status || error.message}`,
      );
      fail++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Done. Success: ${success}, Failed: ${fail}`);
  console.log(`Total distributed: ${totalActual} minutes`);
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
