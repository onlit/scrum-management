/**
 * Distribute Time — Evenly distribute total minutes across leaf subtasks.
 *
 * Usage:
 *   npm run update-actuals -- --minutes 660 --from 60 --to 75
 *
 * - Input is total minutes, parent order range (from/to).
 * - Reads tasks-imported.json, filters leaf subtasks by full_order parent range.
 * - Distributes total minutes evenly (floor + remainder to first N tasks).
 * - Patches each task via PATCH /tasks/{id}/ with duration_actual + duration_unit.
 */

const path = require('path');
const api = require('./lib/api-client');
const { DURATION_UNIT } = require('./lib/constants');

// ---------------------------------------------------------------------------
// Distribution algorithm
// ---------------------------------------------------------------------------

function calculateDistribution(totalMinutes, numTasks) {
  const base = Math.floor(totalMinutes / numTasks);
  const remainder = totalMinutes % numTasks;
  return {
    totalMinutes,
    numTasks,
    base,
    remainder,
    tasksWithBase: numTasks - remainder,
    tasksWithBaseP1: remainder,
    verify: (numTasks - remainder) * base + remainder * (base + 1),
  };
}

function printDistribution(dist) {
  console.log('='.repeat(50));
  console.log('DURATION DISTRIBUTION');
  console.log('='.repeat(50));
  console.log(`Total Minutes: ${dist.totalMinutes}`);
  console.log(`Num Tasks:     ${dist.numTasks}`);
  console.log(`Base Value:    ${dist.base} min/task`);
  console.log('');
  console.log('Distribution:');
  console.log(`  ${dist.tasksWithBase} tasks x ${dist.base}m = ${dist.tasksWithBase * dist.base}m`);
  if (dist.tasksWithBaseP1 > 0) {
    console.log(`  ${dist.tasksWithBaseP1} tasks x ${dist.base + 1}m = ${dist.tasksWithBaseP1 * (dist.base + 1)}m`);
  }
  console.log('');
  console.log(`Verification: ${dist.verify}m (should equal ${dist.totalMinutes}m)`);
  console.log('='.repeat(50));
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--minutes' && args[i + 1]) opts.minutes = parseInt(args[++i], 10);
    else if (args[i] === '--from' && args[i + 1]) opts.from = parseInt(args[++i], 10);
    else if (args[i] === '--to' && args[i + 1]) opts.to = parseInt(args[++i], 10);
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

  // Filter subtasks within the parent order range
  const subtasks = data.items.filter((item) => {
    const match = item.full_order.match(/^(\d+)\./);
    if (!match) return false;
    const parentOrder = parseInt(match[1]);
    return parentOrder >= opts.from && parentOrder <= opts.to;
  });

  if (subtasks.length === 0) {
    console.error(`No subtasks found for parent orders ${opts.from}-${opts.to}`);
    process.exit(1);
  }

  const dist = calculateDistribution(opts.minutes, subtasks.length);
  printDistribution(dist);

  console.log(`\nUpdating ${subtasks.length} tasks via API (unit: ${DURATION_UNIT})...`);
  console.log('='.repeat(50));

  let success = 0;
  let fail = 0;

  for (let i = 0; i < subtasks.length; i++) {
    const task = subtasks[i];
    const minutes = i < dist.tasksWithBaseP1 ? dist.base + 1 : dist.base;

    try {
      await api.patch(`/tasks/${task.id}/`, {
        duration_actual: minutes,
        duration_unit: DURATION_UNIT,
      });
      console.log(`  OK: [${task.full_order}] ${task.name} = ${minutes}m`);
      success++;
    } catch (error) {
      console.error(
        `  FAIL: [${task.full_order}] ${task.name} — ${error.response?.data?.message || error.response?.status || error.message}`,
      );
      fail++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Done. Success: ${success}, Failed: ${fail}`);
  console.log(`Total distributed: ${dist.verify} minutes`);
  console.log('='.repeat(50));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
