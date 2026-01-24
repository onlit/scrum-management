from django import forms
from .utils import get_all_users, get_all_roles
from django.apps import apps


methods_choices = (("GET", "Read"), ("PUT", "Update"), ("POST", "Create"), ("DELETE", "Delete"), )


class PermissionForm(forms.Form):
    model = forms.MultipleChoiceField(choices = tuple(map(lambda model: (str(model).split(".")[-1][:-2], str(model).split(".")[-1][:-2]), apps.get_models())), widget = forms.SelectMultiple(attrs = {
        "class" : "form-control"
    }))
    
    users = forms.MultipleChoiceField(choices = get_all_users(), required = False, widget = forms.SelectMultiple(attrs = {
        "class" : "form-control",
    }))

    roles = forms.MultipleChoiceField(choices = get_all_roles(), required = False, widget = forms.SelectMultiple(attrs = {
        "class" : "form-control",
    }))

    methods = forms.MultipleChoiceField(required = False, choices = methods_choices, widget = forms.SelectMultiple(attrs = {
        "class" : "form-control"
    }))