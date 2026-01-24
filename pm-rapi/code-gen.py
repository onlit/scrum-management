from django.db import models
from django.apps import apps
import json
import types
import os
import requests
from re import sub
from uuid import uuid4
import inflect
from dotenv import load_dotenv

# ----------------------------------
# Setup: Environment and Configuration
# ----------------------------------

# Load environment variables from .env file
load_dotenv()

# Inflection engine (pluralizes words)
p = inflect.engine()

# Configuration Variables
project = "p_pm_rapi"
app = "a_pm_rapi"
microservice = "4eef25cf-c340-49bf-8ecf-eef40ff8b647"

# Set the Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', os.environ.get("MY_PROJECT_SETTING", f"{project}.settings.development"))

# Setup Django
import django
django.setup()

# API Headers for Authorization
headers = {
    "Authorization": "Bearer xyz",
    "Content-Type": "application/json"
}

# ----------------------------------
# Field Type Mappings
# ----------------------------------

# Map Django field types to custom API data types
field_mapping = {
    "AutoField": "Int",
    "BigAutoField": "Int",
    "BigIntegerField": "Int",
    "BinaryField": "Bytes",
    "BooleanField": "Boolean",
    "CharField": "String",
    "DateField": "DateTime",
    "DateTimeField": "DateTime",
    "DecimalField": "Decimal",
    "DurationField": "String",
    "EmailField": "String",
    "FileField": "String",
    "FilePathField": "String",
    "FloatField": "Float",
    "ForeignKey": "UUID",
    "GenericIPAddressField": "String",
    "IPAddressField": "String",
    "ImageField": "String",
    "IntegerField": "Int",
    "JSONField": "Json",
    "PositiveBigIntegerField": "Int",
    "PositiveIntegerField": "Int",
    "PositiveSmallIntegerField": "Int",
    "SlugField": "String",
    "SmallAutoField": "Int",
    "SmallIntegerField": "Int",
    "TextField": "String",
    "TimeField": "String",
    "URLField": "String",
    "UUIDField": "UUID"
}

# Fields and Models to Ignore
ignore_fields = [
    "id", "tags", "_template", "everyone_can_see_it", "anonymous_can_see_it",
    "everyone_in_object_company_can_see_it", "only_these_roles_can_see_it",
    "only_these_users_can_see_it", "updated_by", "created_by", "client",
    "created_at", "updated_at", "_tags", "is_deleted", "deleted_at"
]
ignore_models = [
    "LogEntry", "Permission", "Group_permissions", "Group",
    "ContentType", "Session", "CUser_groups", "CUser_user_permissions", "CUser"
]

num_words = {
    '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four',
    '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine'
}

def replace_numbers_with_words(s):
    """Replace digits with their word equivalents."""
    return ''.join(num_words.get(c, c) for c in s)

# ----------------------------------
# Utility Functions
# ----------------------------------

def camel_case(s):
    """Convert a snake_case or kebab-case string to camelCase."""
    s = sub(r"(_|-)+", " ", s).title().replace(" ", "")
    return ''.join([s[0].lower(), s[1:]])

def title_case(s):
    """Convert camelCase or PascalCase or snake_case to Human Readable Title Case."""
    s = sub(r"(_|-)+", " ", s)
    s = sub(r"([a-z])([A-Z])", r"\1 \2", s)
    return s.title()

# ----------------------------------
# Main Logic to Process Models
# ----------------------------------

app_models = apps.get_models(app)
resp = {}  # Store model payloads
enums = {}  # Store enum definitions
model_order = 0

