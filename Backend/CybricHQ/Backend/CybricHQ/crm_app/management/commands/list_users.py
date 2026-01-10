from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import connection
from crm_app.models import Tenant

class Command(BaseCommand):
    help = "List users across all schemas"

    def handle(self, *args, **options):
        User = get_user_model()
        
        self.stdout.write(self.style.SUCCESS("--- Users in Public Schema ---"))
        try:
            connection.set_schema_to_public()
        except Exception:
             with connection.cursor() as cursor:
                cursor.execute("SET search_path TO public")

        users = User.objects.all().order_by('id')
        if not users.exists():
            self.stdout.write("  (No users found)")
        for user in users:
            self.stdout.write(f"  ID: {user.id} | Username: {user.username} | Email: {user.email} | Staff: {user.is_staff} | Super: {user.is_superuser}")

        self.stdout.write("\n--- Users in Tenant Schemas ---")
        tenants = Tenant.objects.exclude(database_schema='public').exclude(database_schema__isnull=True)
        
        for tenant in tenants:
            schema = tenant.database_schema
            self.stdout.write(self.style.SUCCESS(f"\nScanning Tenant: {tenant.slug} (Schema: {schema})"))
            
            try:
                connection.set_tenant(tenant)
                
                # Check if User table is real or shared
                if User._meta.db_table.startswith(schema) or not User._meta.managed:
                     pass 
                
                users = User.objects.all().order_by('id')
                if not users.exists():
                    self.stdout.write("  (No users found)")
                
                for user in users:
                    self.stdout.write(f"  ID: {user.id} | Username: {user.username} | Email: {user.email} | Staff: {user.is_staff} | Super: {user.is_superuser}")
                    
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  Error accessing {schema}: {e}"))
        
        self.stdout.write(self.style.SUCCESS("\nEnd of Report."))
