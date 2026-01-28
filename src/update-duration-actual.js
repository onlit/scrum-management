require('dotenv').config({ path: __dirname + '/.env' });
const axios = require('axios');

// =============================================================================
// Configuration - Modify these values for each run
// =============================================================================

const SPRINT_META_ID = 'fd6005bd-9a29-43d3-9ef0-694be94dc684';
const SPRINT_ID = 'a6860db6-d458-4eed-99b6-c2ae558457ba'; // Specific sprint stage to update
const RESOURCE_ID = '4ba84c35-05ba-4e62-98cd-0b14824a52a6'; // Umer
const TOTAL_HOURS_WORKED = 82.5;

// =============================================================================
// API Setup
// =============================================================================

const BASE_URL = 'https://pm.pullstream.com/api';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('ERROR: ACCESS_TOKEN not found in environment variables');
  console.error(
    'Please create a .env file with ACCESS_TOKEN=Bearer your_token_here',
  );
  process.exit(1);
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: ACCESS_TOKEN,
    'Content-Type': 'application/json',
  },
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Fetch items for a specific sprint stage.
 * Uses /sprint-stages/ API which returns stages with parent + subtask items.
 * When ownerId is provided, the API response is filtered to that owner.
 */
async function fetchSprintStageItems(sprintMetaId, sprintId, ownerId) {
  const params = new URLSearchParams({
    item_order: 'task__order',
    page_size: '500',
    sprint_meta: sprintMetaId,
  });

  if (ownerId) {
    params.set('owner', ownerId);
  }

  const response = await api.get(`/sprint-stages/?${params.toString()}`);
  const stages = response.data;

  const stage = stages.find((s) => s.id === sprintId);
  if (!stage) {
    console.error(
      `ERROR: Sprint stage ${sprintId} not found in sprint meta ${sprintMetaId}`,
    );
    process.exit(1);
  }

  return stage.items || [];
}

/**
 * Filter to only leaf tasks (subtasks with no children).
 * A leaf task is one where no other item's full_order starts with "thisOrder.".
 */
function filterLeafTasks(items) {
  const allOrders = new Set(items.map((i) => i.full_order));

  return items.filter((item) => {
    // Check if any other item is a child of this one
    const prefix = item.full_order + '.';
    for (const order of allOrders) {
      if (order.startsWith(prefix)) {
        return false; // This item is a parent
      }
    }
    return true;
  });
}

/**
 * Convert duration to hours based on duration_unit
 */
function convertToHours(estimate, unit) {
  if (!estimate) return 0;

  const unitLower = unit ? unit.toLowerCase() : 'hours';
  if (unitLower === 'hours' || unitLower === 'hour') {
    return estimate;
  } else if (unitLower === 'minutes' || unitLower === 'minute') {
    return estimate / 60;
  } else if (unitLower === 'days' || unitLower === 'day') {
    return estimate * 8; // Assuming 8-hour workday
  }
  return estimate;
}

/**
 * Calculate actual hours for each task based on the ratio formula
 */
function calculateActualHours(tasks, totalHoursWorked) {
  const missingUnitCount = tasks.filter(
    (t) => t.duration_estimate && !t.duration_unit,
  ).length;

  // Filter tasks with valid estimates
  const tasksWithEstimates = tasks.filter((t) => {
    const hours = convertToHours(t.duration_estimate, t.duration_unit);
    return hours > 0;
  });

  if (tasksWithEstimates.length === 0) {
    console.error('No tasks with valid duration estimates found');
    return [];
  }

  // Calculate sum of estimates in hours
  const sumOfEstimatesInHours = tasksWithEstimates.reduce((sum, t) => {
    return sum + convertToHours(t.duration_estimate, t.duration_unit);
  }, 0);

  // Calculate ratio
  const ratio = totalHoursWorked / sumOfEstimatesInHours;

  console.log(`\nCalculation Summary:`);
  console.log(`  Tasks with estimates: ${tasksWithEstimates.length}`);
  if (missingUnitCount > 0) {
    console.log(
      `  NOTE: ${missingUnitCount} tasks missing duration_unit; assuming Hours`,
    );
  }
  console.log(`  Sum of estimates: ${sumOfEstimatesInHours.toFixed(2)} hours`);
  console.log(`  Total hours worked: ${totalHoursWorked} hours`);
  console.log(`  Ratio: ${ratio.toFixed(4)}`);

  // Calculate actual hours for each task
  return tasksWithEstimates.map((task) => {
    const estimateInHours = convertToHours(
      task.duration_estimate,
      task.duration_unit,
    );
    const actualHours = estimateInHours * ratio;
    const displayUnit = task.duration_unit || 'Hours';
    return {
      id: task.id,
      name: task.name,
      full_order: task.full_order,
      duration_estimate: task.duration_estimate,
      duration_unit: displayUnit,
      estimate_in_hours: estimateInHours,
      duration_actual: Math.ceil(actualHours), // API requires integer, round up
    };
  });
}

