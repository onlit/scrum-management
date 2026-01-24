from rest_framework.permissions import BasePermission, SAFE_METHODS
import requests
from django.conf import settings
from datetime import datetime


class GlobalViewPermission(BasePermission):
    def has_permission(self, request, view):

        if not hasattr(view, "serializer_class"):
            return True

        model = view.serializer_class.Meta.model.__name__

        parent_class = view.__class__.__bases__[0].__name__

        url = f"{settings.AUTH_HOST}accounts/permissions/{parent_class}/{settings.MS_NAME}/{model}/"

        query_params = {}

        if request.user.is_authenticated and not request.user.roles_names:
            query_params["user"] = request.user.id

        elif request.user.is_authenticated and request.user.roles_names:
            query_params["roles"] = ",".join(request.user.roles_names)

        response = requests.get(url, params=query_params)

        if response.status_code == 200:
            response = response.json()
        else:
            response = None

        if (not response and not request.user.is_authenticated) or (
            response and not request.method in response.get("methods")
        ):
            return False
        return True


class ImportPermission(BasePermission):

    def has_permission(self, request, view):
        return "Can Import/Export" in request.user.roles_names
    

class IsTemplateAdminPermission(BasePermission):

    def has_permission(self, request, view):
        return bool(
            request.user.is_authenticated and "Template Admins" in request.user.roles_names
        )


class LMSStudentPermission(BasePermission):
    routes = []

    def has_permission(self, request, view):
        if (
            request.user.is_authenticated and
            "LMS Student" in request.user.roles_names and
            not request.path in self.routes
        ):
            return False
        
        return True
