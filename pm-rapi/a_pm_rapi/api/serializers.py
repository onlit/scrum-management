from typing import Any
from rest_framework import serializers
from a_pm_rapi.models import (
    Program,
    Project,
    HLR,
    Resource,
    SprintMeta,
    SprintMetaProject,
    Persona,
    Backlog,
    TaskStatus,
    TaskComment,
    Role,
    Task,
    AcceptanceTest,
    TaskResource,
    Stakeholder,
    BugArtifact,
    WorkingTime,
    WorkCode,
    Timesheet,
    TaskType,
    Bug,
    BugComment,
    SprintMetaBug,
    ProjectArtifact,
    HlrArtifact,
    BacklogArtifact,
    TestsConducted,
    TaskBacklog,
    Sprint,
    SprintTask,
    TaskBug,
    FeatureRequest,
    BugStatus,
    AcceptanceStatus,
    INA,
    acceptance_tests_status_choices,
    label_choices,
)
from django.utils.timesince import timesince
from a_pm_rapi.utils import (
    get_only_subtasks,
    get_all_foreign_fields,
    with_objs_lvl_permissions,
    validate_phone_number
)
from django.conf import settings
from django.forms.models import model_to_dict
from django.db.models import Q
from django.apps import apps
from datetime import timedelta
import pytz


class BaseSerializer(serializers.ModelSerializer):
    details = serializers.SerializerMethodField()

    def get_details(self, instance):
        foreign_key_fields = get_all_foreign_fields(self.Meta.model)

        return_data = {}

        for foreign_key_field in foreign_key_fields:
            foreign_key = getattr(instance, f"{foreign_key_field}", None)

            if not foreign_key:
                return_data[foreign_key_field] = {}
                continue

            fields = []
            ignore_fields = ["rrule"]

            ignored_fields = []

            for field in foreign_key._meta.fields:

                if not field.name in ignore_fields:
                    fields.append(field.name)
                else:
                    print("Ingoring Field")
                    ignored_fields.append(field)

            return_data[foreign_key_field] = model_to_dict(
                foreign_key,
                fields=fields,
            )

            for ignored_field in ignored_fields:
                return_data[foreign_key_field][str(ignored_field.name)] = str(
                    getattr(foreign_key, str(ignored_field.name), "")
                )

        return return_data

    def _apply_dynamic_readonly(self, fields):
        """
        Adjusts read-only status of selected fields based on context flags.
        """
        override_map = {
            "created_by_and_client_not_readonly": ["created_by", "client"],
            "id_not_readonly": ["id"],
        }

        for context_flag, field_names in override_map.items():
            if self.context.get(context_flag):
                for field in field_names:
                    if field in fields:
                        fields[field].read_only = False

    def get_fields(self, *args, **kwargs):
        fields = super().get_fields(*args, **kwargs)
        # Dynamically override read-only flags from Meta
        self._apply_dynamic_readonly(fields)
        return fields


class TaskTypeSerializer(BaseSerializer):
    class Meta:
        model = TaskType
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):

        super(TaskTypeSerializer, self).__init__(*args, **kwargs)

        self.fields["program"].queryset = with_objs_lvl_permissions(
            Program.objects.all(), self.context.get("request"))


class ResourceSerializer(BaseSerializer):
    mobile = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True,
        validators=[validate_phone_number]
    )

    landline = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True,
        validators=[validate_phone_number]
    )

    class Meta:
        model = Resource
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )


class RoleSerializer(BaseSerializer):
    class Meta:
        model = Role
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )


class ProgramSerializer(BaseSerializer):
    class Meta:
        model = Program
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )


class ProjectSerializer(BaseSerializer):
    display_value = serializers.SerializerMethodField()
    deadline = serializers.SerializerMethodField()
    rebase = serializers.BooleanField(
        default=False, required=False, write_only=True)
    generate = serializers.BooleanField(
        default=False, required=False, write_only=True)

    class Meta:
        model = Project
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def get_display_value(self, instance) -> str:
        return getattr(instance, "name", "")

    def to_representation(self, instance):
        ret = super().to_representation(instance)

        if 'display_value' in ret:
            ret['__displayValue'] = ret.pop('display_value')

        return ret

    def get_fields(self):
        fields = super().get_fields()

        if not self.context.get("detail_view"):
            fields.pop("generate", None)

        request = self.context.get("request")
        is_internal_anon = self.context.get("is_internal_anon", False)

        if "program" in fields and request and not is_internal_anon:
            fields["program"].queryset = with_objs_lvl_permissions(
                Program.objects.all(), request
            )

        if is_internal_anon:
            fields_to_unlock = ["created_by", "client"]

            for field_name in fields_to_unlock:
                if field_name in fields:
                    fields[field_name].read_only = False

        return fields

    def get_deadline(self, instance):
        task = instance.task_set.order_by("-deadline").first()
        return task.deadline if task else None


