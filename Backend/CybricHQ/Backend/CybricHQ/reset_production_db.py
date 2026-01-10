#!/usr/bin/env python
"""
Production Database Reset Script
Drops all tables in PUBLIC schema and effectively resets the instance.
USE WITH CAUTION - THIS WILL DELETE ALL DATA!
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from django.core.management import call_command
from django.db import connection

def reset_database():
    """Reset the production database - USE WITH EXTREME CAUTION"""
    
    print("=" * 80)
    print("WARNING: THIS WILL DELETE ALL DATA IN THE PUBLIC SCHEMA!")
    print("=" * 80)
    print(f"Database: {connection.settings_dict['NAME']}")
    print(f"Host: {connection.settings_dict['HOST']}")
    print("=" * 80)
    
    confirm = input("Type 'DELETE ALL DATA' to continue: ")
    
    if confirm != "DELETE ALL DATA":
        print("Aborted.")
        sys.exit(0)
    
    print("\n[1/4] Dropping all tables in public schema...")
    with connection.cursor() as cursor:
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
        # Drop public tables
        cursor.execute("""
            SELECT CONCAT('DROP TABLE IF EXISTS "public"."', table_name, '" CASCADE;')
            FROM information_schema.tables
            WHERE table_schema = 'public';
        """)
        # If using MySQL, syntax is different, but line above is for Postgres which supports Schemas.
        # Fallback for generic SQL:
        try:
             cursor.execute("""
                SELECT CONCAT('DROP TABLE IF EXISTS ', table_name, ' CASCADE;')
                FROM information_schema.tables
                WHERE table_schema = 'public';
            """)
        except Exception:
             pass # Might fail on syntax, handled by django 'flush' usually but we want full drop
             
        # Just use Django flush for simplicity if dropping is hard? 
        # No, we want to recreate.
        
        # Hard nuke for Postgres:
        try:
            cursor.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
        except Exception as e:
            print(f"Schema drop failed (might be MySQL?): {e}")
            # Try MySQL Drop
            cursor.execute("""
                SELECT CONCAT('DROP TABLE IF EXISTS `', table_name, '`;')
                FROM information_schema.tables
                WHERE table_schema = DATABASE();
            """)
            rows = cursor.fetchall()
            for row in rows:
                cursor.execute(row[0])

        cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")
    
    print("[2/4] Running migrations...")
    call_command('migrate', '--noinput')
    
    print("[3/4] Creating superuser and initial data...")
    call_command('setup_platform')
    
    print("[4/4] Database reset complete!")
    print("\nDefault superuser credentials:")
    print("  Username: superadmin")
    print("  Password: admin123")
    print("\n✅ Production database is now fresh and ready!")

if __name__ == '__main__':
    reset_database()
