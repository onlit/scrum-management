# Sprint Tasks: Jan 22 - Feb 07, 2026

## Instructions
Import these tasks into your PM app. Each parent task has subtasks indented below it.
- **Deadline** = Target completion date
- **Duration** = Estimated hours
- **Owner** = Assigned resource

---

## SPRINT 1: Jan 22-28, 2026

### 1. Support App Testing and Bug Fixes
**Owner:** Umer (Lead) | **Deadline:** Jan 24 | **Status:** To do

#### 1.1 Test Support App
- **Owner:** Touseef
- **Duration:** 4 hours
- **Deadline:** Jan 22
- **Description:** Complete testing of Support App, document all bugs found
- **Predecessor:** None

#### 1.2 Fix: Data not showing in dropdown/list/details (c708bfec)
- **Owner:** Umer
- **Duration:** 30 minutes
- **Deadline:** Jan 22
- **Description:** AI Classification Result dropdown displays raw UTC ISO instead of formatted timestamp. List and details view show (...) instead of value.
- **URL:** https://me.pullstream.com/support/ai-performance-feedbacks
- **Predecessor:** None

#### 1.3 Fix: Form flows listed with only one form (970cb0f6)
- **Owner:** Umer
- **Duration:** 4 hours (investigate first)
- **Deadline:** Jan 23
- **Description:** Form Flows menu shows entries with only one form (Support Agent Profiles, Autonomy Configurations, Bug Reports). Should only show entries with >1 form.
- **URL:** https://me.pullstream.com/support/ff/knowledge-articles
- **Predecessor:** None

#### 1.4 Fix bugs reported by Touseef
- **Owner:** Umer
- **Duration:** TBD (based on findings)
- **Deadline:** Jan 24
- **Description:** Address any bugs found during Touseef's testing session
- **Predecessor:** 1.1

---

### 2. CRM V3 Prod Testing (15 Bugs)
**Owner:** Abdullah (Lead) | **Deadline:** Jan 24 | **Status:** To do

#### 2.1 Value disappear - Automata Workflow (4e32c2a4)
- **Owner:** Abdullah
- **Duration:** 1 hour
- **Deadline:** Jan 22

#### 2.2 Field needs to be multiline (f0ec1f52)
- **Owner:** Abdullah
- **Duration:** 30 minutes
- **Deadline:** Jan 22

#### 2.3 Dropdown items not ordered correctly (03849cf3)
- **Owner:** Abdullah
- **Duration:** 30 minutes
- **Deadline:** Jan 22

#### 2.4 Values not filtered in related fields (79896381)
- **Owner:** Abdullah
- **Duration:** 1 hour
- **Deadline:** Jan 22

#### 2.5 No validation error for phone fields (97b468d4)
- **Owner:** Abdullah
- **Duration:** 30 minutes
- **Deadline:** Jan 22

#### 2.6 Fields need predefined enum values (bdbe8d83)
- **Owner:** Abdullah
- **Duration:** 1 hour
- **Deadline:** Jan 22

#### 2.7 Fields not autocomplete dropdowns (43736ca7)
- **Owner:** Abdullah
- **Duration:** 1 hour
- **Deadline:** Jan 23

#### 2.8 Industry field as text instead of dropdown (3d3417c8)
- **Owner:** Abdullah
- **Duration:** 30 minutes
- **Deadline:** Jan 23

#### 2.9 Country/City/State not dropdowns (7580bd72)
- **Owner:** Abdullah
- **Duration:** 1 hour
- **Deadline:** Jan 23

#### 2.10 Work Phone/Mobile allow free text (01188e0f)
- **Owner:** Abdullah
- **Duration:** 30 minutes
- **Deadline:** Jan 23

#### 2.11 Phone field incorrect format (31b34fc1)
- **Owner:** Abdullah
- **Duration:** 30 minutes
- **Deadline:** Jan 23

#### 2.12 Categories Description field issues (6419f3d6)
- **Owner:** Abdullah
- **Duration:** 30 minutes
- **Deadline:** Jan 23

#### 2.13 INAs not created with bulk reminder (b11e2604)
- **Owner:** Abdullah
- **Duration:** 1 hour
- **Deadline:** Jan 24

