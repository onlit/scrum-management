# Prompt Templates

Paste these into Claude Code. Replace `{placeholders}` with your specifics.

Reference files: `REFERENCE.md` (constants, UUIDs, rules), `src/lib/constants.js` (sprint/owner keys).

---

## 1. Create New Tasks

```
Read the task descriptions from {SOURCE} (e.g., ./sprint5-scope.md, a pasted list, etc.).

Transform them into the JSON format expected by src/post-tasks.js:
[
  {
    "name": "Parent Task Name",
    "order": 95,
    "subtasks": [
      { "name": "Subtask name", "order": 1, "description": "...", "duration_estimate": 120 }
    ]
  }
]

Follow the rules in REFERENCE.md:
- Parents are containers: NO duration fields
- Subtask duration_estimate in Minutes (integer), apply 0.45 correction factor
- Subtask names start with action verb (Implement, Fix, Review, etc.)
- To override owner on a subtask, add "owner": "Name"

Write the JSON to {OUTPUT}.json, then run:
npm run post-tasks -- --file {OUTPUT}.json --sprint {SPRINT_KEY} --owner {OWNER}
```

**Example usage:**

```
Read the task descriptions from ./marketing-v4-scope.md.
Transform them into post-tasks JSON format, write to marketing-v4-tasks.json,
then run: npm run post-tasks -- --file marketing-v4-tasks.json --sprint SPRINT_4 --owner Umer
```

---

## 2. Update Existing Tasks

```
Read the existing PM tasks from {SOURCE} (e.g., tasks-imported.json).

Find tasks with parent order {FROM} to {TO} and generate an update JSON that:
- {WHAT TO CHANGE: e.g., "sets status to DONE", "sets duration_actual to 90 on each", "reassigns owner to Hamza"}

Write the JSON to {OUTPUT}.json in the format expected by src/update-tasks.js:
[
  { "id": "task-uuid", "status": "DONE" }
]

Only include fields that need to change. Then run:
npm run update-tasks -- --file {OUTPUT}.json
```

**Example usages:**

```
Read tasks from tasks-imported.json.
Find all subtasks under parent orders 95 to 99 and set their status to DONE.
Write to batch-done.json, then run: npm run update-tasks -- --file batch-done.json
```

```
Read tasks from tasks-imported.json.
For tasks 100.1 through 100.5, set duration_actual to match their duration_estimate
and reassign owner to Hamza.
Write to update-100.json, then run: npm run update-tasks -- --file update-100.json
```

---

## 3. Distribute Actual Time

```
I spent {TOTAL} minutes on tasks with parent order {FROM} to {TO}.
Distribute that time evenly across all leaf subtasks in that range.
Run: npm run update-actuals -- --minutes {TOTAL} --from {FROM} --to {TO}
```

**Example usage:**

```
I spent 660 minutes on tasks 100 to 103.
Run: npm run update-actuals -- --minutes 660 --from 100 --to 103
```
