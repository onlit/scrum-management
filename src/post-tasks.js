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
        name: '1.2 Fix: Data not showing in dropdown/list/details (c708bfec)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'AI Classification Result dropdown displays raw UTC ISO instead of formatted timestamp. List and details view show (...) instead of value. URL: https://me.pullstream.com/support/ai-performance-feedbacks',
        deadline: parseDeadline('Jan 22'),
        duration_estimate: 3,
        duration_unit: 'Hours',
        order: 2
      },
      {
        name: '1.3 Fix: Form flows listed with only one form (970cb0f6)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Form Flows menu shows entries with only one form (Support Agent Profiles, Autonomy Configurations, Bug Reports). Should only show entries with >1 form. URL: https://me.pullstream.com/support/ff/knowledge-articles',
        deadline: parseDeadline('Jan 23'),
        duration_estimate: 30,
        duration_unit: 'Hours',
        order: 3
      },
      {
        name: '1.4 Fix bugs reported by Touseef',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Address any bugs found during Touseef\'s testing session. Predecessor: 1.1',
        deadline: parseDeadline('Jan 24'),
        duration_estimate: 3,
        duration_unit: 'Hours',
        order: 4
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
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 4
      },
      {
        name: '3.5 Port export.controller.js to V3 custom route',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Port dynamic headers, CSV streaming, display value enrichment. Source: /crm-v2-rapi/src/controllers/export.controller.js, Target: /crm-v3-rapi/src/domain/routes/v1/export.route.js. Predecessor: 3.4',
        deadline: parseDeadline('Jan 25'),
        duration_estimate: 1,
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
        duration_estimate: 7,
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
        duration_estimate: 7,
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
  },

  // Task 6: CRM V3 Final Bug Fix (moved from Sprint 2)
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

  // Task 7: Implement Search Vector (FTS) in compute-rapi (moved from Sprint 2)
  {
    parent: {
      name: '7. Implement Search Vector (FTS) in compute-rapi',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      deadline: parseDeadline('Jan 29'),
      order: 7
    },
    subtasks: [
      {
        name: '7.1 Schema Changes for FTS Configuration',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Jan 29'),
        duration_estimate: 3,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '7.2 Create ftsMigrationUtils.js',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        duration_estimate: 6,
        duration_unit: 'Hours',
        order: 2
      },
      {
        name: '7.3 Write Unit Tests for ftsMigrationUtils',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        duration_estimate: 3,
        duration_unit: 'Hours',
        order: 3
      },
      {
        name: '7.4 Modify prismaUtils.js for search_vector Field',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 4
      },
      {
        name: '7.5 Integrate FTS into generateAPI.js',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 5
      },
      {
        name: '7.6 End-to-End Testing',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        duration_estimate: 4,
        duration_unit: 'Hours',
        order: 6
      },
      {
        name: '7.7 Enable FTS for CRM V3 Models',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 7
      }
    ]
  },

  // Task 8: Additional Backend Interceptors (moved from Sprint 2)
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

  // Task 9: Route Parity Verification (moved from Sprint 2)
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

  // Task 12: Compute Apps Update (moved from Sprint 2)
  {
    parent: {
      name: '12. Compute Apps Update',
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
        name: '12.7 Update 1000 SME Strategy app',
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
        name: '12.10 Update System app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        deadline: parseDeadline('Feb 02'),
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 10
      }
    ]
  },

  // Task 18: Remaining Backend Controller Migration (moved from Sprint 3)
  {
    parent: {
      name: '18. Remaining Backend Controller Migration (51 Controllers)',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      order: 18
    },
    subtasks: [
      {
        name: '18.1 Port Medium-High Complexity Controllers (7 controllers)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'createBulkOpportunities, createBulkPersonInCallSchedules, createBulkPersonInMarketingLists, createBulkPersonRelationships, createBulkCompanyInTerritories, getOrCreatePerson, resetRottingDaysOpportunities',
        duration_estimate: 7,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '18.2 Port Medium Complexity Controllers (6 controllers)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'accountManagerInCompany, callSchedule, territoryOwner, prospect, companyContact, personRelationship',
        duration_estimate: 3,
        duration_unit: 'Hours',
        order: 2
      },
      {
        name: '18.3 Port Simple Controllers - Metadata/Config (15 controllers)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'pipeline, pipelineStage, opportunityCategory, opportunityProduct, prospectPipeline, prospectPipelineStage, prospectProduct, prospectCategory, channel, relationship, territory, socialMediaType, customerEnquiryStatus, customerEnquiryPurpose, salesPersonTarget',
        duration_estimate: 3,
        duration_unit: 'Hours',
        order: 3
      },
      {
        name: '18.4 Port Simple Controllers - History/Audit (9 controllers)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'callHistory, clientHistory, companyHistory, opportunityHistory, personHistory, personRelationshipHistory, targetActualHistory, opportunityInfluencer, client',
        duration_estimate: 3,
        duration_unit: 'Hours',
        order: 4
      },
      {
        name: '18.5 Port Simple Controllers - Junction/Relation (10 controllers)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'actionPlan, companySocialMedia, personSocialMedia, personInMarketingList, companyInTerritory, marketingList, callList, callListPipeline, callListPipelineStage, dataNeeded',
        duration_estimate: 3,
        duration_unit: 'Hours',
        order: 5
      },
      {
        name: '18.6 Port Utility Controllers (4 controllers)',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'customerEnquiry, onlineSignup, undelete, health',
        duration_estimate: 1,
        duration_unit: 'Hours',
        order: 6
      }
    ]
  },

  // Task 22: Frontend Business Logic Port (moved from Sprint 3)
  {
    parent: {
      name: '22. Frontend Business Logic Port (Beyond Bugs)',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      order: 22
    },
    subtasks: [
      {
        name: '22.1 Port remaining form components',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Port remaining 90+ form components from V2 to V3 entity-core. Source: /ps-admin-microfe/apps/crm-v2/src/pages/, Target: /ps-admin-microfe/packages/entity-core/src/crm-v2/',
        duration_estimate: 14,
        duration_unit: 'Hours',
        order: 1
      }
    ]
  }
];