#### 2.14 Value disappear in list/details (5ed83a01)
- **Owner:** Abdullah
- **Duration:** 1 hour
- **Deadline:** Jan 24

#### 2.15 Color functionality missing (b5c5cc61)
- **Owner:** Abdullah
- **Duration:** 1 hour
- **Deadline:** Jan 24

---

### 3. Backend Migration: Critical Controllers
**Owner:** Umer (Lead) | **Deadline:** Jan 25 | **Status:** To do

#### 3.1 Port company.controller.js to company.interceptor.js
- **Owner:** Umer
- **Duration:** 7 hours
- **Deadline:** Jan 23
- **Description:** Port duplicate detection, cascading deletes (9 entities), visibility filters, display value enrichment
- **Files:**
  - Source: `/crm-v2-rapi/src/controllers/company.controller.js`
  - Target: `/crm-v3-rapi/src/domain/interceptors/company.interceptor.js`
- **Predecessor:** None

#### 3.2 Port person.controller.js to person.interceptor.js
- **Owner:** Umer
- **Duration:** 7 hours
- **Deadline:** Jan 24
- **Description:** Port PII masking, relationship aggregation, cascading deletes (9 entities), workflow triggers
- **Files:**
  - Source: `/crm-v2-rapi/src/controllers/person.controller.js`
  - Target: `/crm-v3-rapi/src/domain/interceptors/person.interceptor.js`
- **Predecessor:** 3.1

#### 3.3 Port opportunity.controller.js to opportunity.interceptor.js
- **Owner:** Umer
- **Duration:** 14 hours
- **Deadline:** Jan 25
- **Description:** Port stage calculation, INA counts, auto-defaults, territory derivation, pipeline/status validation, dual workflow triggers
- **Files:**
  - Source: `/crm-v2-rapi/src/controllers/opportunity.controller.js` (1300+ lines)
  - Target: `/crm-v3-rapi/src/domain/interceptors/opportunity.interceptor.js`
- **Predecessor:** 3.2

#### 3.4 Port import.controller.js to V3 custom route
- **Owner:** Umer
- **Duration:** 4 hours
- **Deadline:** Jan 24
- **Description:** Port CSV streaming, row validation, batch operations, permission checking
- **Files:**
  - Source: `/crm-v2-rapi/src/controllers/import.controller.js`
  - Target: `/crm-v3-rapi/src/domain/routes/v1/import.route.js`
- **Predecessor:** None

#### 3.5 Port export.controller.js to V3 custom route
- **Owner:** Umer
- **Duration:** 3 hours
- **Deadline:** Jan 25
- **Description:** Port dynamic headers, CSV streaming, display value enrichment
- **Files:**
  - Source: `/crm-v2-rapi/src/controllers/export.controller.js`
  - Target: `/crm-v3-rapi/src/domain/routes/v1/export.route.js`
- **Predecessor:** 3.4

---

### 4. CRM V3 Documented Bug Fixes
**Owner:** Umer + Umer | **Deadline:** Jan 28 | **Status:** To do

#### 4.1 Fix: Sales Person page - undefined entity (0f027aa9)
- **Owner:** Umer
- **Duration:** 3 hours
- **Deadline:** Jan 25
- **URL:** https://me.pullstream.com/crm-v3/sales-people
- **Description:** Page returns "Entity type not found. The entity type 'undefined' does not exist."

#### 4.2 Fix: Details view - wrong entity link (18053f60)
- **Owner:** Umer
- **Duration:** 3 hours
- **Deadline:** Jan 25
- **URL:** https://me.pullstream.com/crm-v3/clients/dd6773e5-b619-49ea-accf-083fb4478724
- **Description:** Company Contact column opens Client details instead of Contact details

#### 4.3 Fix: Process Records button missing (f25f3950)
- **Owner:** Umer
- **Duration:** 4 hours
- **Deadline:** Jan 26
- **URL:** https://me.pullstream.com/crm-v3/marketing-lists/6c6bfe61-d86b-43a1-ba4d-56636d247055
- **Description:** Person In Marketing List tab missing "Process Records" button available in V2

