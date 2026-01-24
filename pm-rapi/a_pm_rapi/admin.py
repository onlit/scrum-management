from django.contrib import admin
from django.conf import settings
from django.apps import apps
from django.contrib.admin.sites import AlreadyRegistered
from .utils import register_microservice


app_models = apps.get_models()
if settings.MIGRATE:
    print("Registering microservice since MIGRATE is on.")
    register_microservice()

for model in app_models:
    
    try:
        admin.site.register(model)
    except AlreadyRegistered:
        pass