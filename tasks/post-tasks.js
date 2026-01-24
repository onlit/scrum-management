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

function parseDeadline(dateStr) {
  // Convert "Jan 22" to "2026-01-22T23:59:59Z"
  const months = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  const [month, day] = dateStr.split(' ');
  return `2026-${months[month]}-${day.padStart(2, '0')}T23:59:59Z`;
}

function parseDuration(durationStr) {
  if (!durationStr || durationStr === 'TBD') return { estimate: null, unit: null };

  const match = durationStr.match(/(\d+)\s*(hour|minute|day)/i);
  if (match) {
    return {
      estimate: parseInt(match[1]),
      unit: match[2].toLowerCase() + 's'
    };
  }
  return { estimate: null, unit: null };
}

// =============================================================================
// Task Definitions - Sprint 1 (Jan 22-28, 2026)
// =============================================================================

const SPRINT_1_TASKS = [
  // Task 1: Support App Testing and Bug Fixes
  {
    parent: {
      name: '1. Support App Testing and Bug Fixes',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      deadline: parseDeadline('Jan 24'),
      order: 1
    },
    subtasks: [
      {
        name: '1.1 Test Support App',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.TODO,
        description: 'Complete testing of Support App, document all bugs found',
        deadline: parseDeadline('Jan 22'),
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '1.2 Fix: Data not showing in dropdown/list/details (c708bfec)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'AI Classification Result dropdown displays raw UTC ISO instead of formatted timestamp. List and details view show (...) instead of value. URL: https://me.pullstream.com/support/ai-performance-feedbacks',
        deadline: parseDeadline('Jan 22'),
        duration_estimate: 30,
        duration_unit: 'Minutes',
        order: 2
      },
      {
        name: '1.3 Fix: Form flows listed with only one form (970cb0f6)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Form Flows menu shows entries with only one form (Support Agent Profiles, Autonomy Configurations, Bug Reports). Should only show entries with >1 form. URL: https://me.pullstream.com/support/ff/knowledge-articles',
        deadline: parseDeadline('Jan 23'),
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 3
      },
      {
        name: '1.4 Fix bugs reported by Touseef',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Address any bugs found during Touseef\'s testing session. Predecessor: 1.1',
        deadline: parseDeadline('Jan 24'),
        order: 4
      }
    ]
  },

  // Task 2: CRM V3 Prod Testing (15 Bugs)
  {
    parent: {
      name: '2. CRM V3 Prod Testing (15 Bugs)',
      owner: RESOURCES.Touseef,
      status: TASK_STATUSES.TODO,
      deadline: parseDeadline('Jan 24'),
      order: 2
    },
    subtasks: [
      {
        name: '2.1 Value disappear - Automata Workflow (4e32c2a4)',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 22'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '2.2 Field needs to be multiline (f0ec1f52)',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 22'),
        duration_estimate: 30,
        duration_unit: 'Minutes',
        order: 2
      },
      {
        name: '2.3 Dropdown items not ordered correctly (03849cf3)',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 22'),
        duration_estimate: 30,
        duration_unit: 'Minutes',
        order: 3
      },
      {
        name: '2.4 Values not filtered in related fields (79896381)',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 22'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 4
      },
      {
        name: '2.5 No validation error for phone fields (97b468d4)',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 22'),
        duration_estimate: 30,
        duration_unit: 'Minutes',
        order: 5
      },
      {
        name: '2.6 Fields need predefined enum values (bdbe8d83)',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 22'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 6
      },
      {
        name: '2.7 Fields not autocomplete dropdowns (43736ca7)',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 23'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 7
      },
      {
        name: '2.8 Industry field as text instead of dropdown (3d3417c8)',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 23'),
        duration_estimate: 30,
        duration_unit: 'Minutes',
        order: 8
      },
      {
        name: '2.9 Country/City/State not dropdowns (7580bd72)',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 23'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 9
      },
      {
        name: '2.10 Work Phone/Mobile allow free text (01188e0f)',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 23'),
        duration_estimate: 30,
        duration_unit: 'Minutes',
        order: 10
      },
      {
        name: '2.11 Phone field incorrect format (31b34fc1)',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 23'),
        duration_estimate: 30,
        duration_unit: 'Minutes',
        order: 11
      },
      {
        name: '2.12 Categories Description field issues (6419f3d6)',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 23'),
        duration_estimate: 30,
        duration_unit: 'Minutes',
        order: 12
      },
      {
        name: '2.13 INAs not created with bulk reminder (b11e2604)',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 24'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 13
      },
      {
        name: '2.14 Value disappear in list/details (5ed83a01)',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 24'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 14
      },
      {
        name: '2.15 Color functionality missing (b5c5cc61)',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 24'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 15
      }
    ]
  },

  // Task 3: Backend Migration: Critical Controllers
  {
    parent: {
      name: '3. Backend Migration: Critical Controllers',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      deadline: parseDeadline('Jan 25'),
      order: 3
    },
    subtasks: [
      {
        name: '3.1 Port company.controller.js to company.interceptor.js',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Port duplicate detection, cascading deletes (9 entities), visibility filters, display value enrichment. Source: /crm-v2-rapi/src/controllers/company.controller.js, Target: /crm-v3-rapi/src/domain/interceptors/company.interceptor.js',
        deadline: parseDeadline('Jan 23'),
        duration_estimate: 7,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '3.2 Port person.controller.js to person.interceptor.js',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Port PII masking, relationship aggregation, cascading deletes (9 entities), workflow triggers. Source: /crm-v2-rapi/src/controllers/person.controller.js, Target: /crm-v3-rapi/src/domain/interceptors/person.interceptor.js. Predecessor: 3.1',
        deadline: parseDeadline('Jan 24'),
        duration_estimate: 7,
        duration_unit: 'Hours',
        order: 2
      },
      {
        name: '3.3 Port opportunity.controller.js to opportunity.interceptor.js',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Port stage calculation, INA counts, auto-defaults, territory derivation, pipeline/status validation, dual workflow triggers. Source: /crm-v2-rapi/src/controllers/opportunity.controller.js (1300+ lines), Target: /crm-v3-rapi/src/domain/interceptors/opportunity.interceptor.js. Predecessor: 3.2',
        deadline: parseDeadline('Jan 25'),
        duration_estimate: 14,
        duration_unit: 'Hours',
        order: 3
      },
      {
        name: '3.4 Port import.controller.js to V3 custom route',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Port CSV streaming, row validation, batch operations, permission checking. Source: /crm-v2-rapi/src/controllers/import.controller.js, Target: /crm-v3-rapi/src/domain/routes/v1/import.route.js',
        deadline: parseDeadline('Jan 24'),
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 4
      },
      {
        name: '3.5 Port export.controller.js to V3 custom route',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Port dynamic headers, CSV streaming, display value enrichment. Source: /crm-v2-rapi/src/controllers/export.controller.js, Target: /crm-v3-rapi/src/domain/routes/v1/export.route.js. Predecessor: 3.4',
        deadline: parseDeadline('Jan 25'),
        duration_estimate: 3,
        duration_unit: 'Hours',
        order: 5
      }
    ]
  },

  // Task 4: CRM V3 Documented Bug Fixes
  {
    parent: {
      name: '4. CRM V3 Documented Bug Fixes',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      deadline: parseDeadline('Jan 28'),
      order: 4
    },
    subtasks: [
      {
        name: '4.1 Fix: Sales Person page - undefined entity (0f027aa9)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Page returns "Entity type not found. The entity type \'undefined\' does not exist." URL: https://me.pullstream.com/crm-v3/sales-people',
        deadline: parseDeadline('Jan 25'),
        duration_estimate: 3,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '4.2 Fix: Details view - wrong entity link (18053f60)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Company Contact column opens Client details instead of Contact details. URL: https://me.pullstream.com/crm-v3/clients/dd6773e5-b619-49ea-accf-083fb4478724',
        deadline: parseDeadline('Jan 25'),
        duration_estimate: 3,
        duration_unit: 'Hours',
        order: 2
      },
      {
        name: '4.3 Fix: Process Records button missing (f25f3950)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Person In Marketing List tab missing "Process Records" button available in V2. URL: https://me.pullstream.com/crm-v3/marketing-lists/6c6bfe61-d86b-43a1-ba4d-56636d247055',
        deadline: parseDeadline('Jan 26'),
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 3
      },
      {
        name: '4.4 Fix: Bulk actions missing (28052669)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: '"Add to Territory" and "Create Opportunity" bulk actions missing. Person page missing "Add Relationship" and "Add to Marketing List". URL: https://me.pullstream.com/crm-v3/companies. Files to port: BulkAddToTerritory, BulkCreateOpportunity, BulkAddPersonRelationship, BulkAddPersonToMarketingList',
        deadline: parseDeadline('Jan 27'),
        duration_estimate: 7,
        duration_unit: 'Hours',
        order: 4
      },
      {
        name: '4.5 Fix: Filters missing (f6c827d5)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Filters button missing on Company page. URL: https://me.pullstream.com/crm-v3/companies',
        deadline: parseDeadline('Jan 27'),
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 5
      },
      {
        name: '4.6 Fix: Missing tabs - Company Notes, Email History (161079a0)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Company, Opportunity, and Person detail views missing tabs present in V2. URL: https://me.pullstream.com/crm-v3/companies/b407ec62-135c-4317-b8eb-f7594c523bb4',
        deadline: parseDeadline('Jan 28'),
        duration_estimate: 7,
        duration_unit: 'Hours',
        order: 6
      }
    ]
  },

  // Task 5: Hamza Dependency Planning Meeting
  {
    parent: {
      name: '5. Hamza Dependency Planning Meeting',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      deadline: parseDeadline('Jan 28'),
      order: 5
    },
    subtasks: [
      {
        name: '5.1 Meet with Hamza to discuss CRM dependencies',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Document all CRM dependencies in other apps beyond compute-generated and Automata. Create task list for Sprint 3+.',
        deadline: parseDeadline('Jan 28'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 1
      }
    ]
  }
];