#### 4.4 Fix: Bulk actions missing (28052669)
- **Owner:** Umer
- **Duration:** 7 hours
- **Deadline:** Jan 27
- **URL:** https://me.pullstream.com/crm-v3/companies
- **Description:** "Add to Territory" and "Create Opportunity" bulk actions missing. Person page missing "Add Relationship" and "Add to Marketing List"
- **Files to port:**
  - `/ps-admin-microfe/packages/entity-core/src/crm-v2/forms/BulkAddToTerritory/`
  - `/ps-admin-microfe/packages/entity-core/src/crm-v2/forms/BulkCreateOpportunity/`
  - `/ps-admin-microfe/packages/entity-core/src/crm-v2/forms/BulkAddPersonRelationship/`
  - `/ps-admin-microfe/packages/entity-core/src/crm-v2/forms/BulkAddPersonToMarketingList/`

#### 4.5 Fix: Filters missing (f6c827d5)
- **Owner:** Umer
- **Duration:** 4 hours
- **Deadline:** Jan 27
- **URL:** https://me.pullstream.com/crm-v3/companies
- **Description:** Filters button missing on Company page

#### 4.6 Fix: Missing tabs - Company Notes, Email History (161079a0)
- **Owner:** Umer
- **Duration:** 7 hours
- **Deadline:** Jan 28
- **URL:** https://me.pullstream.com/crm-v3/companies/b407ec62-135c-4317-b8eb-f7594c523bb4
- **Description:** Company, Opportunity, and Person detail views missing tabs present in V2

---

### 5. Hamza Dependency Planning Meeting
**Owner:** Umer + Umer | **Deadline:** Jan 28 | **Status:** To do

#### 5.1 Meet with Hamza to discuss CRM dependencies
- **Owner:** Umer
- **Duration:** 1 hour
- **Deadline:** Jan 28
- **Description:** Document all CRM dependencies in other apps beyond compute-generated and Automata. Create task list for Sprint 3+.

---

## SPRINT 2: Jan 29 - Feb 07, 2026

### 6. CRM V3 Final Bug Fix
**Owner:** Umer | **Deadline:** Jan 29 | **Status:** To do

#### 6.1 Fix: INA record not appearing after save (50f4f88d)
- **Owner:** Umer
- **Duration:** 4 hours
- **Deadline:** Jan 29
- **URL:** https://me.pullstream.com/kanbans/opportunity/2499db79-ac2b-4638-aea7-a9323bf5c09c
- **Description:** INA tab doesn't refresh after save; requires manual page refresh

---

### 7. Search Vector Investigation
**Owner:** Umer | **Deadline:** Jan 29 | **Status:** To do

#### 7.1 Investigate search_vector integration
- **Owner:** Umer
- **Duration:** 3 hours
- **Deadline:** Jan 29
- **Description:** Document how search_vector fields should be integrated in crm-v3. Identify affected models and implementation approach.

---

### 8. Additional Backend Interceptors
**Owner:** Umer | **Deadline:** Jan 30 | **Status:** To do

#### 8.1 Port client.controller.js
- **Owner:** Umer
- **Duration:** 3 hours
- **Deadline:** Jan 29

#### 8.2 Port marketingList.controller.js
- **Owner:** Umer
- **Duration:** 3 hours
- **Deadline:** Jan 29

#### 8.3 Port companyContact.controller.js
- **Owner:** Umer
- **Duration:** 2 hours
- **Deadline:** Jan 30

#### 8.4 Port companyInTerritory.controller.js
- **Owner:** Umer
- **Duration:** 2 hours
- **Deadline:** Jan 30

#### 8.5 Port personInMarketingList.controller.js
- **Owner:** Umer
- **Duration:** 2 hours
- **Deadline:** Jan 30

#### 8.6 Port personRelationship.controller.js
- **Owner:** Umer
- **Duration:** 2 hours
- **Deadline:** Jan 30

---

### 9. Route Parity Verification
**Owner:** Umer | **Deadline:** Jan 30 | **Status:** To do

#### 9.1 Verify V2/V3 route parity
- **Owner:** Umer
- **Duration:** 4 hours
- **Deadline:** Jan 30
- **Description:** Compare all routes between crm-v2-rapi and crm-v3-rapi. Document differences and fix mismatches.

