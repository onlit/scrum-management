/**
 * Duration Distribution Calculator & Updater
 *
 * Distributes total hours worked across N tasks using integer values.
 * Ensures the sum of assigned hours exactly equals total hours worked.
 *
 * Usage:
 *   node src/update-duration-actuals.js <totalHours> <numTasks>
 *
 * Example:
 *   node src/update-duration-actuals.js 11 9
 *
 * Output:
 *   Total: 11 hours across 9 tasks
 *   Base: 1 hour/task
 *   Distribution: 7 tasks × 1h + 2 tasks × 2h = 11h
 */

// =============================================================================
// Duration Distribution Algorithm
// =============================================================================

function calculateDistribution(totalHours, numTasks) {
  const base = Math.floor(totalHours / numTasks);
  const remainder = totalHours % numTasks;

  return {
    totalHours,
    numTasks,
    base,
    remainder,
    tasksWithBase: numTasks - remainder,
    tasksWithBaseP1: remainder,
    verify: (numTasks - remainder) * base + remainder * (base + 1)
  };
}

function printDistribution(dist) {
  console.log('='.repeat(50));
  console.log('DURATION DISTRIBUTION');
  console.log('='.repeat(50));
  console.log(`Total Hours: ${dist.totalHours}`);
  console.log(`Num Tasks:   ${dist.numTasks}`);
  console.log(`Base Value:  ${dist.base} hour(s)/task`);
  console.log('');
  console.log('Distribution:');
  console.log(`  ${dist.tasksWithBase} tasks × ${dist.base}h = ${dist.tasksWithBase * dist.base}h`);
  if (dist.tasksWithBaseP1 > 0) {
    console.log(`  ${dist.tasksWithBaseP1} tasks × ${dist.base + 1}h = ${dist.tasksWithBaseP1 * (dist.base + 1)}h`);
  }
  console.log('');
  console.log(`Verification: ${dist.verify}h (should equal ${dist.totalHours}h)`);
  console.log('='.repeat(50));

  return dist;
}

// =============================================================================
// CLI Mode - Just calculate and print
// =============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: node src/update-duration-actuals.js <totalHours> <numTasks>');
    console.log('Example: node src/update-duration-actuals.js 11 9');
    process.exit(1);
  }

  const totalHours = parseInt(args[0], 10);
  const numTasks = parseInt(args[1], 10);

  if (isNaN(totalHours) || isNaN(numTasks) || numTasks <= 0) {
    console.error('Error: totalHours and numTasks must be positive integers');
    process.exit(1);
  }

  const dist = calculateDistribution(totalHours, numTasks);
  printDistribution(dist);
}

// =============================================================================
// Export for use in other scripts
// =============================================================================

module.exports = { calculateDistribution, printDistribution };