// Cross-sprint subtasks: These subtasks have parents in Sprint 2 but are linked to Sprint 1
const SPRINT_1_CROSS_SPRINT_SUBTASKS = [
  {
    name: '10.2 Update Opportunity kanban with CRM V3',
    owner: RESOURCES.Umer,
    status: TASK_STATUSES.TODO,
    description: 'Update Opportunity kanban to use CRM V3 endpoints',
    deadline: parseDeadline('Jan 31'),
    duration_estimate: 4,
    duration_unit: 'Hours',
    order: 2,
    parentTaskName: '10. Kanban Updates' // Parent is in Sprint 2
  },
  {
    name: '11.2 Investigate Automata CRM dependencies',
    owner: RESOURCES.Umer,
    status: TASK_STATUSES.TODO,
    description: 'Document all CRM dependencies in Automata. Create task list for resolution.',
    deadline: parseDeadline('Feb 01'),
    duration_estimate: 4,
    duration_unit: 'Hours',
    order: 2,
    parentTaskName: '11. Automata CRM Dependencies' // Parent is in Sprint 2
  }
];

// =============================================================================
// Task Definitions - Sprint 2 (Jan 29 - Feb 07, 2026)
// =============================================================================

const SPRINT_2_TASKS = [
  // Task 10: Kanban Updates (Note: 10.2 moved to Sprint 1)
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
      }
      // Note: 10.2 was moved to Sprint 1
    ]
  },

  // Task 11: Automata CRM Dependencies (Note: 11.2 moved to Sprint 1)
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
        name: '11.1 Update Automata workflows referencing CRM V2',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        duration_estimate: 0,
        order: 1
      }
      // Note: 11.2 was moved to Sprint 1
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
        name: '15.2 Fix bugs reported for Events app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Address all bugs reported during Events app testing',
        deadline: parseDeadline('Feb 05'),
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 2
      },
      {
        name: '15.3 Fix bugs reported for Inventory app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Address all bugs reported during Inventory app testing',
        deadline: parseDeadline('Feb 05'),
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 3
      },
      {
        name: '15.4 Fix bugs reported for 1000 SME app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Address all bugs reported during 1000 SME Strategy app testing',
        deadline: parseDeadline('Feb 05'),
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 4
      },
      {
        name: '15.5 Fix bugs reported for Ecommerce app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Address all bugs reported during Ecommerce app testing',
        deadline: parseDeadline('Feb 05'),
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 5
      },
      {
        name: '15.6 Fix bugs reported for Payment app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Address all bugs reported during Payment app testing',
        deadline: parseDeadline('Feb 05'),
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 6
      },
      {
        name: '15.7 Fix bugs reported for Finanshalls app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Address all bugs reported during Finanshalls app testing',
        deadline: parseDeadline('Feb 05'),
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 7
      },
      {
        name: '15.8 Fix bugs reported for Support app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Address all bugs reported during Support app testing',
        deadline: parseDeadline('Feb 05'),
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 8
      },
      {
        name: '15.9 Fix bugs reported for Recruiter app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Address all bugs reported during Recruiter app testing',
        deadline: parseDeadline('Feb 05'),
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 9
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
      }
    ]
  },

  // Task 17: Data Migration and V2 Switchoff
  {
    parent: {
      name: '17. Data Migration and V2 Switchoff',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      order: 17
    },
    subtasks: [
      {
        name: '17.2 Update Calendar INAs with CRM V3.',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        duration_estimate: 3,
        order: 2
      },
      {
        name: '17.3 Schedule production freeze window',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Coordinate with stakeholders for maintenance window. Communicate to users.',
        duration_estimate: 2,
        order: 3
      },
      {
        name: '17.6 Switch off CRM V2',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Disable V2 endpoints, update routing, remove V2 from deployment.',
        duration_estimate: 2,
        order: 6
      },
      {
        name: '17.7 Post-switchoff monitoring',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Monitor for errors, user complaints, data issues for 24-48 hours.',
        duration_estimate: 8,
        duration_unit: 'Hours',
        order: 7
      }
    ]
  },

  // Task 23: PM Tasks Accordion Sprint Column
  {
    parent: {
      name: '23. PM Tasks Accordion Sprint Column',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      order: 23
    },
    subtasks: [
      {
        name: '23.1 Add Sprint column to tasks accordion',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'In PM app, tasks accordion view, add a column called "Sprint" to display which sprint each task belongs to.',
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 1
      }
    ]
  },

  // Task 24: Lists App Crashback Loops
  {
    parent: {
      name: '24. Lists App Crashback Loops',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      order: 24
    },
    subtasks: [
      {
        name: '24.1 Investigate crashback loops in Lists app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Investigate root cause of crashback loops occurring in the Lists app.',
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '24.2 Fix crashback loops in Lists app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Implement fix for crashback loops based on investigation findings. Predecessor: 24.1',
        duration_estimate: 3,
        duration_unit: 'Hours',
        order: 2
      }
    ]
  },

  // Task 25: Review and Upgrade Legacy Apps
  {
    parent: {
      name: '25. Review and Upgrade Legacy Apps',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      order: 25
    },
    subtasks: [
      {
        name: '25.1 Review and upgrade CMS app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Review CMS app for compatibility and upgrade as needed.',
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '25.2 Review and upgrade LMS app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Review LMS app for compatibility and upgrade as needed.',
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 2
      },
      {
        name: '25.3 Review and upgrade Forms app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Review Forms app for compatibility and upgrade as needed.',
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 3
      },
      {
        name: '25.4 Review and upgrade eDoc app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Review eDoc app for compatibility and upgrade as needed.',
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 4
      },
      {
        name: '25.5 Review and upgrade Drive app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Review Drive app for compatibility and upgrade as needed.',
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 5
      },
      {
        name: '25.6 Review and upgrade Marketing V2 app',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Review Marketing V2 app for compatibility and upgrade as needed.',
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 6
      }
    ]
  },

  // Task 26: CRM Route Verification
  {
    parent: {
      name: '26. CRM Route Verification',
      owner: RESOURCES.Umer,
      status: TASK_STATUSES.TODO,
      order: 26
    },
    subtasks: [
      {
        name: '26.1 Verify response structures for all CRM routes',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Verify that response structures match expected format for all CRM V3 routes.',
        duration_estimate: 3,
        duration_unit: 'Hours',
        order: 1
      },
      {
        name: '26.2 Verify behavior for all CRM routes',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Verify CRUD operations, side effects, and business logic for all CRM V3 routes.',
        duration_estimate: 3,
        duration_unit: 'Hours',
        order: 2
      },
      {
        name: '26.3 Verify filters for all CRM routes',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Verify that all filter parameters work correctly for CRM V3 routes.',
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 3
      },
      {
        name: '26.4 Verify search params for all CRM routes',
        owner: RESOURCES.Umer,
        status: TASK_STATUSES.TODO,
        description: 'Verify that search parameters (pagination, sorting, full-text search) work correctly for CRM V3 routes.',
        duration_estimate: 2,
        duration_unit: 'Hours',
        order: 4
      }
    ]
  }
];

// =============================================================================
// Task Definitions - Sprint 3+ (Feb 08 onwards - Deferred)
// Note: Tasks 18 and 22 were moved to Sprint 1
// =============================================================================

const SPRINT_3_TASKS = [
  // All tasks moved to Sprint 1
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