---

### 10. Kanban Updates
**Owner:** Umer + Umer | **Deadline:** Jan 31 | **Status:** To do

#### 10.1 Update INA kanban with CRM V3
- **Owner:** Umer
- **Duration:** 4 hours
- **Deadline:** Jan 31
- **Description:** Update INA kanban to use CRM V3 endpoints

#### 10.2 Update Opportunity kanban with CRM V3
- **Owner:** Umer
- **Duration:** 4 hours
- **Deadline:** Jan 31
- **Description:** Update Opportunity kanban to use CRM V3 endpoints

---

### 11. Automata CRM Dependencies
**Owner:** Umer | **Deadline:** Feb 01 | **Status:** To do

#### 11.1 Investigate Automata CRM dependencies
- **Owner:** Umer
- **Duration:** 4 hours
- **Deadline:** Feb 01
- **Description:** Document all CRM dependencies in Automata. Create task list for resolution.

---

### 12. Compute Apps Update (12 Apps)
**Owner:** Umer + Umer | **Deadline:** Feb 02 | **Status:** To do

#### 12.1 Update Lists app
- **Owner:** Umer
- **Duration:** 1 hour
- **Deadline:** Feb 01
- **Priority:** High

#### 12.2 Update Finanshalls app
- **Owner:** Umer
- **Duration:** 1 hour
- **Deadline:** Feb 01
- **Priority:** High

#### 12.3 Update Recruiter app
- **Owner:** Umer
- **Duration:** 1 hour
- **Deadline:** Feb 01
- **Priority:** Medium

#### 12.4 Update Inventory app
- **Owner:** Umer
- **Duration:** 1 hour
- **Deadline:** Feb 01
- **Priority:** Medium

#### 12.5 Update Payment app
- **Owner:** Umer
- **Duration:** 1 hour
- **Deadline:** Feb 02
- **Priority:** Medium

#### 12.6 Update Support app
- **Owner:** Umer
- **Duration:** 1 hour
- **Deadline:** Feb 02
- **Priority:** High

#### 12.7 Update Marketing app
- **Owner:** Umer
- **Duration:** 1 hour
- **Deadline:** Feb 02
- **Priority:** High

#### 12.8 Update Ecommerce app
- **Owner:** Umer
- **Duration:** 1 hour
- **Deadline:** Feb 02
- **Priority:** Medium

#### 12.9 Update Events app
- **Owner:** Umer
- **Duration:** 1 hour
- **Deadline:** Feb 02
- **Priority:** Low

#### 12.10 Update Asset & Wealth Management app
- **Owner:** Umer
- **Duration:** 1 hour
- **Deadline:** Feb 02
- **Priority:** Low

#### 12.11 Update System app
- **Owner:** Umer
- **Duration:** 1 hour
- **Deadline:** Feb 02
- **Priority:** High

#### 12.12 Update 1000 SME Strategy app
- **Owner:** Umer
- **Duration:** 1 hour
- **Deadline:** Feb 02
- **Priority:** Medium

---

### 13. V2 Cleanup from Microfe
**Owner:** Umer + Umer | **Deadline:** Feb 04 | **Status:** To do

#### 13.1 Remove V2 code from microfe
- **Owner:** Umer
- **Duration:** 7 hours
- **Deadline:** Feb 04
- **Description:** Clean up CRM V2 code from ps-admin-microfe. Remove unused imports, routes, and components.
- **Predecessor:** 12 (all compute apps updated)

---

### 14. Data Migration Preparation
**Owner:** Umer | **Deadline:** Feb 04 | **Status:** To do

#### 14.1 Create data copy scripts (V2 to V3)
- **Owner:** Umer
- **Duration:** 4 hours
- **Deadline:** Feb 04
- **Description:** Prepare scripts for V2 to V3 data migration. Execution deferred to Sprint 3+.
- **Notes:** Full data copy and V2 switchoff requires production freeze - deferred

---

### 15. Buffer and Final Testing
**Owner:** All | **Deadline:** Feb 05 | **Status:** To do

