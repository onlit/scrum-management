import requests
from django.conf import settings
from django.db.models import UUIDField, ForeignKey
from django.db.utils import OperationalError, ProgrammingError
from .models import TaskStatus
from django.apps import apps
import importlib
import inspect
from django.db.models import Q
from django.contrib.contenttypes.models import ContentType
from celery import shared_task
from django.forms.models import model_to_dict
from django.shortcuts import get_object_or_404
from django.db.models import Q
from rest_framework.exceptions import PermissionDenied
from uuid import UUID
from rest_framework import serializers
from rest_framework.utils.serializer_helpers import ReturnList
import json
from glom import glom, assign
import io
import ipaddress
import re


def validate_phone_number(value):
    """ Validator to ensure phone numbers follow the required format. """
    if value:
        pattern = r"^\+\d{1,3}\d{7,14}$"  # Example: +14155552671
        if not re.match(pattern, value):
            raise serializers.ValidationError(
                "Phone number must be in the format: +[CountryCode][Number] without spaces or hyphens.")


def is_request_internal(request):
    return ipaddress.ip_address(request.META['REMOTE_ADDR']) in ipaddress.ip_network(settings.INTERNAL_NETWORK)\


def trigger_bpa(access_token, workflow, workflow_instance="", manual=False, payload={}):
    url = f"{settings.BPA_HOST}trigger/"

    headers = {
        "Content-Type": "application/json",
    }

    if access_token:
        headers["Authorization"] = f"{access_token}"

    response = requests.post(url, data=json.dumps({
        "workflow_id": workflow,
        "instance_id": workflow_instance,
        "payload": payload,
        "manual": manual
    }, default=str), headers=headers)

    if response.status_code == 200:
        return response.json()
    elif response.status_code == 400:
        raise serializers.ValidationError({"bpa": response.json()})
    else:
        raise serializers.ValidationError(
            {"bpa": f"the status code is {response.status_code} from this url {url}"})


def find_workflow_and_trigger(instance, model, client, custom={}, access_token=None):
    url = f"{ settings.SYSTEM_HOST }automata-connection-with-a-models/{settings.MS_NAME}/{model}/"
    headers = {}

    if access_token:
        headers["Authorization"] = access_token

    response = requests.get(
        f'{url}',
        params={
            "client" : client
        },
        headers=headers
    )

    if not response.status_code == 200:
        return
    
    response = response.json()

    payload = {
        "id" : instance.id,
        "created_at" : instance.created_at,
        "updated_at" : instance.updated_at,
        **custom,
        **model_to_dict(instance),
    }


    resp = trigger_bpa(
        access_token,
        response["automata"],
        payload=payload
    )

    instance.workflow = response["automata"]
    instance.workflow_session = resp["instance"]
    instance.save()


def get_only_subtasks(instance):
    tasks = instance.get_child_branch()
    only_child_tasks = []

    for task in tasks:
        child_task = next((x for x in tasks if x.parent_task_id == task.id), None)

        if child_task:
            continue
        
        only_child_tasks.append(task)

    return only_child_tasks


class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):

        if isinstance(obj, UUID):
            # if the obj is uuid, we simply return the value of uuid
            return obj.hex

        return json.JSONEncoder.default(self, obj)