class HlrSerializer(BaseSerializer):
    project_detail = serializers.SerializerMethodField()

    class Meta:
        model = HLR
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def get_fields(self, *args, **kwargs):
        fields = super().get_fields(*args, **kwargs)
        # Restrict project queryset using object-level permissions
        request = self.context.get("request")

        if not self.context.get("is_request_internal"):
            fields["project"].queryset = with_objs_lvl_permissions(
                Project.objects.all(), request
            )

        return fields

    def get_project_detail(self, instance):
        project = instance.project
        return {
            "id": project.id if project else None,
            "name": project.name if project else "",
            "program": project.program.id if project and project.program else None,
        }


class SprintMetaSerializer(BaseSerializer):
    program = serializers.PrimaryKeyRelatedField(
        required=True, queryset=Program.objects.all())

    class Meta:
        model = SprintMeta
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )
        extra_kwargs = {'program': {'required': True}}

    def __init__(self, *args, **kwargs):

        super(SprintMetaSerializer, self).__init__(*args, **kwargs)

        self.fields["program"].queryset = with_objs_lvl_permissions(
            Program.objects.all(), self.context.get("request"))


class SprintMetaProjectSerializer(BaseSerializer):

    class Meta:
        model = SprintMetaProject
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):

        super(SprintMetaProjectSerializer, self).__init__(*args, **kwargs)

        self.fields["project"].queryset = with_objs_lvl_permissions(
            Project.objects.all(), self.context.get("request"))


class PersonaSerializer(BaseSerializer):
    class Meta:
        model = Persona
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def get_fields(self, *args, **kwargs):
        fields = super().get_fields(*args, **kwargs)
        # Restrict project queryset using object-level permissions
        request = self.context.get("request")

        if not self.context.get("is_request_internal"):
            fields["program"].queryset = with_objs_lvl_permissions(
                Program.objects.all(), request
            )

            fields["project"].queryset = with_objs_lvl_permissions(
                Project.objects.all(), request
            )

        return fields


class BaseBacklogSerializer(BaseSerializer):
    rebase_backlog_order = serializers.BooleanField(
        default=False, required=False, write_only=True)
    details = serializers.SerializerMethodField()
    project = serializers.SerializerMethodField()

    def get_fields(self, *args, **kwargs):
        fields = super().get_fields(*args, **kwargs)
        # Restrict project queryset using object-level permissions
        request = self.context.get("request")

        if not self.context.get("is_request_internal"):
            fields["as_a"].queryset = with_objs_lvl_permissions(
                Persona.objects.all(), request
            )

            fields["hlr"].queryset = with_objs_lvl_permissions(
                HLR.objects.all(), request
            )

        return fields

    def get_details(self, instance):
        return {
            "as_a": {
                "name": instance.as_a.name,
            },
            "hlr": {
                "name": instance.hlr.name,
                "description": instance.hlr.description,
                "project": instance.hlr.project.id,
            },
            "project": {
                "name": instance.hlr.project.name,
                "started": instance.hlr.project.started,
                "program": f"{instance.hlr.project.program.id}",
            },
        }

    def get_project(self, instance):
        return str(instance.hlr.project.id)


class BacklogSerializer(BaseBacklogSerializer):
    class Meta:
        model = Backlog
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )


class TaskStatusSerializer(BaseSerializer):
    rebase = serializers.BooleanField(
        write_only=True, required=False, default=False)
    full_order = serializers.SerializerMethodField()
    program_details = serializers.SerializerMethodField()

    class Meta:
        model = TaskStatus
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def get_fields(self, *args, **kwargs):
        fields = super().get_fields(*args, **kwargs)
        fields["parent"].queryset = with_objs_lvl_permissions(
            TaskStatus.objects.all(), self.context.get("request"))
        fields["program"].queryset = with_objs_lvl_permissions(
            Program.objects.all(), self.context.get("request"))
        if not self.context.get("detail_view"):
            fields.pop("program_details", None)

        return fields

    def get_program_details(self, instance):
        program = getattr(getattr(instance, "project"), "program")
        return {
            "id": program.id,
            **model_to_dict(program)
        } if program else {}

    def get_full_order(self, instance):
        full_order = instance.get_full_order()
        return str(full_order) + "." if full_order else ""


class BugStatusSerializer(BaseSerializer):
    class Meta:
        model = BugStatus
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )


class AcceptanceStatusSerializer(BaseSerializer):
    class Meta:
        model = AcceptanceStatus
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )


class TaskCommentSerializer(BaseSerializer):
    class Meta:
        model = TaskComment
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):

        super(TaskCommentSerializer, self).__init__(*args, **kwargs)

        self.fields["task"].queryset = with_objs_lvl_permissions(
            Task.objects.all(), self.context.get("request")
        )


class TaskSerializer(BaseSerializer):
    rebase_task_order = serializers.BooleanField(
        default=False, required=False, write_only=True)
    rebase = serializers.BooleanField(
        default=False, required=False, write_only=True)
    timezone = serializers.ChoiceField(
        choices=list(zip(pytz.all_timezones, pytz.all_timezones)),
        write_only=True,
        required=False
    )
    by = serializers.ChoiceField(
        choices=(("deadline", "deadline"), ("started", "started")),
        write_only=True,
        default="deadline"
    )

    program_details = serializers.SerializerMethodField()
    task_level = serializers.SerializerMethodField()
    sub_tasks = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_at",
            "updated_at",
            "status_assigned_date",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._set_queryset_fields()

        if self.context.get("detail_view"):
            self.fields["sprint_task_details"] = serializers.SerializerMethodField()

    def _set_queryset_fields(self):
        request = self.context.get("request")
        base_tasks = Task.objects.all()

        self.fields["project"].queryset = with_objs_lvl_permissions(
            Project.objects.all(), request)
        self.fields["owner"].queryset = with_objs_lvl_permissions(
            Resource.objects.all(), request)
        self.fields["status"].queryset = with_objs_lvl_permissions(
            TaskStatus.objects.all(), request)
        self.fields["task_type"].queryset = with_objs_lvl_permissions(
            TaskType.objects.all(), request)
        self.fields["parent_task"].queryset = with_objs_lvl_permissions(
            base_tasks, request)
        self.fields["dependency"].queryset = with_objs_lvl_permissions(
            base_tasks, request)
        self.fields["predecessor"].queryset = with_objs_lvl_permissions(
            base_tasks, request)

    def get_sprint_task_details(self, instance):
        sprint_task = SprintTask.objects.filter(task=instance).first()
        if not sprint_task or not sprint_task.sprint:
            return {}

        sprint_meta = sprint_task.sprint.sprint_meta
        return {
            "id": sprint_task.id,
            "sprint": {
                "id": sprint_task.sprint.id,
                "start_date": sprint_task.sprint.start_date,
                "end_date": sprint_task.sprint.end_date,
                "sprint_meta": {
                    "id": sprint_meta.id,
                    "program": sprint_meta.program.id,
                    "name": sprint_meta.name,
                    "started": sprint_meta.started,
                    "sprint_to_generate": sprint_meta.sprint_to_generate,
                    "days": sprint_meta.days,
                    "goal": sprint_meta.goal,
                    "method": sprint_meta.method,
                    "metrics": sprint_meta.metrics,
                } if sprint_meta else {}
            },
            "task": sprint_task.sprint.id,
        }

    def get_program_details(self, instance):
        program = getattr(getattr(instance, "project", None), "program", None)
        return {
            "id": program.id,
            **model_to_dict(program)
        } if program else {}

    def get_sub_tasks(self, instance):
        sub_tasks = get_only_subtasks(instance)
        duration_estimate_sec = 0
        duration_actual_sec = 0

        unit_map = {
            'weeks': 'weeks',
            'week': 'weeks',
            'days': 'days',
            'day': 'days',
            'hours': 'hours',
            'hour': 'hours',
            'minutes': 'minutes',
            'minute': 'minutes',
        }

        for task in sub_tasks:
            unit = (task.duration_unit or "").lower()
            mapped_unit = unit_map.get(unit)
            if not mapped_unit:
                continue

            estimate = task.duration_estimate or 0
            actual = task.duration_actual or 0

            # try:
            duration_estimate_sec += timedelta(**
                                               {mapped_unit: estimate}).total_seconds()
            duration_actual_sec += timedelta(**
                                             {mapped_unit: actual}).total_seconds()
            # except TypeError:
            #     continue  # skip invalid durations

        return {
            "has_sub_tasks": bool(sub_tasks),
            "count": len(sub_tasks),
            "duration_estimate": str(round(duration_estimate_sec / 3600, 2)),
            "duration_actual": str(round(duration_actual_sec / 3600, 2)),
            "duration_unit": "Hours",
        }

    def get_task_level(self, instance):
        level = instance.get_task_level()
        return f"{level}." if level else ""