#### 15.1 Critical bug fixes (buffer)
- **Owner:** Umer + Umer
- **Duration:** 7 hours each
- **Deadline:** Feb 05
- **Description:** Address any critical bugs discovered during testing

#### 15.2 Full regression testing
- **Owner:** Abdullah + Touseef
- **Duration:** 8 hours each
- **Deadline:** Feb 05
- **Description:** Complete regression test of CRM V3 and all updated compute apps

---

### 16. Deployment
**Owner:** All | **Deadline:** Feb 07 | **Status:** To do

#### 16.1 Final acceptance testing
- **Owner:** Abdullah + Touseef
- **Duration:** 8 hours
- **Deadline:** Feb 06

#### 16.2 Deployment preparation
- **Owner:** Umer + Umer
- **Duration:** 4 hours
- **Deadline:** Feb 06

#### 16.3 Production deployment
- **Owner:** Umer + Umer
- **Duration:** 4 hours
- **Deadline:** Feb 07

#### 16.4 Post-deployment verification
- **Owner:** Abdullah + Touseef
- **Duration:** 4 hours
- **Deadline:** Feb 07

---

## Summary by Owner

### Umer Tasks (You)
| Sprint | Task Count | Total Hours |
|--------|------------|-------------|
| 1 | 7 | ~28 hours |
| 2 | 10 | ~35 hours |

### Umer Tasks
| Sprint | Task Count | Total Hours |
|--------|------------|-------------|
| 1 | 6 | ~38 hours |
| 2 | 13 | ~30 hours |

### Abdullah Tasks
| Sprint | Task Count | Total Hours |
|--------|------------|-------------|
| 1 | 15 | ~12 hours |
| 2 | 3 | ~20 hours |

### Touseef Tasks
| Sprint | Task Count | Total Hours |
|--------|------------|-------------|
| 1 | 1 | 4 hours |
| 2 | 3 | ~12 hours |

---

## SPRINT 3+: Feb 08 onwards (Deferred Tasks)

> **Note:** These tasks are deferred because they depend on Sprint 1-2 outcomes, require production freeze, or need investigation results. Sprint dates TBD based on Sprint 2 completion.

---

### 17. Data Migration and V2 Switchoff
**Owner:** Umer + Umer | **Deadline:** TBD | **Status:** Deferred
**Dependency:** All CRM V3 bugs fixed, full regression passed
**Reason Deferred:** Requires production freeze, rollback plan, and stakeholder sign-off

#### 17.1 Create data migration scripts
- **Owner:** Umer
- **Duration:** 8 hours
- **Description:** Scripts to copy all CRM V2 data to V3 tables. Handle foreign key relationships, preserve audit trails.
- **Predecessor:** 14.1 (data copy prep from Sprint 2)

#### 17.2 Create rollback scripts
- **Owner:** Umer
- **Duration:** 4 hours
- **Description:** Scripts to restore V2 data if migration fails. Include validation checks.

#### 17.3 Schedule production freeze window
- **Owner:** Umer
- **Duration:** 2 hours
- **Description:** Coordinate with stakeholders for maintenance window. Communicate to users.

#### 17.4 Execute data migration (dry run)
- **Owner:** Umer + Umer
- **Duration:** 4 hours
- **Description:** Run migration on staging environment. Validate data integrity.
- **Predecessor:** 17.1, 17.2

#### 17.5 Execute data migration (production)
- **Owner:** Umer + Umer
- **Duration:** 4 hours
- **Description:** Run migration on production. Monitor for errors.
- **Predecessor:** 17.4

#### 17.6 Validate migrated data
- **Owner:** Abdullah
- **Duration:** 8 hours
- **Description:** Verify all records migrated correctly. Check counts, relationships, display values.
- **Predecessor:** 17.5

#### 17.7 Switch off CRM V2
- **Owner:** Umer
- **Duration:** 2 hours
- **Description:** Disable V2 endpoints, update routing, remove V2 from deployment.
- **Predecessor:** 17.6

#### 17.8 Post-switchoff monitoring
- **Owner:** Umer + Umer
- **Duration:** 8 hours
- **Description:** Monitor for errors, user complaints, data issues for 24-48 hours.
- **Predecessor:** 17.7

---

