from a_pm_rapi.models import Program, Project
from rest_framework import authentication
from rest_framework import exceptions
from django.conf import settings
import requests


class CustomUser:
    is_authenticated = True

    def __init__(
        self,
        id=None,
        username="",
        first_name="",
        last_name="",
        actingAs="",
        roles_ids=[],
        roles=[],
        roles_names=[],
        is_superuser=False,
        email="",
        client={"id": None},
        access_token="",
        is_authenticated=False,
        is_staff=False,
    ):
        self.id = id
        self.username = username
        self.first_name = first_name
        self.last_name = last_name
        self.actingAs = actingAs
        self.roles_ids = roles_ids
        self.roles = roles
        self.roles_names = roles_names
        self.is_superuser = is_superuser
        self.email = email
        self.client = client
        self.access_token = access_token
        self.is_authenticated = is_authenticated
        self.is_staff = is_staff

    def __str__(self):
        return f"{self.email}"


class APIAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        act_as = request.META.get("HTTP_ACTAS")
        token = request.META.get("HTTP_AUTHORIZATION")
        response = {}
        headers = {"Authorization": token}

        if token:
            url = settings.AUTH_HOST + "v1/auth/"

            response = requests.get(url, headers=headers)

            if response.status_code == 200:
                response = response.json()

            else:
                raise exceptions.AuthenticationFailed({
                    "detail": "Given token is invalid or expired.",
                    "code": "token_not_valid",
                })

        original_client_details = response.get("client", { "id" : None })
        client_details = original_client_details

        #if act_as and client_details and client_details.get("child_clients", {}).get(f"{act_as}", {}):
            #client_details = client_details.get("child_clients", {}).get(f"{act_as}", {})

        user = CustomUser(
            id=response.get("id", None),
            username=response.get("username"),
            first_name=response.get("firstName"),
            last_name=response.get("lastName"),
            actingAs=headers.get("ActAs"),
            roles_ids=response.get("roleIds", []),
            roles=response.get("roles", []),
            roles_names=response.get("roleNames", []),
            is_superuser=response.get("is_superuser", False),
            email=response.get("email"),
            client=client_details,
            access_token=token,
            is_authenticated=bool(response),
            is_staff=response.get("is_staff", False),
        )

        if user.is_authenticated and not Program.objects.filter(name = "me", created_by = user.id).exists():
            program = Program.objects.create(
                name = "me",
                everyone_in_object_company_can_see_it = False,
                created_by = user.id,
                client = user.client.get("id"),
            )

            project = Project.objects.create(
                name = "me",
                program = program,
                everyone_in_object_company_can_see_it = False,
                created_by = user.id,
                client = user.client.get("id"),
            )

        return (user, True)  # authentication successful
