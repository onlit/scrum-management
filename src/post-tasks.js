/**
 * Post Tasks — Create parent + subtask groups from a JSON file.
 *
 * Usage:
 *   npm run post-tasks -- --file tasks.json --sprint SPRINT_4 --owner Umer
 *
 * Input JSON format:
 *   [
 *     {
 *       "name": "Parent Task Name",
 *       "order": 95,
 *       "subtasks": [
 *         {
 *           "name": "Subtask name",
 *           "order": 1,
 *           "description": "Details",
 *           "duration_estimate": 120
 *         }
 *       ]
 *     }
 *   ]
 *
 * - Owner from --owner flag applies to all tasks; subtasks can override with "owner" in JSON.
 * - Sprint from --sprint flag (key name like SPRINT_4, resolved to UUID).
 * - Parent tasks are containers — no duration fields.
 * - Subtask durations are in Minutes, ceiled to integers.
 */

const path = require('path');
const api = require('./lib/api-client');
const { PROJECT_ID, SPRINTS, TASK_STATUSES, DURATION_UNIT } = require('./lib/constants');
const { validateOwnerInput, validateTaskData } = require('./lib/validators');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) opts.file = args[++i];
    else if (args[i] === '--sprint' && args[i + 1]) opts.sprint = args[++i];
    else if (args[i] === '--owner' && args[i + 1]) opts.owner = args[++i];
  }
  if (!opts.file || !opts.sprint || !opts.owner) {
    console.error('Usage: npm run post-tasks -- --file <path> --sprint <key> --owner <name>');
    console.error('  --sprint: ' + Object.keys(SPRINTS).join(', '));
    process.exit(1);
  }
  return opts;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function createTask(data) {
  const res = await api.post('/tasks/', data);
  console.log(`  Created: ${data.name} (${res.data.id})`);
  return res.data;
}

async function linkToSprint(taskId, sprintId) {
  await api.post('/sprint-tasks/', { task: taskId, sprint: sprintId });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();

  const sprintId = SPRINTS[opts.sprint];
  if (!sprintId) {
    console.error(`Unknown sprint "${opts.sprint}". Valid: ${Object.keys(SPRINTS).join(', ')}`);
    process.exit(1);
  }

  const ownerUUID = validateOwnerInput(opts.owner);
  const filePath = path.resolve(opts.file);
  const groups = require(filePath);

  if (!Array.isArray(groups) || groups.length === 0) {
    console.error('Input JSON must be a non-empty array of task groups.');
    process.exit(1);
  }

  // Validate all data before any API calls
  for (const group of groups) {
    if (!group.name) throw new Error('Each group must have a "name" field.');
    if (group.subtasks) {
      for (const sub of group.subtasks) {
        if (sub.duration_estimate != null) {
          sub.duration_estimate = Math.ceil(sub.duration_estimate);
        }
        sub.duration_unit = DURATION_UNIT;
        const subOwner = sub.owner ? validateOwnerInput(sub.owner) : ownerUUID;
        sub._ownerUUID = subOwner;
        validateTaskData({
          ...sub,
          owner: subOwner,
          status: TASK_STATUSES.TODO,
        });
      }
    }
  }

  console.log('='.repeat(70));
  console.log(`Posting ${groups.length} group(s) → Sprint: ${opts.sprint}, Owner: ${opts.owner}`);
  console.log('='.repeat(70));

  let success = 0;
  let fail = 0;

  for (const group of groups) {
    console.log(`\nGroup: ${group.name} (order: ${group.order || '-'})`);

    try {
      const parentData = {
        name: group.name,
        owner: ownerUUID,
        status: TASK_STATUSES.TODO,
        project: PROJECT_ID,
      };
      if (group.order != null) parentData.order = group.order;
      if (group.description) parentData.description = group.description;

      const parent = await createTask(parentData);
      await linkToSprint(parent.id, sprintId);
      success++;

      if (group.subtasks) {
        for (const sub of group.subtasks) {
          const subData = {
            name: sub.name,
            owner: sub._ownerUUID || ownerUUID,
            status: TASK_STATUSES.TODO,
            project: PROJECT_ID,
            parent_task: parent.id,
            duration_unit: DURATION_UNIT,
          };
          if (sub.order != null) subData.order = sub.order;
          if (sub.description) subData.description = sub.description;
          if (sub.duration_estimate != null) subData.duration_estimate = sub.duration_estimate;

          const created = await createTask(subData);
          await linkToSprint(created.id, sprintId);
          success++;
        }
      }
    } catch (error) {
      fail++;
      console.error(`  FAILED: ${error.response?.data?.message || error.response?.status || error.message}`);
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
