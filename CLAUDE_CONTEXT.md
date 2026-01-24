# Claude Context: 1000 SME Sprint Plan

> **Purpose:** This file provides context for future Claude sessions working on this project. Read this first before making changes.

---

## Project Overview

**Goal:** Complete Support App fixes and CRM V2 to V3 migration by Feb 07, 2026.

**Timeline:** Jan 22 - Feb 07, 2026 (2 sprints, 7 days each)

**Current Sprint:** Check today's date against timeline to determine active sprint.

---

## Team

| Name | Role | Capacity | Notes |
|------|------|----------|-------|
| Umer | Lead Developer | 7h/day (12-3 PM + 5-9 PM) | All development tasks |
| Abdullah | Full-time Tester | 8h/day | CRM V3 testing lead |
| Touseef | Part-time Tester | 4-6h/day | Support App testing, assist |
| Hamza | Software Engineer | Available for meetings | Dependency planning |

---

## Key Files

### Task & Planning Files
| File | Purpose |
|------|---------|
| `/tasks/sprint-tasks-jan22-feb07.md` | **Main task list** - All tasks with owners, durations, deadlines |
| `/tasks/1-support-app.md` | Support App bug details and requirements |
| `/tasks/2-crm-v3-migration.md` | CRM V3 migration requirements and bug reports |
| `/pm-app-context.md` | PM app task model definition and sprint info |
| `~/.claude/plans/binary-hugging-walrus.md` | High-level sprint plan with schedules |

### CRM V2 (Source - Being Migrated)
| Path | Purpose |
|------|---------|
| `/crm-v2-rapi/src/controllers/` | 61 controllers with business logic to port |
| `/ps-admin-microfe/apps/crm-v2/src/pages/` | Frontend pages (44 entities) |
| `/ps-admin-microfe/packages/entity-core/src/crm-v2/` | Forms, mappers, validators, columns |

### CRM V3 (Target)
| Path | Purpose |
|------|---------|
| `/crm-v3-rapi/src/domain/interceptors/` | 46 interceptor files for business logic |
| `/crm-v3-rapi/docs/EXTENSION_GUIDE.md` | **Critical** - Pattern for porting logic |
| `/crm-v3-rapi/src/domain/routes/v1/` | Custom routes (import/export) |

---

## Sprint 1-2 Quick Reference (Jan 22 - Feb 07)

### Sprint 1: Jan 22-28 (Foundation + Critical Fixes)
| Day | Key Deliverables |
|-----|------------------|
| Jan 22 | Support App Bug #1 fixed, Touseef testing complete, 6 bugs verified |
| Jan 23 | Support App Bug #2 fixed, company/person interceptors started |
| Jan 24 | All 15 CRM V3 prod bugs verified, import/export ported |
| Jan 25 | Critical interceptors complete, CRM V3 Bugs #1-2 fixed |
| Jan 26-27 | CRM V3 Bugs #3-6 fixed (bulk actions, filters, tabs) |
| Jan 28 | **Hamza meeting**, Sprint 1 regression complete |

### Sprint 2: Jan 29 - Feb 07 (Integration + Cleanup)
| Day | Key Deliverables |
|-----|------------------|
| Jan 29 | Bug #7 (INA) fixed, search_vector investigation |
| Jan 30 | Route parity verified, additional interceptors |
| Jan 31 | INA + Opportunity kanbans updated |
| Feb 01-02 | All 12 compute apps updated |
| Feb 03-04 | V2 cleanup, data migration scripts prep |
| Feb 05 | **Buffer day** - critical fixes |
| Feb 06-07 | Final testing + deployment |

---

## Critical Controller → Interceptor Mapping

| V2 Controller | V3 Interceptor | Lines | Priority | Status |
|---------------|----------------|-------|----------|--------|
| company.controller.js | company.interceptor.js | 700+ | P0 | To do |
| person.controller.js | person.interceptor.js | 800+ | P0 | To do |
| opportunity.controller.js | opportunity.interceptor.js | 1300+ | P0 | To do |
| import.controller.js | Custom route | 400+ | P0 | To do |
| export.controller.js | Custom route | 300+ | P0 | To do |
| client.controller.js | client.interceptor.js | 600+ | P1 | To do |
| marketingList.controller.js | marketingList.interceptor.js | 500+ | P1 | To do |

---

## Bug IDs Quick Reference

