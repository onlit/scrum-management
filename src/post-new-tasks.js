require('dotenv').config();
const axios = require('axios');

// =============================================================================
// Configuration
// =============================================================================

const BASE_URL = 'https://pm.pullstream.com/api';
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('ERROR: ACCESS_TOKEN not found in environment variables');
  console.error('Please create a .env file with ACCESS_TOKEN=Bearer your_token_here');
  process.exit(1);
}

// =============================================================================
// Constants
// =============================================================================

const RESOURCES = {
  Umer: '4ba84c35-05ba-4e62-98cd-0b14824a52a6',
  Touseef: '37bed1cd-b999-4501-9fb7-7697df0d4747',
  Abdullah: '320b0e24-c4e2-400a-bed0-e48f42587aff'
};

const TASK_STATUSES = {
  TODO: 'f323b003-f15e-4d5f-8125-98183735faea',
  IN_PROGRESS: 'a3a16b09-a669-4592-ac20-9b5969912cab',
  BLOCKED: 'c70d0ca5-9997-41fb-a8df-1e3f7feca4b2',
  TESTING: '44fc34a3-6ffc-4eba-af98-7ab58018db1b',
  FAILED_TESTING: '46276100-a07d-4e28-89a6-5fa172111c73',
  DONE: '4cc2307c-b3da-4590-adeb-b1458f96e333',
  DEPLOYED: 'ecf4cac6-7dd0-4fe6-9cc0-9aba5eb09295',
  DEFERRED: 'c10cbc21-ce67-4cf0-a7e6-5e8fb06681e9'
};

const SPRINTS = {
  SPRINT_1: 'a6860db6-d458-4eed-99b6-c2ae558457ba',
  SPRINT_2: 'a1ac537b-1c73-4d3c-b639-e00909110a37',
  SPRINT_3: 'aab5ccfe-a89c-48e8-a923-46c6893f275e'
};

const PROJECT_ID = 'f599f9fd-cac2-4c5e-b39f-20fde85e1b1f';

// =============================================================================
// Axios Instance
// =============================================================================

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

async function createTask(taskData) {
  try {
    const cleanedData = { ...taskData, name: stripOrderNumber(taskData.name) };
    const response = await api.post('/tasks/', cleanedData);
    console.log(`  Created task: ${cleanedData.name} (ID: ${response.data.id})`);
    return response.data;
  } catch (error) {
    console.error(`  ERROR creating task "${taskData.name}":`, error.response?.data || error.message);
    throw error;
  }
}

async function linkTaskToSprint(taskId, sprintId) {
  try {
    const response = await api.post('/sprint-tasks/', {
      task: taskId,
      sprint: sprintId
    });
    console.log(`    Linked to sprint (ID: ${response.data.id})`);
    return response.data;
  } catch (error) {
    console.error(`    ERROR linking task to sprint:`, error.response?.data || error.message);
    throw error;
  }
}

async function createTaskWithSubtasks(parentTaskData, subtasks, sprintId) {
  // Create parent task
  const parentTask = await createTask({
    ...parentTaskData,
    project: PROJECT_ID
  });

  // Link parent to sprint
  await linkTaskToSprint(parentTask.id, sprintId);

  // Create subtasks
  for (const subtask of subtasks) {
    const createdSubtask = await createTask({
      ...subtask,
      project: PROJECT_ID,
      parent_task: parentTask.id
    });
    await linkTaskToSprint(createdSubtask.id, sprintId);
  }

  return parentTask;
}

function stripOrderNumber(name) {
  // Removes patterns like "1. ", "1.1 ", "12.3 ", "18.6 ", etc.
  return name.replace(/^\d+\.?\d*\s+/, '');
}

// =============================================================================
// NEW TASKS - CRM V3 Backend Architectural Refactoring (Completed Jan 29-30)
// =============================================================================