def create_rebase_conflict_tasks_csv(request, conflict_tasks):
    columns = [
        "id",
        "name",
        "description",
        "task_type",
        "status",
        "started",
        "deadline",
        "project",
        "parent_task",
    ]

    delimiter = "|"
    
    csv_contents = delimiter.join(columns) + "\n"

    for task in conflict_tasks:
        row = ""

        for field in columns:
            if field == "task_type":
                value = (task.task_type.name if task.task_type else '')
            elif field == "status":
                value = (task.status.name if task.status else '')
            elif field == "project":
                value = (task.project.name if task.project else '')
            elif field == "parent_task":
                value = (task.parent_task.name if task.parent_task else '')
            else:
                value = str(getattr(task, field, ""))
            
            row += str(value or '').replace("|", ";").replace("\n", " ").replace("\r", "").strip() + delimiter

        csv_contents += row + "\n"
    
    file = io.StringIO(csv_contents)
    files = {'file': ('conflict-tasks.csv', file)}

    response = requests.post(
        f"{settings.DRIVE_HOST}v1/files/",
        files=files,
        data={
            "anonymous_can_see_it": "true",
            "created_by": request.user.id,
            "client": request.user.client.get("id"),
        }
    )
    
    file.close()

    if not response.status_code == 201:
        raise serializers.ValidationError({
            "started" : "Failed to upload task conflicted file to drive.",
            "status_code" : response.status_code,
            "content" : response.content,
        })

    return response.json().get("fileUrl")


def send_email(mail_template_id, to_emails, bcc_emails=[], cc_emails=[], context={}):
    data = {
        "type": "email",
        "template": f"{mail_template_id}",
        "to_emails": to_emails,
        "bcc_emails": bcc_emails,
        "cc_emails": cc_emails,
        "use_template": True,
        "context": context,
        "attachments": []
    }

    response = requests.post(
        f"{settings.NOTIFICATION_HOST}send-template-emails/",
        headers={"Content-type": "application/json"},
        data=json.dumps(data, cls=UUIDEncoder),
    )

    return response.status_code, response.json()


def bulk_duplicate_object(obj, attrs={}, global_attrs={}):

    # we start by building a "flat" clone
    clone = obj._meta.model.objects.get(pk=obj.pk)
    clone.pk = None

    if hasattr(clone, "name"):
        clone.name = f"{clone.name} (Copy)"

    for key, value in global_attrs.items():
        setattr(clone, key, value)

    # if caller specified some attributes to be overridden,
    # use them
    for key, value in attrs.items():
        setattr(clone, key, value)

    # save the partial clone to have a valid ID assigned
    clone.save()

    # Scan field to further investigate relations
    fields = clone._meta.get_fields()
    for field in fields:

        # Manage M2M fields by replicating all related records
        # found on parent "obj" into "clone"
        if not field.auto_created and field.many_to_many:
            for row in getattr(obj, field.name).all():

                for key, value in global_attrs.items():
                    setattr(row, key, value)

                if hasattr(row, "name"):
                    row.name = f"{row.name} (Copy)"

                getattr(clone, field.name).add(row)

        # Manage 1-N and 1-1 relations by cloning child objects
        if field.auto_created and field.is_relation:
            if field.many_to_many:
                # do nothing
                pass
            else:
                # provide "clone" object to replace "obj"
                # on remote field
                attrs = {
                    field.remote_field.name: clone
                }
                children = field.related_model.objects.filter(
                    **{field.remote_field.name: obj})
                for child in children:
                    bulk_duplicate_object(child, attrs, global_attrs)

    return clone


def update_obj_detail_payload(obj, field_path, value):
    assign(obj, f"{field_path}", value, missing=dict)
    return obj


def update_obj_detail(obj, details):
    obj["details"] = obj.get("details", {})
    [
        update_obj_detail_payload(
            obj,
            field_detail["set_path"],
            # getting id to fetch the object detail
            field_detail["details"].get(
                f'{glom(obj, field_detail["get_path"])}', {})
        ) for fields in details
        for field_detail in fields
    ]
    return obj


def append_details(list_of_objects, details):
    new_objects = []

    if type(list_of_objects) == ReturnList or type(list_of_objects) == list:

        new_objects = []
        for obj in list_of_objects:
            update_obj_detail(obj, details)
            new_objects.append(obj)

    else:
        new_objects = list_of_objects
        update_obj_detail(new_objects, details)

    return new_objects