// =============================================================================
// Task Definitions - Sprint 2 (Jan 29 - Feb 07, 2026)
// =============================================================================

const SPRINT_2_TASKS = [
  // Task 6: CRM V3 Final Bug Fix
  {
    parent: {
      name: '6. CRM V3 Final Bug Fix',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      deadline: parseDeadline('Jan 29'),
      order: 6
    },
    subtasks: [
      {
        name: '6.1 Fix: INA record not appearing after save (50f4f88d)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'INA tab doesn\'t refresh after save; requires manual page refresh. URL: https://me.pullstream.com/kanbans/opportunity/2499db79-ac2b-4638-aea7-a9323bf5c09c',
        deadline: parseDeadline('Jan 29'),
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 1
      }
    ]
  },

  // Task 7: Search Vector Investigation
  {
    parent: {
      name: '7. Search Vector Investigation',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      deadline: parseDeadline('Jan 29'),
      order: 7
    },
    subtasks: [
      {
        name: '7.1 Investigate search_vector integration',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Document how search_vector fields should be integrated in crm-v3. Identify affected models and implementation approach.',
        deadline: parseDeadline('Jan 29'),
        duration_estimate: 3,
        duration_unit: 'Hours',
        order: 1
      }
    ]
  },

  // Task 8: Additional Backend Interceptors
  {
    parent: {
      name: '8. Additional Backend Interceptors',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      deadline: parseDeadline('Jan 30'),
      order: 8
    },
    subtasks: [
      {
        name: '8.1 Port client.controller.js',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 29'),
        duration_estimate: 3,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '8.2 Port marketingList.controller.js',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 29'),
        duration_estimate: 3,
        duration_unit: 'Hours',
        order: 2
      },
      {
        name: '8.3 Port companyContact.controller.js',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 30'),
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 3
      },
      {
        name: '8.4 Port companyInTerritory.controller.js',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 30'),
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 4
      },
      {
        name: '8.5 Port personInMarketingList.controller.js',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 30'),
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 5
      },
      {
        name: '8.6 Port personRelationship.controller.js',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 30'),
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 6
      }
    ]
  },

  // Task 9: Route Parity Verification
  {
    parent: {
      name: '9. Route Parity Verification',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      deadline: parseDeadline('Jan 30'),
      order: 9
    },
    subtasks: [
      {
        name: '9.1 Verify V2/V3 route parity',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Compare all routes between crm-v2-rapi and crm-v3-rapi. Document differences and fix mismatches.',
        deadline: parseDeadline('Jan 30'),
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 1
      }
    ]
  },

  // Task 10: Kanban Updates
  {
    parent: {
      name: '10. Kanban Updates',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      deadline: parseDeadline('Jan 31'),
      order: 10
    },
    subtasks: [
      {
        name: '10.1 Update INA kanban with CRM V3',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Update INA kanban to use CRM V3 endpoints',
        deadline: parseDeadline('Jan 31'),
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '10.2 Update Opportunity kanban with CRM V3',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Update Opportunity kanban to use CRM V3 endpoints',
        deadline: parseDeadline('Jan 31'),
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 2
      }
    ]
  },

  // Task 11: Automata CRM Dependencies
  {
    parent: {
      name: '11. Automata CRM Dependencies',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      deadline: parseDeadline('Feb 01'),
      order: 11
    },
    subtasks: [
      {
        name: '11.1 Investigate Automata CRM dependencies',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Document all CRM dependencies in Automata. Create task list for resolution.',
        deadline: parseDeadline('Feb 01'),
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 1
      }
    ]
  },

  // Task 12: Compute Apps Update (12 Apps)
  {
    parent: {
      name: '12. Compute Apps Update (12 Apps)',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      deadline: parseDeadline('Feb 02'),
      order: 12
    },
    subtasks: [
      {
        name: '12.1 Update Lists app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Feb 01'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '12.2 Update Finanshalls app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Feb 01'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 2
      },
      {
        name: '12.3 Update Recruiter app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Feb 01'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 3
      },
      {
        name: '12.4 Update Inventory app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Feb 01'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 4
      },
      {
        name: '12.5 Update Payment app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Feb 02'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 5
      },
      {
        name: '12.6 Update Support app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Feb 02'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 6
      },
      {
        name: '12.7 Update Marketing app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Feb 02'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 7
      },
      {
        name: '12.8 Update Ecommerce app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Feb 02'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 8
      },
      {
        name: '12.9 Update Events app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Feb 02'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 9
      },
      {
        name: '12.10 Update Asset & Wealth Management app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Feb 02'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 10
      },
      {
        name: '12.11 Update System app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Feb 02'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 11
      },
      {
        name: '12.12 Update 1000 SME Strategy app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Feb 02'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 12
      }
    ]
  },

  // Task 13: V2 Cleanup from Microfe
  {
    parent: {
      name: '13. V2 Cleanup from Microfe',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      deadline: parseDeadline('Feb 04'),
      order: 13
    },
    subtasks: [
      {
        name: '13.1 Remove V2 code from microfe',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Clean up CRM V2 code from ps-admin-microfe. Remove unused imports, routes, and components. Predecessor: 12 (all compute apps updated)',
        deadline: parseDeadline('Feb 04'),
        duration_estimate: 7,
        duration_unit: 'Hours',
        order: 1
      }
    ]
  },

  // Task 14: Data Migration Preparation
  {
    parent: {
      name: '14. Data Migration Preparation',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      deadline: parseDeadline('Feb 04'),
      order: 14
    },
    subtasks: [
      {
        name: '14.1 Create data copy scripts (V2 to V3)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Prepare scripts for V2 to V3 data migration. Execution deferred to Sprint 3+. Notes: Full data copy and V2 switchoff requires production freeze - deferred',
        deadline: parseDeadline('Feb 04'),
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 1
      }
    ]
  },

  // Task 15: Buffer and Final Testing
  {
    parent: {
      name: '15. Buffer and Final Testing',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      deadline: parseDeadline('Feb 05'),
      order: 15
    },
    subtasks: [
      {
        name: '15.1 Critical bug fixes (buffer)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Address any critical bugs discovered during testing',
        deadline: parseDeadline('Feb 05'),
        duration_estimate: 7,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '15.2 Full regression testing',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.TODO,
        description: 'Complete regression test of CRM V3 and all updated compute apps',
        deadline: parseDeadline('Feb 05'),
        duration_estimate: 8,
        duration_unit: 'Hours',
        order: 2
      }
    ]
  },

  // Task 16: Deployment
  {
    parent: {
      name: '16. Deployment',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      deadline: parseDeadline('Feb 07'),
      order: 16
    },
    subtasks: [
      {
        name: '16.1 Final acceptance testing',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Feb 06'),
        duration_estimate: 8,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '16.2 Deployment preparation',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Feb 06'),
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 2
      },
      {
        name: '16.3 Production deployment',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Feb 07'),
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 3
      },
      {
        name: '16.4 Post-deployment verification',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Feb 07'),
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 4
      }
    ]
  }
];

