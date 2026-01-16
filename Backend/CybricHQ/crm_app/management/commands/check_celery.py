from django.core.management.base import BaseCommand
from CybricHQ.celery import app
from django.conf import settings
import time

class Command(BaseCommand):
    help = 'Checks Celery status and configuration'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('--- Check Celery Status ---'))
        
        # 1. Check Settings
        self.stdout.write(f"CELERY_BROKER_URL: {settings.CELERY_BROKER_URL}")
        self.stdout.write(f"CELERY_TASK_ALWAYS_EAGER: {settings.CELERY_TASK_ALWAYS_EAGER}")
        
        if settings.CELERY_TASK_ALWAYS_EAGER:
            self.stdout.write(self.style.WARNING("WARNING: Eager mode is ON. Tasks will run synchronously (not via worker)."))
        
        # 2. Check Broker Connection
        try:
            with app.connection_or_acquire() as conn:
                conn.ensure_connection(max_retries=3)
                self.stdout.write(self.style.SUCCESS("Broker connection: OK"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Broker connection FAILED: {e}"))
            return

        # 3. Inspect Workers
        try:
            i = app.control.inspect()
            active = i.active()
            if active:
                self.stdout.write(self.style.SUCCESS(f"Found workers: {list(active.keys())}"))
            else:
                self.stdout.write(self.style.ERROR("No active workers found! Is celery running?"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Worker inspection failed: {e}"))
            
        # 4. Detailed Ping
        try:
            pong = i.ping()
            if pong:
                self.stdout.write(f"Worker Ping: {pong}")
            else:
                self.stdout.write(self.style.ERROR("Worker Ping: No response"))
        except Exception:
            pass
            
        self.stdout.write(self.style.SUCCESS("--- End Check ---"))