### 18. Remaining Backend Controller Migration (51 Controllers)
**Owner:** Umer (Lead) | **Deadline:** TBD | **Status:** Deferred
**Dependency:** Critical controllers (company, person, opportunity, import/export) completed in Sprint 1
**Reason Deferred:** Lower priority than critical controllers; can be done incrementally

#### 18.1 Port Medium-High Complexity Controllers (7 controllers)
**Duration:** 28 hours total (4h each)

##### 18.1.1 Port createBulkOpportunities.controller.js
- **Owner:** Umer
- **Duration:** 4 hours
- **Description:** Preview, apply, revert bulk operations. Selection normalization, duplicate detection.
- **Files:**
  - Source: `/crm-v2-rapi/src/controllers/createBulkOpportunities.controller.js`
  - Target: `/crm-v3-rapi/src/domain/routes/v1/bulkOpportunities.route.js`

##### 18.1.2 Port createBulkPersonInCallSchedules.controller.js
- **Owner:** Umer
- **Duration:** 4 hours

##### 18.1.3 Port createBulkPersonInMarketingLists.controller.js
- **Owner:** Umer
- **Duration:** 4 hours

##### 18.1.4 Port createBulkPersonRelationships.controller.js
- **Owner:** Umer
- **Duration:** 4 hours

##### 18.1.5 Port createBulkCompanyInTerritories.controller.js
- **Owner:** Umer
- **Duration:** 4 hours

##### 18.1.6 Port getOrCreatePerson.controller.js
- **Owner:** Umer
- **Duration:** 4 hours
- **Description:** WhatsApp integration endpoint. Get-or-create by phone, upsert hasWhatsapp.

##### 18.1.7 Port resetRottingDaysOpportunities.controller.js
- **Owner:** Umer
- **Duration:** 4 hours
- **Description:** Batch operations on opportunities in a stage.

#### 18.2 Port Medium Complexity Controllers (6 remaining)
**Duration:** 12 hours total (2h each)

##### 18.2.1 Port accountManagerInCompany.controller.js
- **Owner:** Umer
- **Duration:** 2 hours
- **Description:** FK verification, active assignment uniqueness, workflow trigger.

##### 18.2.2 Port callSchedule.controller.js
- **Owner:** Umer
- **Duration:** 2 hours

##### 18.2.3 Port territoryOwner.controller.js
- **Owner:** Umer
- **Duration:** 2 hours

##### 18.2.4 Port prospect.controller.js
- **Owner:** Umer
- **Duration:** 2 hours

##### 18.2.5 Port companyContact.controller.js (if not done in Sprint 2)
- **Owner:** Umer
- **Duration:** 2 hours

##### 18.2.6 Port personRelationship.controller.js (if not done in Sprint 2)
- **Owner:** Umer
- **Duration:** 2 hours

#### 18.3 Port Simple Controllers - Metadata/Config (15 controllers)
**Duration:** 15 hours total (1h each)

| Controller | Owner | Duration |
|------------|-------|----------|
| pipeline.controller.js | Umer | 1h |
| pipelineStage.controller.js | Umer | 1h |
| opportunityCategory.controller.js | Umer | 1h |
| opportunityProduct.controller.js | Umer | 1h |
| prospectPipeline.controller.js | Umer | 1h |
| prospectPipelineStage.controller.js | Umer | 1h |
| prospectProduct.controller.js | Umer | 1h |
| prospectCategory.controller.js | Umer | 1h |
| channel.controller.js | Umer | 1h |
| relationship.controller.js | Umer | 1h |
| territory.controller.js | Umer | 1h |
| socialMediaType.controller.js | Umer | 1h |
| customerEnquiryStatus.controller.js | Umer | 1h |
| customerEnquiryPurpose.controller.js | Umer | 1h |
| salesPersonTarget.controller.js | Umer | 1h |

#### 18.4 Port Simple Controllers - History/Audit (9 controllers)
**Duration:** 9 hours total (1h each)