### Support App Bugs
| ID | Description | Status |
|----|-------------|--------|
| c708bfec-a7ba-4397-ada4-24cd78680d51 | Data not showing in dropdown/list/details | To do |
| 970cb0f6-fed9-4d9f-af44-4b8870e90b58 | Form flows with single form showing | To do |

### CRM V3 Documented Bugs (7)
| ID | Description | Status |
|----|-------------|--------|
| 0f027aa9-36c8-4657-b641-75a37f65e54d | Sales Person - undefined entity | To do |
| 18053f60-0829-4dc9-95fb-256b02b8ecf5 | Details view - wrong entity link | To do |
| f25f3950-85a1-4300-bca1-bdafe2b2b6bf | Process Records button missing | To do |
| 28052669-6fd4-4b1f-a83f-dc58c67e0e80 | Bulk actions missing | To do |
| f6c827d5-4876-4c69-8f17-613475090192 | Filters missing | To do |
| 161079a0-fd4b-4976-ac53-1b49f4f74748 | Missing tabs (Company Notes, Email History) | To do |
| 50f4f88d-a837-4c0e-8f68-ab336e02997b | INA record not appearing after save | To do |

### CRM V3 Ready for Prod Testing (15)
| ID | Description |
|----|-------------|
| 4e32c2a4-5da6-49dc-b97e-81fc4da22843 | Value disappear - Automata Workflow |
| f0ec1f52-21c6-442a-a884-598ffa8ccff8 | Field needs multiline |
| 03849cf3-58f7-4e3f-b96d-c448b71c860e | Dropdown items not ordered |
| 79896381-5ccd-442a-81f2-b6b1f775e4df | Values not filtered in related fields |
| 97b468d4-66f0-4522-903e-af6e96b45464 | No phone validation error |
| bdbe8d83-b7e7-4599-8caa-25de85030fdf | Fields need enum values |
| 43736ca7-b24c-4e00-b93a-1d0bd8fd7976 | Fields not autocomplete dropdowns |
| 3d3417c8-933f-45f0-8962-d7dce874ba02 | Industry field as text |
| 7580bd72-0c94-4eae-8796-94bc0fcb3717 | Country/City/State not dropdowns |
| 01188e0f-f903-43b1-b275-ebd6849fd448 | Work Phone/Mobile free text |
| 31b34fc1-8351-45ca-8ab2-9473218f1a02 | Phone incorrect format |
| 6419f3d6-8826-4d35-bc88-ccbd25dc6bc3 | Categories Description issues |
| b11e2604-08f6-43f7-9e48-43a9d03e8a00 | INAs not created with bulk reminder |
| 5ed83a01-8833-4d7f-8f77-13164e29db5c | Value disappear in list/details |
| b5c5cc61-090c-42c6-b426-a8b0d4406f51 | Color functionality missing |

---

## Compute Apps (12 Total)

These apps need updating to point to CRM V3:

| App | Priority |
|-----|----------|
| Lists | High |
| Finanshalls | High |
| Support | High |
| Marketing | High |
| System | High |
| Recruiter | Medium |
| Inventory | Medium |
| Payment | Medium |
| Ecommerce | Medium |
| 1000 SME Strategy | Medium |
| Events | Low |
| Asset & Wealth Management | Low |

---

## V3 Interceptor Pattern

When porting business logic from V2 controllers to V3 interceptors, use these lifecycle hooks:

```javascript
// /crm-v3-rapi/src/domain/interceptors/{model}.interceptor.js

module.exports = {
  // Validation phase
  beforeValidate(data, context) { },   // Transform input
  extendSchema(schema, context) { },   // Add Joi rules
  afterValidate(data, context) { },    // Cross-field validation

  // CRUD phase
  beforeCreate(data, context) { },     // Compute fields, check duplicates
  afterCreate(data, context) { },      // Trigger workflows, notifications
  beforeUpdate(data, context) { },
  afterUpdate(data, context) { },
  beforeDelete(data, context) { },     // Check dependencies
  afterDelete(data, context) { },      // Cascade deletes

  // Query phase
  beforeList(queryBuilder, context) { },  // Add filters, visibility
  afterList(data, context) { },           // Enrich display values
  beforeRead(queryBuilder, context) { },
  afterRead(data, context) { },

  // Error handling
  onError(error, context) { }
};
```

