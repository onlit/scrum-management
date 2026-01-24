import requests
from django.conf import settings
import re
from . import serializers
from rest_framework.serializers import ValidationError, PrimaryKeyRelatedField
from django.apps import apps
import json
from a_pm_rapi.models import Project, HLR, Persona, Backlog, Task, TaskComment, AcceptanceTest, TestsConducted, TaskBacklog, TaskResource, Stakeholder, ProjectArtifact, HlrArtifact, BacklogArtifact, WorkingTime, Timesheet, TaskType, TaskStatus, SprintMeta, SprintMetaProject, Sprint, SprintTask
from django.utils import timezone
from a_pm_rapi.utils import with_obj_lvl_get_object_or_404, with_objs_lvl_permissions
from django.http import Http404
from celery import shared_task
from uuid import uuid4
from dateutil.rrule import rrulestr
from django.forms import model_to_dict
from datetime import timedelta
from copy import deepcopy
import pytz
from django.db import IntegrityError
from django.db import transaction
from django.utils.timezone import is_naive, make_aware
from django.db import models
from dateutil.parser import parse as date_parse


def rebase_task_status(instance, order, project, client):
    next_task_statuses = TaskStatus.objects.filter(
        parent=instance.parent,
        order__gte=order,
        project=project,
        client=client,
    ).exclude(id=instance.id).distinct().order_by("order")

    for idx, task_status in enumerate(next_task_statuses):
        task_status.order = order + (idx + 1)
        task_status.save()


def rebase_backlogs_order(instance, order, hlr, client):
    next_backlogs = Backlog.objects.filter(
        order__gte=order,
        hlr=hlr,
        client=client,
    ).exclude(id=instance.id).distinct().order_by("order")

    for idx, backlog in enumerate(next_backlogs):
        backlog.order = order + (idx + 1)
        backlog.no_order_signal = True
        backlog.save()


def rebase_tasks_order(instance, order, parent_task, project, client):
    next_tasks = Task.objects.filter(
        order__gte=order,
        parent_task=parent_task,
        project=project,
        client=client,
    ).exclude(id=instance.id).distinct().order_by("order")

    for idx, task in enumerate(next_tasks):
        task.order = order + (idx + 1)
        print(task.order)
        task.no_order_signal = True
        task.save()


def get_all_tasks(parent_task, all_tasks):
    for task in parent_task.task_set.all():
        all_tasks.append(task) 
        get_all_tasks(task, all_tasks)


def rebase_the_task_dates(parent_task, difference, by="started"):
    tasks_to_update = []

    for task in parent_task.get_child_branch():
        if by == "started":
            task.started = task.started + difference
        else:
            task.deadline = task.deadline + difference
        tasks_to_update.append(task)

    Task.objects.bulk_update(tasks_to_update, fields=[
        "started",
        "deadline",
    ])


def rebase_the_project_dates(project, difference):
    tasks_to_update = []

    for task in Task.objects.filter(
        project=project,
        started__isnull=False
    ):
        if task.started:
            task.started = task.started + difference
        if task.deadline:
            task.deadline = task.deadline + difference
        tasks_to_update.append(task)

    Task.objects.bulk_update(tasks_to_update, fields=[
        "started",
        "deadline",
    ])


def get_template(id, access_token=None):
    url = f"{ settings.SYSTEM_HOST }templates/"
    headers = {}

    if access_token:
        headers["Authorization"] = access_token

    response = requests.get(
        f'{url}{id}/', headers=headers
    )

    if response.status_code == 200:
        return response.json()
    
    return {}


def clone_model(model, custom_params, request, object_to_clone, _template=False):
    cloned_instance = None

    if model == Project:
        cloned_instance = duplicate_project(object_to_clone, request, custom_params, _template)

    return cloned_instance

def get_sub_tasks(parent_task):
    sub_tasks = {}

    for task in Task.objects.filter(parent_task=parent_task).distinct():
        task_backlogs = TaskBacklog.objects.filter(
            task=task).distinct()
        task_resources = TaskResource.objects.filter(
            task=task).distinct()

        sub_tasks[f"{task.id}"] = {
            "task": task,
            "task_backlogs": task_backlogs,
            "task_resources": task_resources,
            "sub_tasks": get_sub_tasks(task),
        }

    return sub_tasks


def create_tasks_from_parent_for_new_parent(subtasks, new_parent_task):
    tasks_to_create = []
    task_backlogs_to_create = []
    task_resources_to_create = []

    for sub_task_parent_id, sub_task_parent_details in subtasks.items():
        sub_task_parent = deepcopy(sub_task_parent_details["task"])
        sub_task_parent.id = uuid4()
        sub_task_parent.parent_task = new_parent_task
        tasks_to_create.append(sub_task_parent)

        for task_backlog in sub_task_parent_details["task_backlogs"]:
            new_task_backlog = deepcopy(task_backlog)
            new_task_backlog.id = uuid4()
            new_task_backlog.task = sub_task_parent
            task_backlogs_to_create.append(new_task_backlog)

        for task_resource in sub_task_parent_details["task_resources"]:
            new_task_resource = deepcopy(task_resource)
            new_task_resource.id = uuid4()
            new_task_resource.task = sub_task_parent
            task_resources_to_create.append(new_task_resource)

        sub_tasks, sub_task_backlogs, sub_task_resources = create_tasks_from_parent_for_new_parent(
            sub_task_parent_details["sub_tasks"], sub_task_parent)

        tasks_to_create += sub_tasks
        task_backlogs_to_create += sub_task_backlogs
        task_resources_to_create += sub_task_resources

    return tasks_to_create, task_backlogs_to_create, task_resources_to_create


def ensure_timezone_aware(dt, timezone_str):
    if dt is None:
        return None
    if is_naive(dt):
        return make_aware(dt, pytz.timezone(timezone_str))
    return dt.astimezone(pytz.timezone(timezone_str))


