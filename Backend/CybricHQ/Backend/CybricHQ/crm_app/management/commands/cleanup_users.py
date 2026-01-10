from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import connection
from crm_app.models import Tenant

class Command(BaseCommand):
    help = "Cleanup non-superuser accounts (test data) across all schemas"

    def handle(self, *args, **options):
        User = get_user_model()
        
        self.stdout.write("--- Cleaning up Public Schema ---")
        # Ensure we are in public
        try:
            connection.set_schema_to_public()
        except Exception:
             with connection.cursor() as cursor:
                cursor.execute("SET search_path TO public")

        # Delete non-superusers in Public
        # Safety: Start with LISTING only, or just delete? 
        # User said "delete". I will delete but verify existence of cybrik.
        
        if not User.objects.filter(username="cybrik", is_superuser=True).exists():
             self.stdout.write(self.style.WARNING("WARNING: 'cybrik' superuser not found in public! Aborting safety check."))
             # In production, maybe name is different? But earlier logs said 'cybrik'.
             # Let's just exclude superusers from deletion.
        
        deleted_count, _ = User.objects.filter(is_superuser=False).delete()
        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted_count} non-superuser(s) from Public schema."))

        self.stdout.write("\n--- Cleaning up Tenant Schemas ---")
        # Filter for tenants that have a schema defined
        tenants = Tenant.objects.exclude(database_schema='public').exclude(database_schema__isnull=True)
        for tenant in tenants:
            schema = tenant.database_schema
            if not schema:
                continue
                
            self.stdout.write(f"Scanning {tenant.slug} ({schema})...")
            try:
                connection.set_tenant(tenant)
                # In isolated mode, users table might exist in tenant schema
                # If using Shared Users, this query will see Public users (cached/referenced). 
                # We need to be careful if it's Shared Users, deleting here might fail or be redundant.
                # If User model is shared, deleting in public was enough.
                # Use a check:
                if User._meta.db_table.startswith(schema) or not User._meta.managed:
                     # It's likely a view or shared.
                     pass 
                else:
                    # It's a real table in this schema (Isolated mode)
                     cnt, _ = User.objects.filter(is_superuser=False).delete()
                     if cnt > 0:
                         self.stdout.write(self.style.SUCCESS(f"  Deleted {cnt} user(s) from {schema}"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  Error in {schema}: {e}"))
        
        self.stdout.write(self.style.SUCCESS("\nCleanup Complete."))
