from django.apps import apps
from celery import shared_task
from datetime import datetime
from itertools import chain
from django.conf import settings
import requests


def to_dict(instance):
    if not instance:
        return {}

    opts = instance._meta
    data = {}
    for f in chain(opts.concrete_fields, opts.private_fields):
        data[f"{f.name}"] = str(f.value_from_object(instance))
    for f in opts.many_to_many:
        data[f"{f.name}"] = [str(i.id) for i in f.value_from_object(instance)]
    return data


@shared_task(name="pre_save_logger")
def pre_save_logger(sender, id, current_data, previous_data, action_time, delete_action=None):

    data = {
        "microservice": settings.MS_NAME,
        "model": sender,
        "object_id": current_data.get(id),
        "before_action_content": str(previous_data),
        "after_action_content": str(current_data),
        "action_datetime": action_time,
    }

    if delete_action:
        data["action"] = "Deletion"

    elif not previous_data:
        data["action"] = "Addition"

    else:
        data["action"] = "Change"

    response = requests.post(settings.LOGGING_HOST, data=data)
    print(response.status_code)


app_models = apps.get_models()


def logging_signal(sender, instance, *args, **kwargs):

    if sender.__name__ == "LogEntry":
        return False

    previous_data = to_dict(sender.objects.filter(**{
        f"{sender._meta.pk.name}":  getattr(instance, sender._meta.pk.name),
    }).first())

    current_data = to_dict(instance)

    pre_save_logger.delay(f"{sender.__name__}", f"{sender._meta.pk.name}",
                          current_data, previous_data, action_time=datetime.now())


def pre_delete_logging_signal(sender, instance, *args, **kwargs):

    if sender.__name__ == "LogEntry":
        return False

    previous_data = to_dict(instance)

    pre_save_logger.delay(f"{sender.__name__}", f"{sender._meta.pk.name}", {
    }, previous_data, action_time=datetime.now(), delete_action=True)
