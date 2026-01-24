from datetime import timedelta
from django.db import models
from django.db.models import Q
from uuid import uuid4
from django.db.models.signals import post_save, pre_delete, pre_save
from django.utils import timezone
from rest_framework import serializers
from recurrence.fields import RecurrenceField
from a_pm_rapi.softdelete.models import SoftDeleteModel


def get_unassigned_status():
    task_status = TaskStatus.objects.filter(
        name="unassigned", program__isnull=True).first()
    if not task_status:
        task_status = TaskStatus.objects.create(name="unassigned")

    return task_status


############ options ####################


status_options = (
    (
        "In Progress",
        "In Progress",
    ),
    (
        "Cancelled",
        "Cancelled",
    ),
    (
        "Completed",
        "Completed",
    ),
    (
        "Schedule",
        "Schedule",
    ),
)


priority_options = (
    (
        "Low",
        "Low",
    ),
    (
        "Medium",
        "Medium",
    ),
    (
        "High",
        "High",
    ),
)


program_status_options = (
    (
        "Working",
        "Working",
    ),
    (
        "Cancelled",
        "Cancelled",
    ),
    (
        "Completed",
        "Completed",
    ),
)

priority_choices = (
    ("Work to fix", "Work to fix"),
    ("Immediate", "Immediate"),
    ("High", "High"),
    ("Medium", "Medium"),
    ("Work it in", "Work it in"),
)

type_choices = (
    ("Bug Report", "Bug Report"),
    ("Feature Request", "Feature Request"),
)

status_choices = (
    ("Unassigned", "Unassigned"),
    ("Clarify", "Clarify"),
    ("Backlog", "Backlog"),
    ("WIP", "WIP"),
    ("Failed Testing", "Failed Testing"),
    ("Awaiting Sandbox Deploy", "Awaiting Sandbox Deploy"),
    ("Ready for Sandbox Testing", "Ready for Sandbox Testing"),
    ("Awaiting Prod Deploy", "Awaiting Prod Deploy"),
    ("Ready for Prod Testing", "Ready for Prod Testing"),
    ("Fixed", "Fixed"),
    ("Archived", "Archived"),
)

label_choices = (
    ("capacity", "capacity"),
    ("needs-research", "needs-research"),
    ("prod-escape", "prod-escape"),
    ("hotfix", "hotfix"),
    ("sandbox", "sandbox"),
    ("prod", "prod"),
    ("environment-specific", "environment-specific"),
)

os_choices = (
    ("MacOS", "MacOS"),
    ("iOS", "iOS"),
    ("Windows", "Windows"),
    ("Android", "Android"),
)

browser_choices = (
    ("Edge", "Edge"),
    ("Safari", "Safari"),
    ("Chrome", "Chrome"),
    ("Firefox", "Firefox"),
    ("Brave", "Brave"),
)

acceptance_tests_status_choices = (
    ("To Test", "To Test"),
    ("Passed", "Passed"),
    ("Failed", "Failed"),
)


duration_unit_choices = (
    ("Weeks", "Weeks"),
    ("Days", "Days"),
    ("Hours", "Hours"),
    ("Minutes", "Minutes"),
)

ina_status_choices = (
    ("In Progress", "In Progress"),
    ("Completed", "Completed"),
)

# feature_request_status_choices = (
#     ("To Test", "To Test"),
#     ("Passed", "Passed"),
#     ("Failed", "Failed"),
# )


class BPABaseModel(models.Model):
    workflow = models.UUIDField(blank=True, null=True)
    workflow_session = models.UUIDField(blank=True, null=True)

    class Meta:
        abstract = True  # Set this model as Abstract


