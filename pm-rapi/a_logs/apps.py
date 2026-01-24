from django.apps import AppConfig


class ALogsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "a_logs"

    def ready(self):
        from .signals import logging_signal, app_models, pre_delete_logging_signal
        from django.db.models.signals import pre_save, pre_delete

        for model in app_models:
            pre_save.connect(logging_signal, model)
            pre_delete.connect(pre_delete_logging_signal, model)