def get_detail_of_a_record(host, payload, access_token):

    url = f"{host}get-bulk-details/"

    resp = requests.post(url, data=json.dumps({
        "data": payload
    }), headers={
        "Content-Type": "application/json",
        "Authorization": f"{access_token}"
    })

    if resp.ok:
        return resp.json()
    else:
        raise serializers.ValidationError({
            "record_id": "Failed to fetch record details",
            "status_code": resp.status_code,
            "content": resp.content,
        })


def get_bulk_details(field_details, access_token):
    response = []

    for host, fields in field_details.items():
        url = f"{host}get-bulk-details/"

        resp = requests.post(url, data=json.dumps({
            "data": fields
        }), headers={
            "Content-Type": "application/json",
            "Authorization": f"{access_token}"
        })

        if resp.ok:
            response.append(resp.json())

    return response


def serializer_uuid_field_details(view, request, list_of_objects):
    view_serializer = getattr(view, "serializer_class",
                              getattr(view, "get_serializer", None))

    if view_serializer:
        fields = list(filter(lambda field: field[0] in settings.UUID_KEY_VALUE_PAIR and serializers.UUIDField == type(
            field[1]), list(view_serializer().fields.items())))
    else:
        fields = []

    fields += list(filter(lambda field: field[0] in settings.UUID_KEY_VALUE_PAIR, list(
        getattr(view, "inner_uuid_key_value_pair", {}).items())))

    field_details = {}

    for field in fields:
        field_name = field[0]

        if type(field[1]) == dict:
            get_path, set_path, inner_field = (field[1].get("get_path", field_name), field[1].get(
                "set_path", f"details.{field_name}"), field[1].get("inner_field", False))
        else:
            get_path, set_path, inner_field = (
                field_name, f"details.{field_name}", False)

        uuid_pair = settings.UUID_KEY_VALUE_PAIR[field_name]

        field_ids = list(filter(lambda field_id: field_id, map(lambda data: f"{glom(data, get_path)}", list_of_objects))) if type(
            list_of_objects) == ReturnList or type(list_of_objects) == list else [f"{glom(list_of_objects, get_path)}"]

        field_ids = [] if field_ids == [None] else field_ids

        field_details[uuid_pair["host"]] = field_details.get(
            uuid_pair["host"], [])

        field_details[uuid_pair["host"]].append({
            "field_name": field_name,
            "get_path": get_path,
            "set_path": set_path,
            "inner_field": inner_field,
            "ids": field_ids,
            "model": uuid_pair["model"]
        })

    details = get_bulk_details(field_details, request.user.access_token)

    list_of_objects = append_details(list_of_objects, details)

    return list_of_objects


def create_task_status():
    try:
        print(TaskStatus.objects.get_or_create(name="unassigned"))
    except (OperationalError, ProgrammingError) as e:
        print("Can Not Create A Task Status!")
        print(str(e))


def generate_serializer_unique_query(
    model, name, custom_filter_fields=None, exclude_fields={}
):
    qfilter = {
        "name": name,
    }

    if custom_filter_fields:
        qfilter.update(custom_filter_fields)

    print(qfilter)

    query = model.objects.filter(**qfilter).exclude(**exclude_fields)
    print(query)
    print(query.exists())

    return query.exists()


def get_details_from_uuid(url, id, token=None):
    headers = {}

    if token:
        headers["Authorization"] = f"{token}"

    url = f"{url}/{id}/"

    resp = requests.get(url, headers=headers)

    if resp.ok:
        return resp.json()
    else:
        return {"error": f"the status code is {resp.status_code} from this url {url}"}


def get_all_uuid_fields(model):
    # print([f.name for f in model._meta.fields if isinstance(f, UUIDField)])
    return [f.name for f in model._meta.fields if isinstance(f, UUIDField)]


def get_all_foreign_fields(model):
    # print([f.name for f in model._meta.fields if isinstance(f, ForeignKey)])
    return [f.name for f in model._meta.fields if isinstance(f, ForeignKey)]