// =============================================================================
// Task Definitions - Sprint 3+ (Feb 08 onwards - Deferred)
// =============================================================================

const SPRINT_3_TASKS = [
  // Task 17: Data Migration and V2 Switchoff
  {
    parent: {
      name: '17. Data Migration and V2 Switchoff',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.DEFERRED,
      description: 'Dependency: All CRM V3 bugs fixed, full regression passed. Reason Deferred: Requires production freeze, rollback plan, and stakeholder sign-off',
      order: 17
    },
    subtasks: [
      {
        name: '17.1 Create data migration scripts',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Scripts to copy all CRM V2 data to V3 tables. Handle foreign key relationships, preserve audit trails. Predecessor: 14.1',
        duration_estimate: 8,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '17.2 Create rollback scripts',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Scripts to restore V2 data if migration fails. Include validation checks.',
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 2
      },
      {
        name: '17.3 Schedule production freeze window',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Coordinate with stakeholders for maintenance window. Communicate to users.',
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 3
      },
      {
        name: '17.4 Execute data migration (dry run)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Run migration on staging environment. Validate data integrity. Predecessor: 17.1, 17.2',
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 4
      },
      {
        name: '17.5 Execute data migration (production)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Run migration on production. Monitor for errors. Predecessor: 17.4',
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 5
      },
      {
        name: '17.6 Validate migrated data',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.DEFERRED,
        description: 'Verify all records migrated correctly. Check counts, relationships, display values. Predecessor: 17.5',
        duration_estimate: 8,
        duration_unit: 'Hours',
        order: 6
      },
      {
        name: '17.7 Switch off CRM V2',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Disable V2 endpoints, update routing, remove V2 from deployment. Predecessor: 17.6',
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 7
      },
      {
        name: '17.8 Post-switchoff monitoring',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Monitor for errors, user complaints, data issues for 24-48 hours. Predecessor: 17.7',
        duration_estimate: 8,
        duration_unit: 'Hours',
        order: 8
      }
    ]
  },

  // Task 18: Remaining Backend Controller Migration (abbreviated - key tasks only)
  {
    parent: {
      name: '18. Remaining Backend Controller Migration (51 Controllers)',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.DEFERRED,
      description: 'Dependency: Critical controllers completed in Sprint 1. Reason Deferred: Lower priority; can be done incrementally',
      order: 18
    },
    subtasks: [
      {
        name: '18.1 Port Medium-High Complexity Controllers (7 controllers)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'createBulkOpportunities, createBulkPersonInCallSchedules, createBulkPersonInMarketingLists, createBulkPersonRelationships, createBulkCompanyInTerritories, getOrCreatePerson, resetRottingDaysOpportunities',
        duration_estimate: 28,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '18.2 Port Medium Complexity Controllers (6 controllers)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'accountManagerInCompany, callSchedule, territoryOwner, prospect, companyContact, personRelationship',
        duration_estimate: 12,
        duration_unit: 'Hours',
        order: 2
      },
      {
        name: '18.3 Port Simple Controllers - Metadata/Config (15 controllers)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'pipeline, pipelineStage, opportunityCategory, opportunityProduct, prospectPipeline, prospectPipelineStage, prospectProduct, prospectCategory, channel, relationship, territory, socialMediaType, customerEnquiryStatus, customerEnquiryPurpose, salesPersonTarget',
        duration_estimate: 15,
        duration_unit: 'Hours',
        order: 3
      },
      {
        name: '18.4 Port Simple Controllers - History/Audit (9 controllers)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'callHistory, clientHistory, companyHistory, opportunityHistory, personHistory, personRelationshipHistory, targetActualHistory, opportunityInfluencer, client',
        duration_estimate: 9,
        duration_unit: 'Hours',
        order: 4
      },
      {
        name: '18.5 Port Simple Controllers - Junction/Relation (10 controllers)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'actionPlan, companySocialMedia, personSocialMedia, personInMarketingList, companyInTerritory, marketingList, callList, callListPipeline, callListPipelineStage, dataNeeded',
        duration_estimate: 10,
        duration_unit: 'Hours',
        order: 5
      },
      {
        name: '18.6 Port Utility Controllers (4 controllers)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'customerEnquiry, onlineSignup, undelete, health',
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 6
      }
    ]
  },

  // Task 19: Automata CRM Integration
  {
    parent: {
      name: '19. Automata CRM Integration',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.DEFERRED,
      description: 'Dependency: Investigation from Sprint 2 (task 11.1). Reason Deferred: Unknown scope until investigation complete',
      order: 19
    },
    subtasks: [
      {
        name: '19.1 Document Automata CRM dependencies',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Based on investigation in Sprint 2, create comprehensive list of all CRM touchpoints in Automata. Predecessor: 11.1',
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '19.2 Update Automata workflows referencing CRM V2',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Update workflow definitions to use CRM V3 endpoints. Duration TBD based on 19.1 findings',
        order: 2
      },
      {
        name: '19.3 Update Automata triggers for CRM entities',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Update any triggers that fire on CRM entity changes. Duration TBD based on 19.1 findings',
        order: 3
      },
      {
        name: '19.4 Test Automata workflows with CRM V3',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.DEFERRED,
        description: 'End-to-end testing of all CRM-related workflows',
        order: 4
      },
      {
        name: '19.5 Deploy Automata changes',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Deploy updated Automata configuration. Predecessor: 19.4',
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 5
      }
    ]
  },

  // Task 20: Search Vector Implementation
  {
    parent: {
      name: '20. Search Vector Implementation',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.DEFERRED,
      description: 'Dependency: Investigation from Sprint 2 (task 7.1). Reason Deferred: Investigation only in Sprint 2',
      order: 20
    },
    subtasks: [
      {
        name: '20.1 Design search_vector integration approach',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Based on investigation, design how search vectors should be generated and used in V3. Predecessor: 7.1',
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '20.2 Implement search_vector generation',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Add search vector generation to relevant interceptors (beforeCreate, beforeUpdate). Models affected: Company, Person, Opportunity, Prospect',
        duration_estimate: 8,
        duration_unit: 'Hours',
        order: 2
      },
      {
        name: '20.3 Implement vector search endpoints',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Add beforeVectorSearch/afterVectorSearch hooks per EXTENSION_GUIDE.md',
        duration_estimate: 8,
        duration_unit: 'Hours',
        order: 3
      },
      {
        name: '20.4 Test vector search functionality',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.DEFERRED,
        description: 'Test search accuracy, performance, relevance ranking',
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 4
      },
      {
        name: '20.5 Migrate existing search vectors from V2',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Script to regenerate search vectors for existing records',
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 5
      }
    ]
  },

  // Task 21: Hamza Dependency Tasks
  {
    parent: {
      name: '21. Hamza Dependency Tasks (TBD)',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.DEFERRED,
      description: 'Dependency: Hamza meeting in Sprint 1 (task 5.1). Reason Deferred: Tasks to be defined after Hamza meeting. This section will be populated after the Hamza meeting on Jan 28.',
      order: 21
    },
    subtasks: [
      {
        name: '21.1 Document non-compute, non-Automata CRM dependencies',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Create task list from Hamza meeting output. Predecessor: 5.1',
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 1
      }
    ]
  },

  // Task 22: Frontend Business Logic Port
  {
    parent: {
      name: '22. Frontend Business Logic Port (Beyond Bugs)',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.DEFERRED,
      description: 'Dependency: Bug fixes in Sprint 1-2 cover immediate needs. Reason Deferred: Full parity not required for Feb 07 deadline',
      order: 22
    },
    subtasks: [
      {
        name: '22.1 Port remaining form components',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Port remaining 90+ form components from V2 to V3 entity-core. Source: /ps-admin-microfe/apps/crm-v2/src/pages/, Target: /ps-admin-microfe/packages/entity-core/src/crm-v2/',
        duration_estimate: 40,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '22.2 Port data mappers',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Port 48+ data mapper functions. Source: /ps-admin-microfe/packages/entity-core/src/crm-v2/configs/dataMappers/',
        duration_estimate: 16,
        duration_unit: 'Hours',
        order: 2
      },
      {
        name: '22.3 Port table column configurations',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Port 48+ table column configs with inline editing support. Source: /ps-admin-microfe/packages/entity-core/src/crm-v2/configs/tableColumns/',
        duration_estimate: 16,
        duration_unit: 'Hours',
        order: 3
      },
      {
        name: '22.4 Port validation schemas',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Port 40+ Yup validation schemas. Source: /ps-admin-microfe/packages/entity-core/src/crm-v2/configs/validationSchemas/',
        duration_estimate: 8,
        duration_unit: 'Hours',
        order: 4
      },
      {
        name: '22.5 Port cascading dropdown logic',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Port Country to State to City hierarchy and dependent field clearing',
        duration_estimate: 8,
        duration_unit: 'Hours',
        order: 5
      },
      {
        name: '22.6 Port pinned filters with localStorage',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.DEFERRED,
        description: 'Port filter persistence using localStorage (Person page pattern)',
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 6
      }
    ]
  },

  // Task 23: Additional Testing and Regression
  {
    parent: {
      name: '23. Additional Testing and Regression',
      owner: RESOURCES.Touseef,
      status: TASK_STATUSES.DEFERRED,
      order: 23
    },
    subtasks: [
      {
        name: '23.1 Full CRM V3 regression test',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.DEFERRED,
        description: 'Complete regression of all CRM V3 functionality after full migration',
        duration_estimate: 16,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '23.2 Cross-app integration testing',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.DEFERRED,
        description: 'Test CRM V3 integration with all 12 compute apps, Automata, kanbans',
        duration_estimate: 16,
        duration_unit: 'Hours',
        order: 2
      },
      {
        name: '23.3 Performance testing',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.DEFERRED,
        description: 'Load testing for list views, bulk operations, import/export',
        duration_estimate: 8,
        duration_unit: 'Hours',
        order: 3
      },
      {
        name: '23.4 User acceptance testing',
        owner: RESOURCES.Touseef,
        status: TASK_STATUSES.DEFERRED,
        description: 'Final sign-off from business users',
        order: 4
      }
    ]
  }
];

