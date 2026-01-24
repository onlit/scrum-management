from __future__ import absolute_import
import os
import platform
from celery import Celery
from django.conf import settings
import django


# Detect if running on Windows
is_windows = platform.system().lower() == "windows"

# Set the default Django settings module for the 'celery' program
os.environ.setdefault('DJANGO_SETTINGS_MODULE',
                      'p_pm_rapi.settings.development')
django.setup()

PROJECT_NAME = getattr(settings, "PROJECT_NAME", "p_pm_rapi")

# Initialize Celery app
if not is_windows:
    import celery_longterm_scheduler
    app = Celery(PROJECT_NAME, task_cls=celery_longterm_scheduler.Task)
else:
    app = Celery(PROJECT_NAME)

# Load settings
app.config_from_object('django.conf:settings')

# Configure additional Celery options only for non-Windows environments
if not is_windows:
    if hasattr(settings, "CELERY_LONGTERM_SCHEDULER_BACKEND"):
        app.conf["longterm_scheduler_backend"] = settings.CELERY_LONGTERM_SCHEDULER_BACKEND

    if hasattr(settings, "CELERY_BEAT_SCHEDULE"):
        app.conf["beat_schedule"] = settings.CELERY_BEAT_SCHEDULE

# Discover tasks from installed apps
app.autodiscover_tasks(lambda: settings.INSTALLED_APPS)

# -----------------------------
# Utility Tasks and Functions
# -----------------------------


@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')


@app.task()
def run_celery_long_term():
    if not is_windows:
        os.system(f"celery -A {PROJECT_NAME} longterm_scheduler")
    else:
        print("Long-term scheduler is not supported on Windows.")


# Exports
__all__ = ["app", "debug_task", "run_celery_long_term"]