| Controller | Owner | Duration |
|------------|-------|----------|
| callHistory.controller.js | Umer | 1h |
| clientHistory.controller.js | Umer | 1h |
| companyHistory.controller.js | Umer | 1h |
| opportunityHistory.controller.js | Umer | 1h |
| personHistory.controller.js | Umer | 1h |
| personRelationshipHistory.controller.js | Umer | 1h |
| targetActualHistory.controller.js | Umer | 1h |
| opportunityInfluencer.controller.js | Umer | 1h |
| client.controller.js | Umer | 1h |

#### 18.5 Port Simple Controllers - Junction/Relation (10 controllers)
**Duration:** 10 hours total (1h each)

| Controller | Owner | Duration |
|------------|-------|----------|
| actionPlan.controller.js | Umer | 1h |
| companySocialMedia.controller.js | Umer | 1h |
| personSocialMedia.controller.js | Umer | 1h |
| personInMarketingList.controller.js | Umer | 1h |
| companyInTerritory.controller.js | Umer | 1h |
| marketingList.controller.js | Umer | 1h |
| callList.controller.js | Umer | 1h |
| callListPipeline.controller.js | Umer | 1h |
| callListPipelineStage.controller.js | Umer | 1h |
| dataNeeded.controller.js | Umer | 1h |

#### 18.6 Port Utility Controllers (4 controllers)
**Duration:** 4 hours total (1h each)

| Controller | Owner | Duration |
|------------|-------|----------|
| customerEnquiry.controller.js | Umer | 1h |
| onlineSignup.controller.js | Umer | 1h |
| undelete.controller.js | Umer | 1h |
| health.controller.js | Umer | 1h |

---

### 19. Automata CRM Integration
**Owner:** Umer (Lead) | **Deadline:** TBD | **Status:** Deferred
**Dependency:** Investigation from Sprint 2 (task 11.1)
**Reason Deferred:** Unknown scope until investigation complete

#### 19.1 Document Automata CRM dependencies
- **Owner:** Umer
- **Duration:** 4 hours
- **Description:** Based on investigation in Sprint 2, create comprehensive list of all CRM touchpoints in Automata.
- **Predecessor:** 11.1 (Investigate Automata CRM dependencies)

#### 19.2 Update Automata workflows referencing CRM V2
- **Owner:** Umer
- **Duration:** TBD (based on 19.1 findings)
- **Description:** Update workflow definitions to use CRM V3 endpoints.

#### 19.3 Update Automata triggers for CRM entities
- **Owner:** Umer
- **Duration:** TBD (based on 19.1 findings)
- **Description:** Update any triggers that fire on CRM entity changes.

#### 19.4 Test Automata workflows with CRM V3
- **Owner:** Abdullah
- **Duration:** TBD (based on scope)
- **Description:** End-to-end testing of all CRM-related workflows.

#### 19.5 Deploy Automata changes
- **Owner:** Umer
- **Duration:** 2 hours
- **Description:** Deploy updated Automata configuration.
- **Predecessor:** 19.4

---

### 20. Search Vector Implementation
**Owner:** Umer | **Deadline:** TBD | **Status:** Deferred
**Dependency:** Investigation from Sprint 2 (task 7.1)
**Reason Deferred:** Investigation only in Sprint 2

#### 20.1 Design search_vector integration approach
- **Owner:** Umer
- **Duration:** 4 hours
- **Description:** Based on investigation, design how search vectors should be generated and used in V3.
- **Predecessor:** 7.1 (search_vector investigation)

#### 20.2 Implement search_vector generation
- **Owner:** Umer
- **Duration:** 8 hours
- **Description:** Add search vector generation to relevant interceptors (beforeCreate, beforeUpdate).
- **Models affected:** Company, Person, Opportunity, Prospect

#### 20.3 Implement vector search endpoints
- **Owner:** Umer
- **Duration:** 8 hours
- **Description:** Add beforeVectorSearch/afterVectorSearch hooks per EXTENSION_GUIDE.md.

#### 20.4 Test vector search functionality
- **Owner:** Abdullah
- **Duration:** 4 hours
- **Description:** Test search accuracy, performance, relevance ranking.

#### 20.5 Migrate existing search vectors from V2
- **Owner:** Umer
- **Duration:** 4 hours
- **Description:** Script to regenerate search vectors for existing records.

---