def repeated_task_creator(instance, timezone, by="deadline", commit=False, max_count=50):
    if not instance.rrule or not instance.deadline or not (instance.started or (instance.duration_estimate and instance.duration_unit)):
        return

    # -- Get all child subtasks once for reuse
    all_sub_tasks = get_sub_tasks(instance)

    # -- Prepare base fields
    base_task = model_to_dict(instance, exclude=["id", "rrule"])
    fk_fields = [
        "parent_task", "dependency", "predecessor", "project",
        "hlr", "task_type", "owner", "status"
    ]
    for field in fk_fields:
        base_task[f"{field}_id"] = base_task.pop(field, None)

    # -- Collect associated models
    parent_task_backlogs = list(TaskBacklog.objects.filter(task=instance))
    parent_task_resources = list(TaskResource.objects.filter(task=instance))

    tasks_objects, task_backlogs_objects, task_resources_objects = [], [], []

    # -- Time calculation
    started = instance.started
    time_diff_sec = None

    if instance.started and instance.deadline:
        time_diff_sec = (instance.deadline - instance.started).total_seconds()

    elif instance.deadline and instance.duration_unit and instance.duration_estimate:
        unit_map = {
            "Weeks": ("days", instance.duration_estimate * 7),
            "Days": ("days", instance.duration_estimate),
            "Hours": ("hours", instance.duration_estimate),
            "Minutes": ("minutes", instance.duration_estimate),
        }
        duration_unit, duration_value = unit_map.get(instance.duration_unit, (None, None))
        if duration_unit and duration_value is not None:
            delta = timedelta(**{duration_unit: duration_value})
            time_diff_sec = delta.total_seconds()
            started = instance.deadline - delta

    if not time_diff_sec or not started:
        return

    dtstart = instance.deadline if by == "deadline" else started
    dtstart = ensure_timezone_aware(dtstart, timezone)

    # -- Get dates from rrule
    dates = instance.rrule.occurrences(dtstart=dtstart)
    rule = rrulestr(str(instance.rrule))  # fallback use of rule._count if available
    latest_task = Task.objects.filter(parent_task=instance).order_by("-order").first()
    latest_order = latest_task.order if latest_task else 0

    count = 0
    for i, recurrence_dt in enumerate(dates):
        if i == 0:
            continue  # skip the original task
        if count >= max_count or (getattr(rule, "_count", None) and count >= rule._count):
            break

        new_task = Task(**base_task)
        new_task.id = uuid4()
        new_task.name = f"[{count + 1}] {instance.name}"
        new_task.rrule = None
        new_task.order = latest_order + count + 1
        new_task.parent_task = instance

        if by == "deadline":
            new_task.deadline = recurrence_dt
            new_task.started = recurrence_dt - timedelta(seconds=time_diff_sec)
        else:
            new_task.started = recurrence_dt
            new_task.deadline = recurrence_dt + timedelta(seconds=time_diff_sec)

        tasks_objects.append(new_task)

        for backlog in parent_task_backlogs:
            new_backlog = deepcopy(backlog)
            new_backlog.id = uuid4()
            new_backlog.task = new_task
            task_backlogs_objects.append(new_backlog)

        for resource in parent_task_resources:
            new_resource = deepcopy(resource)
            new_resource.id = uuid4()
            new_resource.task = new_task
            task_resources_objects.append(new_resource)

        sub_tasks, sub_backlogs, sub_resources = create_tasks_from_parent_for_new_parent(all_sub_tasks, new_task)
        tasks_objects.extend(sub_tasks)
        task_backlogs_objects.extend(sub_backlogs)
        task_resources_objects.extend(sub_resources)

        count += 1

    if commit:
        with transaction.atomic():
            tasks = Task.objects.bulk_create(tasks_objects)
            task_backlogs = TaskBacklog.objects.bulk_create(task_backlogs_objects)
            task_resources = TaskResource.objects.bulk_create(task_resources_objects)
    else:
        tasks = tasks_objects
        task_backlogs = task_backlogs_objects
        task_resources = task_resources_objects

    return {
        "tasks": tasks,
        "task_backlogs": task_backlogs,
        "task_resources": task_resources,
    }


def bulk_create_stages_in_bpa(payload, access_token=None):
    url = f"{ settings.BPA_HOST }bulk-create-stages/"
    headers = {
        "Content-Type": "application/json"
    }

    if access_token:
        headers["Authorization"] = access_token

    print(payload)

    response = requests.post(
        f'{url}', data=json.dumps(payload), headers=headers
    )

    if response.status_code == 201:
        return response.json()

    elif response.status_code == 400:
        raise ValidationError({
            "email": "Failed to create stages!",
            "status_code": response.status_code,
            "response": response.content,
        })


def create_task_in_bpa(tasks, request, payload, workflow_id, parent_bpa_stage_id=None):
    for task in tasks:
        new_order = f"{task.order}"

        # Create the stage dictionary
        stage_data = {
            "id": str(uuid4()),
            "name": f"{task.name}",
            "description": f"{task.description}",
            "workflow": workflow_id,
            "order": new_order,
            "rotting_days": task.rotting_days,
        }

        # Add parent_stage_id if it exists
        if parent_bpa_stage_id:
            stage_data["parent_stage"] = parent_bpa_stage_id

        payload["stages"].append(stage_data)

        current_bpa_stage_id = stage_data["id"]

        sub_tasks = with_objs_lvl_permissions(
            Task.objects.filter(
                project_id=task.project.id,
                parent_task=task
            ).order_by("order"),
            request
        )
        
        create_task_in_bpa(sub_tasks, request, payload, workflow_id, current_bpa_stage_id)