def get_all_users():
    users = []

    url = f"{ settings.AUTH_HOST }accounts/register/"

    response = requests.get(url)

    if response.status_code == 200:
        users = map(lambda x: (x["id"], x["email"]), response.json())

    return tuple(users)


def get_all_roles():
    roles = []

    url = f"{ settings.AUTH_HOST }accounts/roles/"

    response = requests.get(url)

    if response.status_code == 200:
        roles = map(lambda x: (x["name"], x["name"]), response.json())

    return tuple(roles)


def register_microservice():
    """Registers the microservice with the central API."""
    if settings.IS_LOCAL:
        print("Skipping microservice registration in local environment.")
        return
    
    models = []

    for model in apps.get_models():
        fields = [{"name": field.name, "type": field.get_internal_type()} for field in model._meta.fields]

        models.append({
            "name": model.__name__,
            "fields": fields
        })

    if not models:
        print("No models found. Registration skipped.")
        return

    payload = {
        "microservice": {
            "name": settings.MS_NAME,
            "description": f"Microservice responsible for managing {settings.MS_NAME}-related tasks.",
            "sandboxDomainUrl": "https://sandbox.pm.pullstream.com",
            "stagingDomainUrl": "https://pm.staging.pullstream.com",
            "productionDomainUrl": "https://pm.pullstream.com",
        },
        "models": models
    }

    try:
        response = requests.post(f"{ settings.AUTH_HOST }v1/microservices/register/", json=payload)
        response.raise_for_status()
        print("Microservice registered successfully.")
    except requests.exceptions.RequestException as e:
        print(f"Failed to register microservice: {e}")


def get_filter(has_beta_field, request, custom_filteration={}):

    client = request.user.client
    created_by = request.user.id
    qfilter = custom_filteration

    if not client:
        qfilter["created_by"] = created_by

    if (
        client
        and not client.get("name").lower() == "pullstream"
        and not has_beta_field
    ):
        qfilter["client"] = client.get("id")

    qfilter = Q(**qfilter)

    if client and not client.get("name").lower() == "pullstream" and has_beta_field:
        qfilter.add(Q(client=client.get("id")), Q.AND)

        if client.get("beta_partners"):
            qfilter.add(Q(beta_partners=True), Q.OR)

    return qfilter


def get_all_record_ids(model_name=None):
    for model in apps.get_models():
        print(model.objects.all())


def get_all_model_serializers():
    serializers = []
    for name, cls in inspect.getmembers(
        importlib.import_module("a_pm_rapi.api.serializers"), inspect.isclass
    ):
        if cls.__module__ == "a_pm_rapi.api.serializers":
            if hasattr(cls, "Meta"):
                if hasattr(cls.Meta, "model"):
                    serializers.append(cls)
    return serializers


def get_model_serializer(model_name):
    for name, cls in inspect.getmembers(
        importlib.import_module("a_pm_rapi.api.serializers"), inspect.isclass
    ):
        if cls.__module__ == "a_pm_rapi.api.serializers":
            if hasattr(cls, "Meta"):
                if hasattr(cls.Meta, "model"):
                    if cls.Meta.model.__name__ == f"{model_name}":
                        return cls

    return


def check_if_write_only_field_exist_in_serializer(serializer, field):
    for write_only_field in serializer()._writable_fields:
        if write_only_field.field_name == f"{field}":
            return True

    return False


def check_if_fields_exists_in_serializer(fields, serializer, errors):
    for field, value in fields.items():
        if not check_if_write_only_field_exist_in_serializer(serializer, field):
            if not errors.get("fields_not_found", None):
                errors["fields_not_found"] = {}
                errors["fields_not_found"][
                    f"{field}"
                ] = "This Field Doesn't Exist In Serializer!"
            else:
                errors["fields_not_found"][
                    f"{field}"
                ] = "This Field Doesn't Exist In Serializer!"