const NEW_TASKS = [
  // Task 28: CRM V3 DI Pattern Migration & Interceptor Cohesion Enhancement
  {
    parent: {
      name: '28. CRM V3 DI Pattern Migration & Interceptor Cohesion Enhancement',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.DONE,
      deadline: '2026-01-31T23:59:59Z',
      order: 28
    },
    subtasks: [
      {
        name: '28.1 Implement IoC factory pattern for route dependency injection',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DONE,
        description: 'Refactor route modules to utilize factory functions enabling constructor-based injection of auth middleware. Decouples route definitions from middleware instantiation for improved testability. Files: clients.routes.js, create-bulk-company-in-territories.routes.js, create-bulk-person-in-marketing-lists.routes.js, get-or-create-person.routes.js, opportunity-stages.routes.js, reset-rotting-days-opportunities.routes.js',
        deadline: '2026-01-30T23:59:59Z',
        duration_estimate: 3,
        duration_actual: 1,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '28.2 Propagate getVisibilityFilters() utility across interceptor beforeList hooks',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DONE,
        description: 'Standardize multi-tenant data isolation by refactoring interceptors to consume centralized visibility filter utility. Eliminates hardcoded client ID predicates. Affected: opportunity.interceptor.js, person.interceptor.js, marketingList.interceptor.js',
        deadline: '2026-01-30T23:59:59Z',
        duration_estimate: 2,
        duration_actual: 1,
        duration_unit: 'Hours',
        order: 2
      },
      {
        name: '28.3 Normalize UUID validation semantics via assertValidUuid() abstraction',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DONE,
        description: 'Refactor 7 domain controllers to leverage centralized UUID validation utility, eliminating redundant regex-based validation logic. Controllers: createBulkOpportunities, createBulkPersonInMarketingLists, createBulkPersonRelationships, getOrCreatePerson, opportunityStages, personUnmaskedPhone, resetRottingDaysOpportunities',
        deadline: '2026-01-30T23:59:59Z',
        duration_estimate: 2,
        duration_actual: 1,
        duration_unit: 'Hours',
        order: 3
      },
      {
        name: '28.4 Optimize clientFromOpportunity with batch hydration & deduplication',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DONE,
        description: 'Refactor clientFromOpportunity controller: replace N+1 query patterns with batch lookups, implement within-batch deduplication for companyContactId collisions, migrate from attachNestedDisplayValues to enrichRecordDisplayValues for consistent display value computation.',
        deadline: '2026-01-29T23:59:59Z',
        duration_estimate: 3,
        duration_actual: 1,
        duration_unit: 'Hours',
        order: 4
      },
      {
        name: '28.5 Scaffold integration test harness for domain controller coverage',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DONE,
        description: 'Author comprehensive integration test suites validating controller behavior against live database fixtures. Suites: clientFromOpportunity (588 lines), createBulkCompanyInTerritories (967 lines), createBulkPersonInMarketingLists (634 lines), getOrCreatePerson (560 lines), opportunityStages (708 lines), personByEmail (286 lines), resetRottingDaysOpportunities (734 lines). Total: 4,477 LOC.',
        deadline: '2026-01-30T23:59:59Z',
        duration_estimate: 6,
        duration_actual: 2,
        duration_unit: 'Hours',
        order: 5
      },
      {
        name: '28.6 Augment interceptor test coverage for visibility predicate assertions',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DONE,
        description: 'Extend integration test coverage for interceptor modules validating visibility filter propagation and error boundary handling. Files: marketingList.interceptor.integration.test.js (447 lines), opportunity.interceptor.integration.test.js (481 lines), person.interceptor.integration.test.js (637 lines). Total: 1,565 LOC.',
        deadline: '2026-01-30T23:59:59Z',
        duration_estimate: 4,
        duration_actual: 2,
        duration_unit: 'Hours',
        order: 6
      }
    ]
  }
];

// =============================================================================
// Main Execution
// =============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('Posting NEW Tasks for Completed CRM V3 Backend Work');
  console.log('='.repeat(80));
  console.log(`\nBase URL: ${BASE_URL}`);
  console.log(`Project ID: ${PROJECT_ID}`);
  console.log('');

  let totalTasks = 0;
  let successCount = 0;
  let errorCount = 0;

  // Process New Tasks - Add to Sprint 2
  console.log('\n' + '='.repeat(80));
  console.log('ADDING TO SPRINT 2: Jan 29 - Feb 07, 2026');
  console.log('='.repeat(80));

  for (const taskGroup of NEW_TASKS) {
    console.log(`\n--- ${taskGroup.parent.name} ---`);
    try {
      await createTaskWithSubtasks(taskGroup.parent, taskGroup.subtasks, SPRINTS.SPRINT_2);
      totalTasks += 1 + taskGroup.subtasks.length;
      successCount += 1 + taskGroup.subtasks.length;
    } catch (error) {
      errorCount += 1 + taskGroup.subtasks.length;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total tasks processed: ${totalTasks}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log('='.repeat(80));
}

// Run the script
main().catch(console.error);