def duplicate_backlog(backlog, hlr, custom_attrs, records):
    if Backlog.objects.filter(
        i_want = backlog.i_want,
        as_a__name = backlog.as_a.name,
        hlr = hlr
    ).exists():
        return
        
    old_backlog_id = backlog.id
    new_backlog = backlog
    new_backlog.pk = uuid4()
    new_backlog.hlr = hlr

    for key, value in custom_attrs.items():
        setattr(new_backlog, key, value)

    if new_backlog.as_a:
        old_as_a_id = new_backlog.as_a.id
        as_a = records["as_a_to_create"].get(f"{old_as_a_id}")

        if not as_a:
            as_a = Persona.objects.filter(
                name = new_backlog.as_a.name,
                project = hlr.project
            ).first()

            if not as_a:
                as_a = new_backlog.as_a
                as_a.pk = uuid4()
                as_a.project = hlr.project

                for key, value in custom_attrs.items():
                    setattr(as_a, key, value)

                records["as_a_to_create"][f"{old_as_a_id}"] = as_a

        new_backlog.as_a = as_a

    records["backlogs_to_create"][f"{old_backlog_id}"] = new_backlog

    for acceptance_test in AcceptanceTest.objects.filter(backlog_id=old_backlog_id).all():
        old_acceptance_test_id = acceptance_test.id
        acceptance_test.pk = uuid4()
        acceptance_test.backlog = new_backlog
        records["acceptance_tests_to_create"][f"{old_acceptance_test_id}"] = acceptance_test

    return new_backlog


def duplicate_task(task, name, order, custom_attrs, records, clone_sub_tasks=True, subTask=False):
    old_task_id = task.id
    new_task = task
    new_task.pk = uuid4()
    new_task.name = name
    new_task.order = order
    if subTask:
        new_task.parent_task = records["tasks_to_create"][f"{new_task.parent_task.id}"]
    
    for key, value in custom_attrs.items():
        setattr(new_task, key, value)

    records["tasks_to_create"][f"{old_task_id}"] = new_task

    for task_comment in TaskComment.objects.filter(task_id=old_task_id).all():
        old_task_comment_id = task_comment.id
        task_comment.pk = uuid4()
        task_comment.task = new_task
        for key, value in custom_attrs.items():
            setattr(task_comment, key, value)
        records["task_comments_to_create"][f"{old_task_comment_id}"] = task_comment

    for sprint_task in SprintTask.objects.filter(task_id=old_task_id).all():
        old_sprint_task_id = sprint_task.id
        sprint_task.pk = uuid4()
        sprint_task.task = new_task
        for key, value in custom_attrs.items():
            setattr(sprint_task, key, value)
        records["sprint_tasks_to_create"][f"{old_sprint_task_id}"] = sprint_task

    if clone_sub_tasks:
        for sub_task in Task.objects.filter(parent_task_id=old_task_id).all():
            duplicate_task(sub_task, sub_task.name, sub_task.order, custom_attrs, records, True, True)
    
    return new_task


def duplicate_task_v2_for_project(records, request, task, new_project, old_project_start_date, _template=False):
    old_task_id = task.id
    old_task_task_type_id = task.task_type_id
    old_task_status_id = task.status_id
    old_task_hlr_id = task.hlr_id
    old_task_parent_task_id = task.parent_task_id
    old_task_dependency_id = task.dependency_id
    old_task_predecessor_id = task.predecessor_id

    new_task = deepcopy(task)
    new_task.pk = uuid4()
    new_task.project = new_project
    new_task._template = _template
    new_task.created_by = request.user.id
    new_task.updated_by = request.user.id
    new_task.client = request.user.client.get("id")

    if old_project_start_date and new_project.started and new_task.status_assigned_date:
        new_task.status_assigned_date = new_project.started + timedelta(seconds=(new_task.status_assigned_date - old_project_start_date).total_seconds())

    if old_project_start_date and new_project.started and new_task.started:
        new_task.started = new_project.started + timedelta(seconds=(new_task.started - old_project_start_date).total_seconds())
    
    if old_project_start_date and new_project.started and new_task.deadline:
        new_task.deadline = new_project.started + timedelta(seconds=(new_task.deadline - old_project_start_date).total_seconds())

    if new_task.task_type:
        new_task_type = records["task_type_to_create"].get(f"{old_task_task_type_id}")

        if not new_task_type:
            new_task_type = new_task.task_type
            new_task_type.pk = uuid4()
            new_task_type.project = new_project
            new_task_type._template = _template
            new_task_type.created_by = request.user.id
            new_task_type.updated_by = request.user.id
            new_task_type.client = request.user.client.get("id")
            records["task_type_to_create"][f"{old_task_task_type_id}"] = new_task_type

        new_task.task_type = new_task_type
    
    if new_task.status:
        new_task_status = records["task_status_to_create"].get(f"{old_task_status_id}")

        if not new_task_status:
            new_task_status = new_task.status
            new_task_status.pk = uuid4()
            new_task_status.project = new_project
            new_task_status._template = _template
            new_task_status.created_by = request.user.id
            new_task_status.updated_by = request.user.id
            new_task_status.client = request.user.client.get("id")
            records["task_status_to_create"][f"{old_task_status_id}"] = new_task_status

        new_task.status = new_task_status

    if new_task.hlr:
        new_hlr = records["hlrs_to_create"].get(f"{old_task_hlr_id}")

        if not new_hlr:
            new_hlr = new_task.hlr
            new_hlr.pk = uuid4()
            new_hlr.project = new_project
            new_hlr._template = _template
            new_hlr.created_by = request.user.id
            new_hlr.updated_by = request.user.id
            new_hlr.client = request.user.client.get("id")
            records["hlrs_to_create"][f"{old_task_hlr_id}"] = new_hlr

        new_task.hlr = new_hlr

    if new_task.parent_task:

        if old_task_parent_task_id == old_task_id: # self task
            new_task.parent_task = new_task
        else:
            parent_task = records["tasks_to_create"].get(f"{old_task_parent_task_id}")

            if not parent_task:
                parent_task = duplicate_task_v2_for_project(records, request, new_task.parent_task, new_project, old_project_start_date, _template)
        
            new_task.parent_task = parent_task

    if new_task.dependency:

        if old_task_dependency_id == old_task_id: # self task
            new_task.dependency = new_task
        else:
            parent_task = records["tasks_to_create"].get(f"{old_task_dependency_id}")

            if not dependency:
                dependency = duplicate_task_v2_for_project(records, request, new_task.dependency, new_project, old_project_start_date, _template)
        
            new_task.dependency = dependency

    if new_task.predecessor:

        if old_task_predecessor_id == old_task_id: # self task
            new_task.predecessor = new_task
        else:
            parent_task = records["tasks_to_create"].get(f"{old_task_predecessor_id}")

            if not predecessor:
                predecessor = duplicate_task_v2_for_project(records, request, new_task.predecessor, new_project, old_project_start_date, _template)
        
            new_task.predecessor = predecessor

    records["tasks_to_create"][f"{old_task_id}"] = new_task
    return new_task