class AcceptanceTestSerializer(BaseSerializer):
    class Meta:
        model = AcceptanceTest
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def get_fields(self, *args, **kwargs):
        fields = super().get_fields(*args, **kwargs)
        # Restrict project queryset using object-level permissions
        request = self.context.get("request")

        if not self.context.get("is_request_internal"):
            fields["backlog"].queryset = with_objs_lvl_permissions(
                Backlog.objects.all(), request
            )

        return fields


class TaskResourceSerializer(BaseSerializer):
    class Meta:
        model = TaskResource
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):

        super(TaskResourceSerializer, self).__init__(*args, **kwargs)

        self.fields["task"].queryset = with_objs_lvl_permissions(
            Task.objects.all(), self.context.get("request")
        )
        self.fields["resource"].queryset = with_objs_lvl_permissions(
            Resource.objects.all(), self.context.get("request")
        )


class StakeholderSerializer(BaseSerializer):
    class Meta:
        model = Stakeholder
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):

        super(StakeholderSerializer, self).__init__(*args, **kwargs)

        self.fields["project"].queryset = with_objs_lvl_permissions(
            Project.objects.all(), self.context.get("request")
        )
        self.fields["role"].queryset = with_objs_lvl_permissions(
            Role.objects.all(), self.context.get("request")
        )


class ProjectArtifactSerializer(BaseSerializer):
    class Meta:
        model = ProjectArtifact
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):

        super(ProjectArtifactSerializer, self).__init__(*args, **kwargs)

        self.fields["project"].queryset = with_objs_lvl_permissions(
            Project.objects.all(), self.context.get("request")
        )


class HlrArtifactSerializer(BaseSerializer):
    class Meta:
        model = HlrArtifact
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):

        super(HlrArtifactSerializer, self).__init__(*args, **kwargs)

        self.fields["hlr"].queryset = with_objs_lvl_permissions(
            HLR.objects.all(), self.context.get("request")
        )


class BacklogArtifactSerializer(BaseSerializer):
    class Meta:
        model = BacklogArtifact
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):

        super(BacklogArtifactSerializer, self).__init__(*args, **kwargs)

        self.fields["backlog"].queryset = with_objs_lvl_permissions(
            Backlog.objects.all(), self.context.get("request")
        )


class BugArtifactSerializer(BaseSerializer):
    class Meta:
        model = BugArtifact
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):

        super(BugArtifactSerializer, self).__init__(*args, **kwargs)

        self.fields["bug"].queryset = with_objs_lvl_permissions(
            Bug.objects.all(), self.context.get("request")
        )


class WorkingTimeSerializer(BaseSerializer):
    class Meta:
        model = WorkingTime
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):

        super(WorkingTimeSerializer, self).__init__(*args, **kwargs)

        self.fields["project"].queryset = with_objs_lvl_permissions(
            Project.objects.all(), self.context.get("request")
        )


class WorkCodeSerializer(BaseSerializer):
    class Meta:
        model = WorkCode
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )


class TimesheetSerializer(BaseSerializer):
    class Meta:
        model = Timesheet
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):

        super(TimesheetSerializer, self).__init__(*args, **kwargs)

        self.fields["task"].queryset = with_objs_lvl_permissions(
            Task.objects.all(), self.context.get("request")
        )
        self.fields["resource"].queryset = with_objs_lvl_permissions(
            Resource.objects.all(), self.context.get("request")
        )
        self.fields["workcode"].queryset = with_objs_lvl_permissions(
            WorkCode.objects.all(), self.context.get("request")
        )


