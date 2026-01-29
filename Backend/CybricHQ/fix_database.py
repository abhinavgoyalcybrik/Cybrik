#!/usr/bin/env python
"""
Script to fix missing database columns
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from django.db import connection

def add_column_if_not_exists(table, column, column_def):
    """Add a column to a table if it doesn't already exist"""
    with connection.cursor() as cursor:
        # Check if column exists
        cursor.execute(f"PRAGMA table_info({table})")
        columns = [row[1] for row in cursor.fetchall()]
        
        if column not in columns:
            print(f"Adding column {column} to {table}...")
            try:
                cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column_def}")
                print(f"✓ Successfully added {column}")
                return True
            except Exception as e:
                print(f"✗ Error adding {column}: {e}")
                return False
        else:
            print(f"✓ Column {column} already exists in {table}")
            return True

def main():
    print("Fixing database schema...\n")
    
    # Add missing Lead columns
    success = True
    
    success &= add_column_if_not_exists(
        'crm_app_lead',
        'is_manual_only',
        'is_manual_only INTEGER NOT NULL DEFAULT 0'
    )
    
    success &= add_column_if_not_exists(
        'crm_app_lead',
        'walked_in_at',
        'walked_in_at TEXT NULL'
    )
    
    success &= add_column_if_not_exists(
        'crm_app_lead',
        'receptionist_id',
        'receptionist_id INTEGER NULL REFERENCES auth_user(id) ON DELETE SET NULL'
    )
    
    if success:
        print("\n✓ All columns added successfully!")
        print("You can now restart your Django server.")
    else:
        print("\n✗ Some columns failed to add. Check errors above.")
        sys.exit(1)

if __name__ == '__main__':
    main()