**Key context properties:**
- `context.user` - Current user info
- `context.modelName` - Entity being operated on
- `context.operation` - create/update/delete/list/read
- `context.queryBuilder` - For query modification
- `context.existingRecord` - For updates/deletes

---

## Frontend Patterns to Port

### Bulk Actions (4)
- `BulkAddToTerritory` - Add companies to territory
- `BulkCreateOpportunity` - Create opportunities for selected records
- `BulkAddPersonRelationship` - Add relationships to people
- `BulkAddPersonToMarketingList` - Add people to marketing lists

### Filters
- Company page: Territory, Sales Person filters
- Person page: Marketing List, Relationships filters (localStorage persistence)

### Tabs (Detail Views)
- Company: Company Notes, Email History
- Person: Person Relationships, Person History, Email History, INAs
- Opportunity: Email History

---

## Sprint 3+ Deferred Items (Detailed)

> Full task breakdown in `/tasks/sprint-tasks-jan22-feb07.md` under "SPRINT 3+: Feb 08 onwards"

### 17. Data Migration & V2 Switchoff (~40h)
| Task | Owner | Duration |
|------|-------|----------|
| Create data migration scripts | Umer | 8h |
| Create rollback scripts | Umer | 4h |
| Schedule production freeze | Umer | 2h |
| Execute dry run (staging) | Umer | 4h |
| Execute production migration | Umer | 4h |
| Validate migrated data | Abdullah | 8h |
| Switch off CRM V2 | Umer | 2h |
| Post-switchoff monitoring | Umer | 8h |

### 18. Remaining Backend Controllers (51 controllers, ~78h)
| Group | Count | Duration Each |
|-------|-------|---------------|
| Medium-High complexity | 7 | 4h |
| Medium complexity | 6 | 2h |
| Simple - Metadata/Config | 15 | 1h |
| Simple - History/Audit | 9 | 1h |
| Simple - Junction/Relation | 10 | 1h |
| Utility | 4 | 1h |

### 19. Automata CRM Integration (TBD)
- Document dependencies (from Sprint 2 investigation)
- Update workflows referencing CRM V2
- Update entity triggers
- Test and deploy

### 20. Search Vector Implementation (~28h)
- Design integration approach
- Implement vector generation in interceptors
- Implement vector search endpoints
- Test functionality
- Migrate existing vectors

### 21. Hamza Dependency Tasks (TBD)
- Tasks to be defined after Jan 28 meeting
- Non-compute, non-Automata CRM dependencies

### 22. Frontend Business Logic Port (~92h)
| Task | Duration |
|------|----------|
| Port 90+ form components | 40h |
| Port 48+ data mappers | 16h |
| Port 48+ table column configs | 16h |
| Port 40+ validation schemas | 8h |
| Port cascading dropdown logic | 8h |
| Port pinned filters | 4h |

### 23. Additional Testing (~40h+)
- Full CRM V3 regression
- Cross-app integration testing
- Performance testing
- User acceptance testing

**Sprint 3+ Total:** ~280+ dev-hours (4-5 additional sprints)

---

## How to Update Tasks

### To modify task list:
1. Edit `/tasks/sprint-tasks-jan22-feb07.md`
2. Update status, deadlines, or add new subtasks
3. Keep the markdown table format consistent

### To add a new bug:
1. Add to appropriate section in task file
2. Add ID to quick reference above
3. Assign owner and estimate duration

### To mark task complete:
1. Change `Status: To do` → `Status: Done`
2. Or add completion date to description

---

## Common Commands

```bash
# Navigate to project
cd /home/rover/pullstream/monorepos/1000-sme-sprint-plan

# View V2 controllers
ls crm-v2-rapi/src/controllers/

# View V3 interceptors
ls crm-v3-rapi/src/domain/interceptors/

# View extension guide
cat crm-v3-rapi/docs/EXTENSION_GUIDE.md

# View task list
cat tasks/sprint-tasks-jan22-feb07.md
```

---

## Session Checklist

When starting a new session:

1. Read this file first
2. Check current date against timeline
3. Review `/tasks/sprint-tasks-jan22-feb07.md` for current status
4. Ask user which task to work on
5. Read relevant source files before making changes

---

## Contact Points

- **Umer** - Lead developer, owns all dev tasks
- **Abdullah** - Testing questions, bug verification
- **Touseef** - Support App testing
- **Hamza** - Dependency planning, other app integrations