class BugSerializer(BaseSerializer):
    program_details = serializers.SerializerMethodField()

    class Meta:
        model = Bug
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
            "status_assigned_date",
        )

    def get_program_details(self, instance):
        return {
            "id": instance.project.program.id,
            **model_to_dict(instance.project.program),
        } if instance.project else {}

    def __init__(self, *args, **kwargs):

        super(BugSerializer, self).__init__(*args, **kwargs)

        query_set = Project.objects.all() if self.context.get(
            "request") else Project.objects.none()

        self.fields["signed_off"].queryset = with_objs_lvl_permissions(Resource.objects.all(
        ), self.context.get("request")) if self.context.get("request") else Resource.objects.none()
        self.fields["resource"].queryset = with_objs_lvl_permissions(Resource.objects.all(
        ), self.context.get("request")) if self.context.get("request") else Resource.objects.none()
        self.fields["project"].queryset = (with_objs_lvl_permissions(query_set, self.context.get("request")) | query_set.filter(
            client=settings.PULLSTREAM_CLIENT_ID, beta_partners=True)).distinct() if self.context.get("request") else query_set

    def validate_labels(self, value):
        """Validate that labels is a list of valid label choices."""
        if value is None:
            return value

        if not isinstance(value, list):
            raise serializers.ValidationError("Labels must be a list.")

        valid_labels = [choice[0] for choice in label_choices]
        invalid = [label for label in value if label not in valid_labels]

        if invalid:
            raise serializers.ValidationError(
                f"Invalid labels: {invalid}. Valid options are: {valid_labels}"
            )

        return value


class BugCommentSerializer(BaseSerializer):
    class Meta:
        model = BugComment
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):

        super(BugCommentSerializer, self).__init__(*args, **kwargs)

        self.fields["bug"].queryset = with_objs_lvl_permissions(
            Bug.objects.all(), self.context.get("request")
        )


class SprintMetaBugSerializer(BaseSerializer):
    class Meta:
        model = SprintMetaBug
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):

        super(SprintMetaBugSerializer, self).__init__(*args, **kwargs)

        self.fields["sprint"].queryset = with_objs_lvl_permissions(
            SprintMeta.objects.all(), self.context.get("request")
        )
        self.fields["bug"].queryset = with_objs_lvl_permissions(
            Bug.objects.all(), self.context.get("request")
        )


class TestsConductedSerializer(BaseSerializer):
    # date_tested = serializers.CharField()
    tested_by_details = serializers.SerializerMethodField()

    class Meta:
        model = TestsConducted
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):

        super(TestsConductedSerializer, self).__init__(*args, **kwargs)

        self.fields["acceptance_criteria"].queryset = with_objs_lvl_permissions(
            AcceptanceTest.objects.all(), self.context.get("request")
        )

    def get_tested_by_details(self, instance):
        resource = Resource.objects.filter(id=instance.tested_by)

        if not resource:
            return {}
        else:
            return resource.values()[0]


class TaskBacklogSerializer(BaseSerializer):
    backlog_as_a_details = serializers.SerializerMethodField()
    task_owner_details = serializers.SerializerMethodField()

    class Meta:
        model = TaskBacklog
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):

        super(TaskBacklogSerializer, self).__init__(*args, **kwargs)

        self.fields["task"].queryset = with_objs_lvl_permissions(
            Task.objects.all(), self.context.get("request")
        )
        self.fields["backlog"].queryset = with_objs_lvl_permissions(
            Backlog.objects.all(), self.context.get("request")
        )

    def get_backlog_as_a_details(self, instance):
        return Persona.objects.filter(id=instance.backlog.as_a_id).values()[0]

    def get_task_owner_details(self, instance):
        return Resource.objects.filter(id=instance.task.owner_id).values()[0] if instance.task.owner_id else {}


class SprintSerializer(BaseSerializer):
    class Meta:
        model = Sprint
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):

        super(SprintSerializer, self).__init__(*args, **kwargs)

        self.fields["sprint_meta"].queryset = with_objs_lvl_permissions(
            SprintMeta.objects.all(), self.context.get("request")
        )