def check_if_records_exists_in_model(request, records, model, lookup_field, errors):
    for value in records:

        try:
            query = model.objects.filter(
                get_filter(
                    hasattr(model(), f"beta_partners"), request, {
                        lookup_field: value}
                )
            )
        except Exception as e:
            if not errors.get("records_not_found", None):
                errors["records_not_found"] = {}
                errors["records_not_found"][f"{value}"] = str(e)
            else:
                errors["records_not_found"][f"{value}"] = str(e)

            continue

        if not query.exists():
            if not errors.get("records_not_found", None):
                errors["records_not_found"] = {}
                errors["records_not_found"][f"{value}"] = "This Record Doesn't Exist!"
            else:
                errors["records_not_found"][f"{value}"] = "This Record Doesn't Exist!"


def validation_for_multple_action(
    model_name, records, fields, action, lookup_field, request, errors
):
    ct = ContentType.objects.filter(model=model_name.lower()).first()

    if not ct:
        errors["model"] = "Model Not Found!"
        return

    model = ct.model_class()

    if not hasattr(model(), f"{lookup_field}"):
        errors["lookup_field"] = "Lookup Field Doesn't Exist!"
        return

    model_serializer = get_model_serializer(model_name)

    if not model_serializer:
        errors["model"] = "Model Serializer Not Found!"
        return

    if not records and action != "Create":
        errors["records"] = "Records Shouldn't Be Empty!"
        return

    check_if_fields_exists_in_serializer(fields, model_serializer, errors)

    if not action == "Create":
        check_if_records_exists_in_model(
            request, records, model, lookup_field, errors)

    if errors:
        return

    validation = model_serializer(
        data=fields, partial=True if not action == "Create" else False
    )

    if not validation.is_valid():
        errors["serializer_errors"] = validation.errors
        return


@shared_task(name="run_multiple_actions")
def run_multiple_actions(
    model_name, records, fields, action, lookup_field, custom_action_data
):

    fields.update(custom_action_data)
    ct = ContentType.objects.filter(model=model_name.lower()).first()
    model = ct.model_class()

    if action == "Create":

        if not records:
            model.objects.create(**fields)
            return

        else:
            for value in records:
                custom_data = fields
                custom_data[lookup_field] = value
                model.objects.create(**custom_data)

    elif action == "Update":

        for value in records:
            q = model.objects.filter(**{lookup_field: value}).first()

            if q:
                for field, value in fields.items():
                    setattr(q, field, value)

                q.save()

    elif action == "Delete":

        for value in records:
            q = model.objects.filter(**{lookup_field: value}).first()

            if q:
                q.delete()


def get_permission_for_objects(model, objects):

    resp = requests.post(
        f"{settings.AUTH_HOST}accounts/object-level-permissions/{settings.MS_NAME}/{model}/",
        data={
            "microservice": f"{settings.MS_NAME}",
            "model": f"{model}",
            "objects": objects,
        },
    )

    return resp.json()


def duplicate_object(obj, attrs={}):

    # we start by building a "flat" clone
    clone = obj._meta.model.objects.get(pk=obj.pk)
    clone.pk = None
    clone.no_task_types_and_task_statuses = True

    # if caller specified some attributes to be overridden,
    # use them
    for key, value in attrs.items():
        setattr(clone, key, value)

    # save the partial clone to have a valid ID assigned
    clone.save()

    # Scan field to further investigate relations
    fields = clone._meta.get_fields()
    for field in fields:

        # Manage M2M fields by replicating all related records
        # found on parent "obj" into "clone"
        if not field.auto_created and field.many_to_many:
            for row in getattr(obj, field.name).all():
                getattr(clone, field.name).add(row)

        # Manage 1-N and 1-1 relations by cloning child objects
        if field.auto_created and field.is_relation:
            if field.many_to_many:
                # do nothing
                pass
            else:
                # provide "clone" object to replace "obj"
                # on remote field
                attrs = {
                    field.remote_field.name: clone
                }
                children = field.related_model.objects.filter(
                    **{field.remote_field.name: obj})
                for child in children:
                    duplicate_object(child, attrs)

    return clone


