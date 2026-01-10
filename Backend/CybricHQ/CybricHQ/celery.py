from __future__ import annotations
import os
from celery import Celery

# use your Django settings module
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "CybricHQ.settings")

app = Celery("CybricHQ")
# Load config from Django settings, using `CELERY_` namespace keys
app.config_from_object("django.conf:settings", namespace="CELERY")
# Auto-discover task modules in installed apps
app.autodiscover_tasks()



