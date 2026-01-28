require('dotenv').config();
const axios = require('axios');

// =============================================================================
// Configuration - Modify these values for each run
// =============================================================================

const PROJECT_ID = 'f599f9fd-cac2-4c5e-b39f-20fde85e1b1f';
const RESOURCE_ID = '4ba84c35-05ba-4e62-98cd-0b14824a52a6'; // Umer
const TOTAL_HOURS_WORKED = 82.5;

// =============================================================================
// API Setup
// =============================================================================

const BASE_URL = 'https://pm.pullstream.com/api';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('ERROR: ACCESS_TOKEN not found in environment variables');
  console.error('Please create a .env file with ACCESS_TOKEN=Bearer your_token_here');
  process.exit(1);
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': ACCESS_TOKEN,
    'Content-Type': 'application/json'
  }
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Fetch all tasks for a project and resource, handling pagination
 */
async function fetchTasksByResource(projectId, resourceId) {
  const allTasks = [];
  let url = `/tasks/?project=${projectId}&owner=${resourceId}`;

  while (url) {
    try {
      const response = await api.get(url);
      const data = response.data;

      // Handle paginated response
      if (data.results) {
        allTasks.push(...data.results);
        // Get next page URL (relative path)
        url = data.next ? data.next.replace(BASE_URL, '') : null;
      } else if (Array.isArray(data)) {
        allTasks.push(...data);
        url = null;
      } else {
        url = null;
      }
    } catch (error) {
      if (error.response?.status === 403) {
        console.error('\nERROR: Access denied (403). Your ACCESS_TOKEN may be expired.');
        console.error('Please refresh your token in the .env file.');
      } else if (error.response?.status === 401) {
        console.error('\nERROR: Unauthorized (401). Invalid ACCESS_TOKEN.');
      }
      throw error;
    }
  }

  return allTasks;
}

/**
 * Filter out parent tasks (tasks with subtasks can't have duration_actual updated)
 * A leaf task is one that has no children (subtasks)
 */
function filterLeafTasks(tasks) {
  // Get all task IDs that are referenced as parent_task
  const parentTaskIds = new Set(
    tasks
      .filter(t => t.parent_task)
      .map(t => t.parent_task)
  );

  // Filter to only tasks that are not parents
  return tasks.filter(t => !parentTaskIds.has(t.id));
}

/**
 * Convert duration to hours based on duration_unit
 */
function convertToHours(estimate, unit) {
  if (!estimate || !unit) return 0;

  const unitLower = unit.toLowerCase();
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
  // Filter tasks with valid estimates
  const tasksWithEstimates = tasks.filter(t => {
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
  console.log(`  Sum of estimates: ${sumOfEstimatesInHours.toFixed(2)} hours`);
  console.log(`  Total hours worked: ${totalHoursWorked} hours`);
  console.log(`  Ratio: ${ratio.toFixed(4)}`);

  // Calculate actual hours for each task
  return tasksWithEstimates.map(task => {
    const estimateInHours = convertToHours(task.duration_estimate, task.duration_unit);
    const actualHours = estimateInHours * ratio;
    return {
      id: task.id,
      name: task.name,
      duration_estimate: task.duration_estimate,
      duration_unit: task.duration_unit,
      estimate_in_hours: estimateInHours,
      duration_actual: Math.round(actualHours * 100) / 100 // Round to 2 decimal places
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
      duration_unit: 'Hours'
    });
    return response.data;
  } catch (error) {
    console.error(`  ERROR updating task ${taskId}:`, error.response?.data || error.message);
    throw error;
  }
}

// =============================================================================
// Main Execution
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  console.log('='.repeat(80));
  console.log('Update Duration Actual Script');
  console.log('='.repeat(80));
  console.log(`\nMode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE UPDATE'}`);
  console.log(`Project ID: ${PROJECT_ID}`);
  console.log(`Resource ID: ${RESOURCE_ID}`);
  console.log(`Total Hours Worked: ${TOTAL_HOURS_WORKED}`);

  // Fetch all tasks for the resource
  console.log(`\nFetching tasks...`);
  const allTasks = await fetchTasksByResource(PROJECT_ID, RESOURCE_ID);
  console.log(`  Found ${allTasks.length} total tasks for resource`);

  // Filter to leaf tasks only
  const leafTasks = filterLeafTasks(allTasks);
  console.log(`  Leaf tasks (no subtasks): ${leafTasks.length}`);

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
    console.log(`\n  ${task.name}`);
    console.log(`    Estimate: ${task.duration_estimate} ${task.duration_unit} (${task.estimate_in_hours} hrs)`);
    console.log(`    Actual:   ${task.duration_actual} hours`);
    totalActual += task.duration_actual;
  }

  console.log('\n' + '-'.repeat(80));
  console.log(`Total Actual Hours: ${totalActual.toFixed(2)} (Expected: ${TOTAL_HOURS_WORKED})`);

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
        console.log(`  Updated: ${task.name} -> ${task.duration_actual} hours`);
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
main().catch(error => {
  console.error('Script failed:', error.message);
  process.exit(1);
});