class SprintTaskSerializer(BaseSerializer):
    task_owner_details = serializers.SerializerMethodField()
    task_status_details = serializers.SerializerMethodField()

    class Meta:
        model = SprintTask
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):

        super(SprintTaskSerializer, self).__init__(*args, **kwargs)

        self.fields["task"].queryset = with_objs_lvl_permissions(
            Task.objects.all(), self.context.get("request")
        )
        self.fields["sprint"].queryset = with_objs_lvl_permissions(
            Sprint.objects.all(), self.context.get("request")
        )

    def get_task_owner_details(self, instance):
        return Resource.objects.filter(id=instance.task.owner_id).values()[0] if instance.task.owner_id else {}

    def get_task_status_details(self, instance):
        return {
            "id": instance.task.status.id,
            **model_to_dict(instance.task.status),
        } if instance.task and instance.task.status else {}


class TaskBugSerializer(BaseSerializer):
    task_project_details = serializers.SerializerMethodField()

    class Meta:
        model = TaskBug
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):

        super(TaskBugSerializer, self).__init__(*args, **kwargs)

        self.fields["task"].queryset = with_objs_lvl_permissions(
            Task.objects.all(), self.context.get("request")
        )
        self.fields["bug"].queryset = with_objs_lvl_permissions(
            Bug.objects.all(), self.context.get("request")
        )

    def get_task_project_details(self, instance):
        return Project.objects.filter(id=instance.task.project.id).values()[0] if instance.task and instance.task.project else {}


class FeatureRequestSerializer(BaseSerializer):
    class Meta:
        model = FeatureRequest
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def __init__(self, *args, **kwargs):

        super(FeatureRequestSerializer, self).__init__(*args, **kwargs)

        query_set = Project.objects.all() if self.context.get(
            "request") else Project.objects.none()

        self.fields["project"].queryset = (with_objs_lvl_permissions(query_set, self.context.get("request")) | query_set.filter(
            client=settings.PULLSTREAM_CLIENT_ID, beta_partners=True)).distinct() if self.context.get("request") else query_set


class AcceptanceTestUpdateSerializer(serializers.Serializer):
    project = serializers.UUIDField()
    backlog = serializers.UUIDField(required=False)
    name = serializers.CharField(max_length=150, required=False)
    given = serializers.CharField(max_length=1000, required=False)
    when = serializers.CharField(max_length=1000, required=False)
    then = serializers.CharField(max_length=1000, required=False)
    criteria = serializers.CharField(max_length=1000, required=False)
    status = serializers.ChoiceField(
        choices=acceptance_tests_status_choices, required=False
    )
    # status = serializers.UUIDField(required=False)


class INASerializer(BaseSerializer):

    ''' description of class '''
    link = serializers.CharField(
        required=False, write_only=True)
    create_calendar_entry = serializers.BooleanField(
        required=False, write_only=True)
    reminder_name = serializers.CharField(required=False, write_only=True)
    reminder_description = serializers.CharField(
        required=False, write_only=True)
    reminder_timezone = serializers.CharField(required=False, write_only=True)
    calendar = serializers.UUIDField(
        required=False, allow_null=True, write_only=True)

    class Meta:
        model = INA
        fields = "__all__"
        read_only_fields = ("event", "updated_by", "id", "created_by",
                            "human_friendly_datetimes", "client", "state", "model")


class DeleteAllSerializer(serializers.Serializer):
    model = serializers.ChoiceField(
        choices=tuple([(model.__name__, model.__name__)
                      for model in apps.get_models()])
    )


class MultipleActionSerializer(serializers.Serializer):
    model = serializers.ChoiceField(
        choices=tuple([(model.__name__, model.__name__)
                      for model in apps.get_models()])
    )
    records = serializers.ListField()
    fields = serializers.DictField()
    action = serializers.ChoiceField(
        choices=(
            ("Create", "Create"),
            ("Update", "Update"),
            ("Delete", "Delete"),
        )
    )
    lookup_field = serializers.CharField(max_length=120, default="id")


class ImportSerializer(serializers.Serializer):
    file = serializers.FileField()


class BulkHLRsSerializer(serializers.Serializer):
    hlrs = serializers.ListField(child=HlrSerializer())

    def get_fields(self, *args, **kwargs):
        fields = super().get_fields(*args, **kwargs)

        # Ensure merged context is passed properly to child serializer
        hlr_context = {
            **self.context,
            "created_by_and_client_not_readonly": True,
            "id_not_readonly": True,
        }

        # Set the child serializer with the updated context
        fields["hlrs"].child = HlrSerializer(context=hlr_context)

        return fields