def duplicate_project(project, request, attrs, _template=False):
    manager = "template_objects" if not _template else "objects"
    old_project_start_date = project.started

    new_project = deepcopy(project)
    new_project.pk = None
    new_project.no_task_types_and_task_statuses = True
    new_project._template = _template

    for key, value in attrs.items():
        setattr(new_project, key, value)

    # save the partial clone to have a valid ID assigned
    new_project.created_by = request.user.id
    new_project.updated_by = request.user.id
    new_project.client = request.user.client.get("id")
    new_project.save()

    records = {
        "sprints_to_create": {},
        "sprint_tasks_to_create": {},
        "persona_to_create": {},
        "task_type_to_create": {},
        "task_status_to_create": {},
        "hlrs_to_create": {},
        "backlogs_to_create": {},
        "tasks_to_create": {},
        "task_comments_to_create": {},  # Added this line
        "acceptance_tests_to_create": {},  # Added this line
        "tests_conducted_to_create": {},  # Added this line
        "task_backlogs_to_create": {},  # Added this line
        "task_resources_to_create": {},  # Added this line
        "stakeholders_to_create": {},  # Added this line
        "project_artifacts_to_create": {},  # Added this line
        "hlr_artifacts_to_create": {},  # Added this line
        "backlog_artifacts_to_create": {},  # Added this line
        "working_times_to_create": {},  # Added this line
        "timesheets_to_create": {},  # Added this line
    }
    
    link_task_foreign_keys = {
        "parent_task" : {},
        "dependency" : {},
        "predecessor" : {},
    }

    for persona in getattr(Persona, manager).filter(project=project):
        old_persona_id = persona.id

        if records["persona_to_create"].get(f"{old_persona_id}"):
            continue

        new_persona = persona
        new_persona.pk = uuid4()
        new_persona.project = new_project
        new_persona._template = _template
        new_persona.created_by = request.user.id
        new_persona.updated_by = request.user.id
        new_persona.client = request.user.client.get("id")

        records["persona_to_create"][f"{old_persona_id}"] = new_persona

    for task_type in getattr(TaskType, manager).filter(project=project):
        old_task_type_id = task_type.id

        if records["task_type_to_create"].get(f"{old_task_type_id}"):
            continue

        new_task_type = task_type
        new_task_type.pk = uuid4()
        new_task_type.project = new_project
        new_task_type._template = _template
        new_task_type.created_by = request.user.id
        new_task_type.updated_by = request.user.id
        new_task_type.client = request.user.client.get("id")

        records["task_type_to_create"][f"{old_task_type_id}"] = new_task_type
    
    for task_status in getattr(TaskStatus, manager).filter(project=project):
        old_task_status_id = task_status.id

        if records["task_status_to_create"].get(f"{old_task_status_id}"):
            continue

        new_task_status = task_status
        new_task_status.pk = uuid4()
        new_task_status.project = new_project
        new_task_status._template = _template
        new_task_status.created_by = request.user.id
        new_task_status.updated_by = request.user.id
        new_task_status.client = request.user.client.get("id")

        records["task_status_to_create"][f"{old_task_status_id}"] = new_task_status
    
    for hlr in getattr(HLR, manager).filter(project=project):
        old_hlr_id = hlr.id

        if records["hlrs_to_create"].get(f"{old_hlr_id}"):
            continue

        new_hlr = hlr
        new_hlr.pk = uuid4()
        new_hlr.project = new_project
        new_hlr._template = _template
        new_hlr.created_by = request.user.id
        new_hlr.updated_by = request.user.id
        new_hlr.client = request.user.client.get("id")

        records["hlrs_to_create"][f"{old_hlr_id}"] = new_hlr

    for backlog in getattr(Backlog, manager).filter(hlr__project=project):
        old_backlog_id = backlog.id
        old_as_a_id = backlog.as_a.id
        
        as_a = new_task_type = records["persona_to_create"].get(f"{backlog.as_a.id}")

        if not as_a:
            new_as_a = backlog.as_a
            new_as_a.pk = uuid4()
            new_as_a.project = new_project
            new_as_a._template = _template
            new_as_a.created_by = request.user.id
            new_as_a.updated_by = request.user.id
            new_as_a.client = request.user.client.get("id")
            records["persona_to_create"][f"{old_as_a_id}"] = new_as_a
            as_a = new_as_a

        new_backlog = backlog
        new_backlog.pk = uuid4()
        new_backlog.hlr = records["hlrs_to_create"][f"{backlog.hlr.id}"]
        new_backlog.as_a = as_a
        new_backlog._template = _template
        new_backlog.created_by = request.user.id
        new_backlog.updated_by = request.user.id
        new_backlog.client = request.user.client.get("id")

        records["backlogs_to_create"][f"{old_backlog_id}"] = new_backlog

    for task in getattr(Task, manager).filter(project=project):
        new_task = records["tasks_to_create"].get(f"{task.id}")
        if new_task: continue
        duplicate_task_v2_for_project(
            records, request, task, new_project, old_project_start_date, _template)

    for task_comment in getattr(TaskComment, manager).filter(task__project=project):
        old_task_comment_id = task_comment.id

        new_task_comment = task_comment
        new_task_comment.pk = uuid4()
        new_task_comment.task = records["tasks_to_create"][f"{task_comment.task.id}"]
        new_task_comment._template = _template
        new_task_comment.created_by = request.user.id
        new_task_comment.updated_by = request.user.id
        new_task_comment.client = request.user.client.get("id")

        records["task_comments_to_create"][f"{old_task_comment_id}"] = new_task_comment

    for acceptance_test in getattr(AcceptanceTest, manager).filter(backlog__hlr__project=project):

        old_acceptance_test_id = acceptance_test.id

        new_acceptance_test = acceptance_test
        new_acceptance_test.pk = uuid4()
        new_acceptance_test.backlog = records[
            "backlogs_to_create"][f"{acceptance_test.backlog.id}"]
        new_acceptance_test._template = _template
        new_acceptance_test.created_by = request.user.id
        new_acceptance_test.updated_by = request.user.id
        new_acceptance_test.client = request.user.client.get("id")

        records["acceptance_tests_to_create"][f"{old_acceptance_test_id}"] = new_acceptance_test

    for tests_conducted in getattr(TestsConducted, manager).filter(acceptance_criteria__backlog__hlr__project=project):
        old_tests_conducted_id = tests_conducted.id

        new_tests_conducted = tests_conducted
        new_tests_conducted.pk = uuid4()
        new_tests_conducted.acceptance_criteria = records[
            "acceptance_tests_to_create"][f"{tests_conducted.acceptance_criteria.id}"]
        new_tests_conducted._template = _template
        new_tests_conducted.created_by = request.user.id
        new_tests_conducted.updated_by = request.user.id
        new_tests_conducted.client = request.user.client.get("id")

        records["tests_conducted_to_create"][f"{old_tests_conducted_id}"] = new_tests_conducted

    for task_backlog in getattr(TaskBacklog, manager).filter(backlog__hlr__project=project, task__project=project):
        old_task_backlog_id = task_backlog.id

        new_task_backlog = task_backlog
        new_task_backlog.pk = uuid4()
        new_task_backlog.task = records["tasks_to_create"][f"{task_backlog.task.id}"]
        new_task_backlog.backlog = records["backlogs_to_create"][f"{task_backlog.backlog.id}"]
        new_task_backlog._template = _template
        new_task_backlog.created_by = request.user.id
        new_task_backlog.updated_by = request.user.id
        new_task_backlog.client = request.user.client.get("id")

        records["task_backlogs_to_create"][f"{old_task_backlog_id}"] = new_task_backlog

    for task_resource in getattr(TaskResource, manager).filter(task__project=project):
        old_task_resource_id = task_resource.id

        new_task_resource = task_resource
        new_task_resource.pk = uuid4()
        new_task_resource.task = records["tasks_to_create"][f"{task_resource.task.id}"]
        new_task_resource._template = _template
        new_task_resource.created_by = request.user.id
        new_task_resource.updated_by = request.user.id
        new_task_resource.client = request.user.client.get("id")

        records["task_resources_to_create"][f"{old_task_resource_id}"] = new_task_resource

    for stakeholder in getattr(Stakeholder, manager).filter(project=project):
        old_stakeholder_id = stakeholder.id

        new_stakeholder = stakeholder
        new_stakeholder.pk = uuid4()
        new_stakeholder.project = new_project
        new_stakeholder._template = _template
        new_stakeholder.created_by = request.user.id
        new_stakeholder.updated_by = request.user.id
        new_stakeholder.client = request.user.client.get("id")

        records["stakeholders_to_create"][f"{old_stakeholder_id}"] = new_stakeholder

    for artifact in getattr(ProjectArtifact, manager).filter(project=project):
        old_artifact_id = artifact.id

        new_artifact = artifact
        new_artifact.pk = uuid4()
        new_artifact.project = new_project
        new_artifact._template = _template
        new_artifact.created_by = request.user.id
        new_artifact.updated_by = request.user.id
        new_artifact.client = request.user.client.get("id")

        records["project_artifacts_to_create"][f"{old_artifact_id}"] = new_artifact

    for hlr_artifact in getattr(HlrArtifact, manager).filter(hlr__project=project):
        old_hlr_artifact_id = hlr_artifact.id

        new_hlr_artifact = hlr_artifact
        new_hlr_artifact.pk = uuid4()
        new_hlr_artifact.hlr = records["hlrs_to_create"][f"{hlr_artifact.hlr.id}"]
        new_hlr_artifact._template = _template
        new_hlr_artifact.created_by = request.user.id
        new_hlr_artifact.updated_by = request.user.id
        new_hlr_artifact.client = request.user.client.get("id")

        records["hlr_artifacts_to_create"][f"{old_hlr_artifact_id}"] = new_hlr_artifact

    for backlog_artifact in getattr(BacklogArtifact, manager).filter(backlog__hlr__project=project):
        old_backlog_artifact_id = backlog_artifact.id

        new_backlog_artifact = backlog_artifact
        new_backlog_artifact.pk = uuid4()
        new_backlog_artifact.backlog = records[
            "backlogs_to_create"][f"{backlog_artifact.backlog.id}"]
        new_backlog_artifact._template = _template
        new_backlog_artifact.created_by = request.user.id
        new_backlog_artifact.updated_by = request.user.id
        new_backlog_artifact.client = request.user.client.get("id")

        records["backlog_artifacts_to_create"][f"{old_backlog_artifact_id}"] = new_backlog_artifact

    for working_time in getattr(WorkingTime, manager).filter(project=project):
        old_working_time_id = working_time.id

        new_working_time = working_time
        new_working_time.pk = uuid4()
        new_working_time.project = new_project
        new_working_time._template = _template
        new_working_time.created_by = request.user.id
        new_working_time.updated_by = request.user.id
        new_working_time.client = request.user.client.get("id")

        records["working_times_to_create"][f"{old_working_time_id}"] = new_working_time

    for timesheet in getattr(Timesheet, manager).filter(task__project=project):
        old_timesheet_id = timesheet.id

        new_timesheet = timesheet
        new_timesheet.pk = uuid4()
        new_timesheet.task = records["tasks_to_create"][f"{timesheet.task.id}"]
        new_timesheet._template = _template
        new_timesheet.created_by = request.user.id
        new_timesheet.updated_by = request.user.id
        new_timesheet.client = request.user.client.get("id")

        records["timesheets_to_create"][f"{old_timesheet_id}"] = new_timesheet


    sprint_meta = getattr(SprintMeta, manager).filter(program=project.program, sprintmetaproject__project=project).order_by("-started").distinct().first()

    if sprint_meta:
        old_sprint_meta_started = sprint_meta.started

        sprint_meta_project = getattr(SprintMetaProject, manager).filter(
            project=project,
            sprint_meta=sprint_meta
        ).order_by("-created_at").distinct().first()

        sprints = getattr(Sprint, manager).filter(
            sprint_meta=sprint_meta
        ).all().distinct()

        sprint_tasks = getattr(SprintTask, manager).filter(
            task__project=project,
            sprint__sprint_meta=sprint_meta,
        ).all()

        sprint_meta.pk = None
        sprint_meta.name = f"{sprint_meta.name} ({new_project.name})"
        sprint_meta.program = new_project.program
        sprint_meta.started = new_project.started + timedelta(seconds=(old_sprint_meta_started - old_project_start_date).total_seconds())
        sprint_meta._template = _template
        sprint_meta.created_by = request.user.id
        sprint_meta.updated_by = request.user.id
        sprint_meta.client = request.user.client.get("id")
        sprint_meta.no_sprint_meta_signal = True
        sprint_meta.save()

        sprint_meta_project.pk = None
        sprint_meta_project.project = new_project
        sprint_meta_project.sprint_meta = sprint_meta
        sprint_meta_project._template = _template
        sprint_meta_project.created_by = request.user.id
        sprint_meta_project.updated_by = request.user.id
        sprint_meta_project.client = request.user.client.get("id")
        sprint_meta_project.save()

        for sprint in sprints:
            old_sprint_id = sprint.id

            if records["sprints_to_create"].get(f"{old_sprint_id}"):
                continue

            new_sprint = sprint
            new_sprint.pk = uuid4()
            new_sprint.sprint_meta = sprint_meta

            if new_sprint.start_date:
                new_sprint.start_date = sprint_meta.started.date() + timedelta(days=(new_sprint.start_date - old_sprint_meta_started.date()).days)

            if new_sprint.end_date:
                new_sprint.end_date = sprint_meta.started.date() + timedelta(days=(new_sprint.end_date - old_sprint_meta_started.date()).days)

            new_sprint._template = _template
            new_sprint.created_by = request.user.id
            new_sprint.updated_by = request.user.id
            new_sprint.client = request.user.client.get("id")

            records["sprints_to_create"][f"{old_sprint_id}"] = new_sprint

        for sprint_task in sprint_tasks:
            old_sprint_task_id = sprint_task.id
            sprint_sprint_task = records["tasks_to_create"].get(f"{sprint_task.task.id}")
            sprint = records["sprints_to_create"].get(f"{sprint_task.sprint.id}")

            if records["sprint_tasks_to_create"].get(f"{old_sprint_task_id}") or not sprint_sprint_task or not sprint:
                continue

            new_sprint_task = sprint_task
            new_sprint_task.pk = uuid4()
            new_sprint_task.task = sprint_sprint_task
            new_sprint_task.sprint = sprint
            new_sprint_task._template = _template
            new_sprint_task.created_by = request.user.id
            new_sprint_task.updated_by = request.user.id
            new_sprint_task.client = request.user.client.get("id")

            records["sprint_tasks_to_create"][f"{old_sprint_task_id}"] = new_sprint_task

    # Perform object creations
    Persona.objects.bulk_create(list(records["persona_to_create"].values()))
    TaskType.objects.bulk_create(list(records["task_type_to_create"].values()))
    TaskStatus.objects.bulk_create(
        list(records["task_status_to_create"].values()))
    HLR.objects.bulk_create(list(records["hlrs_to_create"].values()))
    Backlog.objects.bulk_create(list(records["backlogs_to_create"].values()))

    # Detach and store foreign key references
    link_task_foreign_keys = {}

    for new_task in records["tasks_to_create"].values():
        print(f"{new_task.pk}, {new_task}")
        link_task_foreign_keys[new_task.pk] = {
            "parent_task": new_task.parent_task.pk if new_task.parent_task else None,
            "dependency": new_task.dependency.pk if new_task.dependency else None,
            "predecessor": new_task.predecessor.pk if new_task.predecessor else None,
        }

        # Nullify for bulk_create
        new_task.parent_task = None
        new_task.dependency = None
        new_task.predecessor = None

    # Bulk create tasks
    Task.objects.bulk_create(records["tasks_to_create"].values())

    # Refetch the created tasks
    task_manager = "template_objects" if _template else "objects"
    tasks = getattr(Task, task_manager).filter(id__in=link_task_foreign_keys.keys())
    tasks_to_update = []

    for task in tasks:
        refs = link_task_foreign_keys[task.pk]
        task.parent_task_id = refs["parent_task"]
        task.dependency_id = refs["dependency"]
        task.predecessor_id = refs["predecessor"]
        tasks_to_update.append(task)

    # Bulk update all with restored FKs
    getattr(Task, task_manager).bulk_update(
        tasks_to_update,
        ["parent_task", "dependency", "predecessor"]
    )
 
    TaskComment.objects.bulk_create(
        list(records["task_comments_to_create"].values()))
    AcceptanceTest.objects.bulk_create(
        list(records["acceptance_tests_to_create"].values()))
    TestsConducted.objects.bulk_create(
        list(records["tests_conducted_to_create"].values()))
    TaskBacklog.objects.bulk_create(
        list(records["task_backlogs_to_create"].values()))
    TaskResource.objects.bulk_create(
        list(records["task_resources_to_create"].values()))
    Stakeholder.objects.bulk_create(
        list(records["stakeholders_to_create"].values()))
    ProjectArtifact.objects.bulk_create(
        list(records["project_artifacts_to_create"].values()))
    HlrArtifact.objects.bulk_create(
        list(records["hlr_artifacts_to_create"].values()))
    BacklogArtifact.objects.bulk_create(
        list(records["backlog_artifacts_to_create"].values()))
    WorkingTime.objects.bulk_create(
        list(records["working_times_to_create"].values()))
    Timesheet.objects.bulk_create(
        list(records["timesheets_to_create"].values()))
    
    Sprint.objects.bulk_create(
        list(records["sprints_to_create"].values()))
    SprintTask.objects.bulk_create(
        list(records["sprint_tasks_to_create"].values()))

    return new_project


