# crm_app/apps.py

from django.apps import AppConfig
from django.db.models.signals import post_migrate
import logging

logger = logging.getLogger(__name__)


def create_default_groups(sender, **kwargs):
    """
    Only run AFTER migrations, when auth tables exist.
    Importing Group inside the function avoids early AppRegistry loading errors.
    """
    from django.contrib.auth.models import Group  # IMPORT HERE, NOT AT TOP

    ROLE_NAMES = ["admin", "counselor", "lead_gen"]

    for role in ROLE_NAMES:
        try:
            Group.objects.get_or_create(name=role)
            logger.info(f"Ensured group exists: {role}")
        except Exception as exc:
            logger.error(f"Error creating group {role}: {exc}")


class CrmAppConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "crm_app"

    def ready(self):
        import os
        
        post_migrate.connect(create_default_groups, sender=self)
        
        import crm_app.signals
        
        if os.environ.get('RUN_MAIN') == 'true':
            from crm_app.services.call_scheduler import start_scheduler
            start_scheduler()
            logger.info("AI Call Scheduler started")
