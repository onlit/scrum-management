# Task Creation Standards and Best Practices

## Overview

This document establishes standards for creating and estimating tasks in the PM system, based on empirical data from completed sprints.

---

## Estimation Calibration

### Historical Data (Sprint 1)

| Metric | Value |
|--------|-------|
| Estimated | 189 hours |
| Actual | 85 hours |
| Overestimate Factor | 2.2x |

### Estimation Guidelines

Apply a **0.45 correction factor** to initial estimates, or use this reference:

| If your gut says... | Estimate instead... |
|---------------------|---------------------|
| 1 hour | 30 minutes |
| 2 hours | 1 hour |
| 4 hours | 2 hours |
| 7 hours | 3 hours |
| 14 hours | 6 hours |
| 30 hours | 14 hours |

### Why We Overestimate

- Padding for unknowns that don't materialize
- Assuming worst-case complexity
- Not accounting for familiarity with codebase
- Including context-switching time that doesn't occur in focused work

---

## Task Structure

### Hierarchy Rules

1. **Parent tasks** are containers only - never add `duration_estimate` or `duration_actual` to them
2. **Child tasks** (subtasks) carry all duration fields
3. Parent task totals are derived by summing children

### Example Structure

```
Parent: "Backend Migration: Critical Controllers"
  ├── duration_estimate: null  ✓
  ├── duration_actual: null    ✓
  │
  └── Children:
      ├── "Port company.controller.js" → duration_estimate: 3, duration_actual: 2
      ├── "Port person.controller.js"  → duration_estimate: 3, duration_actual: 2
      └── "Port opportunity.controller.js" → duration_estimate: 6, duration_actual: 4
```

---

## Required Fields

### Parent Tasks

| Field | Required | Notes |
|-------|----------|-------|
| name | Yes | Use format: "N. Task Group Name" |
| owner | Yes | Primary responsible resource |
| status | Yes | Reflects aggregate child status |
| project | Yes | Always set |
| deadline | Optional | Latest child deadline |
| order | Yes | Sprint-relative ordering |
| duration_estimate | **No** | Never set on parents |
| duration_actual | **No** | Never set on parents |

### Child Tasks (Subtasks)

| Field | Required | Notes |
|-------|----------|-------|
| name | Yes | Use format: "N.M Specific action" |
| owner | Yes | Can differ from parent |
| status | Yes | Individual task status |
| parent_task | Yes | Links to parent |
| project | Yes | Same as parent |
| deadline | Recommended | Specific due date |
| duration_estimate | Yes | In hours (use calibrated estimates) |
| duration_unit | Yes | "Hours" for dev work |
| duration_actual | Post-completion | Fill after task is Done |
| description | Recommended | URLs, file paths, context |
| order | Yes | Execution sequence within parent |

---

## Naming Conventions

### Parent Tasks

Format: `{order}. {Category}: {Scope}`

Examples:
- `3. Backend Migration: Critical Controllers`
- `4. CRM V3 Documented Bug Fixes`
- `7. Implement Search Vector (FTS) in compute-rapi`

### Child Tasks

Format: `{parent_order}.{child_order} {Action}: {Target} ({ticket_id})`

Examples:
- `3.1 Port company.controller.js to company.interceptor.js`
- `4.1 Fix: Sales Person page - undefined entity (0f027aa9)`
- `7.3 Write Unit Tests for ftsMigrationUtils`

### Action Verbs

| Verb | Use For |
|------|---------|
| Fix | Bug fixes with known issue |
| Port | Moving code between systems |
| Implement | New functionality |
| Update | Modifying existing functionality |
| Write | Creating new code/tests |
| Verify | Validation/QA tasks |
| Investigate | Research/discovery tasks |

---

## Duration Units

| Unit | Use When |
|------|----------|
| Hours | All development tasks (default) |
| Days | Multi-day epics (avoid - break down instead) |
| Minutes | Quick fixes under 1 hour |

### Standard Estimates (Calibrated)

| Task Type | Estimate |
|-----------|----------|
| Simple bug fix (single file) | 1-2 hours |
| Controller port (medium complexity) | 2-3 hours |
| Controller port (high complexity, 1000+ lines) | 4-6 hours |
| New feature component | 3-4 hours |
| Unit test suite | 1-2 hours |
| Config/metadata changes | 30 min - 1 hour |
| Investigation/research | 1-2 hours |

---

## Description Field Standards

Include in descriptions:

1. **URLs** - Direct links to affected pages
2. **File paths** - Source and target locations
3. **Predecessors** - "Predecessor: N.M" for dependencies
4. **Scope details** - What specifically needs to change

### Example Description

```
Port PII masking, relationship aggregation, cascading deletes (9 entities),
workflow triggers.
Source: /crm-v2-rapi/src/controllers/person.controller.js
Target: /crm-v3-rapi/src/domain/interceptors/person.interceptor.js
Predecessor: 3.1
```

---

## Status Usage

| Status | When to Use |
|--------|-------------|
| To do | Task created, not started |
| In Progress | Actively being worked on |
| Blocked | Waiting on external dependency |
| Testing | Code complete, in QA |
| Failed Testing | QA found issues |
| Done | Passed QA, merged |
| Deployed | Live in production |
| Deferred | Moved to future sprint |

---

## Sprint Planning Checklist

- [ ] All parent tasks have no duration fields
- [ ] All child tasks have calibrated duration_estimate
- [ ] Task names follow naming conventions
- [ ] Descriptions include relevant URLs and file paths
- [ ] Dependencies marked with predecessor field
- [ ] Order field set for execution sequence
- [ ] Deadlines set within sprint boundaries

---

## Post-Sprint Actions

1. Fill `duration_actual` on all completed tasks
2. Calculate sprint accuracy ratio: `actual_total / estimated_total`
3. Update calibration factor if ratio deviates >20% from 0.45
4. Document any estimation outliers and why they occurred

---

## API Field Reference

```javascript
// Child task with all recommended fields
{
  name: "3.1 Port company.controller.js to company.interceptor.js",
  owner: RESOURCES.Umer,
  status: TASK_STATUSES.TODO,
  project: PROJECT_ID,
  parent_task: parentTaskId,
  description: "Port duplicate detection, cascading deletes...",
  deadline: "2026-01-23T23:59:59Z",
  duration_estimate: 3,  // Calibrated from initial 7
  duration_unit: "Hours",
  order: 1
}

// Parent task - NO duration fields
{
  name: "3. Backend Migration: Critical Controllers",
  owner: RESOURCES.Umer,
  status: TASK_STATUSES.TODO,
  project: PROJECT_ID,
  deadline: "2026-01-25T23:59:59Z",
  order: 3
  // duration_estimate: NOT SET
  // duration_actual: NOT SET
}
```