class BaseModel(SoftDeleteModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    _template = models.BooleanField(default=False)
    ## visibility ##
    everyone_can_see_it = models.BooleanField(default=False)
    anonymous_can_see_it = models.BooleanField(default=False)
    everyone_in_object_company_can_see_it = models.BooleanField(default=True)
    only_these_roles_can_see_it = models.JSONField(blank=True, null=True)
    only_these_users_can_see_it = models.JSONField(blank=True, null=True)
    updated_by = models.UUIDField(null=True, blank=True)
    created_by = models.UUIDField(null=True, blank=True)
    client = models.UUIDField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    _tags = models.TextField(blank=True, null=True)

    class Meta:
        abstract = True  # Set this model as Abstract


class Resource(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    user = models.UUIDField()
    name = models.CharField(max_length=400)
    description = models.TextField(blank=True, null=True)
    cost = models.PositiveIntegerField(blank=True, null=True)
    email = models.EmailField()
    mobile = models.CharField(max_length=20, blank=True, null=True)
    landline = models.CharField(max_length=20, blank=True, null=True)
    beta_partners = models.BooleanField(default=False)
    disabled = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        # constraints = [
        #     models.UniqueConstraint(
        #         fields=['email', 'client'], name='email_client'),
        #     models.UniqueConstraint(
        #         fields=['user', 'client'], name='user_client'),
        # ]

    def __str__(self):
        return f"{self.name}"


class Role(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    name = models.CharField(max_length=400)
    description = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name}"


class Program(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    name = models.CharField(max_length=400)
    description = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

        constraints = [
            models.UniqueConstraint(fields=['name', "created_by"], condition=Q(
                name="me"), name='one_me_program')
        ]

    def __str__(self):
        return self.name


class Project(BaseModel, BPABaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    program = models.ForeignKey(
        Program, on_delete=models.RESTRICT, blank=True, null=True)
    name = models.CharField(max_length=400)
    description = models.TextField(blank=True, null=True)
    beta_partners = models.BooleanField(default=False)
    started = models.DateTimeField(blank=True, null=True)
    # deadline = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=['name', "program", "created_by"], condition=Q(
                name="me"), name='one_me_project')
        ]

    def __str__(self):
        return self.name


class HLR(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    name = models.CharField(max_length=400)
    project = models.ForeignKey(Project, on_delete=models.RESTRICT)
    description = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name}"


class SprintMeta(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    program = models.ForeignKey(Program, on_delete=models.RESTRICT, null=True)
    name = models.CharField(max_length=400)
    started = models.DateTimeField()
    # end_date = models.DateTimeField()
    sprint_to_generate = models.PositiveSmallIntegerField(default=1)
    days = models.SmallIntegerField()
    goal = models.TextField(blank=True, null=True)
    method = models.TextField(blank=True, null=True)
    metrics = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name}"


class SprintMetaProject(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    project = models.ForeignKey(Project, on_delete=models.RESTRICT)
    sprint_meta = models.ForeignKey(SprintMeta, on_delete=models.RESTRICT)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.project.name}"


class Persona(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    program = models.ForeignKey(
        Program,
        on_delete=models.RESTRICT,
        blank=True,
        null=True,
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.RESTRICT,
        related_name="persona_project",
        blank=True,
        null=True,
    )
    name = models.CharField(max_length=400)
    description = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name}"


class Backlog(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    hlr = models.ForeignKey(HLR, on_delete=models.RESTRICT)
    name = models.CharField(blank=True, null=True, max_length=400)
    description = models.TextField(blank=True, null=True)
    as_a = models.ForeignKey(Persona, on_delete=models.RESTRICT)
    i_want = models.TextField(blank=True, null=True)
    so_that = models.TextField(blank=True, null=True)
    story_points = models.SmallIntegerField(blank=True, null=True)
    impact = models.SmallIntegerField(blank=True, null=True)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name}"


class TaskStatus(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    parent = models.ForeignKey('self', on_delete=models.RESTRICT, blank=True, null=True)
    name = models.CharField(
        max_length=400,
    )
    description = models.TextField(blank=True, null=True)
    project = models.ForeignKey(
        Project,
        on_delete=models.RESTRICT,
        blank=True,
        null=True,
        related_name="task_status_project",
    )
    program = models.ForeignKey(
        Program,
        on_delete=models.RESTRICT,
        blank=True,
        null=True,
        related_name="task_status_program",
    )
    order = models.IntegerField(default=0)
    rotting_days = models.PositiveSmallIntegerField(default=0)
    final_stage = models.BooleanField(default=False)
    colour = models.CharField(max_length=100, blank=True, null=True)

    def get_full_order(self):
        orders = []
        for task_status in self.get_ancestors():
            orders.append(str(int(task_status.order)))
        orders.reverse()
        return ".".join(orders[:-1]) if len(orders[:-1]) > 1 else str(next(iter(orders[:-1]), ''))
    
    def get_ancestors(self):
        return TaskStatus.objects.raw(f'''WITH RECURSIVE task_statuses(id, "order", "parent_id") AS (
    SELECT id, "order", "parent_id"
    FROM a_pm_rapi_taskstatus
    WHERE id = %s AND is_deleted = false AND "_template"=false
    UNION ALL
    SELECT task_status.id, task_status.order, task_status.parent_id
    FROM a_pm_rapi_taskstatus AS task_status, task_statuses AS t
    WHERE task_status.id = t.parent_id AND task_status.is_deleted = false AND task_status._template = false
    )
SELECT * FROM task_statuses;''', [self.id])
    
    def get_child_branch(self):
        return TaskStatus.objects.raw(f'''WITH RECURSIVE task_statuses AS (
    (SELECT *
    FROM a_pm_rapi_taskstatus
    WHERE id = %s AND is_deleted = false AND "_template" = false ORDER BY "order")
    UNION ALL
    SELECT ts.*
    FROM a_pm_rapi_taskstatus AS ts, task_statuses AS t
    WHERE ts.parent_id = t.id AND ts.is_deleted = false AND ts._template = false
    )
SELECT * FROM task_statuses;''', [self.id])[1:]
    
    @staticmethod
    def get_all_task_status_of_a_project(project_id, search_term=""):
        return TaskStatus.objects.raw(f'''WITH RECURSIVE task_statuses AS (
   SELECT 1 AS depth, *
        , ARRAY[("order", id)] AS path
   FROM   a_pm_rapi_taskstatus
   WHERE  "parent_id" IS NULL 
          AND "project_id"=%s
          AND "_template"=false
          AND is_deleted=false

   UNION ALL

   SELECT r.depth + 1, n.*
        , r.path || (n.order, n.id)
   FROM   task_statuses r 
   JOIN   a_pm_rapi_taskstatus n ON n.parent_id = r.id
   WHERE  n.is_deleted = false AND n._template = false
)
SELECT *
FROM   task_statuses
WHERE name ILIKE %s
ORDER  BY path;''', [project_id, f'%%{search_term}%%'])

    # class Meta:
        # unique_together = ["name", "project"]
        # ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name}"


class AcceptanceStatus(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    name = models.CharField(
        max_length=400,
    )
    description = models.TextField(blank=True, null=True)
    order = models.IntegerField(default=0)
    rotting_days = models.PositiveSmallIntegerField(default=0)

    class Meta:
        unique_together = ["name", "client"]
        # ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name}"


class BugStatus(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    name = models.CharField(
        max_length=400,
    )
    description = models.TextField(blank=True, null=True)
    order = models.IntegerField(default=0)
    rotting_days = models.PositiveSmallIntegerField(default=0)

    class Meta:
        unique_together = ["name", "client"]

    def __str__(self):
        return f"{self.name}"


class TaskType(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    name = models.CharField(max_length=400)
    description = models.TextField(null=True, blank=True)
    project = models.ForeignKey(
        Project,
        on_delete=models.RESTRICT,
        related_name="task_type_project",
        blank=True,
        null=True,
    )
    program = models.ForeignKey(
        Program,
        blank=True,
        null=True,
        on_delete=models.RESTRICT,
        related_name="task_type_program",
    )

    def __str__(self):
        return f"{self.name}"

    # class Meta:
    #     unique_together = ["name", "project",]


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

    class Meta:
        ordering = ["-created_at"]
        # constraints = [
        #     models.UniqueConstraint(fields=['order',
        #                             'name', 'project', "client", "parent_task",], name='Task And SubTask Unique'),
        # ]

    def get_task_level(self):
        orders = []
        for task in self.get_ancestors():
            orders.append(str(int(task.order)))
        orders.reverse()
        return ".".join(orders[:-1])

    @staticmethod
    def get_all_tasks_of_a_status(project_id, task_status_id, owner=None):
        owner_id = [owner] if owner else []
        return Task.objects.raw(f'''WITH RECURSIVE tasks AS (
   SELECT 1 AS depth, *
        , ARRAY[("order", id)] AS path
   FROM   a_pm_rapi_task
   WHERE  "parent_task_id" IS NULL
   		  AND "project_id"=%s
          {'AND "owner_id"=%s' if owner else ''}
          AND "_template"=false
          AND is_deleted=false

   UNION ALL

   SELECT r.depth + 1, n.*
        , r.path || (n.order, n.id)
   FROM   tasks r 
   JOIN   a_pm_rapi_task n ON n.parent_task_id = r.id
   WHERE n.project_id=%s
     {'AND n.owner_id=%s' if owner else ''}
     AND n.is_deleted = false
     AND n._template = false
)
SELECT *
FROM   tasks
WHERE  status_id=%s
ORDER  BY path;''', [f"{project_id}", *owner_id, f"{project_id}", *owner_id, f"{task_status_id}"])

    
    def get_ancestors(self):
        return Task.objects.raw(f'''WITH RECURSIVE tasks(id, "order", "parent_task_id") AS (
            SELECT id, "order", "parent_task_id"
            FROM a_pm_rapi_task
            WHERE id = %s
            UNION ALL
            SELECT tk.id, tk.order, tk.parent_task_id
            FROM a_pm_rapi_task AS tk, tasks AS t
            WHERE tk.id = t.parent_task_id
            )
        SELECT * FROM tasks;''', [self.id])
    
    def get_child_branch(self):
        return Task.objects.raw(f'''WITH RECURSIVE tasks AS (
    SELECT *
    FROM a_pm_rapi_task
    WHERE id = %s
    UNION ALL
    SELECT tk.*
    FROM a_pm_rapi_task AS tk, tasks AS t
    WHERE tk.parent_task_id = t.id AND tk.is_deleted = false
    )
SELECT * FROM tasks;''', [self.id])[1:]
    
    def get_child_branch_conflict_started_tasks(self, started, client):
        return Task.objects.raw(f'''WITH RECURSIVE tasks AS (
    SELECT *
    FROM a_pm_rapi_task
    WHERE id = %s
    UNION ALL
    SELECT tk.*
    FROM a_pm_rapi_task AS tk, tasks AS t
    WHERE tk.parent_task_id = t.id
      AND DATE_TRUNC('minute', tk.started) > %s::timestamp
      AND tk.is_deleted = false
      AND tk.client = %s
)
SELECT * FROM tasks;''', [self.id, started.replace(second=0, microsecond=0), client])[1:]
    
    def get_child_branch_conflict_deadline_tasks(self, deadline, client):
        return Task.objects.raw(f'''WITH RECURSIVE tasks AS (
    SELECT *
    FROM a_pm_rapi_task
    WHERE id = %s
    UNION ALL
    SELECT tk.*
    FROM a_pm_rapi_task AS tk, tasks AS t
    WHERE tk.parent_task_id = t.id
      AND DATE_TRUNC('minute', tk.deadline) > %s::timestamp
      AND tk.is_deleted = false
      AND tk.client = %s
)
SELECT * FROM tasks;''', [self.id, deadline.replace(second=0, microsecond=0), client])[1:]

    def __str__(self):
        return f"{self.name}"


class TaskComment(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    task = models.ForeignKey(Task, on_delete=models.RESTRICT)
    comment = models.TextField(blank=True, null=True)
    attachment = models.URLField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.comment} {self.attachment}"


class AcceptanceTest(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    backlog = models.ForeignKey(
        Backlog, on_delete=models.RESTRICT, blank=True, null=True
    )
    name = models.CharField(max_length=400)
    given = models.TextField(blank=True, null=True)
    when = models.TextField(blank=True, null=True)
    then = models.TextField(blank=True, null=True)
    criteria = models.TextField(blank=True, null=True)
    status = models.CharField(
        max_length=7, choices=acceptance_tests_status_choices, default="To Test", null=True
    )
    # status = models.ForeignKey(AcceptanceStatus, on_delete=models.RESTRICT, null = True)
    order = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name}"


class TestsConducted(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    acceptance_criteria = models.ForeignKey(
        AcceptanceTest, on_delete=models.RESTRICT)
    date_tested = models.DateField(blank=True, null=True)
    tested_by = models.UUIDField(blank=True, null=True)
    passed = models.BooleanField(default=False)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.acceptance_criteria.name}"


class TaskBacklog(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    task = models.ForeignKey(Task, on_delete=models.RESTRICT)
    backlog = models.ForeignKey(Backlog, on_delete=models.RESTRICT)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ["task", "backlog"]

    def __str__(self):
        return f"{self.task.name} / {self.backlog.name}"


class Sprint(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    sprint_meta = models.ForeignKey(SprintMeta, on_delete=models.RESTRICT)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.start_date} - {self.end_date} / {self.sprint_meta.name}"


class SprintTask(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    task = models.ForeignKey(Task, on_delete=models.RESTRICT)
    sprint = models.ForeignKey(Sprint, on_delete=models.RESTRICT)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.task.name}"


class TaskResource(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    task = models.ForeignKey(Task, on_delete=models.RESTRICT)
    resource = models.ForeignKey(Resource, on_delete=models.RESTRICT)
    percentage_time = models.SmallIntegerField(blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.task.name


class Stakeholder(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    project = models.ForeignKey(Project, on_delete=models.RESTRICT)
    name = models.CharField(max_length=400)
    description = models.TextField(blank=True, null=True)
    role = models.ForeignKey(Role, on_delete=models.RESTRICT)
    email = models.EmailField()
    mobile = models.CharField(max_length=20, blank=True, null=True)
    landline = models.CharField(max_length=20, blank=True, null=True)
    person = models.UUIDField(null=True, blank=False)  # person uuid from crm

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name}"


# class Artifact(BaseModel):
#     id = models.UUIDField(default = uuid4, primary_key = True, editable = False)
#     created_by = models.UUIDField(blank = True, null = True)
#     updated_by = models.UUIDField(blank = True, null = True)
#     client = models.UUIDField(blank = True, null = True)
#     name = models.CharField(max_length = 150)
#     description = models.TextField(blank = True, null = True)
#     link = models.URLField(max_length = 50)
#     created_at = models.DateTimeField(auto_now_add = True)


#     class Meta:
#         ordering = ['-created_at']


#     def __str__(self):
#         return f"{self.name}"


class ProjectArtifact(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    project = models.ForeignKey(Project, on_delete=models.RESTRICT)
    drive = models.TextField()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.project.name}"


class HlrArtifact(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    hlr = models.ForeignKey(HLR, on_delete=models.RESTRICT)
    drive = models.TextField()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.hlr.name}"


class BacklogArtifact(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    backlog = models.ForeignKey(Backlog, on_delete=models.RESTRICT)
    drive = models.TextField()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.backlog.name}"


class WorkingTime(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    project = models.ForeignKey(Project, on_delete=models.RESTRICT)
    week_start = models.CharField(max_length=10, blank=True, null=True)
    fiscal_year_start = models.DateField(blank=True, null=True)
    default_start_time = models.DateTimeField()
    default_end_time = models.DateTimeField()
    hours_per_week = models.PositiveSmallIntegerField()
    days_per_month = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.project.name


class WorkCode(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    name = models.CharField(max_length=400)
    description = models.TextField(blank=True, null=True)
    billable = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name}"


class Timesheet(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    task = models.ForeignKey(Task, on_delete=models.RESTRICT)
    resource = models.ForeignKey(Resource, on_delete=models.RESTRICT)
    name = models.CharField(max_length=100)
    date_time_started = models.DateTimeField()
    hours = models.PositiveSmallIntegerField()
    description = models.TextField(blank=True, null=True)
    workcode = models.ForeignKey(WorkCode, on_delete=models.RESTRICT)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.task.name}"


class Bug(BaseModel):
    """bug"""

    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    headline = models.CharField(max_length=400)
    description = models.TextField(null=True, blank=True)
    steps_to_reproduce = models.TextField(blank=True, null=True)
    expected_result = models.TextField(blank=True, null=True)
    actual_result = models.TextField(blank=True, null=True)
    notes = models.TextField(null=True, blank=True)
    keywords = models.TextField(null=True, blank=True)
    resolution = models.TextField(null=True, blank=True)
    priority = models.CharField(
        max_length=25, choices=priority_choices, default="Work to fix"
    )
    type = models.CharField(
        max_length=15, choices=type_choices, default="Bug Report")
    status = models.CharField(
        max_length=30, choices=status_choices, default="Unassigned", null=True
    )
    # status_assigned_date = models.DateTimeField(blank=True, null = True)
    # status = models.ForeignKey(BugStatus, on_delete=models.SET_NULL, null = True)
    reported_by_name = models.CharField(max_length=400, blank=True, null=True)
    reported_by_email = models.EmailField(null=True, blank=True)
    url = models.URLField(blank=True, null=True)
    screenshot_drive_link = models.TextField(blank=True, null=True)
    os = models.CharField(max_length=20, choices=os_choices, blank=True, null=True)
    browser = models.CharField(max_length=20, choices=browser_choices, blank=True, null=True)
    duration_estimate = models.SmallIntegerField(blank=True, null=True)
    duration_unit = models.CharField(
        max_length=7, blank=True, null=True, choices=duration_unit_choices)
    duration_actual = models.SmallIntegerField(blank=True, null=True)
    signed_off = models.ForeignKey(
        Resource,
        on_delete=models.RESTRICT,
        related_name="signed_off",
        null=True,
        blank=True,
    )
    resource = models.ForeignKey(
        Resource, on_delete=models.RESTRICT, null=True, blank=True
    )
    project = models.ForeignKey(
        Project, on_delete=models.RESTRICT, null=True, blank=True
    )
    due_date = models.DateField(null=True, blank=True)
    date_fixed = models.DateField(null=True, blank=True)
    estimated_start_date_time = models.DateTimeField(null=True, blank=True)
    labels = models.JSONField(blank=True, null=True, default=list)

    def __str__(self):
        return f"{self.headline}"


class BugComment(BaseModel):
    """bug comment"""

    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    bug = models.ForeignKey(Bug, on_delete=models.RESTRICT)
    comment = models.TextField()
    organization = models.CharField(max_length=222, blank=True, null=True)

    def __str__(self):
        return self.comment


class BugArtifact(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    bug = models.ForeignKey(Bug, on_delete=models.RESTRICT)
    drive = models.TextField()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.bug.name}"


class SprintMetaBug(BaseModel):
    """sprint bug"""

    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    sprint = models.ForeignKey(SprintMeta, on_delete=models.RESTRICT)
    bug = models.ForeignKey(Bug, on_delete=models.RESTRICT)

    def __str__(self):
        return f"{self.bug.headline}"


class TaskBug(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    task = models.ForeignKey(Task, on_delete=models.RESTRICT)
    bug = models.ForeignKey(Bug, on_delete=models.RESTRICT)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.task.name}"


class FeatureRequest(BaseModel):
    id = models.UUIDField(default=uuid4, primary_key=True, editable=False)
    name = models.CharField(max_length=250)
    description = models.TextField()
    project = models.ForeignKey(Project, on_delete=models.RESTRICT)
    status = models.CharField(max_length=250, blank=True, null=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.task.name}"


class INA(BaseModel):
    model = models.UUIDField()
    model_name = models.TextField()
    microservice_name = models.TextField()
    record_id = models.UUIDField()
    next_action = models.TextField()
    notes = models.TextField(blank=True, null=True)
    datetime = models.DateTimeField()
    # end = models.DateTimeField()
    event = models.UUIDField(blank=True, null=True)  # event calendar
    responsible = models.UUIDField(blank=True, null=True)  # employee hr
    status = models.CharField(
        choices=ina_status_choices, max_length=11, default="In Progress")

    def __str__(self):
        return f"{self.next_action}"


def create_sprints_from_sprint_meta(sender, instance, created, *args, **kwargs):

    if getattr(instance, "no_sprint_meta_signal", None):
        return

    before_updation = SprintMeta.objects.filter(id=instance.id).first()

    current_sprints = Sprint.objects.filter(sprint_meta=instance).order_by(
        "-start_date"
    )
    sprint_meta_date = instance.started.date()
    days = instance.days
    sprints_to_generate = instance.sprint_to_generate
    last_date = sprint_meta_date

    if before_updation:

        if sprints_to_generate < current_sprints.count():
            raise serializers.ValidationError(
                {
                    "sprint": "Can't Update Because # Sprints is less then current sprints count."
                }
            )

        elif sprints_to_generate > current_sprints.count():
            sprints_to_generate = instance.sprint_to_generate - current_sprints.count()
            last_date = (
                current_sprints.first().start_date
                if current_sprints.first()
                else sprint_meta_date
            )

            if current_sprints.count():
                last_date += timedelta(days=days)

        else:
            sprints_to_generate = 0

    for sprint in range(sprints_to_generate):

        Sprint.objects.create(
            created_by=instance.created_by,
            updated_by=instance.updated_by,
            client=instance.client,
            sprint_meta=instance,
            start_date=last_date,
            end_date=last_date + timedelta(days=days-1)
        )

        last_date += timedelta(days=days)


def set_order_for_task_and_status_date(sender, instance, *args, **kwargs):

    if hasattr(instance, "no_order_signal"): return

    task = Task.objects.filter(id=instance.id).first()

    if not task or (task and task.status and not task.status_assigned_date):
        instance.status_assigned_date = timezone.now()

    if task and instance.status and task.status != instance.status:
        instance.status_assigned_date = timezone.now()

    if not instance.order:

        order = 0
        task = (
            Task.objects.filter(project=instance.project)
            .exclude(id=instance.id)
            .order_by("-order")
            .first()
        )

        if task:
            order = task.order

        instance.order += order + 1


def set_order_for_task_status(sender, instance, *args, **kwargs):

    if not instance.order and instance.project:

        order = 0
        task_status = (
            TaskStatus.objects.filter(project=instance.project)
            .exclude(id=instance.id)
            .order_by("-order")
            .first()
        )

        if task_status:
            order = task_status.order

        instance.order += order + 1


def set_order_for_backlog(sender, instance, *args, **kwargs):

    if hasattr(instance, "no_order_signal"): return

    if not instance.order:

        order = 0
        backlog = (
            Backlog.objects.filter(hlr=instance.hlr)
            .exclude(id=instance.id)
            .order_by("-order")
            .first()
        )

        if backlog:
            order = backlog.order

        instance.order += order + 1


def create_task_types(sender, instance, created, *args, **kwargs):

    if not created or getattr(instance, "no_task_types_and_task_statuses", None):
        return
    task_types = ["Reminder", "Backlog", "Bug", "Feature Request"]

    for task_type in task_types:
        TaskType.objects.create(name=task_type, project=instance,
                                created_by=instance.created_by, client=instance.client)


def create_task_status(sender, instance, created, *args, **kwargs):

    if not created or getattr(instance, "no_task_types_and_task_statuses", None):
        return
    task_statuses = ["To do", "In Progress",
                     "Testing", "Approved", "Done", "Deployed"]

    for idx, task_status in enumerate(task_statuses):
        TaskStatus.objects.create(name=task_status, project=instance, order=idx+1,
                                  created_by=instance.created_by, client=instance.client)


post_save.connect(create_sprints_from_sprint_meta, SprintMeta)
# pre_save.connect(rebase_the_project, Project)
post_save.connect(create_task_types, Project)
post_save.connect(create_task_status, Project)
pre_save.connect(set_order_for_task_and_status_date, Task)
pre_save.connect(set_order_for_task_status, TaskStatus)
pre_save.connect(set_order_for_backlog, Backlog)

# def assign_status_to_task_instead_of_deleting(sender, instance, *args, **kwargs):
#     task_status = TaskStatus.objects.filter(name="unassigned").first()

#     print(task_status)

#     if task_status:
#         print(instance.statueses.all())
#         for task in instance.statueses.all():
#             task.status = task_status
#             task.save()

#     instance.id = None
#     instance.pk = None


# pre_delete.connect(assign_status_to_task_instead_of_deleting, TaskStatus)
