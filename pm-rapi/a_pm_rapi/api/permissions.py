from rest_framework.permissions import BasePermission
from a_pm_rapi.utils import is_request_internal

class AllowInternalOrMustBeAuthenticatedPermission(BasePermission):

    def has_permission(self, request, view):
        return (not request.user.is_authenticated and is_request_internal(request)) or request.user.is_authenticated