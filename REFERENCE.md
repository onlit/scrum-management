# PM API Reference & Task Standards

## API Endpoints

| Method | Endpoint         | Purpose                 |
| ------ | ---------------- | ----------------------- |
| POST   | `/tasks/`        | Create a task           |
| PATCH  | `/tasks/{id}/`   | Update a task (sparse)  |
| POST   | `/sprint-tasks/` | Link a task to a sprint |

Base URL: `https://pm.pullstream.com/api`

## Authentication

Token stored in `.env` at project root:

```
ACCESS_TOKEN=Bearer <jwt>
```

The token includes the `Bearer ` prefix. Never wrap it again.

## Task Model (Key Fields)

| Field             | Type     | Constraint         | Notes                                         |
| ----------------- | -------- | ------------------ | --------------------------------------------- |
| id                | UUID     | PK, auto           |                                               |
| name              | text     | required           |                                               |
| description       | text     | optional           |                                               |
| parent_task       | UUID FK  | optional           | Links subtask to parent                       |
| project           | UUID FK  | required           | Always `f599f9fd-cac2-4c5e-b39f-20fde85e1b1f` |
| owner             | UUID FK  | optional           | Resource UUID                                 |
| status            | UUID FK  | optional           | TaskStatus UUID                               |
| order             | integer  | default 0          | Sprint-relative ordering                      |
| duration_estimate | SmallInt | 0–32767            | **Integer only** — API rejects decimals       |
| duration_actual   | SmallInt | 0–32767            | **Integer only**                              |
| duration_unit     | char(7)  | Minutes/Hours/Days | Always use `"Minutes"`                        |
| deadline          | datetime | optional           |                                               |

## Constants

### Project

```
f599f9fd-cac2-4c5e-b39f-20fde85e1b1f
```

### Resources

| Name     | UUID                                   |
| -------- | -------------------------------------- |
| Umer     | `4ba84c35-05ba-4e62-98cd-0b14824a52a6` |
| Touseef  | `37bed1cd-b999-4501-9fb7-7697df0d4747` |
| Abdullah | `320b0e24-c4e2-400a-bed0-e48f42587aff` |
| Hamza    | `7c5eafb5-a524-4b1f-b99e-d206db462ea3` |

### Task Statuses

| Key            | UUID                                   |
| -------------- | -------------------------------------- |
| TODO           | `f323b003-f15e-4d5f-8125-98183735faea` |
| IN_PROGRESS    | `a3a16b09-a669-4592-ac20-9b5969912cab` |
| BLOCKED        | `c70d0ca5-9997-41fb-a8df-1e3f7feca4b2` |
| TESTING        | `44fc34a3-6ffc-4eba-af98-7ab58018db1b` |
| FAILED_TESTING | `46276100-a07d-4e28-89a6-5fa172111c73` |
| DONE           | `4cc2307c-b3da-4590-adeb-b1458f96e333` |
| DEPLOYED       | `ecf4cac6-7dd0-4fe6-9cc0-9aba5eb09295` |
| DEFERRED       | `c10cbc21-ce67-4cf0-a7e6-5e8fb06681e9` |

### Sprints

| Key      | UUID                                   |
| -------- | -------------------------------------- |
| SPRINT_1 | `a6860db6-d458-4eed-99b6-c2ae558457ba` |
| SPRINT_2 | `a1ac537b-1c73-4d3c-b639-e00909110a37` |
| SPRINT_3 | `aab5ccfe-a89c-48e8-a923-46c6893f275e` |
| SPRINT_4 | `373612a4-55f3-479f-b400-d468602e0df0` |

## Status Flow

```
To do → In Progress → Testing → Done → Deployed
             ↓            ↓
          Blocked    Failed Testing
             ↓            ↓
          Deferred   In Progress (rework)
```

## Task Structure Rules

1. **Parent tasks** are containers — never set `duration_estimate` or `duration_actual` on them.
2. **Child tasks** (subtasks) carry all duration fields.
3. Parent totals are derived by summing children.
4. `duration_unit` is always `"Minutes"`.
5. `duration_estimate` must be an integer (use `Math.ceil()` if converting from hours).

## Naming Conventions

**Parent:** `{Category}: {Scope}` — e.g., `VoIP Microservice: Review, Clean & Launch`

**Child:** `{Action verb} {target}` — e.g., `Review generated models, fields and relationships`

| Verb        | Use For                          |
| ----------- | -------------------------------- |
| Fix         | Bug fixes                        |
| Port        | Moving code between systems      |
| Implement   | New functionality                |
| Update      | Modifying existing functionality |
| Write       | Creating new code/tests          |
| Verify      | Validation/QA tasks              |
| Investigate | Research/discovery               |

## Estimation Calibration

Apply a **0.45 correction factor** to gut estimates:

| Gut says | Estimate (minutes) |
| -------- | ------------------ |
| 2 hours  | 60 min             |
| 4 hours  | 120 min            |
| 7 hours  | 180 min            |
| 14 hours | 360 min            |
| 30 hours | 840 min            |

Historical: Sprint 1 had a 2.2x overestimate (189h estimated vs 85h actual).