def get_obj_lvl_filters(request, request_dict=False):
    client = request.user.client if not request_dict else request["user"]["client"]
    created_by = request.user.id if not request_dict else request["user"]["id"]
    role_ids = request.user.roles_ids if not request_dict else request["user"]["roles_ids"]
    is_authenticated = request.user.is_authenticated if not request_dict else request[
        "user"]["is_authenticated"]
    qfilter = Q()
    qfilter.add(Q(everyone_can_see_it=True), Q.OR)
    qfilter.add(Q(created_by=created_by, client=client.get("id")), Q.OR)

    if is_authenticated:
        qfilter.add(
            Q(only_these_users_can_see_it__has_any_keys=[created_by]), Q.OR)

    if role_ids:
        qfilter.add(Q(only_these_roles_can_see_it__has_any_keys=role_ids), Q.OR)

    if (
        client.get("id", None)
        # and not client.get("name").lower() == "pullstream"
    ):
        qfilter.add(Q(client=client.get("id"),
                    everyone_in_object_company_can_see_it=True), Q.OR)

    if not is_authenticated:
        qfilter.add(Q(anonymous_can_see_it=True), Q.OR)

    return qfilter


def with_objs_lvl_permissions(queryset, request):
    return queryset.filter(get_obj_lvl_filters(request, type(request) == dict)) if request else []


def with_obj_lvl_get_object_or_404(model, request, **fields):
    return get_object_or_404(model, get_obj_lvl_filters(request, type(request) == dict), **fields) if request else {}


def with_obj_lvl_perform_update(self, serializer, custom_params={}):
    instance = self.get_object()
    current_user = UUID(
        self.request.user.id) if self.request.user.is_authenticated else None
    body = {"message": "You don't have permission to change visibility"}

    try:
        serializer.validated_data["everyone_can_see_it"]
        if instance.created_by != current_user:
            raise PermissionDenied(body)
    except KeyError:
        pass

    try:
        serializer.validated_data["anonymous_can_see_it"]
        if instance.created_by != current_user:
            raise PermissionDenied(body)
    except KeyError:
        pass

    try:
        serializer.validated_data["everyone_in_object_company_can_see_it"]
        if instance.created_by != current_user:
            raise PermissionDenied(body)
    except KeyError:
        pass

    try:
        serializer.validated_data["only_these_roles_can_see_it"]
        if instance.created_by != current_user:
            raise PermissionDenied(body)
    except KeyError:
        pass

    try:
        serializer.validated_data["only_these_users_can_see_it"]
        if instance.created_by != current_user:
            raise PermissionDenied(body)
    except KeyError:
        pass

    return serializer.save(updated_by=self.request.user.id, **custom_params)


# Erd Diagram

def upload_new_file(request, data, file, token=None):
    headers = {}

    if token:
        headers["Authorization"] = f"{token}"

    urls = settings.DRIVE_HOST + f"files/"

    response = requests.post(urls, data=data, files={
                             'file': file}, headers=headers)

    if response.ok:
        return response.json()
    else:
        return {"error": f"the status code is {response.status_code}"}


def get_file_by_name(request, name, token=None):

    headers = {}

    if token:
        headers["Authorization"] = f"{token}"

    urls = settings.DRIVE_HOST + "files/?name=" + str(name)

    response = requests.get(urls, headers=headers)

    if response.ok:
        return response.json()
    else:
        return {"error": f"the status code is {response.status_code}"}


def update_new_file(request, id, data, file, token=None):
    headers = {}

    if token:
        headers["Authorization"] = f"{token}"

    urls = settings.DRIVE_HOST + f"files/"+id+"/"

    response = requests.put(urls, data=data, files={
                            'file': file}, headers=headers)
    if response.ok:
        return response.json()
    else:
        return {"error": f"the status code is {response.status_code}"}
