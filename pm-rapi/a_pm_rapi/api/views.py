from django.db.utils import IntegrityError
from datetime import datetime
import csv
from .permissions import AllowInternalOrMustBeAuthenticatedPermission
from .serializers import (
    BulkHLRsSerializer,
    BulkDeleteTaskSerializer,
    DuplicateBacklogsSerializer,
    CloneTaskSerializer,
    BulkConnectTasksToSprintSerializer,
    CloneSystemTemplateSerializer,
    SprintMetaProjectSerializer,
    ProgramSerializer,
    ProjectSerializer,
    HlrSerializer,
    SprintMeta,
    SprintMetaSerializer,
    PersonaSerializer,
    BacklogSerializer,
    TaskStatusSerializer,
    BugStatusSerializer,
    ResourceSerializer,
    RoleSerializer,
    TaskSerializer,
    TaskCommentSerializer,
    AcceptanceTestSerializer,
    TaskResourceSerializer,
    StakeholderSerializer,
    BugArtifactSerializer,
    WorkingTimeSerializer,
    WorkCodeSerializer,
    TimesheetSerializer,
    ProjectArtifactSerializer,
    HlrArtifactSerializer,
    BacklogArtifactSerializer,
    TaskTypeSerializer,
    BugSerializer,
    BugCommentSerializer,
    SprintMetaBugSerializer,
    TaskBacklogSerializer,
    TestsConductedSerializer,
    SprintTaskSerializer,
    TaskBugSerializer,
    SprintSerializer,
    FeatureRequestSerializer,
    AcceptanceTestUpdateSerializer,
    DeleteAllSerializer,
    MultipleActionSerializer,
    AcceptanceStatusSerializer,
    INASerializer,
    ImportSerializer,
    BulkDetailsSerializer,
    BulkDuplicateSerializer,
    BulkCreateSprintTaskSerializer,
    BulkCreateSprintBugSerializer,
    BulkBacklogsSerializer,
    BulkUATsSerializer,
    BulkPersonaSerializer,
    BulkBugsSerializer
)
from django.db.models import Q, Prefetch
from .base import (
    ListCreateAPIView,
    RetrieveUpdateDestroyAPIView,
)
from a_pm_rapi.models import (
    status_choices,
    SprintMetaProject,
    Program,
    Project,
    HLR,
    Resource,
    SprintMeta,
    Persona,
    Backlog,
    TaskStatus,
    BugStatus,
    Role,
    Task,
    TaskComment,
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
    acceptance_tests_status_choices,
    FeatureRequest,
    AcceptanceStatus,
    INA
)
from django.shortcuts import get_object_or_404
from .filters import DjangoFilterBackend, BugFilterset, TaskFilterset, CustomSearchFilter
from rest_framework.filters import OrderingFilter, SearchFilter
from django.http import HttpResponse
from django.conf import settings
from a_pm_rapi.utils import (
    upload_new_file,
    get_file_by_name,
    update_new_file,
    validation_for_multple_action,
    run_multiple_actions,
    bulk_duplicate_object,
    with_objs_lvl_permissions,  # 1
    with_obj_lvl_get_object_or_404,  # 3
    with_obj_lvl_perform_update,  # 4
    serializer_uuid_field_details,
    get_obj_lvl_filters,
    create_rebase_conflict_tasks_csv,
    find_workflow_and_trigger,
    is_request_internal
)
from rest_framework.views import Response, status, APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import serializers
from django.contrib.contenttypes.models import ContentType
from rest_framework import exceptions
from django.apps import apps
from django.utils import timezone
from datetime import timedelta
from django.forms.models import model_to_dict
from django.utils.dateparse import parse_date
from a_pm_rapi.api.utils import (
    get_model, get_serializer, import_, create_calendar_event, bulk_create_stages_in_bpa, clone_model, rebase_the_project_dates, rebase_tasks_order,
    create_importlog, get_microservice, duplicate_project, create_task_in_bpa, repeated_task_creator, get_template, get_all_tasks, rebase_the_task_dates,
    rebase_backlogs_order, duplicate_task, rebase_task_status, duplicate_backlog
)
from a_pm_rapi.permissions import ImportPermission, IsTemplateAdminPermission, LMSStudentPermission
import pandas as pd
import numpy as np
from pandas.errors import ParserError
from django.http import Http404
from a_pm_rapi.api.tasks import send_ina_email
from rest_framework import exceptions
from django.db import transaction
from uuid import UUID
import json
import os
import redis
from django.db import connection