def create_calendar_event(payload, access_token=None):
    url = f"{ settings.CALENDAR_HOST }events/"
    headers = {}

    if access_token:
        headers["Authorization"] = access_token

    response = requests.post(
        f'{url}', data=payload, headers=headers
    )

    if response.status_code == 201:
        return response.json()

    elif response.status_code == 400:
        raise ValidationError({
            "email": "Failed to create calendar event!",
            "status_code": response.status_code,
            "response": response.content,
        })

    else:
        raise ValidationError({
            "email": "Failed to create calendar event!",
            "status_code": response.status_code,
        })


def pluralize(noun):

    if re.search('[sxz]$', noun):
        return re.sub('$', 'es', noun)
    elif re.search('[^aeioudgkprt]h$', noun):
        return re.sub('$', 'es', noun)
    elif re.search('[aeiou]y$', noun):
        return re.sub('y$', 'ies', noun)
    else:
        return noun + 's'


def get_path(model_name):
    splitted_capital_words = re.findall('[A-Z][^A-Z]*', model_name)
    print(
        f"{'-'.join(splitted_capital_words[:-1])}{pluralize(splitted_capital_words[-1].lower())}")

    return f"{'-'.join(splitted_capital_words[:-1])}{pluralize(splitted_capital_words[-1].lower())}"