### 21. Hamza Dependency Tasks (TBD)
**Owner:** TBD | **Deadline:** TBD | **Status:** Deferred
**Dependency:** Hamza meeting in Sprint 1 (task 5.1)
**Reason Deferred:** Tasks to be defined after Hamza meeting

> **Note:** This section will be populated after the Hamza meeting on Jan 28. The meeting will identify CRM dependencies in apps beyond compute-generated and Automata.

#### 21.1 Document non-compute, non-Automata CRM dependencies
- **Owner:** Umer
- **Duration:** 2 hours
- **Description:** Create task list from Hamza meeting output.
- **Predecessor:** 5.1 (Hamza meeting)

#### 21.2-21.N Additional tasks TBD
- **Description:** Tasks to be added based on Hamza meeting findings.

---

### 22. Frontend Business Logic Port (Beyond Bugs)
**Owner:** Umer + Umer | **Deadline:** TBD | **Status:** Deferred
**Dependency:** Bug fixes in Sprint 1-2 cover immediate needs
**Reason Deferred:** Full parity not required for Feb 07 deadline

#### 22.1 Port remaining form components
- **Owner:** Umer
- **Duration:** 40 hours
- **Description:** Port remaining 90+ form components from V2 to V3 entity-core.
- **Source:** `/ps-admin-microfe/apps/crm-v2/src/pages/`
- **Target:** `/ps-admin-microfe/packages/entity-core/src/crm-v2/`

#### 22.2 Port data mappers
- **Owner:** Umer
- **Duration:** 16 hours
- **Description:** Port 48+ data mapper functions.
- **Source:** `/ps-admin-microfe/packages/entity-core/src/crm-v2/configs/dataMappers/`

#### 22.3 Port table column configurations
- **Owner:** Umer
- **Duration:** 16 hours
- **Description:** Port 48+ table column configs with inline editing support.
- **Source:** `/ps-admin-microfe/packages/entity-core/src/crm-v2/configs/tableColumns/`

#### 22.4 Port validation schemas
- **Owner:** Umer
- **Duration:** 8 hours
- **Description:** Port 40+ Yup validation schemas.
- **Source:** `/ps-admin-microfe/packages/entity-core/src/crm-v2/configs/validationSchemas/`

#### 22.5 Port cascading dropdown logic
- **Owner:** Umer
- **Duration:** 8 hours
- **Description:** Port Country → State → City hierarchy and dependent field clearing.

#### 22.6 Port pinned filters with localStorage
- **Owner:** Umer
- **Duration:** 4 hours
- **Description:** Port filter persistence using localStorage (Person page pattern).

---

### 23. Additional Testing and Regression
**Owner:** Abdullah + Touseef | **Deadline:** TBD | **Status:** Deferred

#### 23.1 Full CRM V3 regression test
- **Owner:** Abdullah
- **Duration:** 16 hours
- **Description:** Complete regression of all CRM V3 functionality after full migration.

#### 23.2 Cross-app integration testing
- **Owner:** Abdullah + Touseef
- **Duration:** 16 hours
- **Description:** Test CRM V3 integration with all 12 compute apps, Automata, kanbans.

#### 23.3 Performance testing
- **Owner:** Abdullah
- **Duration:** 8 hours
- **Description:** Load testing for list views, bulk operations, import/export.

#### 23.4 User acceptance testing
- **Owner:** TBD (End users)
- **Duration:** TBD
- **Description:** Final sign-off from business users.

---

## Sprint 3+ Summary

| Task Group | Subtasks | Total Hours | Owner |
|------------|----------|-------------|-------|
| 17. Data Migration & Switchoff | 8 | ~40h | Umer + Umer + Abdullah |
| 18. Backend Controllers (51) | 51 | ~78h | Umer + Umer |
| 19. Automata Integration | 5+ | TBD | Umer + Abdullah |
| 20. Search Vector | 5 | ~28h | Umer + Abdullah |
| 21. Hamza Dependencies | TBD | TBD | TBD |
| 22. Frontend Port | 6 | ~92h | Umer + Umer |
| 23. Testing | 4 | ~40h+ | Abdullah + Touseef |

**Estimated Sprint 3+ Total:** ~280+ dev-hours (4-5 sprints at current capacity)