/**
 * Update a task's duration_actual via PATCH
 */
async function updateTaskDuration(taskId, durationActual) {
  try {
    const response = await api.patch(`/tasks/${taskId}/`, {
      duration_actual: durationActual,
      duration_unit: 'Hours',
    });
    return response.data;
  } catch (error) {
    console.error(
      `  ERROR updating task ${taskId}:`,
      error.response?.data || error.message,
    );
    throw error;
  }
}

// =============================================================================
// Main Execution
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  if (!SPRINT_META_ID || !SPRINT_ID) {
    console.error(
      'ERROR: SPRINT_META_ID and SPRINT_ID must be set in the Configuration section.',
    );
    process.exit(1);
  }

  console.log('='.repeat(80));
  console.log('Update Duration Actual Script');
  console.log('='.repeat(80));
  console.log(
    `\nMode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE UPDATE'}`,
  );
  console.log(`Sprint Meta ID: ${SPRINT_META_ID}`);
  console.log(`Sprint ID:      ${SPRINT_ID}`);
  console.log(`Resource ID:    ${RESOURCE_ID}`);
  console.log(`Total Hours Worked: ${TOTAL_HOURS_WORKED}`);

  // Fetch items from the specific sprint stage (all owners for hierarchy)
  console.log(`\nFetching tasks from sprint stage (all owners)...`);
  const allItems = await fetchSprintStageItems(SPRINT_META_ID, SPRINT_ID);
  console.log(`  Total items (parents + subtasks): ${allItems.length}`);

  // Determine leaf tasks using full stage hierarchy
  const leafItems = filterLeafTasks(allItems);
  const leafItemIds = new Set(leafItems.map((item) => item.id));
  console.log(`  Leaf tasks (no children): ${leafItems.length}`);

  // Fetch items for this owner and intersect with leaf tasks
  console.log(`\nFiltering to resource owner...`);
  const ownerItems = await fetchSprintStageItems(
    SPRINT_META_ID,
    SPRINT_ID,
    RESOURCE_ID,
  );
  console.log(`  Items for resource: ${ownerItems.length}`);

  const leafTasks = ownerItems.filter((item) => leafItemIds.has(item.id));
  console.log(`  Leaf tasks for resource: ${leafTasks.length}`);

  // Calculate actual hours
  const tasksToUpdate = calculateActualHours(leafTasks, TOTAL_HOURS_WORKED);

  if (tasksToUpdate.length === 0) {
    console.log('\nNo tasks to update. Exiting.');
    return;
  }

  // Display what will be updated
  console.log('\n' + '='.repeat(80));
  console.log('Tasks to Update:');
  console.log('='.repeat(80));

  let totalActual = 0;
  for (const task of tasksToUpdate) {
    console.log(`\n  [${task.full_order}] ${task.name}`);
    console.log(
      `    Estimate: ${task.duration_estimate} ${task.duration_unit} (${task.estimate_in_hours} hrs)`,
    );
    console.log(`    Actual:   ${task.duration_actual} hours`);
    totalActual += task.duration_actual;
  }

  console.log('\n' + '-'.repeat(80));
  console.log(
    `Total Actual Hours: ${totalActual.toFixed(2)} (Expected: ${TOTAL_HOURS_WORKED})`,
  );

  // Perform updates if not dry run
  if (!isDryRun) {
    console.log('\n' + '='.repeat(80));
    console.log('Updating tasks...');
    console.log('='.repeat(80));

    let successCount = 0;
    let errorCount = 0;

    for (const task of tasksToUpdate) {
      try {
        await updateTaskDuration(task.id, task.duration_actual);
        console.log(`  Updated: [${task.full_order}] ${task.name} -> ${task.duration_actual} hours`);
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('UPDATE SUMMARY');
    console.log('='.repeat(80));
    console.log(`  Successful: ${successCount}`);
    console.log(`  Errors: ${errorCount}`);
  } else {
    console.log('\n' + '='.repeat(80));
    console.log('DRY RUN COMPLETE - No changes made');
    console.log('Run without --dry-run to apply changes');
    console.log('='.repeat(80));
  }
}

// Run the script
main().catch((error) => {
  console.error('Script failed:', error.message);
  process.exit(1);
});