def normalize_value(value, expected_type=None):
    if value in [None, "", "null", "None"]:
        return None

    # Handle string preprocessing early
    if isinstance(value, str):
        value = value.strip()

    # Boolean conversion
    if expected_type == bool:
        try:
            if isinstance(value, str):
                if value.lower() in ["true", "1"]:
                    return True
                if value.lower() in ["false", "0"]:
                    return False
            elif isinstance(value, (int, bool)):
                return bool(value)
        except Exception:
            return value

    # Integer conversion
    if expected_type == int:
        try:
            return int(value)
        except (ValueError, TypeError):
            return value

    # Float conversion
    if expected_type == float:
        try:
            return float(value)
        except (ValueError, TypeError):
            return value

    # String conversion
    if expected_type == str:
        return str(value)

    # Date parsing
    if expected_type in ["date", "datetime"]:
        try:
            return date_parse(value)
        except (ValueError, TypeError):
            return value

    return value


def get_serializer(model_name, override_serializers={}):
    serializer_name = f"{model_name}Serializer"

    if override_serializers.get(model_name, None):
        return getattr(serializers, override_serializers[model_name])

    things = dir(serializers)

    if not serializer_name in things:
        raise ValidationError({"serializer": "Serializer Doesn't Exist!"})

    return getattr(serializers, serializer_name)