class BacklogWithUATsSerializer(BaseBacklogSerializer):
    uats = serializers.ListField(child=AcceptanceTestSerializer())

    class Meta:
        model = Backlog
        fields = "__all__"
        read_only_fields = (
            "is_deleted",
            "deleted_at",
            "updated_by",
            "id",
            "_template",
            "created_by",
            "client",
            "created_at",
            "updated_at",
        )

    def get_fields(self, *args, **kwargs):
        fields = super().get_fields(*args, **kwargs)

        uat_context = {
            **self.context,
            "created_by_and_client_not_readonly": True,
            "id_not_readonly": True,
        }

        fields["uats"].child = AcceptanceTestSerializer(context=uat_context)

        return fields


class BulkBacklogsSerializer(serializers.Serializer):
    backlogs = serializers.ListField(child=BacklogWithUATsSerializer())

    def get_fields(self, *args, **kwargs):
        fields = super().get_fields(*args, **kwargs)

        # Merge context for the child serializer
        backlog_context = {
            **self.context,
            "created_by_and_client_not_readonly": True,
            "id_not_readonly": True,
        }

        child = BacklogWithUATsSerializer(context=backlog_context)

        # Override the `as_a` field to be a string
        if "as_a" in child.fields:
            child.fields["as_a"] = serializers.CharField()

        fields["backlogs"].child = child
        return fields


class BulkUATsSerializer(serializers.Serializer):
    uats = serializers.ListField(child=AcceptanceTestSerializer())

    def get_fields(self, *args, **kwargs):
        fields = super().get_fields(*args, **kwargs)

        # Ensure merged context is passed properly to child serializer
        uat_context = {
            **self.context,
            "created_by_and_client_not_readonly": True,
            "id_not_readonly": True,
        }

        # Set the child serializer with the updated context
        fields["uats"].child = AcceptanceTestSerializer(context=uat_context)

        return fields


class BulkPersonaSerializer(serializers.Serializer):
    personas = serializers.ListField(child=PersonaSerializer())

    def get_fields(self, *args, **kwargs):
        fields = super().get_fields(*args, **kwargs)

        # Ensure merged context is passed properly to child serializer
        persona_context = {
            **self.context,
            "created_by_and_client_not_readonly": True,
        }

        # Set the child serializer with the updated context
        fields["personas"].child = PersonaSerializer(context=persona_context)

        return fields


class BulkDetailsChildSerializer(serializers.Serializer):
    field_name = serializers.CharField()
    get_path = serializers.CharField(required=False, allow_blank=True)
    set_path = serializers.CharField(required=False, allow_blank=True)
    inner_field = serializers.BooleanField(required=False)
    model = serializers.CharField()
    ids = serializers.ListField(
        child=serializers.UUIDField(), allow_empty=True)


class BulkDetailsSerializer(serializers.Serializer):
    data = serializers.ListField(
        child=BulkDetailsChildSerializer(), allow_empty=True)


class BulkDuplicateSerializer(serializers.Serializer):
    model = serializers.CharField()
    ids = serializers.ListField(child=serializers.UUIDField())


class BulkDeleteTaskSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.UUIDField())


class CloneTaskSerializer(serializers.Serializer):
    name = serializers.CharField()
    order = serializers.IntegerField()
    rebase = serializers.BooleanField(default=False)
    clone_sub_tasks = serializers.BooleanField(default=True)


class DuplicateBacklogsSerializer(serializers.Serializer):
    ids = serializers.PrimaryKeyRelatedField(
        queryset=Backlog.objects.all(), many=True)
    new_hlr = serializers.PrimaryKeyRelatedField(queryset=HLR.objects.all())

    def __init__(self, *args, **kwargs):

        super(DuplicateBacklogsSerializer, self).__init__(*args, **kwargs)

        self.fields["ids"].queryset = with_objs_lvl_permissions(
            Backlog.objects.all(), self.context.get("request")
        )

        self.fields["new_hlr"].queryset = with_objs_lvl_permissions(
            HLR.objects.all(), self.context.get("request")
        )