class LivenessProbeHealthCheckAPIView(APIView):
    """
    Simple health check to verify that the application process is running
    and responsive. Does not check for external dependencies.
    Corresponds to the /api/healthz endpoint.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, format=None):
        return Response({"status": "OK"}, status=status.HTTP_200_OK)


class ReadinessProbeHealthCheckAPIView(APIView):
    """
    Checks the status of all critical dependencies (e.g., Database, Redis).
    If any dependency is unavailable, it returns a 503 Service Unavailable.
    Corresponds to the /api/health endpoint.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    # Define a shared timeout for checks to ensure the total is less than
    # the Kubernetes probe's timeoutSeconds.
    CHECK_TIMEOUT_SECONDS = 2

    def get(self, request, format=None):
        try:
            # 1. Check the database connection
            # We use a very lightweight query to ensure the connection is alive.
            # This tests the connection pool, authentication, and basic query execution.
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")

            # 2. Check the Redis connection
            # The PING command is the standard way to check if a Redis server
            # is responsive.
            redis_url = getattr(settings, "REDIS_URL", os.getenv("REDIS_URL"))
            if not redis_url:
                raise Exception("REDIS_URL is not configured.")

            # The redis-py client has a built-in timeout for the connection.
            r = redis.from_url(
                redis_url,
                socket_connect_timeout=self.CHECK_TIMEOUT_SECONDS,
                socket_timeout=self.CHECK_TIMEOUT_SECONDS
            )
            if not r.ping():
                raise ConnectionError("Redis server did not respond to PING.")

            # Add other checks for critical services here...

        except Exception as e:
            # If any check fails, we catch the exception and return a 503 response.
            # The 'reason' helps with debugging the failing component.
            return Response(
                {
                    # Answer: A clear, machine-readable status.
                    "status": "UNAVAILABLE",
                    "reason": str(e)
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        # If all checks pass, return a 200 OK.
        return Response({"status": "OK"}, status=status.HTTP_200_OK)
    

class ProgramListCreateAPIView(ListCreateAPIView):
    serializer_class = ProgramSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "name",
        "description",
    ]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        if Program.objects.filter(name=serializer.validated_data.get("name"), client=self.request.user.client.get("id")).exists():
            raise serializers.ValidationError({"name": "Name must be unique!"})

        serializer.save(**vdata)

    def get_queryset(self):

        qfilter = {}

        program_without_task_status = self.request.GET.get(
            "program_without_task_status", None
        )
        program_with_task_status = self.request.GET.get(
            "program_with_task_status", None
        )

        if program_without_task_status:
            qfilter["task_status_program__id"] = None

        if program_with_task_status:
            qfilter["task_status_program__isnull"] = False

        query_set = Program.objects.filter(**qfilter)

        if self.request.GET.get("beta_partners"):
            return (with_objs_lvl_permissions(query_set, self.request) | query_set.filter(client=settings.PULLSTREAM_CLIENT_ID, project__beta_partners=True)).distinct()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(ProgramListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id
        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class ProgramRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = ProgramSerializer

    def perform_update(self, serializer):
        instance = self.get_object()

        if instance.name == "me":
            raise serializers.ValidationError(
                {"program": "You can't update this program."})

        if Program.objects.filter(name=serializer.validated_data.get("name", instance.name), client=self.request.user.client.get("id")).exclude(id=instance.id).exists():
            raise serializers.ValidationError({"name": "Name must be unique!"})

        with_obj_lvl_perform_update(self, serializer)

    def perform_destroy(self, instance):

        if instance.name == "me":
            raise serializers.ValidationError(
                {"program": "You can't delete this program."})

        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(Program, self.request, **data)

    def get_serializer_context(self):

        context = super(
            ProgramRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class ProjectListCreateAPIView(ListCreateAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [AllowInternalOrMustBeAuthenticatedPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "name",
        "description",
    ]

    def get_queryset(self):

        query_set = Project.objects.all()

        if self.request.GET.get("beta_partners"):
            return (with_objs_lvl_permissions(query_set.prefetch_related("task_set"), self.request) | query_set.filter(client=settings.PULLSTREAM_CLIENT_ID, beta_partners=True)).distinct()

        return with_objs_lvl_permissions(query_set.prefetch_related("task_set"), self.request)

    def perform_create(self, serializer):
        is_internal_anon = self.request.method == "POST" and is_request_internal(self.request) and not self.request.user.is_authenticated

        vdata = {}

        created_by = serializer.validated_data.pop("created_by", None)
        client = serializer.validated_data.pop("client", None)

        if is_internal_anon:
            if not created_by:
                raise exceptions.ValidationError({"created_by": "Created By Field Is Required!"})

            if not client:
                raise exceptions.ValidationError({"client": "Client Field Is Required!"})

            vdata["created_by"] = created_by
            vdata["client"] = client
        else:
            vdata["created_by"] = self.request.user.id

            if self.request.user.client:
                vdata["client"] = self.request.user.client.get("id")

        if (
            not serializer.validated_data.get("program")
        ):
            raise exceptions.ValidationError(
                exceptions._get_error_details(
                    {"program": "Program Field Is Required!"})
            )

        if Project.objects.filter(name=serializer.validated_data.get("name"), program=serializer.validated_data.get("program"), client=self.request.user.client.get("id")).exists():
            raise serializers.ValidationError({"name": "Name must be unique!"})
        
        serializer.validated_data.pop("rebase", False)

        serializer.save(**vdata)

    def get_serializer_context(self):

        context = super(ProjectListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request
        context["is_internal_anon"] = self.request.method == "POST" and is_request_internal(self.request) and not self.request.user.is_authenticated

        return context


class ProjectRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectSerializer

    def perform_update(self, serializer):
        instance = self.get_object()

        serializer.validated_data.pop("created_by", None)
        serializer.validated_data.pop("client", None)

        generate = serializer.validated_data.pop("generate", False)
        rebase = serializer.validated_data.pop("rebase", False)
        started = serializer.validated_data.get("started", instance.started)
        program = serializer.validated_data.get("program", instance.program)
        client_id = self.request.user.client.get("id") if self.request.user.client else None

        if instance.name == "me" and instance.program.name == "me":
            raise serializers.ValidationError(
                {"project": "You can't update this project."})

        if program:
            project_filter = Project.objects.filter(
                name=serializer.validated_data.get("name", instance.name),
                program=program
            )
            if client_id is not None:
                project_filter = project_filter.filter(client=client_id)
            if project_filter.exclude(id=instance.id).exists():
                raise serializers.ValidationError({"name": "Name must be unique!"})
        
        conflict_tasks = Task.objects.filter(project=instance)
        if started is not None:
            conflict_tasks = conflict_tasks.filter(started__lt=started)
        if client_id is not None:
            conflict_tasks = conflict_tasks.filter(client=client_id)

        if started and not rebase and conflict_tasks:            
            raise serializers.ValidationError({
                "error_code": "Can't Rebase In Past",
                "conflicted_tasks_csv_file" : create_rebase_conflict_tasks_csv(self.request, conflict_tasks), 
                "started": "Started date must be less then task started date!",
            })

        new_project = serializer.save(updated_by=self.request.user.id)

        if rebase and started:
            rebase_the_project_dates(new_project, new_project.started - instance.started)
            
        if generate:
            find_workflow_and_trigger(new_project, str(new_project.__class__.__name__), client_id, {}, self.request.user.access_token)

    def perform_destroy(self, instance):

        if instance.name == "me" and instance.program.name == "me":
            raise serializers.ValidationError(
                {"project": "You can't delete this project."})

        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(Project, self.request, **data)

    def get_serializer_context(self):

        context = super(
            ProjectRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request
        context["detail_view"] = True

        return context


class HlrListCreateAPIView(ListCreateAPIView):
    serializer_class = HlrSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_fields = [
        "name",
        "description",
        "project",
        "project__program",
    ]
    ordering_fields = "__all__"
    search_fields = [
        "name",
        "description",
        "project__name",
    ]

    def get_queryset(self):

        query_set = HLR.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_serializer_context(self):

        context = super(HlrListCreateAPIView, self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class HlrRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = HlrSerializer

    def perform_update(self, serializer):
        with_obj_lvl_perform_update(self, serializer)

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(HLR, self.request, **data)

    def get_serializer_context(self):

        context = super(HlrRetrieveUpdateDestroyAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class SprintMetaListCreateAPIView(ListCreateAPIView):
    serializer_class = SprintMetaSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "name",
        "goal",
        "method",
        "metrics",
    ]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_queryset(self):
        project = self.request.GET.get("project", None)
        qfilter = {}

        if project:
            qfilter["sprintmetaproject__project_id"] = project

        query_set = SprintMeta.objects.filter(**qfilter)

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(SprintMetaListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class SprintMetaRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = SprintMetaSerializer

    def perform_update(self, serializer):
        before_instance = self.get_object()

        if serializer.validated_data.get("sprint_to_generate"):
            before_updation = self.get_object()
            current_sprints = Sprint.objects.filter(
                sprint_meta=before_updation
            ).order_by("-start_date")
            sprints_to_generate = serializer.validated_data["sprint_to_generate"]

            if sprints_to_generate < current_sprints.count():
                raise serializers.ValidationError(
                    {
                        "sprint": "Can't Update Because # Sprints is less then current sprints count."
                    }
                )

        instance = serializer.save(updated_by=self.request.user.id)
        difference = instance.started.date() - before_instance.started.date()

        if not instance.started.date() == before_instance.started.date():
            for sprint in Sprint.objects.filter(sprint_meta=instance, start_date__isnull=False, end_date__isnull=False):
                sprint.start_date = sprint.start_date + difference
                sprint.end_date = sprint.end_date + difference
                sprint.save()


    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(SprintMeta, self.request, **data)

    def get_serializer_context(self):

        context = super(
            SprintMetaRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class SprintMetaProjectListCreateAPIView(ListCreateAPIView):
    serializer_class = SprintMetaProjectSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "project__name",
        "project__description",
    ]

    def perform_create(self, serializer):

        project = serializer.validated_data.get("project", None)

        # if project and SprintMetaProject.objects.filter(
        #     project = project,
        #     client = self.request.user.client.get("id"),
        # ).exists():
        #     raise serializers.ValidationError({
        #         "project" : "One project can only belong to one sprint meta!"
        #     })

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_queryset(self):

        query_set = SprintMetaProject.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(SprintMetaProjectListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class SprintMetaProjectRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = SprintMetaProjectSerializer

    def perform_update(self, serializer):
        instance = self.get_object()

        project = serializer.validated_data.get("project", instance.project)

        if project and SprintMetaProject.objects.filter(
            project = project,
            client = self.request.user.client.get("id"),
        ).exclude(id=instance.id).exists():
            raise serializers.ValidationError({
                "project" : "One project can only belong to one sprint meta!"
            })

        serializer.save(updated_by=self.request.user.id)

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(SprintMetaProject, self.request, **data)

    def get_serializer_context(self):

        context = super(
            SprintMetaProjectRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class PersonaListCreateAPIView(ListCreateAPIView):
    serializer_class = PersonaSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "name",
        "description",
    ]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        name = serializer.validated_data.get("name")
        project = serializer.validated_data.get("project")
        
        if project and Persona.objects.filter(
            name=name,
            project=project,
            client=self.request.user.client.get("id")
        ).exists():
            raise serializers.ValidationError({
                "name": "Name must be unique!"
            })

        serializer.save(**vdata)

    def get_queryset(self):

        query_set = Persona.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(PersonaListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class PersonaRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = PersonaSerializer

    def perform_update(self, serializer):
        instance = self.get_object()

        name = serializer.validated_data.get("name", instance.name)
        project = serializer.validated_data.get("project", instance.project)
        
        if project and Persona.objects.filter(
            name=name,
            project=project,
            client=self.request.user.client.get("id")
        ).exclude(id=instance.id).exists():
            raise serializers.ValidationError({
                "name": "Name must be unique!"
            })

        with_obj_lvl_perform_update(self, serializer)

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(Persona, self.request, **data)

    def get_serializer_context(self):

        context = super(
            PersonaRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class BacklogListCreateAPIView(ListCreateAPIView):
    serializer_class = BacklogSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "name",
        "description",
        "i_want",
        "so_that",
    ]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}
        rebase_backlog_order = serializer.validated_data.pop("rebase_backlog_order", False)

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        instance = serializer.save(**vdata)

        if rebase_backlog_order:
            rebase_backlogs_order(
                instance,
                instance.order,
                instance.hlr,
                self.request.user.client.get("id")
            )

    def get_queryset(self):

        query_set = Backlog.objects.all()
        project = self.request.GET.get("project")

        if self.request.GET.get("hideBacklogsThatAreInTaskBacklogs"):
            query_set = query_set.filter(taskbacklog__isnull=True)

        if project:
            query_set = query_set.filter(hlr__project_id=project)

        if project:
            query_set = query_set.filter(hlr__project_id=project)

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(BacklogListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class BacklogRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = BacklogSerializer

    def perform_update(self, serializer):
        rebase_backlog_order = serializer.validated_data.pop("rebase_backlog_order", False)
        instance = with_obj_lvl_perform_update(self, serializer)

        if rebase_backlog_order:
            rebase_backlogs_order(
                instance,
                instance.order,
                instance.hlr,
                self.request.user.client.get("id")
            )

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(Backlog, self.request, **data)

    def get_serializer_context(self):

        context = super(
            BacklogRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class TaskStatusListCreateAPIView(ListCreateAPIView):
    serializer_class = TaskStatusSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "name",
        "description",
        "program__name",
    ]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}
        rebase = serializer.validated_data.pop("rebase", False)

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        name = serializer.validated_data.get("name")
        parent = serializer.validated_data.get("parent", None)
        project = serializer.validated_data.get("project")
        final_stage = serializer.validated_data.get("final_stage")
        
        if project and TaskStatus.objects.filter(
            name=name,
            parent=parent,
            project=project,
            client=self.request.user.client.get("id")
        ).exists():
            raise serializers.ValidationError({
                "name": "Name must be unique!"
            })

        if final_stage and project and TaskStatus.objects.filter(
            final_stage=True,
            parent=parent,
            project=project,
            client=self.request.user.client.get("id")
        ).exists():
            raise serializers.ValidationError({
                "final_stage": "Only one task stage can be final stage!"
            })

        instance = serializer.save(**vdata)

        if rebase and instance.project:
            rebase_task_status(
                instance,
                instance.order,
                instance.project,
                self.request.user.client.get("id")
            )

    def get_queryset(self):
        project = self.request.GET.get("project__name")
        only_parent = self.request.GET.get("only_parent", False)

        qfilter = {}

        if only_parent:
            qfilter["parent__isnull"] = True

        if project == "me":
            qfilter["project"] = Project.objects.get(
                name="me",
                program__name="me",
                created_by=self.request.user.id,
            )

        query_set = TaskStatus.objects.filter(**qfilter)

        return with_objs_lvl_permissions(
            query_set, self.request
        )  # .exclude(name="unassigned")

    def get_serializer_context(self):

        context = super(TaskStatusListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request
        context["detail_view"] = True

        return context


class TaskStatusRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = TaskStatusSerializer

    def perform_update(self, serializer):
        instance = self.get_object()
        rebase = serializer.validated_data.pop("rebase", False)
        name = serializer.validated_data.get("name", instance.name)
        parent = serializer.validated_data.get("parent", instance.parent)
        project = serializer.validated_data.get("project", instance.project)
        final_stage = serializer.validated_data.get("final_stage", instance.final_stage)

        if parent == instance:
            raise serializers.ValidationError({
                "parent": "Can't be parent of same task!"
            })

        if parent and not instance.parent:
            child_tasks = instance.get_child_branch()
            if list(map(lambda x: f"{parent.id}" == f"{x.id}", child_tasks)):
                raise serializers.ValidationError({
                    "parent": "Parent Task can't be part of of it's own child!"
                })
        
        if project and TaskStatus.objects.filter(
            name=name,
            parent=parent,
            project=project,
            client=self.request.user.client.get("id")
        ).exclude(id=instance.id).exists():
            raise serializers.ValidationError({
                "name": "Name must be unique!"
            })

        if final_stage and project and TaskStatus.objects.filter(
            final_stage=True,
            parent=parent,
            project=project,
            client=self.request.user.client.get("id")
        ).exclude(id=instance.id).exists():
            raise serializers.ValidationError({
                "final_stage": "Only one task stage can be final stage!"
            })

        instance = with_obj_lvl_perform_update(self, serializer)

        if rebase and instance.project:
            rebase_task_status(
                instance,
                instance.order,
                instance.project,
                self.request.user.client.get("id")
            )

    def perform_destroy(self, instance):
        if instance.name == "unassigned":
            raise serializers.ValidationError(
                {"task_status": "You Can't Delete This Task Status!"}
            )

        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(TaskStatus, self.request, **data)

    def get_serializer_context(self):

        context = super(
            TaskStatusRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["detail_view"] = True
        context["created_by"] = self.request.user.id
        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class AcceptanceStatusListCreateAPIView(ListCreateAPIView):
    serializer_class = AcceptanceStatusSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "name",
        "description",
    ]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        try:
            serializer.save(**vdata)
        except IntegrityError as e:
            raise serializers.ValidationError(
                {"name": "Bug Status Should Be Unique!"})

    def get_queryset(self):

        query_set = AcceptanceStatus.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(AcceptanceStatusListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class AcceptanceStatusRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = AcceptanceStatusSerializer
    # lookup_field = "id"

    def perform_update(self, serializer):
        with_obj_lvl_perform_update(self, serializer)

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(AcceptanceStatus, self.request, **data)

    def get_serializer_context(self):

        context = super(
            AcceptanceStatusRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class BugStatusListCreateAPIView(ListCreateAPIView):
    serializer_class = BugStatusSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "name",
        "description",
    ]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        try:
            serializer.save(**vdata)
        except IntegrityError as e:
            raise serializers.ValidationError(
                {"name": "Bug Status Should Be Unique!"})

    def get_queryset(self):

        query_set = BugStatus.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(BugStatusListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class BugStatusRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = BugStatusSerializer
    # lookup_field = "id"

    def perform_update(self, serializer):
        with_obj_lvl_perform_update(self, serializer)

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(BugStatus, self.request, **data)

    def get_serializer_context(self):

        context = super(
            BugStatusRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class TaskTypeListCreateAPIView(ListCreateAPIView):
    serializer_class = TaskTypeSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "name",
        "description",
    ]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        name = serializer.validated_data.get("name")
        project = serializer.validated_data.get("project")
        
        if project and TaskType.objects.filter(
            name=name,
            project=project,
            client=self.request.user.client.get("id")
        ).exists():
            raise serializers.ValidationError({
                "name": "Name must be unique!"
            })

        serializer.save(**vdata)

    def get_queryset(self):
        project = self.request.GET.get("project__name")
        qfilter = {}

        if project == "me":
            qfilter["project"] = Project.objects.get(
                name="me",
                program__name="me",
                created_by=self.request.user.id,
            )

        query_set = TaskType.objects.filter(**qfilter)

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(TaskTypeListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class TaskTypeRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = TaskTypeSerializer

    def perform_update(self, serializer):
        instance = self.get_object()
        
        name = serializer.validated_data.get("name", instance.name)
        project = serializer.validated_data.get("project", instance.project)
        
        if project and TaskType.objects.filter(
            name=name,
            project=project,
            client=self.request.user.client.get("id")
        ).exclude(id=instance.id).exists():
            raise serializers.ValidationError({
                "name": "Name must be unique!"
            })
        
        with_obj_lvl_perform_update(self, serializer)

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(TaskType, self.request, **data)

    def get_serializer_context(self):

        context = super(
            TaskTypeRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class ResourceListCreateAPIView(ListCreateAPIView):
    serializer_class = ResourceSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "name",
        "description",
        "cost",
        "email",
        "mobile",
        "landline",
    ]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        if Resource.objects.filter(user=serializer.validated_data["user"], client=self.request.user.client.get("id")).exists():
            raise serializers.ValidationError({"user": "User must be unique!"})

        if Resource.objects.filter(email=serializer.validated_data["email"], client=self.request.user.client.get("id")).exists():
            raise serializers.ValidationError(
                {"email": "Email must be unique!"})

        serializer.save(**vdata)

    def get_queryset(self):
        query_set = Resource.objects.all()

        qfilter = {
            "disabled": False
        }

        resources_with_user = self.request.GET.get("resources_with_user", None)

        resources_without_user = self.request.GET.get(
            "resources_without_user", None)

        include_disabled = self.request.GET.get("include_disabled", False)

        if resources_without_user:
            qfilter["user"] = None

        if resources_with_user:
            qfilter["user__isnull"] = False

        if include_disabled:
            del qfilter["disabled"]

        return with_objs_lvl_permissions(query_set.filter(**qfilter), self.request)

    def get_serializer_context(self):

        context = super(ResourceListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class ResourceRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = ResourceSerializer

    def perform_update(self, serializer):
        instance = self.get_object()

        if Resource.objects.filter(user=serializer.validated_data.get("user", instance.user), client=self.request.user.client.get("id")).exclude(id=instance.id).exists():
            raise serializers.ValidationError({"user": "User must be unique!"})

        if Resource.objects.filter(email=serializer.validated_data.get("email", instance.email), client=self.request.user.client.get("id")).exclude(id=instance.id).exists():
            raise serializers.ValidationError(
                {"email": "Email must be unique!"})

        with_obj_lvl_perform_update(self, serializer)

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(Resource, self.request, **data)

    def get_serializer_context(self):

        context = super(
            ResourceRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class RoleListCreateAPIView(ListCreateAPIView):
    serializer_class = RoleSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "name",
        "description",
    ]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_queryset(self):
        query_set = Role.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(RoleListCreateAPIView, self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class RoleRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = RoleSerializer

    def perform_update(self, serializer):
        with_obj_lvl_perform_update(self, serializer)

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(Role, self.request, **data)

    def get_serializer_context(self):

        context = super(RoleRetrieveUpdateDestroyAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class TaskListCreateAPIView(ListCreateAPIView):
    serializer_class = TaskSerializer
    permission_classes = [LMSStudentPermission, AllowInternalOrMustBeAuthenticatedPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_fields = [
        "parent_task",
        "project__name",
        "project__program",
        "hlr",
        "name",
        "description",
        "task_type",
        "owner",
        "status",
        "started",
        "duration_estimate",
        "duration_unit",
        "duration_actual",
        "milestone",
        "order",
        "rotting_days",
        "rotting_days",
        "completion_percent",
        "notes",
    ]
    filterset_class = TaskFilterset
    ordering_fields = "__all__"
    search_fields = [
        "name",
        "description",
        "duration_unit",
        "notes",
    ]

    def perform_create(self, serializer):
        vdata = {
            "created_by": self.request.user.id,
            "client": self.request.user.client.get("id"),
        }

        if not self.request.user.is_authenticated:
            vdata["created_by"] = serializer.validated_data.pop("created_by", "")
            vdata["client"] = serializer.validated_data.pop("client", "")

            if not vdata["created_by"]:
                raise serializers.ValidationError({
                    "created_by" : "Created by isn't required field!"
                })
            
            if not vdata["client"]:
                raise serializers.ValidationError({
                    "client" : "Client isn't required field!"
                })

        deadline = serializer.validated_data.get("deadline")
        started = serializer.validated_data.get("started")
        duration_estimate = serializer.validated_data.get("duration_estimate")
        duration_unit = serializer.validated_data.get("duration_unit")
        predecessor = serializer.validated_data.get("predecessor")
        rrule = serializer.validated_data.pop("rrule", None)
        by = serializer.validated_data.pop("by", "deadline")
        timezone = serializer.validated_data.pop("timezone", None)
        project = serializer.validated_data.get("project")
        serializer.validated_data.pop("rebase", False)
        rebase_task_order = serializer.validated_data.pop("rebase_task_order", False)
        custom_params = {}

        if rrule and timezone and deadline and (started or (duration_estimate and duration_unit)):
            custom_params["rrule"] = rrule

        if self.request.GET.get("create_project__name") == "me" or not project:
            project = Project.objects.get(
                name="me",
                program__name="me",
                created_by=vdata["created_by"],
            )

            if self.request.GET.get("create_task_type__name") == "Reminder":
                task_type = TaskType.objects.filter(
                    name="Reminder",
                    project=project,
                    created_by=vdata["created_by"],
                    client=vdata["client"],
                ).first()

                if not task_type:
                    task_type = TaskType.objects.create(
                        name="Reminder",
                        project=project,
                        created_by=vdata["created_by"],
                        client=vdata["client"],
                    )

                serializer.validated_data["task_type"] = task_type

        tasks = Task.objects.filter(
            name=serializer.validated_data["name"],
            parent_task=serializer.validated_data.get("parent_task", None),
            project=project,
            client=vdata["client"] if vdata.get("client") else None
        ).all()

        if tasks:
            vdata["name"] = f'{serializer.validated_data["name"]} ({len(tasks)+1})'

        if not serializer.validated_data.get("status"):

            if serializer.validated_data.get("project", None):
                project = Project.objects.filter(
                    id=project.id).first()

                if project:

                    task_status = TaskStatus.objects.filter(
                        program=project.program, **vdata).order_by("order").all()

                    if task_status:
                        vdata["status"] = task_status[0]

        if (
            serializer.validated_data.get("started") and
            project and project.started and
            serializer.validated_data.get(
                "started") < project.started
        ):
            raise serializers.ValidationError({"started": "Started Date Must Be Greater Then Project Start Date!"})
        
        if (
            serializer.validated_data.get("started") and
            serializer.validated_data.get("deadline") and
            serializer.validated_data.get(
                "started") > serializer.validated_data.get("deadline")
        ):
            raise serializers.ValidationError({"started": "Started Date Must Be Less Then Deadline Date!"})

        if (
            serializer.validated_data.get("started") and
            serializer.validated_data.get("dependency") and
            serializer.validated_data.get(
                "started") < serializer.validated_data.get("dependency").deadline
        ):
            raise serializers.ValidationError(
                {"started": "Started Date Must Be Greater Then Dependency Task Deadline Date!"})

        try:
            instance = serializer.save(**vdata, **custom_params)
        except IntegrityError:
            raise serializers.ValidationError({"name": "Task Must Be Unique!"})

        if predecessor:
            predecessor.dependency = instance

            if predecessor.started and instance.deadline and predecessor.started.date() < instance.deadline.date():
                instance_deadline_data = instance.deadline.date()
                predecessor.started = predecessor.started.replace(
                    year=instance_deadline_data.year,
                    month=instance_deadline_data.month,
                    day=instance_deadline_data.day,
                )

                if predecessor.deadline.date() < predecessor.started.date():
                    new_predecessor_deadline_date = predecessor.started.date() - \
                        predecessor.deadline.date()

                    predecessor.deadline = predecessor.deadline + new_predecessor_deadline_date

            predecessor.save()

        if custom_params.get("rrule"):
            repeated_task_creator(instance, timezone, by, True)

        if rebase_task_order:
            rebase_tasks_order(
                instance,
                instance.order,
                instance.parent_task,
                instance.project,
                vdata["client"]
            )

    def get_queryset(self):
        qfilter = {}

        if self.request.GET.get("parent_task_null"):
            qfilter["parent_task"] = None
        elif self.request.GET.get("parent_task_not_null"):
            qfilter["parent_task__isnull"] = False

        query_set = Task.objects.filter(**qfilter)

        if self.request.GET.get("hideTasksThatAreInTaskBugs"):
            query_set = query_set.filter(taskbug__isnull=True)

        if self.request.GET.get("sprint_task_null"):
            query_set = query_set.filter(sprinttask__isnull=True)
        elif self.request.GET.get("sprint_task_not_null"):
            query_set = query_set.filter(sprinttask__isnull=False)

        if self.request.GET.get("started_null"):
            query_set = query_set.filter(started__isnull=True)
        elif self.request.GET.get("started_not_null"):
            query_set = query_set.filter(started__isnull=False)

        if self.request.GET.get("deadline_null"):
            query_set = query_set.filter(deadline__isnull=True)
        elif self.request.GET.get("deadline_not_null"):
            query_set = query_set.filter(deadline__isnull=False)

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(TaskListCreateAPIView, self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class TaskRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = TaskSerializer

    def perform_update(self, serializer):
        serializer.validated_data.pop("created_by", "")
        serializer.validated_data.pop("client", "")
        
        instance = self.get_object()

        if Task.objects.filter(parent_task = instance).exists():
            serializer.validated_data.pop("duration_estimate", None)
            serializer.validated_data.pop("duration_unit", None)
            serializer.validated_data.pop("duration_actual", None)
        
        rebase = serializer.validated_data.pop("rebase", False)
        dependency = serializer.validated_data.get("dependency", instance.dependency)
        project = serializer.validated_data.pop("project", instance.project)
        started = serializer.validated_data.get("started", instance.started)
        deadline = serializer.validated_data.get("deadline", instance.deadline)

        rrule = serializer.validated_data.pop("rrule", None)
        by = serializer.validated_data.pop("by", "deadline")
        timezone = serializer.validated_data.pop("timezone", None)
        rebase_task_order = serializer.validated_data.pop("rebase_task_order", False)
        custom_params = {}

        if not instance.rrule and rrule and timezone and instance.deadline and (instance.started or (instance.duration_estimate and instance.duration_unit)):
            custom_params["rrule"] = rrule

        if (
            started and
            project and project.started and
            started < project.started
        ):
            raise serializers.ValidationError({"started": "Started Date Must Be Greater Then Project Start Date!"})
        
        if (
            started and
            deadline and
            started > deadline
        ):
            raise serializers.ValidationError({"started": "Started Date Must Be Less Then Deadline Date!"})

        if (
            started and
            dependency and
            started < dependency.deadline
        ):
            raise serializers.ValidationError(
                {"started": "Started Date Should Be Greater Then Dependency Task Deadline Date!"})
        
        if started != instance.started and not rebase:
            conflict_tasks = instance.get_child_branch_conflict_started_tasks(started, self.request.user.client.get("id"))

            if conflict_tasks:
                raise serializers.ValidationError({
                    "error_code": "Can't Rebase In Past",
                    "conflicted_tasks_csv_file" : create_rebase_conflict_tasks_csv(self.request, conflict_tasks), 
                    "started": "Started date must be less then sub tasks started date!",
                })
            
        if deadline != instance.deadline and not rebase:
            conflict_tasks = instance.get_child_branch_conflict_deadline_tasks(deadline, self.request.user.client.get("id"))

            if conflict_tasks:
                raise serializers.ValidationError({
                    "error_code": "Can't Rebase In Past",
                    "conflicted_tasks_csv_file" : create_rebase_conflict_tasks_csv(self.request, conflict_tasks), 
                    "deadline": "Deadline date must be less then sub tasks deadline date!",
                })

        try:
            new_instance = with_obj_lvl_perform_update(
                self, serializer, custom_params)
        except IntegrityError:
            raise serializers.ValidationError({"name": "Task Must Be Unique!"})

        if serializer.validated_data.get("predecessor"):
            new_instance.predecessor.dependency = new_instance

            if new_instance.predecessor and new_instance.predecessor.started and new_instance.deadline and new_instance.predecessor.started.date() < new_instance.deadline.date():
                new_instance_deadline_data = new_instance.deadline.date()
                new_instance.predecessor.started = new_instance.predecessor.started.replace(
                    year=new_instance_deadline_data.year,
                    month=new_instance_deadline_data.month,
                    day=new_instance_deadline_data.day,
                )

                if new_instance.predecessor.deadline.date() < new_instance.predecessor.started.date():
                    new_predecessor_deadline_date = new_instance.predecessor.started.date() - \
                        new_instance.predecessor.deadline.date()

                    new_instance.predecessor.deadline = new_instance.predecessor.deadline + \
                        new_predecessor_deadline_date

            new_instance.predecessor.save()

        if custom_params.get("rrule"):
            repeated_task_creator(new_instance, timezone, by, True)
        
        if rebase and instance.started and started != instance.started:
            rebase_the_task_dates(new_instance, new_instance.started - instance.started, by="started")
        
        if rebase and instance.deadline and deadline != instance.deadline:
            rebase_the_task_dates(new_instance, new_instance.deadline - instance.deadline, by="deadline")

        if rebase_task_order:
            rebase_tasks_order(
                new_instance,
                new_instance.order,
                new_instance.parent_task,
                new_instance.project,
                self.request.user.client.get("id")
            )

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        instance = with_obj_lvl_get_object_or_404(Task, self.request, **data)

        return instance

    def get_serializer_context(self):

        context = super(TaskRetrieveUpdateDestroyAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request
        context["detail_view"] = True

        context["exclude_task"] = self.get_object()

        return context


class TaskCommentListCreateAPIView(ListCreateAPIView):
    serializer_class = TaskCommentSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "comment",
    ]

    def perform_create(self, serializer):
        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        if not serializer.validated_data.get("comment") and not serializer.validated_data.get("attachment"):
            raise serializers.ValidationError(
                {"comment": "You should provide either comment or attachment."})

        serializer.save(**vdata)

    def get_queryset(self):
        query_set = TaskComment.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)


class TaskCommentRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = TaskCommentSerializer

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(TaskComment, self.request, **data)

    def get_serializer_context(self):

        context = super(
            TaskCommentRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class AcceptanceTestListCreateAPIView(ListCreateAPIView):
    serializer_class = AcceptanceTestSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "name",
        "given",
        "when",
        "then",
        "status",
        "criteria",
    ]

    def perform_create(self, serializer):
        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_queryset(self):
        query_set = AcceptanceTest.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(AcceptanceTestListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class AcceptanceTestRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = AcceptanceTestSerializer

    def perform_update(self, serializer):
        instance = self.get_object()
        status = serializer.validated_data.get("status", instance.status)

        if not status == instance.status and status != "To Test":
            passed = True if status == "Passed" else False
            resource = Resource.objects.filter(

                user = self.request.user.id,
                client = self.request.user.client.get("id")
            ).first()

            if resource:
                TestsConducted.objects.create(
                    acceptance_criteria = instance,
                    date_tested = timezone.now().date(),
                    tested_by = f"{resource.id}",
                    passed = passed,
                    notes = f"{status}",
                    created_by = self.request.user.id,
                    client = self.request.user.client.get("id"),
                )

        with_obj_lvl_perform_update(self, serializer)

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(AcceptanceTest, self.request, **data)

    def get_serializer_context(self):

        context = super(
            AcceptanceTestRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class TaskResourceListCreateAPIView(ListCreateAPIView):
    serializer_class = TaskResourceSerializer
    filter_backends = [
        DjangoFilterBackend,
        OrderingFilter,
        SearchFilter,
    ]  # SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "task__name",
        "resource__name",
    ]

    def perform_create(self, serializer):
        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_queryset(self):
        query_set = TaskResource.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(TaskResourceListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class TaskResourceRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = TaskResourceSerializer

    def perform_update(self, serializer):
        with_obj_lvl_perform_update(self, serializer)

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(TaskResource, self.request, **data)

    def get_serializer_context(self):

        context = super(
            TaskResourceRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class StakeholderListCreateAPIView(ListCreateAPIView):
    serializer_class = StakeholderSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "name",
        "description",
        "email",
        "mobile",
        "landline",
    ]

    def perform_create(self, serializer):
        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_queryset(self):
        query_set = Stakeholder.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(StakeholderListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class StakeholderRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = StakeholderSerializer

    def perform_update(self, serializer):
        with_obj_lvl_perform_update(self, serializer)

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(Stakeholder, self.request, **data)

    def get_serializer_context(self):

        context = super(
            StakeholderRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class BugArtifactListCreateAPIView(ListCreateAPIView):
    serializer_class = BugArtifactSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = ["bug__name", "drive"]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_queryset(self):
        query_set = BugArtifact.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(BugArtifactListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id
        context["client"] = self.request.user.client

        return context


class BugArtifactRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = BugArtifactSerializer

    def perform_update(self, serializer):
        with_obj_lvl_perform_update(self, serializer)

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(BugArtifact, self.request, **data)

    def get_serializer_context(self):

        context = super(
            BugArtifactRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class ProjectArtifactListCreateAPIView(ListCreateAPIView):
    serializer_class = ProjectArtifactSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = ["project__name", "drive"]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_queryset(self):
        query_set = ProjectArtifact.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(ProjectArtifactListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class ProjectArtifactRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = ProjectArtifactSerializer

    def perform_update(self, serializer):
        with_obj_lvl_perform_update(self, serializer)

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(ProjectArtifact, self.request, **data)

    def get_serializer_context(self):

        context = super(
            ProjectArtifactRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class HlrArtifactListCreateAPIView(ListCreateAPIView):
    serializer_class = HlrArtifactSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = ["hlr__name", "drive"]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_queryset(self):
        query_set = HlrArtifact.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(HlrArtifactListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class HlrArtifactRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = HlrArtifactSerializer

    def perform_update(self, serializer):
        with_obj_lvl_perform_update(self, serializer)

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(HlrArtifact, self.request, **data)

    def get_serializer_context(self):

        context = super(
            HlrArtifactRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class BacklogArtifactListCreateAPIView(ListCreateAPIView):
    serializer_class = BacklogArtifactSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = ["backlog__name", "drive"]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_queryset(self):
        query_set = BacklogArtifact.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(BacklogArtifactListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class BacklogArtifactRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = BacklogArtifactSerializer

    def perform_update(self, serializer):
        with_obj_lvl_perform_update(self, serializer)

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(BacklogArtifact, self.request, **data)

    def get_serializer_context(self):

        context = super(
            BacklogArtifactRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class WorkingTimeListCreateAPIView(ListCreateAPIView):
    serializer_class = WorkingTimeSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "project__name",
        "week_start",
    ]
    # search_fields = "__all__"

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_queryset(self):
        query_set = WorkingTime.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(WorkingTimeListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class WorkingTimeRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = WorkingTimeSerializer

    def perform_update(self, serializer):
        with_obj_lvl_perform_update(self, serializer)

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(WorkingTime, self.request, **data)

    def get_serializer_context(self):

        context = super(
            WorkingTimeRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class WorkCodeListCreateAPIView(ListCreateAPIView):
    serializer_class = WorkCodeSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "name",
        "description",
    ]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_queryset(self):
        query_set = WorkCode.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(WorkCodeListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class WorkCodeRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = WorkCodeSerializer

    def perform_update(self, serializer):
        with_obj_lvl_perform_update(self, serializer)

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(WorkCode, self.request, **data)

    def get_serializer_context(self):

        context = super(
            WorkCodeRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class TimesheetListCreateAPIView(ListCreateAPIView):
    serializer_class = TimesheetSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "name",
        "description",
        "task__name",
        "resource__name",
        "workcode__name",
    ]

    def perform_create(self, serializer):
        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_queryset(self):
        query_set = Timesheet.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(TimesheetListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class TimesheetRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = TimesheetSerializer

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(Timesheet, self.request, **data)

    def get_serializer_context(self):

        context = super(
            TimesheetRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class BugListCreateAPIView(ListCreateAPIView):
    serializer_class = BugSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    filterset_class = BugFilterset
    ordering_fields = "__all__"
    search_fields = [
        "headline",
        "description",
        "steps_to_reproduce",
        "expected_result",
        "actual_result",
        "notes",
        "keywords",
        "resolution",
        "priority",
        # "type",
        "status",
        "reported_by_name",
        "reported_by_email",
        "screenshot_drive_link",
        "os",
        "browser",
    ]

    def perform_create(self, serializer):

        headline = serializer.validated_data.get("headline")
        project = serializer.validated_data.get("project")
        
        if not project:
            raise serializers.ValidationError({
                "project" : "Project is required field!"
            })
        
        if Bug.objects.filter(headline=headline, project=project).exists() or Task.objects.filter(name=headline, project=project).exists():
            raise serializers.ValidationError({
                "headline" : "Headline must be unique!"
            })

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        instance = serializer.save(**vdata)
        task_type = TaskType.objects.filter(
            name="Bug",
            project=project,
            created_by=self.request.user.id,
            client=self.request.user.client.get("id"),
        ).first()

        if not task_type:
            task_type = TaskType.objects.create(
                name="Bug",
                project=project,
                created_by=self.request.user.id,
                client=self.request.user.client.get("id"),
            )

        task = Task.objects.create(
            project = instance.project,
            name = instance.headline,
            description = instance.description,
            owner = instance.resource,
            task_type=task_type,
            created_by=self.request.user.id,
            client=self.request.user.client.get("id"),
        )

        TaskBug.objects.create(
            task = task,
            bug = instance,
            created_by=self.request.user.id,
            client=self.request.user.client.get("id"),
        )


    def get_queryset(self):
        query_set = Bug.objects.all()

        qfilter = {}
        project = self.request.GET.get("project", None)
        resource = self.request.GET.get("resource", None)
        signed_off = self.request.GET.get("signed_off", None)
        task = self.request.GET.get("task", None)
        hideBugsThatAreInTaskBugs = self.request.GET.get("hideBugsThatAreInTaskBugs", None)

        if project:
            query_set = query_set.filter(project_id=project)

        if resource:
            query_set = query_set.filter(resource_id=resource)

        if signed_off:
            query_set = query_set.filter(signed_off_id=signed_off)

        if hideBugsThatAreInTaskBugs:
            query_set = query_set.filter(taskbug__isnull=True)

        if task and not hideBugsThatAreInTaskBugs:
            query_set = query_set.filter(taskbug__isnull=False, taskbug__task_id = task)

        if self.request.user.client.get("id") == settings.PULLSTREAM_CLIENT_ID:
            return (with_objs_lvl_permissions(query_set, self.request) | query_set.exclude(client=self.request.user.client.get("id"))).distinct()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(BugListCreateAPIView, self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class BugRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = BugSerializer

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        if self.request.user.client.get("id") == settings.PULLSTREAM_CLIENT_ID:
            return get_object_or_404(Bug, **data)

        return with_obj_lvl_get_object_or_404(Bug, self.request, **data)

    def get_serializer_context(self):

        context = super(BugRetrieveUpdateDestroyAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class BugCommentListCreateAPIView(ListCreateAPIView):
    serializer_class = BugCommentSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = ["bug__headline", "comment"]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_queryset(self):
        query_set = BugComment.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(BugCommentListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class BugCommentRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = BugCommentSerializer

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(BugComment, self.request, **data)

    def get_serializer_context(self):

        context = super(
            BugCommentRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class SprintMetaBugListCreateAPIView(ListCreateAPIView):
    serializer_class = SprintMetaBugSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "sprint__name",
        "bug__headline",
    ]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_bug_or_404(self, bug):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(Bug, self.request, **data)

    def get_sprint_or_404(self, sprint):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(SprintMeta, self.request, **data)

    def get_queryset(self):
        query_set = SprintMetaBug.objects.all()

        bug = self.request.GET.get("bug")
        sprint = self.request.GET.get("sprint")

        if bug:
            query_set = query_set.filter(bug=self.get_bug_or_404(bug))

        if sprint:
            query_set = query_set.filter(sprint=self.get_sprint_or_404(sprint))

        qfilter = {}

        return with_objs_lvl_permissions(query_set.filter(**qfilter), self.request)

    def get_serializer_context(self):

        context = super(SprintMetaBugListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class SprintMetaBugRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = SprintMetaBugSerializer

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(SprintMetaBug, self.request, **data)

    def get_serializer_context(self):

        context = super(
            SprintMetaBugRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class TestsConductedListCreateAPIView(ListCreateAPIView):
    serializer_class = TestsConductedSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = ["acceptance_criteria__name", "notes", "tested_by"]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_queryset(self):

        if self.request.GET.get("project"):
            query_set = TestsConducted.objects.filter(
                acceptance_criteria__backlog__hlr__project=self.request.GET.get(
                    "project"
                ),
            )
        else:
            query_set = TestsConducted.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(TestsConductedListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class TestsConductedRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = TestsConductedSerializer

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(TestsConducted, self.request, **data)

    def get_serializer_context(self):

        context = super(
            TestsConductedRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class TaskBacklogListCreateAPIView(ListCreateAPIView):
    serializer_class = TaskBacklogSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "task__name",
        "backlog__name",
    ]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_queryset(self):
        query_set = TaskBacklog.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(TaskBacklogListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class TaskBacklogRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = TaskBacklogSerializer

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(TaskBacklog, self.request, **data)

    def get_serializer_context(self):

        context = super(
            TaskBacklogRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class SprintListCreateAPIView(ListCreateAPIView):
    serializer_class = SprintSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = ["sprint_meta__name"]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        sprint_meta = serializer.validated_data.get("sprint_meta")
        start_date = serializer.validated_data.get("start_date")
        end_date = serializer.validated_data.get("end_date")

        if start_date and not end_date:
            vdata["end_date"] = start_date + timedelta(days=sprint_meta.days-1)
        
        if end_date and end_date < start_date:
            raise serializers.ValidationError({
                "end_date" : "End date must be greater then start date!"
            })
        
        if end_date and (end_date - start_date).days > sprint_meta.days:
            raise serializers.ValidationError({
                "end_date" : f"The difference between start date and end date should be maximum {sprint_meta.days} days!"
            })

        serializer.save(**vdata)

    def get_queryset(self):
        query_set = Sprint.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(SprintListCreateAPIView, self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class SprintRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = SprintSerializer

    def perform_update(self, serializer):
        instance = self.get_object()
        custom = {}

        sprint_meta = serializer.validated_data.get("sprint_meta", instance.sprint_meta)
        start_date = serializer.validated_data.get("start_date", instance.start_date)
        end_date = serializer.validated_data.get("end_date", instance.end_date)

        if start_date and not end_date:
            custom["end_date"] = start_date + timedelta(days=sprint_meta.days)
        
        if end_date and end_date < start_date:
            raise serializers.ValidationError({
                "end_date" : "End date must be greater then start date!"
            })
        
        if end_date and (end_date - start_date).days > sprint_meta.days:
            raise serializers.ValidationError({
                "end_date" : f"The difference between start date and end date should be maximum {sprint_meta.days} days!"
            })

        with_obj_lvl_perform_update(self, serializer, custom)

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(Sprint, self.request, **data)

    def get_serializer_context(self):

        context = super(
            SprintRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class SprintTaskListCreateAPIView(ListCreateAPIView):
    serializer_class = SprintTaskSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "task__name",
        "sprint__sprint_meta__name",
    ]

    def perform_create(self, serializer):

        task = serializer.validated_data.get("task")
        sprint = serializer.validated_data.get("sprint")

        if SprintTask.objects.filter(
            sprint = sprint,
            task = task,
            client = self.request.user.client.get("id"),
        ).exists():
            raise serializers.ValidationError({
                "task" : "Task must be unique!"
            })

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_queryset(self):
        query_set = SprintTask.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(SprintTaskListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class SprintTaskRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = SprintTaskSerializer

    def perform_update(self, serializer):
        instance = self.get_object()

        task = serializer.validated_data.get("task", instance.task)
        sprint = serializer.validated_data.get("sprint", instance.sprint)

        if SprintTask.objects.filter(
            sprint = sprint,
            task = task,
            client = self.request.user.client.get("id"),
        ).exclude(id=instance.id).exists():
            raise serializers.ValidationError({
                "task" : "Task must be unique!"
            })

        with_obj_lvl_perform_update(self, serializer)

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(SprintTask, self.request, **data)

    def get_serializer_context(self):

        context = super(
            SprintTaskRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class FeatureRequestListCreateAPIView(ListCreateAPIView):
    serializer_class = FeatureRequestSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "name",
        "description",
        "project__name",
        "status",
    ]

    def perform_create(self, serializer):

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_queryset(self):
        query_set = FeatureRequest.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(FeatureRequestListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class FeatureRequestRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = FeatureRequestSerializer

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(FeatureRequest, self.request, **data)

    def get_serializer_context(self):

        context = super(
            FeatureRequestRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class TaskBugListCreateAPIView(ListCreateAPIView):
    serializer_class = TaskBugSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "task__name",
        "bug__headline",
    ]

    def perform_create(self, serializer):

        bug = serializer.validated_data.get("bug")

        # if TaskBug.objects.filter(bug=bug).exists():
        #     raise serializers.ValidationError({
        #         "bug" : "This bug already has task assigned to it!"
        #     })

        vdata = {"created_by": self.request.user.id}

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        serializer.save(**vdata)

    def get_queryset(self):
        query_set = TaskBug.objects.all()

        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):

        context = super(TaskBugListCreateAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class TaskBugRetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class = TaskBugSerializer


    def perform_update(self, serializer):
        instance = self.get_object()

        bug = serializer.validated_data.get("bug", instance.bug)

        # if TaskBug.objects.filter(bug=bug).exclude(id=instance.id).exists():
        #     raise serializers.ValidationError({
        #         "bug" : "This bug already has task assigned to it!"
        #     })
        
        with_obj_lvl_perform_update(self, serializer)

    def get_object(self):

        data = {}

        data["id"] = self.kwargs.get("id")

        return with_obj_lvl_get_object_or_404(TaskBug, self.request, **data)

    def get_serializer_context(self):

        context = super(
            TaskBugRetrieveUpdateDestroyAPIView, self
        ).get_serializer_context()

        context["created_by"] = self.request.user.id

        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class INAListCreateAPIView(ListCreateAPIView):
    ''' class description '''
    serializer_class = INASerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_exclude = ["only_these_roles_can_see_it",
                         "only_these_users_can_see_it"]
    ordering_fields = "__all__"
    search_fields = [
        "next_action",
        "status"
    ]

    def perform_create(self, serializer):
        ''' function description '''

        vdata = {"created_by": self.request.user.id}
        link = serializer.validated_data.pop("link", "")
        create_calendar_entry = serializer.validated_data.pop(
            "create_calendar_entry", True)
        reminder_name = serializer.validated_data.pop(
            "reminder_name", "")
        reminder_description = serializer.validated_data.pop(
            "reminder_description", "")
        reminder_timezone = serializer.validated_data.pop(
            "reminder_timezone", "")
        calendar = serializer.validated_data.pop(
            "calendar", None)

        if self.request.user.client:
            vdata["client"] = self.request.user.client.get("id")

        model = get_model(
            serializer.validated_data["model_name"],
            microservice_name=serializer.validated_data["microservice_name"],
            access_token=self.request.user.access_token
        )

        if not model or not "id" in model:
            raise serializers.ValidationError(
                {"model": "Model Doesn't Exist!"})

        vdata["model"] = model["id"]

        if create_calendar_entry:

            if not reminder_name:
                raise serializers.ValidationError({
                    "reminder_name": "Reminder name is required!"
                })

            if not reminder_timezone:
                raise serializers.ValidationError({
                    "reminder_timezone": "Reminder timezone is required!"
                })

            if not calendar:
                raise serializers.ValidationError({
                    "calendar": "Calendar is required!"
                })

            reminder_payload = {
                "title": reminder_name,
                "description": reminder_description,
                "timezone": reminder_timezone,
                "start_date_time": serializer.validated_data.get("datetime"),
                "event_type": "Reminder",
                "calendar": calendar,
            }

            reminder = create_calendar_event(
                reminder_payload, self.request.user.access_token) if reminder_payload.get("title") else {}
            vdata["event"] = reminder.get("id")

        instance = serializer.save(**vdata)

        if not create_calendar_entry and not link:
            raise serializers.ValidationError({
                "link": "Link is required!"
            })

        if not create_calendar_entry:

            send_ina_email.apply_async(
                [
                    f"{instance.id}",
                    link,
                    {
                        "username": self.request.user.username,
                        "email": self.request.user.email,
                    }
                ],
                eta=instance.datetime,
            )

    def get_queryset(self):
        ''' function description '''

        query_set = INA.objects.all()

        # .filter(**qfilter)
        return with_objs_lvl_permissions(query_set, self.request)

    def get_serializer_context(self):
        ''' function description '''

        context = super(INAListCreateAPIView, self).get_serializer_context()

        context["created_by"] = self.request.user.id
        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class INARetrieveUpdateDestroyAPIView(RetrieveUpdateDestroyAPIView):
    ''' class description '''

    serializer_class = INASerializer

    def perform_update(self, serializer):
        instance = self.get_object()

        model = get_model(
            serializer.validated_data.get("model_name", instance.model_name),
            serializer.validated_data.get("microservice_name", instance.microservice_name),
            access_token=self.request.user.access_token
        )

        if not model or not "id" in model:
            raise serializers.ValidationError(
                {"model": "Model Doesn't Exist!"})

        serializer.validated_data["model"] = model["id"]
        with_obj_lvl_perform_update(self, serializer)

    def perform_destroy(self, instance):
        instance.delete(updated_by = self.request.user.id)

    def get_object(self):

        return with_obj_lvl_get_object_or_404(INA, self.request, id=self.kwargs["id"])

    def get_serializer_context(self):
        ''' function description '''

        context = super(INARetrieveUpdateDestroyAPIView,
                        self).get_serializer_context()

        context["created_by"] = self.request.user.id
        context["client"] = self.request.user.client
        context["request"] = self.request

        return context


class INAAPIView(APIView):
    permission_classes = [LMSStudentPermission, 
        IsAuthenticated,
    ]
    inner_uuid_key_value_pair = {
        "responsible": {
            "get_path": "responsible",
            "set_path": "details.responsible",
            "inner_field": True,
        }
    }

    def get(self, request):
        microservice_name = request.GET.get("microservice_name", None)
        model_name = request.GET.get("model_name", None)
        responsible = request.GET.get("responsible", None)
        page_size = 10

        if request.GET.get("page_size", "").isdigit():
            page_size = int(request.GET.get("page_size"))

        qfilter = {}

        if microservice_name:
            qfilter["microservice_name"] = microservice_name

        if model_name:
            qfilter["model_name"] = model_name

        if responsible:
            qfilter["responsible"] = responsible

        zombie_inas = with_objs_lvl_permissions(INA.objects.filter(
            status="In Progress", datetime__lt=timezone.now(), **qfilter).order_by("datetime"), request)
        inprogress_inas = with_objs_lvl_permissions(INA.objects.filter(status="In Progress", datetime__gte=timezone.now(
        ), datetime__lte=timezone.now() + timedelta(days=7), **qfilter).order_by("datetime"), request)

        response = []
        stages = ["Zombies", ]

        for i in range(7):
            new_datetime = datetime.now() + timedelta(days=i)
            stage = new_datetime.strftime("%A")

            if not stage in stages:
                if not i:
                    stages.append("Today")
                else:
                    stages.append(stage)

        for stage in stages:
            status_response = {}

            status_response["name"] = stage
            status_response["zombie"] = "Zombie" in stage
            status_response["items"] = []

            itterator = zombie_inas if "Zombie" in stage else inprogress_inas

            for ina in itterator[:page_size]:

                todays_ina = datetime.now().strftime(
                    "%A") == ina.datetime.strftime("%A") and stage == "Today"

                if not "Zombie" in stage and not todays_ina and ina.datetime.strftime("%A") != stage:
                    continue

                ina_payload = {
                    "id": f"{ina.id}",
                    "model_name": f"{ina.model_name}",
                    "microservice_name": f"{ina.microservice_name}",
                    "record_id": f"{ina.record_id}",
                    "next_action": f"{ina.next_action}",
                    "notes": f"{ina.notes}",
                    "datetime": f"{ina.datetime}",
                    "event": f"{ina.event}" if ina.event else None,
                    "responsible": f"{ina.responsible}",
                    "details": {},
                    "status": f"{ina.status}",
                }

                status_response["items"].append(
                    ina_payload
                )
            status_response["items"] = serializer_uuid_field_details(
                self, request, status_response["items"])
            response.append(status_response)

        return Response(response, status=status.HTTP_200_OK)


# class ProjectDuplicateView(APIView):
#     serializer_class = ProjectSerializer
#     permission_classes = [LMSStudentPermission, 
#         AllowAny,
#     ]

#     def post(self, request, project_id):
#         instance = get_object_or_404(Project, id=project_id)
#         serializer = ProjectSerializer(
#             data=request.data, context={"request": request})

#         if serializer.is_valid():

#             project = duplicate_project(
#                 instance, request, serializer.validated_data)
#             project.template_id = project_id
#             project.save()

#             serializer = ProjectSerializer(
#                 project, context={"request": request})

#             return Response(data=serializer.data)

#         return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AcceptanceTestProjectUpdateView(APIView):
    def patch(self, request):
        serializer = AcceptanceTestUpdateSerializer(data=request.data)

        if serializer.is_valid():
            qfilter = {}
            client = self.request.user.client
            created_by = self.request.user.id

            if not client["id"]:
                qfilter["created_by"] = created_by

            elif client["id"] and not client.get("id") == settings.PULLSTREAM_CLIENT_ID:
                qfilter["client"] = client.get("id")

            qfilter["id"] = serializer.validated_data["project"]

            project = get_object_or_404(Project, **qfilter)

            for acceptance_test in AcceptanceTest.objects.filter(
                backlog__hlr__project=project
            ):

                if serializer.validated_data.get("backlog", None):
                    newQfilter = qfilter
                    newQfilter["id"] = serializer.validated_data.get(
                        "backlog", None)
                    backlog = Backlog.objects.filter(**newQfilter).first()

                    if backlog:
                        acceptance_test.backlog = backlog

                if serializer.validated_data.get("name", None):
                    acceptance_test.name = serializer.validated_data.get(
                        "name", None)

                if serializer.validated_data.get("given", None):
                    acceptance_test.given = serializer.validated_data.get(
                        "given", None)

                if serializer.validated_data.get("when", None):
                    acceptance_test.when = serializer.validated_data.get(
                        "when", None)

                if serializer.validated_data.get("then", None):
                    acceptance_test.then = serializer.validated_data.get(
                        "then", None)

                if serializer.validated_data.get("criteria", None):
                    acceptance_test.criteria = serializer.validated_data.get(
                        "criteria", None
                    )

                if serializer.validated_data.get("status", None):
                    acceptance_test.status = serializer.validated_data.get(
                        "status", None
                    )
                    # newQfilter = qfilter
                    # newQfilter["id"] = serializer.validated_data.get("status", None)
                    # status = AcceptanceStatus.objects.filter(**newQfilter).first()

                    # if status:
                    #     acceptance_test.status = status

                acceptance_test.save()

            return Response(serializer.data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TaskStatusAPIView(APIView):

    def get(self, request):
        item_order = request.GET.get("item_order", "-created_at")
        project_id = request.GET.get("project", None)
        owner = request.GET.get("owner", None)
        page_size = 10

        if request.GET.get("page_size", "").isdigit():
            page_size = int(request.GET.get("page_size"))


        if not project_id:
            raise serializers.ValidationError({
                "project" : "Project is required!"
            })

        itemsFilter = {}

        project = with_obj_lvl_get_object_or_404(Project, request, id=project_id)

        response = []

        for task_status in TaskStatus.get_all_task_status_of_a_project(project.id):
            status_response = {}

            status_response["id"] = str(task_status.id)
            status_response["project"] = f"{task_status.project.id}"
            status_response["name"] = f"{task_status.name}"
            status_response["description"] = f"{task_status.description}"
            status_response["order"] = task_status.order
            full_order = task_status.get_full_order()
            status_response["full_order"] = str(full_order) + "." if full_order else ""
            status_response["rotting_days"] = task_status.rotting_days
            status_response["final_stage"] = task_status.final_stage
            status_response["colour"] = task_status.colour
            status_response["items"] = []

            itemsFilter["status_id"] = task_status.id

            items_qs = Task.get_all_tasks_of_a_status(task_status.project.id, task_status.id, owner)

            for task in items_qs[:page_size]:
                task_full_order = task.get_task_level()
                item_payload = {
                    "id": f"{task.id}",
                    "order": (str(task_full_order) + "." if task_full_order else "") + f"{task.order}",
                    "name": f"{task.name}",
                    "colour": task.status.colour if task.status and task.status.colour else None,
                    "completed_by_deadline": True,
                    "rotting": False,
                }

                if task.deadline and task.status and task.deadline < timezone.now() and not task.status.final_stage:
                    item_payload["completed_by_deadline"] = False

                if task.status_assigned_date and task.status and task.status.rotting_days:
                    diff_in_days = (timezone.now() -
                                    task.status_assigned_date).days

                    if diff_in_days >= task.status.rotting_days:
                        item_payload["rotting"] = True

                status_response["items"].append(item_payload)

            response.append(status_response)

        return Response(response, status=status.HTTP_200_OK)


class SprintStatusAPIView(APIView):

    def get(self, request):
        item_order = request.GET.get("item_order", "-created_at")
        owner = request.GET.get("owner", None)
        sprint_meta = request.GET.get("sprint_meta", None)
        sprint = request.GET.get("sprint", None)
        page_size = 10

        if request.GET.get("page_size", "").isdigit():
            page_size = int(request.GET.get("page_size"))


        if not sprint_meta and not sprint:
            raise serializers.ValidationError({
                "sprint_meta" : "Sprint Meta is required!"
            })

        itemsFilter = {}
        sprint_meta_kanban = sprint_meta and not sprint

        if owner:
            itemsFilter["task__owner_id"] = owner

        sprint_stages = []
        current_datetime = timezone.now()

        if sprint_meta_kanban:
            sprints = with_objs_lvl_permissions(
                Sprint.objects.filter(
                    sprint_meta_id = sprint_meta,
                ).order_by("end_date")
                .distinct(), request
            ).all()

            sprint_stages += list(sprints)
        else:
            sprint = with_obj_lvl_get_object_or_404(Sprint, request, id = sprint)
            sprint_stages.append(sprint)

        response = []

        for stage in sprint_stages:
            status_response = {}
            is_current_sprint = False

            if stage.start_date <= current_datetime.date() and stage.end_date >= current_datetime.date():
                is_current_sprint = True

            status_response["id"] = str(stage.id)
            status_response["label"] = f"{stage.start_date.strftime('%d/%m/%y')} | {(stage.end_date - stage.start_date).days + 1} days"
            status_response["current"] = is_current_sprint
            status_response["items"] = []

            itemsFilter["sprint_id"] = stage.id

            items_qs = with_objs_lvl_permissions(SprintTask.objects.filter(**itemsFilter).order_by(item_order), request)

            total_duration = timedelta(hours=0)

            for item in items_qs:
                task = item.task
                task_level = task.get_task_level()

                task_hours = timedelta(seconds=0)

                if task.duration_estimate and task.duration_unit:
                    if task.duration_unit == "Weeks":
                        task_hours = timedelta(weeks=task.duration_estimate)

                    elif task.duration_unit == "Days":
                        task_hours = timedelta(days=task.duration_estimate)
                    
                    elif task.duration_unit == "Hours":
                        task_hours = timedelta(hours=task.duration_estimate)
                    
                    elif task.duration_unit == "Minutes":
                        task_hours = timedelta(minutes=task.duration_estimate)

                    total_duration += task_hours

                item_payload = {
                    "sprint_task_id": f"{item.id}",
                    "id": f"{task.id}",
                    "order": task.order,
                    "name": f"{task.name}",
                    "started" : task.started,
                    "deadline" : task.deadline,
                    "duration_estimate" : task.duration_estimate,
                    "duration_actual" : task.duration_actual,
                    "duration_unit" : task.duration_unit,
                    "rrule" : str(task.rrule) if task.rrule else '',
                    "full_order": (str(task_level) + "." if task_level else "") + f"{task.order}",
                    "task_level" : str(task_level) + "." if task_level else "",
                    "colour": task.status.colour if task.status and task.status.colour else None,
                    "completed_by_deadline": True,
                    "rotting": False,
                }

                if task.deadline and task.status and task.deadline < timezone.now() and not task.status.final_stage:
                    item_payload["completed_by_deadline"] = False

                if task.status_assigned_date and task.status and task.status.rotting_days:
                    diff_in_days = (timezone.now() -
                                    task.status_assigned_date).days

                    if diff_in_days >= task.status.rotting_days:
                        item_payload["rotting"] = True

                status_response["items"].append(item_payload)

            status_response["items"] = sorted(status_response["items"], key=lambda x: list(map(int, x.get("full_order").split('.'))))
            status_response["duration_estimate"] = str(round(total_duration.total_seconds() / 3600, 2))
            status_response["duration_unit"] = "Hours"

            response.append(status_response)

        return Response(response, status=status.HTTP_200_OK)


class MeProjectTaskStatusAPIView(APIView):

    def get(self, request):
        item_order = request.GET.get("item_order", "-created_at")
        task_type = request.GET.get("task_type", None)
        do_what = request.GET.get("do_what", None)
        page_size = 10

        if request.GET.get("page_size", "").isdigit():
            page_size = int(request.GET.get("page_size"))

        itemsFilter = {}

        if task_type:
            itemsFilter["task_type_id"] = task_type

        if do_what:
            itemsFilter["reminder_event_do_what"] = do_what

        response = []
        project = Project.objects.get(
            name="me",
            program__name="me",
            created_by=request.user.id,
        )

        for task_status in TaskStatus.objects.filter(program=project.program).order_by("order").all():
            status_response = {}

            status_response["id"] = task_status.id
            status_response["name"] = task_status.name
            status_response["items"] = []

            itemsFilter["status"] = task_status
            tasks = with_objs_lvl_permissions(Task.objects.filter(
                **itemsFilter).order_by(item_order).distinct(), request)
            status_response["totalCount"] = tasks.count()

            for task in tasks[:page_size]:
                status_response["items"].append(
                    {
                        "id": f"{task.id}",
                        "name": f"{task.name}",
                    }
                )

            response.append(status_response)

        return Response(response, status=status.HTTP_200_OK)


class BugStatusAPIView(APIView):

    def get(self, request):
        item_order = request.GET.get("item_order", "-created_at")
        all_user = request.GET.get("all_users", False)
        user = request.GET.get("user", request.user.id)
        project = request.GET.get("project", None)
        program = request.GET.get("program", None)
        owner = request.GET.get("owner", None)
        comment = request.GET.get("comment", None)
        artifact = request.GET.get("artifact", None)
        sprint_meta = request.GET.get("sprint_meta", None)
        task = request.GET.get("task", None)
        search = request.GET.get("search", "")
        stakeholder_person = request.GET.get("stakeholder_person", None)
        reported_by_email = request.GET.get("reported_by_email", None)
        bug_type = request.GET.get("type", None)
        priority = request.GET.get("priority", None)
        labels = request.GET.get("labels", None)
        start_date_str = request.GET.get("start_date", None)
        end_date_str = request.GET.get("end_date", None)
        # page_size = 10

        # if request.GET.get("page_size", "").isdigit():
        #     page_size = int(request.GET.get("page_size"))

        itemsFilter = {}

        if search:
            itemsFilter["headline__icontains"] = search

        if user and not all_user:
            itemsFilter["resource__user"] = user

        if owner:
            itemsFilter["resource"] = owner

        if project:
            itemsFilter["project"] = project

        if program:
            itemsFilter["project__program"] = program

        if stakeholder_person:
            itemsFilter["project__stakeholder__person"] = stakeholder_person

        if comment:
            itemsFilter["bugcomment"] = comment

        if artifact:
            itemsFilter["bugartifact"] = artifact

        if sprint_meta:
            itemsFilter["sprintmetabug__sprint"] = sprint_meta

        if task:
            itemsFilter["taskbug__task"] = task

        if reported_by_email:
            itemsFilter["reported_by_email"] = reported_by_email

        if bug_type:
            itemsFilter["type"] = bug_type

        if priority:
            itemsFilter["priority"] = priority

        if labels:
            # Support comma-separated labels for filtering
            label_list = [l.strip() for l in labels.split(",") if l.strip()]
            if label_list:
                itemsFilter["labels__contains"] = label_list

        if start_date_str and end_date_str:
            start_date = parse_date(start_date_str)
            end_date = parse_date(end_date_str)

            if not start_date or not end_date:
                raise serializers.ValidationError({
                    "date": "Invalid start_date or end_date. Use YYYY-MM-DD."
                })

            itemsFilter["created_at__date__range"] = (start_date, end_date)

        base_query_set = Bug.objects.filter(**itemsFilter)

        if self.request.user.client.get("id") == settings.PULLSTREAM_CLIENT_ID:
            bugs_query = (with_objs_lvl_permissions(base_query_set, self.request) | base_query_set.exclude(
                client=settings.PULLSTREAM_CLIENT_ID)).distinct()
        else:
            bugs_query = with_objs_lvl_permissions(
                base_query_set, self.request)

        bugs_query = bugs_query.prefetch_related(
            Prefetch('taskbug_set', queryset=TaskBug.objects.select_related(
                'task'), to_attr='cached_taskbugs')
        ).select_related('project', 'resource').order_by(item_order)

        all_bugs = list(bugs_query)

        bugs_by_status = {status[0]: [] for status in status_choices}
        for bug in all_bugs:
            if bug.status in bugs_by_status:
                bugs_by_status[bug.status].append(bug)

        response = []
        for bug_status in status_choices:
            status_key = bug_status[0]
            bugs_in_status = bugs_by_status.get(status_key, [])

            items = []
            for bug in bugs_in_status:
                taskbug = bug.cached_taskbugs[0] if hasattr(
                    bug, 'cached_taskbugs') and bug.cached_taskbugs else None
                items.append({
                    "id": f"{bug.id}",
                    "details": {
                        "task": model_to_dict(taskbug.task) if taskbug else {},
                    },
                    "name": f"{bug.headline}",
                    "steps_to_reproduce": f"{bug.steps_to_reproduce or ''}",
                    "actual_result": f"{bug.actual_result or ''}",
                    "expected_result": f"{bug.expected_result or ''}",
                    "url": f"{bug.url or ''}",
                    "screenshot_drive_link": f"{bug.screenshot_drive_link or ''}",
                    "type": bug.type,
                    "priority": bug.priority,
                    "project": f"{bug.project.id}" if bug.project else None,
                    "project_name": bug.project.name if bug.project else None,
                    "resource": f"{bug.resource.id}" if bug.resource else None,
                    "resource_name": bug.resource.name if bug.resource else None,
                    "reported_by_name": bug.reported_by_name,
                    "reported_by_email": bug.reported_by_email,
                    "due_date": str(bug.due_date) if bug.due_date else None,
                    "created_at": bug.created_at.isoformat() if bug.created_at else None,
                    "updated_at": bug.updated_at.isoformat() if bug.updated_at else None,
                    "task": f"{taskbug.task.id}" if taskbug else "",
                    "labels": bug.labels or [],
                })

            response.append({
                "id": status_key,
                "name": status_key,
                "items": items,
                "totalCount": len(bugs_in_status),
            })

        if search:
            response = list(filter(lambda x: x["items"], response))

        return Response(response, status=status.HTTP_200_OK)


class AcceptanceTestStatusAPIView(APIView):
    permission_classes = [LMSStudentPermission, 
        AllowAny,
    ]

    def get(self, request):
        backlog = request.GET.get("backlog", None)
        hlr = request.GET.get("hlr", None)
        project = request.GET.get("project", None)
        item_order = request.GET.get("item_order", "-created_at")
        page_size = 10

        if request.GET.get("page_size", "").isdigit():
            page_size = int(request.GET.get("page_size"))

        # user = request.GET.get("user", None)

        itemsFilter = {}

        if hlr:
            itemsFilter["backlog__hlr_id"] = hlr

        if backlog:
            itemsFilter["backlog_id"] = backlog

        if project:
            itemsFilter["backlog__hlr__project_id"] = project

        # if user:
        #     itemsFilter["backlog__hlr__project_id"] = project

        response = []

        for acceptance_tests_status in acceptance_tests_status_choices:
            status_response = {}

            status_response["id"] = acceptance_tests_status[0]
            status_response["name"] = acceptance_tests_status[0]
            status_response["items"] = []

            itemsFilter["status"] = acceptance_tests_status[0]
            # itemsFilter["status__name"] = acceptance_tests_status[0]

            for acceptance_test in with_objs_lvl_permissions(AcceptanceTest.objects.filter(**itemsFilter).order_by(item_order).distinct(), request)[
                :page_size
            ]:
                status_response["items"].append(
                    {
                        "id": f"{acceptance_test.id}",
                        "name": f"{acceptance_test.then}",
                    }
                )

            response.append(status_response)

        return Response(response, status=status.HTTP_200_OK)


class BulkCreateHLRsAPIView(APIView):
    permission_classes = [
        LMSStudentPermission,
        AllowInternalOrMustBeAuthenticatedPermission
    ]
    serializer_class = BulkHLRsSerializer

    def post(self, request):
        is_internal_anon = is_request_internal(request) and not request.user.is_authenticated
        
        serializer = self.serializer_class(
            data=request.data,
            context={
                "request": request,
                "is_request_internal" : is_internal_anon,
            }
        )
        serializer.is_valid(raise_exception=True)

        hlrs_to_create = []

        for hlr_data in serializer.validated_data.get("hlrs", []):
            vdata = self._build_creation_metadata(
                hlr_data,
                request.user,
                is_internal_anon
            )

            # Append tag and merge metadata
            hlr_data["_tags"] = "Created by bpa"
            hlrs_to_create.append(HLR(**{ **hlr_data, **vdata }))

        HLR.objects.bulk_create(hlrs_to_create)

        return Response({"success": True}, status=status.HTTP_200_OK)

    def _build_creation_metadata(self, hlr_data, user, is_internal_anon):
        """
        Builds metadata for created_by and client depending on the type of request.
        Raises appropriate validation errors if required.
        """
        if is_internal_anon:
            created_by = hlr_data.get("created_by")
            client = hlr_data.get("client")

            errors = {}
            if not created_by:
                errors["created_by"] = "This field is required for internal anonymous requests."
            if not client:
                errors["client"] = "This field is required for internal anonymous requests."

            if errors:
                raise serializers.ValidationError(errors)

            return {
                "created_by": str(created_by),
                "client": str(client),
            }

        # For authenticated requests
        vdata = {"created_by": user.id}
        if hasattr(user, "client") and user.client:
            vdata["client"] = user.client.get("id")

        return vdata


class BulkCreateBacklogsAPIView(APIView):
    permission_classes = [
        LMSStudentPermission,
        AllowInternalOrMustBeAuthenticatedPermission
    ]
    serializer_class = BulkBacklogsSerializer

    def post(self, request):
        is_internal_anon = is_request_internal(request) and not request.user.is_authenticated

        serializer = self.serializer_class(
            data=request.data,
            context={
                "request": request,
                "is_request_internal": is_internal_anon,
            }
        )
        serializer.is_valid(raise_exception=True)

        raw_backlogs = serializer.validated_data.get("backlogs", [])

        backlogs_to_create = []
        uats_to_create = []

        for i, raw_data in enumerate(raw_backlogs):
            raw_data.pop("rebase_backlog_order", False)
            # Extract UATs, which will be processed and linked to the new backlog
            uats = raw_data.pop("uats", [])
            
            # Build metadata for the backlog itself
            backlog_vdata = self._build_creation_metadata(raw_data, request.user, is_internal_anon)

            hlr = raw_data.get("hlr")
            if not hlr:
                raise serializers.ValidationError({
                    f"backlogs[{i}].hlr": "HLR is missing or invalid."
                })

            as_a_val = raw_data.pop("as_a", None)
            if not as_a_val:
                raise serializers.ValidationError({
                    f"backlogs[{i}].as_a": "As A is a required field."
                })

            persona_obj = self._resolve_or_create_persona(
                value=as_a_val,
                hlr=hlr,
                created_by=backlog_vdata["created_by"],
                client=backlog_vdata.get("client")
            )

            full_data = {
                **raw_data,
                **backlog_vdata,
                "_tags": "Created by bpa",
                "hlr": hlr,
                "as_a": persona_obj,
            }
            
            # Create the Backlog instance in memory (not yet saved to DB)
            backlog_instance = Backlog(**full_data)
            backlogs_to_create.append(backlog_instance)

            # MERGED LOGIC: Prepare UATs for creation
            for uat_data in uats:
                # UATs inherit the same creation metadata as the parent backlog
                uat_full_data = {
                    **uat_data,
                    **backlog_vdata,
                    "_tags": "Created by bpa",
                    "backlog": backlog_instance, # Link UAT to the backlog instance
                }
                uats_to_create.append(AcceptanceTest(**uat_full_data))


        with transaction.atomic():
            # First, create all backlogs so they get assigned a primary key
            Backlog.objects.bulk_create(backlogs_to_create)
            
            # Now that backlogs are saved and have IDs, create the associated UATs
            # The 'backlog' attribute on each AcceptanceTest instance is now valid
            if uats_to_create:
                AcceptanceTest.objects.bulk_create(uats_to_create)

        return Response({
            "success": True,
            "created_backlogs": len(backlogs_to_create),
            "created_uats": len(uats_to_create)
        }, status=status.HTTP_200_OK)

    def _resolve_or_create_persona(self, value, hlr, created_by, client):
        try:
            uuid_val = UUID(value)
            return Persona.objects.get(id=uuid_val, project=hlr.project)
        except (ValueError, Persona.DoesNotExist):
            pass

        persona_by_name = Persona.objects.filter(name=value, project=hlr.project).first()
        if persona_by_name:
            return persona_by_name

        return Persona.objects.create(
            project=hlr.project,
            name=value,
            created_by=created_by,
            client=client,
        )

    def _build_creation_metadata(self, item_data, user, is_internal_anon):
        """
        Builds metadata for created_by and client. This helper is now used for
        both backlogs and UATs, promoting code reuse.
        """
        if is_internal_anon:
            created_by = item_data.get("created_by")
            client = item_data.get("client")

            errors = {}
            if not created_by:
                errors["created_by"] = "This field is required for internal anonymous requests."
            if not client:
                errors["client"] = "This field is required for internal anonymous requests."

            if errors:
                raise serializers.ValidationError(errors)

            return {
                "created_by": str(created_by),
                "client": str(client),
            }

        # For authenticated requests
        metadata = {"created_by": user.id}
        if getattr(user, "client", None) and user.client:
            metadata["client"] = user.client.get("id")
        return metadata


class BulkCreateUATsAPIView(APIView):
    permission_classes = [
        LMSStudentPermission,
        AllowInternalOrMustBeAuthenticatedPermission
    ]
    serializer_class = BulkUATsSerializer

    def post(self, request):
        is_internal_anon = is_request_internal(request) and not request.user.is_authenticated
        
        serializer = self.serializer_class(
            data=request.data,
            context={
                "request": request,
                "is_request_internal" : is_internal_anon,
            }
        )
        serializer.is_valid(raise_exception=True)

        uats_to_create = []

        for uat_data in serializer.validated_data.get("uats", []):
            vdata = self._build_creation_metadata(
                uat_data,
                request.user,
                is_internal_anon
            )

            # Append tag and merge metadata
            uat_data["_tags"] = "Created by bpa"
            uats_to_create.append(AcceptanceTest(**{ **uat_data, **vdata }))

        AcceptanceTest.objects.bulk_create(uats_to_create)

        return Response({"success": True}, status=status.HTTP_200_OK)

    def _build_creation_metadata(self, uat_data, user, is_internal_anon):
        """
        Builds metadata for created_by and client depending on the type of request.
        Raises appropriate validation errors if required.
        """
        if is_internal_anon:
            created_by = uat_data.get("created_by")
            client = uat_data.get("client")

            errors = {}
            if not created_by:
                errors["created_by"] = "This field is required for internal anonymous requests."
            if not client:
                errors["client"] = "This field is required for internal anonymous requests."

            if errors:
                raise serializers.ValidationError(errors)

            return {
                "created_by": str(created_by),
                "client": str(client),
            }

        # For authenticated requests
        vdata = {"created_by": user.id}
        if hasattr(user, "client") and user.client:
            vdata["client"] = user.client.get("id")

        return vdata


class BulkCreatePersonaAPIView(APIView):
    permission_classes = [
        LMSStudentPermission,
        AllowInternalOrMustBeAuthenticatedPermission
    ]
    serializer_class = BulkPersonaSerializer

    def post(self, request):
        is_internal_anon = is_request_internal(request) and not request.user.is_authenticated

        serializer = self.serializer_class(
            data=request.data,
            context={
                "request": request,
                "is_request_internal": is_internal_anon,
            }
        )
        serializer.is_valid(raise_exception=True)

        validated_personas = serializer.validated_data.get("personas", [])

        # Step 1: Collect all (project, name) pairs
        project_name_pairs = [
            (persona.get("project"), persona.get("name"))
            for persona in validated_personas
            if persona.get("project") and persona.get("name")
        ]

        # Step 2: Fetch existing personas
        existing_q = Q()
        for project, name in project_name_pairs:
            existing_q |= Q(project=project, name=name)

        existing_personas = Persona.objects.filter(existing_q)
        existing_set = set((p.project_id, p.name) for p in existing_personas)

        # Dicts to hold final response
        response = {}

        # Step 3: Prepare personas for creation
        personas_to_create = []

        for persona_data in validated_personas:
            project = persona_data.get("project")
            name = persona_data.get("name")

            if project and (getattr(project, "id"), name) in existing_set:
                continue  # Skip existing

            metadata = self._build_creation_metadata(persona_data, request.user, is_internal_anon)
            persona_data["_tags"] = "Created by bpa"
            complete_data = {**persona_data, **metadata}
            personas_to_create.append(Persona(**complete_data))

        # Step 4: Bulk create new personas
        Persona.objects.bulk_create(personas_to_create)

        # Step 5: Merge existing and created into response
        all_personas = Persona.objects.filter(existing_q)

        for persona in all_personas:
            project_id = getattr(persona, "project_id", None)
            if not project_id:
                continue

            name = persona.name
            response.setdefault(str(project_id), {})[name] = {
                "id": str(persona.id),
                "name": name,
                "description": persona.description or "",
                "project": str(project_id),
            }

        return Response({
            "success": True,
            "personas": response,
        }, status=status.HTTP_200_OK)


    def _build_creation_metadata(self, persona_data, user, is_internal_anon):
        """
        Build metadata for `created_by` and `client`.
        If the request is internal & anonymous, require these fields explicitly.
        """
        if is_internal_anon:
            created_by = persona_data.get("created_by")
            client = persona_data.get("client")

            errors = {}
            if not created_by:
                errors["created_by"] = "This field is required for internal anonymous requests."
            if not client:
                errors["client"] = "This field is required for internal anonymous requests."

            if errors:
                raise serializers.ValidationError(errors)

            return {
                "created_by": str(created_by),
                "client": str(client),
            }

        metadata = {"created_by": user.id}

        if hasattr(user, "client") and user.client:
            metadata["client"] = getattr(user.client, "id", user.client.get("id"))

        return metadata


class BulkUpdateTaskStatusAPIView(APIView):
    permission_classes = [LMSStudentPermission, IsAuthenticated]

    def patch(self, request):
        task_statuses = request.data if request.data else []
        response = []

        print(task_statuses)

        for task_status in task_statuses:

            if not task_status.get("id"):
                raise serializers.ValidationError(
                    {"id": "Task Status Must Have ID!"})

            instance = with_obj_lvl_get_object_or_404(
                TaskStatus, self.request, id=task_status["id"])
            serializer = TaskStatusSerializer(instance, data=task_status, context={
                                              "request": self.request}, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            response.append(serializer.data)

        return Response(response, status=status.HTTP_200_OK)


class BulkCreateSprintTasksAPIView(APIView):
    permission_classes = [LMSStudentPermission, IsAuthenticated]
    serializer_class = BulkCreateSprintTaskSerializer

    def post(self, request, sprint_id):
        sprint = with_obj_lvl_get_object_or_404(Sprint, request, id = sprint_id)
        sprint_meta_projects = with_objs_lvl_permissions(
            SprintMetaProject.objects.filter(sprint_meta=sprint.sprint_meta).all(),
            request
        )
        serializer = self.serializer_class(data=request.data, context = {
            "projects" : sprint_meta_projects.values_list("id", flat = True)
        })
        serializer.is_valid(raise_exception=True)
        sprint_tasks = [] 

        for task in serializer.validated_data.get("tasks", []):
            sprint_task = SprintTask.objects.create(
                task = task,
                sprint = sprint,
                created_by = request.user.id,
                client = request.user.client.get("id"),
            )
            sprint_tasks.append(sprint_task)

        return Response(SprintTaskSerializer(sprint_tasks, many=True, context = {
            "request" : request
        }).data, status=status.HTTP_200_OK)


class BulkCreateSprintBugsAPIView(APIView):
    permission_classes = [LMSStudentPermission, IsAuthenticated]
    serializer_class = BulkCreateSprintBugSerializer

    def post(self, request):
        serializer = self.serializer_class(data=request.data, context = {
            "request" : request,
            "client" : request.user.client.get("id"),
        })
        serializer.is_valid(raise_exception=True)

        sprint = serializer.validated_data.get("sprint")
        bugs = serializer.validated_data.get("bugs")
        sprint_tasks_to_create = []

        projects = SprintMetaProject.objects.filter(sprint_meta = sprint.sprint_meta).values_list("project_id", flat=True)

        for project in list(set(map(lambda x: x.project.id, bugs)) - set(projects)):
            SprintMetaProject.objects.create(
                project_id = project,
                sprint_meta = sprint.sprint_meta,
                created_by = request.user.id,
                client = request.user.client.get("id"),
            )
        
        for bug in bugs:
            taskbug = TaskBug.objects.filter(bug=bug).first()
            
            if not taskbug:
                continue

            if SprintTask.objects.filter(task = taskbug.task, sprint = sprint).exists():
                continue

            sprint_task = SprintTask(
                task = taskbug.task,
                sprint = sprint,
                created_by = request.user.id,
                client = request.user.client.get("id"),
            )
            sprint_tasks_to_create.append(sprint_task)

        SprintTask.objects.bulk_create(sprint_tasks_to_create)

        return Response({
            "sprint_tasks_created" : True
        }, status=status.HTTP_200_OK)


class BulkCreateBugsAPIView(APIView):
    permission_classes = [AllowAny]
    serializer_class = BulkBugsSerializer

    def post(self, request):
        serializer = self.serializer_class(
            data=request.data,
            context={
                "request": request,
                "is_request_internal": True,
            }
        )
        serializer.is_valid(raise_exception=True)

        program_id = serializer.validated_data.get("program_id")
        project_id = serializer.validated_data.get("project_id")
        bugs_data = serializer.validated_data.get("bugs", [])

        # Get the project to ensure it exists and belongs to the program
        project = Project.objects.get(id=project_id)
        
        # Use PULLSTREAM_CLIENT_ID for all bugs
        client_id = settings.PULLSTREAM_CLIENT_ID

        bugs_to_create = []
        
        for bug_data in bugs_data:
            # bug_data from serializer.validated_data is already a dict
            # Set project and client for each bug (override any existing values)
            bug_data["project"] = project
            bug_data["client"] = client_id
            # created_by can be None for anonymous requests
            bug_data["created_by"] = None
            
            bugs_to_create.append(Bug(**bug_data))

        # Use bulk_create for efficient database insertion
        Bug.objects.bulk_create(bugs_to_create)

        return Response({
            "success": True,
            "created_bugs": len(bugs_to_create)
        }, status=status.HTTP_201_CREATED)


class BulkUpdateAcceptanceStatusAPIView(APIView):
    permission_classes = [LMSStudentPermission, IsAuthenticated]

    def patch(self, request):
        acceptance_statuses = request.data if request.data else []
        response = []

        print(acceptance_statuses)

        for acceptance_status in acceptance_statuses:

            if not acceptance_status.get("id"):
                raise serializers.ValidationError(
                    {"id": "Acceptance Status Must Have ID!"})

            instance = with_obj_lvl_get_object_or_404(
                AcceptanceStatus, self.request, id=acceptance_status["id"])
            serializer = AcceptanceStatusSerializer(instance, data=acceptance_status, context={
                                                    "request": self.request}, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            response.append(serializer.data)

        return Response(response, status=status.HTTP_200_OK)


class BulkUpdateBugStatusAPIView(APIView):
    permission_classes = [LMSStudentPermission, IsAuthenticated]

    def patch(self, request):
        bug_statuses = request.data if request.data else []
        response = []

        print(bug_statuses)

        for bug_status in bug_statuses:

            if not bug_status.get("id"):
                raise serializers.ValidationError(
                    {"id": "Bug Status Must Have ID!"})

            instance = with_obj_lvl_get_object_or_404(
                BugStatus, self.request, id=bug_status["id"])
            serializer = BugStatusSerializer(instance, data=bug_status, context={
                                             "request": self.request}, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            response.append(serializer.data)

        return Response(response, status=status.HTTP_200_OK)


class DeleteAllAPIView(APIView):
    serializer_class = DeleteAllSerializer
    permission_classes = [LMSStudentPermission, IsAuthenticated]

    def get(self, request):
        return Response({}, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = self.serializer_class(
            data=request.data, context={"request": self.request})

        serializer.is_valid(raise_exception=True)

        model = apps.get_model(app_label="a_pm_rapi",
                               model_name=serializer.validated_data["model"])

        qfilter = {}
        client = self.request.user.client
        created_by = self.request.user.id

        if not client["id"]:
            qfilter["created_by"] = created_by
        else:
            qfilter["client"] = client["id"]

        model.objects.filter(**qfilter).delete()

        return Response({}, status=status.HTTP_200_OK)


class MultipleActionAPIView(APIView):
    serializer_class = MultipleActionSerializer
    permission_classes = [LMSStudentPermission, IsAuthenticated]

    def get(self, request):
        return Response({}, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = self.serializer_class(data=request.data)

        if serializer.is_valid():
            errors = {}
            valid_records = []

            model_name = serializer.validated_data["model"]
            records = serializer.validated_data["records"]
            fields = serializer.validated_data["fields"]
            action = serializer.validated_data["action"]
            lookup_field = serializer.validated_data["lookup_field"]

            validation_for_multple_action(
                model_name, records, fields, action, lookup_field, request, errors
            )

            if errors:
                return Response(errors, status=status.HTTP_400_BAD_REQUEST)

            custom_action_data = {}
            ct = ContentType.objects.filter(model=model_name.lower()).first()
            model = ct.model_class()

            if action == "Create":
                custom_action_data["created_by"] = request.user.id

                if request.user.client:
                    custom_action_data["client"] = request.user.client.get(
                        "id")

            elif action == "Update" and hasattr(model(), "updated_by"):
                custom_action_data["updated_by"] = request.user.id

            run_multiple_actions.delay(
                model_name, records, fields, action, lookup_field, custom_action_data
            )

            return Response({}, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ImportActionAPIView(APIView):
    serializer_class = ImportSerializer
    permission_classes = [LMSStudentPermission, IsAuthenticated, ImportPermission]

    override_serializers = {
        "HLR": "HlrSerializer"
    }
    fields_to_exclude_by_model = {}

    fields_to_exclude = [
        "everyone_can_see_it", "anonymous_can_see_it", "everyone_in_object_company_can_see_it",
        "only_these_roles_can_see_it", "only_these_users_can_see_it",
        "updated_by", "created_by", "client", "created_at", "updated_at", "is_deleted", "deleted_at", "_template"
    ]

    def has_import_permission(self, request):
        return "Can Import/Export" in getattr(request.user, "roles_names", [])

    def get(self, request, model_name):
        if not self.has_import_permission(request):
            return Response(
                {"detail": "You don't have permission to import/export."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response({})

    def post(self, request, model_name):
        if not self.has_import_permission(request):
            return Response(
                {"detail": "You don't have permission to import/export."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Validate file input
        serializer = self.serializer_class(data=request.FILES)
        serializer.is_valid(raise_exception=True)
        file = serializer.validated_data["file"]

        # Resolve model class
        try:
            model = apps.get_model('a_pm_rapi', model_name)
        except LookupError:
            raise serializers.ValidationError({
                "model": "Model doesn't exist or you don't have permission to import this model."
            })

        # Parse CSV
        try:
            df = pd.read_csv(file, delimiter=",", encoding="utf-8")
        except (ParserError, UnicodeDecodeError):
            raise serializers.ValidationError({
                "file": "Please upload a valid UTF-8 encoded pipe-delimited CSV file."
            })

        df = df.replace({np.nan: None})
        df["created_by"] = request.user.id
        df["client"] = request.user.client["id"]

        records = df.to_dict("records")
        if not records:
            raise serializers.ValidationError({"file": "There are no rows in the CSV file."})

        # Prepare request dictionary
        request_dict = {
            "user": {
                "id": request.user.id,
                "actingAs": request.user.actingAs,
                "roles_ids": request.user.roles_ids,
                "roles": request.user.roles,
                "roles_names": request.user.roles_names,
                "email": request.user.email,
                "client": request.user.client,
                "access_token": request.user.access_token,
                "is_authenticated": request.user.is_authenticated,
            },
            "request_dict": True,
        }

        # Fetch model metadata from auth/microservice registry
        model_details = get_model(
            model.__name__,
            microservice_name=settings.MS_NAME,
            access_token=request.user.access_token
        )

        if not model_details or not model_details.get("id") or not model_details.get("microserviceId"):
            raise serializers.ValidationError({
                "model": "Invalid or missing model details."
            })

        # Create import log entry
        log_report = create_importlog(
            {
                "name": file.name,
                "microservice": settings.MS_NAME,
                "microservice_id": model_details["microserviceId"],
                "model": model.__name__,
                "model_id": model_details["id"],
                "total_rows": len(records),
            },
            request.user.access_token
        )

        if not log_report:
            raise serializers.ValidationError({
                "log_report": "Failed to create import log entry."
            })

        # Start async import job
        import_.delay(
            log_report,
            model.__name__,
            file.name,
            len(records),
            records,
            request.user.client["id"],
            request.user.id,
            self.fields_to_exclude,
            self.fields_to_exclude_by_model,
            self.override_serializers,
            request_dict
        )

        return Response(log_report, status=status.HTTP_200_OK)


class ExportAPIView(APIView):
    permission_classes = [LMSStudentPermission, IsAuthenticated, ImportPermission]

    override_serializers = {
        "HLR": "HlrSerializer"
    }

    exclude_fields_by_model = {
        # "UIPrefix": ["some_field"]
    }

    exclude_fields_global = [
        "everyone_can_see_it", "anonymous_can_see_it", "everyone_in_object_company_can_see_it",
        "only_these_roles_can_see_it", "only_these_users_can_see_it",
        "updated_by", "created_by", "client", "created_at", "updated_at", "is_deleted", "deleted_at", "_template"
    ]

    def has_export_permission(self, request):
        return "Can Import/Export" in getattr(request.user, "roles_names", [])

    def get(self, request, model_name):
        if not self.has_export_permission(request):
            raise serializers.ValidationError(
                {"detail": "You don't have permission to import/export."}
            )

        try:
            model = apps.get_model("a_pm_rapi", model_name)
        except LookupError:
            raise serializers.ValidationError(
                {"detail": "Model does not exist or you lack permission to export it."}
            )

        queryset = with_objs_lvl_permissions(model.objects.all(), request)

        model_serializer = get_serializer(model.__name__, self.override_serializers)
        all_fields = [f.name for f in model._meta.fields]
        serializer_fields = (
            model_serializer.Meta.fields if hasattr(model_serializer.Meta, 'fields') and model_serializer.Meta.fields != "__all__" else all_fields
        )

        excluded_fields = set(
            self.exclude_fields_global + self.exclude_fields_by_model.get(model_name, [])
        )
        export_fields = [f for f in serializer_fields if f not in excluded_fields]

        if not export_fields:
            raise serializers.ValidationError(
                {"detail": "No exportable fields available for this model."}
            )

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{model_name.lower()}s.csv"'

        writer = csv.writer(response, delimiter=",", quoting=csv.QUOTE_MINIMAL)
        writer.writerow(export_fields)

        # Using .values_list is efficient as it avoids full model instantiation
        for row in queryset.values_list(*export_fields):
            writer.writerow([str(val) if val is not None else "" for val in row])

        return response


class GetBulkDetailsAPIView(APIView):
    permission_classes = [LMSStudentPermission, AllowAny]
    filter_querysets = {
        # "ModelName" : lambda ids, request: ModelName.objects.filter(id__in=ids).distinct(),
    }
    model_serializer = {
        # "ModelName" : ModelNameSerializer,
    }

    def post(self, request):
        serializer = BulkDetailsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = []

        for child in serializer.data["data"]:
            details = {}

            model = apps.get_model(app_label='a_pm_rapi',
                                   model_name=child["model"])

            get_queryset = self.filter_querysets.get(child["model"], lambda ids, request: with_objs_lvl_permissions(
                model.objects.filter(id__in=ids).distinct(), request))(child["ids"], request)

            qs_serializer = self.model_serializer.get(child["model"], globals(
            )[f'{child["model"]}Serializer'])(get_queryset, many=True)

            list(map(lambda data: details.update(
                {f"{data['id']}": data}), qs_serializer.data))

            response.append({
                "field_name": child["field_name"],
                "get_path": child.get("get_path"),
                "set_path": child.get("set_path"),
                "inner_field": child.get("inner_field"),
                "model": child["model"],
                "details": details,
            })

        return Response(response, status=status.HTTP_200_OK)

class BulkConnectTasksToSprintAPIView(APIView):
    permission_classes = [LMSStudentPermission, IsAuthenticated]
    serializer_class = BulkConnectTasksToSprintSerializer

    def post(self, request):
        serializer = self.serializer_class(data=request.data, context = {
            "request" : request
        })
        serializer.is_valid(raise_exception=True)

        sprint = serializer.validated_data.get("sprint")
        project = serializer.validated_data.get("project")
        all_ = serializer.validated_data.get("all_")
        ids = serializer.validated_data.get("ids")
        exclude = serializer.validated_data.get("exclude")
        filters = serializer.validated_data.get("filters")
        search_query = serializer.validated_data.get("search_query", "")

        if all_:
            qs = with_objs_lvl_permissions(Task.objects.filter(project=project).exclude(id__in=exclude), request)
        else:
            qs = with_objs_lvl_permissions(Task.objects.filter(id__in=ids, project=project), request)

        filter_ = TaskFilterset(filters, queryset=qs)
        tasks = CustomSearchFilter.filter_queryset(
            search_query,
            [
                "name",
                "description",
                "duration_unit",
                "notes"
            ],
            filter_.qs,

        )

        if not tasks:
            raise serializers.ValidationError(
                {"tasks": "No Tasks selected!"})
        
        if not SprintMetaProject.objects.filter(
            project=project,
            sprint_meta=sprint.sprint_meta,
            client=self.request.user.client.get("id")
        ).exists():
            raise serializers.ValidationError(
                {"sprint": "Invalid Sprint!"})

        all_tasks = []

        for task in tasks:
            all_tasks.append(task)
            get_all_tasks(task, all_tasks)
            
        already_sprint_tasks = SprintTask.objects.filter(
            sprint=sprint,
            task__in=list(map(lambda x: x.id, all_tasks)),
            client=self.request.user.client.get("id")
        ).all().values_list("task_id", flat=True)

        sprint_tasks_to_create = []
        new_already_sprint_tasks = [
            *already_sprint_tasks
        ]

        for task in all_tasks:
            if task.id in new_already_sprint_tasks:
                continue
            sprint_tasks_to_create.append(SprintTask(
                task = task,
                sprint = sprint,
                created_by = request.user.id,
                client=self.request.user.client.get("id")
            ))
            new_already_sprint_tasks.append(task.id)

        SprintTask.objects.bulk_create(
            sprint_tasks_to_create)

        return Response({"sprint_tasks": "Sprint Tasks Created Successfully!"}, status=status.HTTP_200_OK)


class BulkDeleteTaskAPIView(APIView):
    permission_classes = [LMSStudentPermission, IsAuthenticated]
    serializer_class = BulkDeleteTaskSerializer

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data.get("ids", [])

        instances = with_objs_lvl_permissions(Task.objects.filter(id__in=ids), request)
        
        instances.delete()

        return Response({}, status=status.HTTP_204_NO_CONTENT)


class BulkDuplicateAPIView(APIView):
    permission_classes = [LMSStudentPermission, IsAuthenticated]
    serializer_class = BulkDuplicateSerializer

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            model = apps.get_model(
                'a_pm_rapi', serializer.validated_data["model"])
        except LookupError as e:
            raise serializers.ValidationError({
                "model": "Invalid model, model doesn't exist!",
            })

        ids = serializer.validated_data["ids"]
        objects = []
        duplicated_objects = []

        for id_ in ids:

            try:
                object_ = with_obj_lvl_get_object_or_404(
                    model, request, id=id_)
            except Http404:
                raise serializers.ValidationError(
                    {"id": id_, "message": f"{id_} doesn't exist in model {model.__name__}"})

            objects.append(object_)

        for object_ in objects:
            try:
                duplicated_objects.append(bulk_duplicate_object(object_, global_attrs={
                    "created_by": request.user.id,
                    "client": request.user.client.get("id"),
                }))
            except IntegrityError as e:
                raise serializers.ValidationError({
                    "id": object_.id,
                    "message": "Can't duplicate this object!",
                    "error": str(e)
                })

        return Response({
            "duplicated_objects": [f"{object_.id}" for object_ in duplicated_objects]
        }, status=status.HTTP_200_OK)


class CloneTaskAPIView(APIView):
    permission_classes = [LMSStudentPermission, IsAuthenticated]
    serializer_class = CloneTaskSerializer

    def post(self, request, task_id=None):
        instance = with_obj_lvl_get_object_or_404(Task, request, id=task_id)
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)

        name = serializer.validated_data.get("name")
        order = serializer.validated_data.get("order")
        rebase = serializer.validated_data.get("rebase")
        clone_sub_tasks = serializer.validated_data.get("clone_sub_tasks", True)

        records = {
            "tasks_to_create" : {},
            "task_comments_to_create" : {},
            "sprint_tasks_to_create" : {},
        }

        custom_attrs = {
            "created_by" : request.user.id,
            "client" : request.user.client.get("id"),
        }

        new_task = duplicate_task(instance, name, order, custom_attrs, records, clone_sub_tasks)
        Task.objects.bulk_create(records["tasks_to_create"].values())
        TaskComment.objects.bulk_create(records["task_comments_to_create"].values())
        SprintTask.objects.bulk_create(records["sprint_tasks_to_create"].values())

        if rebase:
            rebase_tasks_order(
                new_task,
                new_task.order,
                new_task.parent_task,
                new_task.project,
                self.request.user.client.get("id")
            )

        return Response({
            "task": {
                "id" : f"{new_task.id}",
                **model_to_dict(new_task, exclude=["rrule"]),
            },
        }, status=status.HTTP_200_OK)


class DuplicateBacklogAPIView(APIView):
    permission_classes = [LMSStudentPermission, IsAuthenticated]
    serializer_class = DuplicateBacklogsSerializer

    def post(self, request):
        serializer = self.serializer_class(data=request.data, context = {
            "request" : request
        })
        serializer.is_valid(raise_exception=True)

        backlogs = serializer.validated_data.get("ids")
        new_hlr = serializer.validated_data.get("new_hlr")

        records = {
            "as_a_to_create" : {},
            "backlogs_to_create" : {},
            "acceptance_tests_to_create" : {},
        }

        custom_attrs = {
            "created_by" : request.user.id,
            "client" : request.user.client.get("id"),
        }

        for backlog in backlogs:
            duplicate_backlog(
                backlog,
                new_hlr,
                custom_attrs,
                records,
            )

        Persona.objects.bulk_create(records["as_a_to_create"].values())
        Backlog.objects.bulk_create(records["backlogs_to_create"].values())
        AcceptanceTest.objects.bulk_create(records["acceptance_tests_to_create"].values())

        return Response({
            "status" : "OK",
        }, status=status.HTTP_200_OK)


class CloneSystemTemplateAPIView(APIView):
    permission_classes = [LMSStudentPermission, IsAuthenticated]
    serializer_class = CloneSystemTemplateSerializer
    custom_params_serializer = {
        "Project" : ProjectSerializer
    }

    def post(self, request, model=None):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        is_template_admin = request.user.is_authenticated and "Template Admins" in request.user.roles_names

        template_id = serializer.validated_data.get("template_id", None)

        template_details = get_template(template_id, request.user.access_token)

        if not template_details:
            raise serializers.ValidationError({
                "template_id" : "Template not found!"
            })
        
        if not model == template_details.get("details", {}).get("model", {}).get("model", None):
            raise serializers.ValidationError({
                "template_id" : "Invalid Template!"
            })

        try:
            model = apps.get_model('a_pm_rapi', model)
        except LookupError as e:
            raise serializers.ValidationError({
                "model": "Invalid model, model doesn't exist!",
            })
        
        template = model.template_objects.filter(id=template_id).first()
        create_a_template = is_template_admin and not template
        
        if create_a_template:
            clone_from = template_details["clone_from"]
            custom_params = json.loads(template_details["custom_params_in_json"])

            object_to_clone = with_obj_lvl_get_object_or_404(model, request, id=clone_from)

            serializer = self.custom_params_serializer[model.__name__](clone_from, data=custom_params, context={ "request" : request }, partial=True)
            serializer.is_valid(raise_exception=True)
            new_custom_params = serializer.validated_data
            new_custom_params["id"] = template_id
            cloned_instance = clone_model(model, new_custom_params, request, object_to_clone, True)
        else:
            custom_params = serializer.validated_data.get("custom_params", {})
            serializer = self.custom_params_serializer[model.__name__](template, data=custom_params, context={ "request" : request }, partial=True)
            serializer.is_valid(raise_exception=True)
            new_custom_params = serializer.validated_data
            cloned_instance = clone_model(model, new_custom_params, request, template, False)

        return Response({
            "id" : cloned_instance.id,
            **model_to_dict(cloned_instance)
        } if cloned_instance else {}, status=status.HTTP_200_OK)

    def delete(self, request, model=None, template_id=None):

        if not request.user.is_authenticated or not "Template Admins" in request.user.roles_names:
            raise exceptions.PermissionDenied()

        template_details = get_template(template_id, request.user.access_token)

        if not template_details:
            raise serializers.ValidationError({
                "template_id" : "Template not found!"
            })
        
        if not model == template_details.get("details", {}).get("model", {}).get("model", None):
            raise serializers.ValidationError({
                "template_id" : "Invalid Template!"
            })

        try:
            model = apps.get_model('a_pm_rapi', model)
        except LookupError as e:
            raise serializers.ValidationError({
                "model": "Invalid model, model doesn't exist!",
            })
        
        try:
            object_to_delete = model.template_objects.get(get_obj_lvl_filters(request), id=template_id)
        except model.DoesNotExist as e:
            raise serializers.ValidationError({
                "template_id" : "Template not found!"
            })
        
        object_to_delete.delete(updated_by = self.request.user.id)

        return Response({ "deleted": True }, status=status.HTTP_200_OK)


class BulkStageCreateAPIView(APIView):
    permission_classes = [LMSStudentPermission, IsAuthenticated]

    def post(self, request, project_id):

        workflow_id = request.data.get("workflow_id")

        if not workflow_id:
            raise serializers.ValidationError({
                "workflow_id": "Workflow id is required!"
            })

        tasks = with_objs_lvl_permissions(
            Task.objects.filter(project_id=project_id,
                                parent_task__isnull=True).order_by("order"),
            request
        )

        payload = {
            "stages": []
        }

        create_task_in_bpa(tasks, request, payload, workflow_id)
        
        print(payload["stages"])
        print(list(map(lambda x: x["order"], payload["stages"])))

        bulk_create_stages_in_bpa(payload, request.user.access_token)

        return Response({}, status=status.HTTP_200_OK)


class GetOrderedTaskStatusesAPIView(APIView):
    permission_classes = [LMSStudentPermission, IsAuthenticated]

    def get(self, request, project_id=None):
        project = with_obj_lvl_get_object_or_404(Project, request, id=project_id)
        search = request.GET.get("search", "")

        task_statuses = TaskStatus.get_all_task_status_of_a_project(project_id, search)

        return Response(TaskStatusSerializer(task_statuses, many=True, context = { "request" : request }).data, status=status.HTTP_200_OK)