# Iterate over all models
for model in app_models:
    model_name = model.__name__
    
    if model_name in ignore_models:
        continue  # Skip ignored models
    
    model_order += 1
    # Initialize model payload
    payload = {
        "id": uuid4(),
        "order" : model_order,
        "name": model_name,
        "label": title_case(model_name),
        "description": "",
        "microserviceId": microservice,
        "fields": {}
    }

    # Process fields
    field_order = 0
    for field in model._meta.get_fields():
        if isinstance(field, models.ManyToOneRel) or field.name in ignore_fields:
            continue  # Skip reverse relations and ignored fields

        # Handle special case for _client
        field_name = "opportunity_client" if field.name == "_client" else camel_case(field.name)

        # Create enum if field has choices
        if getattr(field, "choices", None) and not str(field) in enums:
            enums[str(field)] = {
                "id": uuid4(),
                "name": payload["name"] + p.plural(
                    replace_numbers_with_words(
                        ''.join(x for x in field.name.replace("_", " ").title() if not x.isspace())
                    )
                ),
                "microserviceId": microservice,
                "values": [
                    {
                        "value": replace_numbers_with_words(
                            ''.join(x for x in choice[0].replace("_", " ").title() if not x.isspace())
                        )
                    }
                    for choice in field.choices
                ]
            }

        # Determine default value
        default = getattr(field, "default", None)
        if isinstance(default, types.FunctionType) or "NOT_PROVIDED" in str(default):
            default = None

        field_order += 1
        # Prepare field payload
        field_payload = {
            "id": uuid4(),
            "order" : field_order,
            "name": field_name,
            "label": title_case(field_name),
            "description": "",
            "onDelete": "Cascade",
            "dataType": "Enum" if getattr(field, "choices", None) else field_mapping.get(field.get_internal_type(), "String"),
            "showInTable" : True,
            "showInDetailCard" : True,
            "isEditable" : True,
            "isMultiline" : field.get_internal_type() == "TextField",
            "isOptional": getattr(field, "null", False),
            "isUnique": getattr(field, "unique", False),
            "defaultValue": default,
            "isForeignKey": getattr(field, "is_relation", False),
            "maxLength": getattr(field, "max_length", None)
        }

        # Normalize default values based on data type
        if field_payload["dataType"] == "String" and not field_payload["defaultValue"]:
            field_payload["defaultValue"] = ""
        if field_payload["dataType"] == "Boolean":
            field_payload["defaultValue"] = "true" if field_payload["defaultValue"] else "false"
        if field_payload["dataType"] in ["Int", "Decimal"] and field_payload["defaultValue"] is not None:
            field_payload["defaultValue"] = str(field_payload["defaultValue"])

        # Attach enum ID if applicable
        if getattr(field, "choices", None):
            field_payload["enumDefnId"] = enums[str(field)]["id"]
            if field_payload["defaultValue"]:
                field_payload["defaultValue"] = ''.join(x for x in field_payload["defaultValue"].replace("_", " ").title() if not x.isspace())

        # Handle ForeignKey references
        if field_payload["isForeignKey"]:
            field_payload["foreignKeyModelId"] = payload["id"] if payload["name"] == field.related_model.__name__ else resp[field.related_model.__name__]["id"]

        # Clean up unnecessary fields
        if not field_payload["defaultValue"] or field_payload["isOptional"]:
            field_payload.pop("defaultValue", None)

        # Add field to model payload
        payload["fields"][field_name] = field_payload

    # Save model payload
    resp[model_name] = payload

# ----------------------------------
# Upload Enum Definitions
# ----------------------------------

# Post all enums in batch to the API
enum_resp = requests.post(
    "https://compute.pullstream.com/api/v1/enum-defns/batch/",
    data=json.dumps(list(enums.values()), default=str),
    headers=headers
)
print(enum_resp.content)

# ----------------------------------
# Upload Models
# ----------------------------------

# Prepare model payloads for batch posting
models_payload = list(resp.values())
for model_payload in models_payload:
    model_payload["fields"] = list(model_payload["fields"].values())

with open("payload.json", "w", encoding="utf-8") as f:
    f.write(json.dumps(models_payload, default=str))

# Post models one-by-one
for payload in models_payload:
    print(payload["name"])  # Print model name for debugging
    model_resp = requests.post(
        "https://compute.pullstream.com/api/v1/models/batch/",
        data=json.dumps([payload], default=str),
        headers=headers
    )
    print(model_resp.json())
    print("\n")
