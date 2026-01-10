from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = 'Drops a specific tenant schema from the database. USE WITH CAUTION.'

    def add_arguments(self, parser):
        parser.add_argument('schema_name', type=str, help='Name of the schema to drop (e.g. tenant_acme)')

    def handle(self, *args, **options):
        schema_name = options['schema_name']
        
        self.stdout.write(f"Preparing to drop schema: {schema_name}")
        confirm = input(f"Are you sure you want to permanently DELETE schema '{schema_name}'? (yes/no): ")
        
        if confirm.lower() != 'yes':
            self.stdout.write(self.style.WARNING("Operation cancelled."))
            return

        with connection.cursor() as cursor:
            # Check if schema exists
            cursor.execute(
                "SELECT schema_name FROM information_schema.schemata WHERE schema_name = %s",
                [schema_name]
            )
            if not cursor.fetchone():
                self.stdout.write(self.style.ERROR(f"Schema '{schema_name}' does not exist."))
                return

            try:
                self.stdout.write(f"Dropping schema '{schema_name}'...")
                cursor.execute(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE')
                self.stdout.write(self.style.SUCCESS(f"Successfully dropped schema '{schema_name}'"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Failed to drop schema: {e}"))
