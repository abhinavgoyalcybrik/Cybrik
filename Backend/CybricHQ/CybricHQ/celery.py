from __future__ import annotations
import os
from celery import Celery

# Use your Django settings module
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "CybricHQ.settings")

app = Celery("CybricHQ")

# Load config from Django settings, using `CELERY_` namespace keys
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover task modules in installed apps
app.autodiscover_tasks()

# Celery Beat scheduler settings
app.conf.update(
    timezone='Asia/Kolkata',  # IST timezone for India
    enable_utc=True,
    beat_scheduler='celery.beat:PersistentScheduler',
)

# Optional: Debug task for testing Celery Beat
@app.task
def debug_periodic_task():
    import logging
    logging.getLogger(__name__).info("Celery Beat is running! Periodic task executed.")
    return "Beat is working"