// =============================================================================
// Main Execution
// =============================================================================

async function main() {
  console.log('='.repeat(80));
  console.log('Starting Task Import to PM');
  console.log('='.repeat(80));
  console.log(`\nBase URL: ${BASE_URL}`);
  console.log(`Project ID: ${PROJECT_ID}`);
  console.log('');

  let totalTasks = 0;
  let successCount = 0;
  let errorCount = 0;

  // Process Sprint 1 Tasks
  console.log('\n' + '='.repeat(80));
  console.log('SPRINT 1: Jan 22-28, 2026');
  console.log('='.repeat(80));

  for (const taskGroup of SPRINT_1_TASKS) {
    console.log(`\n--- ${taskGroup.parent.name} ---`);
    try {
      await createTaskWithSubtasks(taskGroup.parent, taskGroup.subtasks, SPRINTS.SPRINT_1);
      totalTasks += 1 + taskGroup.subtasks.length;
      successCount += 1 + taskGroup.subtasks.length;
    } catch (error) {
      errorCount += 1 + taskGroup.subtasks.length;
    }
  }

  // Process Sprint 2 Tasks
  console.log('\n' + '='.repeat(80));
  console.log('SPRINT 2: Jan 29 - Feb 07, 2026');
  console.log('='.repeat(80));

  for (const taskGroup of SPRINT_2_TASKS) {
    console.log(`\n--- ${taskGroup.parent.name} ---`);
    try {
      await createTaskWithSubtasks(taskGroup.parent, taskGroup.subtasks, SPRINTS.SPRINT_2);
      totalTasks += 1 + taskGroup.subtasks.length;
      successCount += 1 + taskGroup.subtasks.length;
    } catch (error) {
      errorCount += 1 + taskGroup.subtasks.length;
    }
  }

  // Process Sprint 3+ Tasks (Deferred)
  console.log('\n' + '='.repeat(80));
  console.log('SPRINT 3+: Feb 08 onwards (Deferred)');
  console.log('='.repeat(80));

  for (const taskGroup of SPRINT_3_TASKS) {
    console.log(`\n--- ${taskGroup.parent.name} ---`);
    try {
      await createTaskWithSubtasks(taskGroup.parent, taskGroup.subtasks, SPRINTS.SPRINT_3);
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