class CloneSystemTemplateSerializer(serializers.Serializer):
    template_id = serializers.UUIDField()
    custom_params = serializers.DictField(allow_empty=True, required=False)


class BulkCreateSprintTaskSerializer(serializers.Serializer):
    tasks = serializers.PrimaryKeyRelatedField(
        queryset=Task.objects.all(), many=True)

    def __init__(self, *args, **kwargs):

        super(BulkCreateSprintTaskSerializer, self).__init__(*args, **kwargs)

        self.fields["tasks"].queryset = with_objs_lvl_permissions(
            Task.objects.filter(
                project_id__in=self.context.get("projects", [])
            ), self.context.get("request")
        )


class BulkCreateSprintBugSerializer(serializers.Serializer):
    sprint = serializers.PrimaryKeyRelatedField(queryset=Sprint.objects.all())
    bugs = serializers.PrimaryKeyRelatedField(
        queryset=Bug.objects.all(), many=True)

    def __init__(self, *args, **kwargs):

        super(BulkCreateSprintBugSerializer, self).__init__(*args, **kwargs)

        self.fields["sprint"].queryset = with_objs_lvl_permissions(
            Sprint.objects.all(), self.context.get("request")
        )

        bugs_qs = Bug.objects.all()
        bugs = with_objs_lvl_permissions(bugs_qs, self.context.get("request"))

        if self.context.get("client") == settings.PULLSTREAM_CLIENT_ID:
            bugs |= bugs_qs.exclude(client=self.context.get("client"))
            bugs = bugs.distinct()

        self.fields["bugs"].queryset = bugs


class BulkBugsSerializer(serializers.Serializer):
    program_id = serializers.UUIDField()
    project_id = serializers.UUIDField()
    bugs = serializers.ListField(child=BugSerializer())

    def validate(self, data):
        program_id = data.get("program_id")
        project_id = data.get("project_id")
        
        # Validate that program exists and belongs to Pullstream client
        try:
            program = Program.objects.get(id=program_id)
            if not program.client or str(program.client) != settings.PULLSTREAM_CLIENT_ID:
                raise serializers.ValidationError({
                    "program_id": "Program must belong to Pullstream client."
                })
        except Program.DoesNotExist:
            raise serializers.ValidationError({
                "program_id": "Program not found."
            })
        
        # Validate that project exists, belongs to the program, and belongs to Pullstream client
        try:
            project = Project.objects.get(id=project_id)
            if project.program_id != program_id:
                raise serializers.ValidationError({
                    "project_id": "Project does not belong to the specified program."
                })
            if not project.client or str(project.client) != settings.PULLSTREAM_CLIENT_ID:
                raise serializers.ValidationError({
                    "project_id": "Project must belong to Pullstream client."
                })
        except Project.DoesNotExist:
            raise serializers.ValidationError({
                "project_id": "Project not found."
            })
        
        return data

    def get_fields(self, *args, **kwargs):
        fields = super().get_fields(*args, **kwargs)

        # Ensure merged context is passed properly to child serializer
        bug_context = {
            **self.context,
            "created_by_and_client_not_readonly": True,
            "id_not_readonly": True,
        }

        # Set the child serializer with the updated context
        bug_serializer = BugSerializer(context=bug_context)
        # Remove project field since it's set from project_id in bulk serializer
        bug_serializer.fields.pop("project", None)
        fields["bugs"].child = bug_serializer

        return fields


class BulkConnectTasksToSprintSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.UUIDField(), default=[
    ], allow_empty=True, required=False)
    all_ = serializers.BooleanField(default=False, required=False)
    exclude = serializers.ListField(child=serializers.UUIDField(), default=[
    ], allow_empty=True, required=False)
    project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.all())
    sprint = serializers.PrimaryKeyRelatedField(queryset=Sprint.objects.all())
    filters = serializers.DictField(
        default={}, allow_null=True, required=False)
    search_query = serializers.CharField(
        allow_blank=True, allow_null=True, required=False)

    def __init__(self, *args, **kwargs):

        super(BulkConnectTasksToSprintSerializer,
              self).__init__(*args, **kwargs)

        self.fields["project"].queryset = with_objs_lvl_permissions(
            Project.objects.all(), self.context.get("request")
        )
        self.fields["sprint"].queryset = with_objs_lvl_permissions(
            Sprint.objects.all(), self.context.get("request")
        )
