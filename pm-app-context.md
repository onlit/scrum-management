## Available Task Statuses

1. To do
2. In Progress
3. Blocked
4. Testing
5. Failed Testing
6. Done
7. Deployed
8. Deferred

### Status Descriptions

| # | Status | Description |
|---|--------|-------------|
| 1 | To do | Task not yet started |
| 2 | In Progress | Developer actively working on task |
| 3 | Blocked | Waiting on dependency, external input, or investigation |
| 4 | Testing | QA (Abdullah/Touseef) verifying the work |
| 5 | Failed Testing | Did not pass QA, needs rework |
| 6 | Done | Passed testing, merged to main branch |
| 7 | Deployed | Released to production |
| 8 | Deferred | Pushed to future sprint |

### Status Flow

```
To do → In Progress → Testing → Done → Deployed
             ↓            ↓
          Blocked    Failed Testing
             ↓            ↓
          Deferred   In Progress (rework)
```

## Sprints
Duration: 7 days
No of Sprints: 9
First Sprint: 22/01/26 | 7 days 

## Task Model Definition
class Task(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    parent_task = models.ForeignKey(
        "self", on_delete=models.RESTRICT, blank=True, null=True
    )
    dependency = models.ForeignKey(
        "self", on_delete=models.RESTRICT, blank=True, null=True, related_name="task_dependency"
    )
    predecessor = models.ForeignKey(
        "self", on_delete=models.RESTRICT, blank=True, null=True, related_name="task_predecessor"
    )
    project = models.ForeignKey(
        Project, on_delete=models.RESTRICT, blank=True, null=True)
    hlr = models.ForeignKey(
        HLR, on_delete=models.RESTRICT, blank=True, null=True)
    name = models.TextField()
    description = models.TextField(blank=True, null=True)
    task_type = models.ForeignKey(
        TaskType, on_delete=models.RESTRICT, blank=True, null=True
    )
    owner = models.ForeignKey(
        Resource, on_delete=models.RESTRICT, blank=True, null=True)
    status = models.ForeignKey(
        TaskStatus,
        on_delete=models.SET(get_unassigned_status),
        related_name="task_statuses",
        blank=True,
        null=True,
    )
    status_assigned_date = models.DateTimeField(blank=True, null=True)
    started = models.DateTimeField(blank=True, null=True)
    duration_estimate = models.SmallIntegerField(blank=True, null=True)
    duration_unit = models.CharField(
        max_length=7, blank=True, null=True, choices=duration_unit_choices)
    duration_actual = models.SmallIntegerField(blank=True, null=True)
    milestone = models.BooleanField(default=False)
    order = models.IntegerField(default=0)
    rotting_days = models.PositiveSmallIntegerField(default=0)
    deadline = models.DateTimeField(blank=True, null=True)
    rrule = RecurrenceField(blank=True, null=True, include_dtstart=False)
    completion_percent = models.SmallIntegerField(default=0)
    notes = models.TextField(null=True, blank=True)
    reminder_event = models.UUIDField(blank=True, null=True)
    reminder_event_do_what = models.UUIDField(blank=True, null=True)