def get_model_import(model_name):
    url = f"{ settings.AUTH_HOST }accounts/models/{settings.MS_NAME}/{model_name}/"

    response = requests.get(url)

    if response.status_code == 200:
        return response.json()

    return {}


def get_microservice():
    url = f"{ settings.AUTH_HOST }accounts/microservices/{settings.MS_NAME}/"

    response = requests.get(url)

    if response.status_code == 200:
        return response.json()

    return {}


def get_model(model_id_or_name, microservice_id=None, microservice_name=None, access_token=None):
    base_url = f"{settings.AUTH_HOST}v1/models/{model_id_or_name}"
    params = {}
    headers = {}

    if access_token:
        headers["Authorization"] = access_token

    if microservice_id:
        params["microserviceId"] = microservice_id
    if microservice_name:
        params["microserviceName"] = microservice_name

    try:
        response = requests.get(base_url, params=params, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        # Optional: log error
        print(f"[get_model_from_node] Failed: {e}")
        return {}


def get_model_by_id(model_id, access_token):
    url = f"{ settings.AUTH_HOST }accounts/models/{model_id}/"

    response = requests.get(url, headers={
        "Authorization": access_token
    })

    if response.status_code == 200:
        return response.json()

    return {}


def create_importlog(payload, access_token):
    print(f"DEBUG: Attempting to create import log {id} at {settings.LOGGING_HOST}") # Added debug log
    resp = requests.post(f"{settings.LOGGING_HOST}import-logs/",
                         data=payload, headers={"Authorization": access_token})
    
    print(f"DEBUG: create import log response status: {resp.status_code}") # Added debug log
    
    if resp.ok:
        print(f"DEBUG: Successfully created import log {id}") # Added debug log
        return resp.json()

    print(f"DEBUG: Failed to create import log {id}. Status: {resp.status_code}, Response: {resp.text}") # Added debug log
    return {}


def update_importlog(id, payload, access_token):
    print(f"DEBUG: Attempting to update import log {id} at {settings.LOGGING_HOST}") # Added debug log
    try:
        resp = requests.patch(f"{settings.LOGGING_HOST}import-logs/{id}/",
                              data=payload, headers={"Authorization": access_token})
        print(f"DEBUG: Update import log response status: {resp.status_code}") # Added debug log

        if resp.ok:
            print(f"DEBUG: Successfully updated import log {id}") # Added debug log
            return resp.json()
        else:
            print(f"DEBUG: Failed to update import log {id}. Status: {resp.status_code}, Response: {resp.text}") # Added debug log

    except requests.exceptions.RequestException as e:
        print(f"DEBUG: Network error updating import log {id}: {e}") # Added debug log
    except Exception as e:
        print(f"DEBUG: Unexpected error updating import log {id}: {e}") # Added debug log

    return {}


@shared_task(name="import_")
def import_(log_report, model_name, csv_name, total_rows, records,
            client_id, user_id, fields_to_exclude,
            fields_to_exclude_by_model, override_serializers, request_dict):

    def log_failure(message, status='Failed', count=total_rows):
        update_importlog(log_report["id"], {
            "failed_count": count,
            "imported_count": 0,
            "imported": 0,
            "failed": json.dumps([{"error": message, "row_number": "N/A"}]),
            "finished_at": timezone.now(),
            "status": status,
        }, request_dict.get("user", {}).get("access_token"))

    try:
        model = apps.get_model('a_pm_rapi', model_name)
    except LookupError:
        return log_failure(f"Model '{model_name}' not found.")
    except Exception as e:
        return log_failure(f"Unexpected model lookup error: {str(e)}")

    if not records:
        return log_failure("No records provided in the CSV data.", count=0)

    try:
        serializer_class = get_serializer(model.__name__, override_serializers)
        serializer_fields = set(serializer_class().get_fields().keys())
        model_fields = {f.name: f for f in model._meta.get_fields() if hasattr(f, 'attname')}

        unknown_columns = [
            col for col in records[0].keys()
            if col not in model_fields and col not in serializer_fields and col != 'id'
        ]
        if unknown_columns:
            return log_failure(f"Invalid columns for model {model_name}: {unknown_columns}")

        serializer = serializer_class(data=records[0], context={"request": request_dict})
        serializer.is_valid(raise_exception=True)
    except ValidationError as e:
        return log_failure(f"Initial validation failed: {e.detail}")
    except Exception as e:
        return log_failure(f"Setup error: {str(e)}")

    created_objects, updated_objects, error_logs = [], [], []
    foreign_key_fields = {}

    try:
        for name, field in serializer.get_fields().items():
            if isinstance(field, PrimaryKeyRelatedField):
                foreign_key_fields[name] = field.queryset.model
    except Exception:
        pass

    excluded_fields = set(fields_to_exclude_by_model.get(model.__name__, []) or fields_to_exclude)
    excluded_fields.discard('id')

    bulk_to_create = []

    for index, row in enumerate(records, start=2):
        instance_data, errors = {}, []

        for key, val in row.items():
            if key in excluded_fields:
                continue

            if isinstance(val, str) and val.strip().lower() in ['null', 'none']:
                val = None

            if key not in model_fields:
                continue  # Skip serializer-only fields

            field_type = None
            try:
                f = model_fields.get(key)
                if isinstance(f, models.CharField): field_type = str
                if isinstance(f, models.TextField): field_type = str
                if isinstance(f, models.BooleanField): field_type = bool
                elif isinstance(f, models.IntegerField): field_type = int
                elif isinstance(f, models.FloatField): field_type = float
                elif isinstance(f, (models.DateField, models.DateTimeField)): field_type = 'datetime'
            except:
                pass

            try:
                if key in foreign_key_fields:
                    if val is None:
                        instance_data[key] = None
                    else:
                        related_model = foreign_key_fields[key]
                        related_obj = with_obj_lvl_get_object_or_404(related_model, request_dict, id=val)
                        instance_data[key] = related_obj
                else:
                    instance_data[key] = normalize_value(val, expected_type=field_type)
            except Exception as e:
                error_logs.append({"error": f"Invalid value for '{key}': {str(e)}", "row_number": index})
                instance_data = None
                break

        if not instance_data:
            continue

        try:
            obj = None
            if row.get("id"):
                try:
                    obj = with_obj_lvl_get_object_or_404(model, request_dict, id=row["id"])
                except (Http404, ValueError, TypeError):
                    obj = None

            instance_data.update({"client": client_id, "updated_by": user_id})

            if obj:
                for key, val in instance_data.items():
                    setattr(obj, key, val)
                obj.save()
                updated_objects.append(obj)
            else:
                instance_data["created_by"] = user_id
                instance_data["client"] = client_id
                bulk_to_create.append(model(**instance_data))

        except (ValidationError, IntegrityError) as e:
            error_logs.append({"error": str(e), "row_number": index})
        except Exception as e:
            error_logs.append({"error": f"Unexpected error: {e}", "row_number": index})

    if bulk_to_create:
        try:
            with transaction.atomic():
                created_objects.extend(model.objects.bulk_create(bulk_to_create, batch_size=100))
        except Exception as e:
            error_logs.append({"error": f"Bulk create failed: {e}", "row_number": "N/A"})

    final_status = "Completed"
    if error_logs:
        final_status = "Completed with errors"
    if not created_objects and not updated_objects:
        final_status = "Failed"

    update_importlog(log_report["id"], {
        "failed_count": len(error_logs),
        "imported_count": len(created_objects) + len(updated_objects),
        "created_count": len(created_objects),
        "updated_count": len(updated_objects),
        "failed": json.dumps(error_logs),
        "finished_at": timezone.now(),
        "status": final_status,
    }, request_dict.get("user", {}).get("access_token"))