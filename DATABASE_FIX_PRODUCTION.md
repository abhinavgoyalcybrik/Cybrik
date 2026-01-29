# Database Schema Fix - Production Deployment Guide

## Problem
The production database (api.cybriksolutions.com) is missing the following columns:
- `crm_app_lead.is_manual_only`
- `crm_app_lead.walked_in_at`
- `crm_app_lead.receptionist_id`

These were added in migration `0020_remove_lead_address_remove_lead_dob_and_more`.

## Solution

### Step 1: SSH into Production Server
```bash
ssh your-production-server
```

### Step 2: Navigate to Django Project
```bash
cd /path/to/CybricHQ
```

### Step 3: Activate Virtual Environment (if applicable)
```bash
source venv/bin/activate
# or
source env/bin/activate
```

### Step 4: Check Migration Status
```bash
python manage.py showmigrations crm_app
```

Look for migration `0020_remove_lead_address_remove_lead_dob_and_more`. 
If it shows `[ ]` (not applied), proceed to Step 5.
If it shows `[X]` (applied), proceed to Step 6.

### Step 5: Apply Migrations Normally
```bash
python manage.py migrate crm_app
```

### Step 6: If Migration is Marked as Applied but Columns Missing
The migration was "faked" or the database was restored from backup.

#### Option A: Manual SQL (PostgreSQL)
```bash
python manage.py dbshell
```

Then run:
```sql
-- Check if columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'crm_app_lead';

-- Add missing columns if needed
ALTER TABLE crm_app_lead 
ADD COLUMN IF NOT EXISTS is_manual_only BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE crm_app_lead 
ADD COLUMN IF NOT EXISTS walked_in_at TIMESTAMP WITH TIME ZONE NULL;

ALTER TABLE crm_app_lead 
ADD COLUMN IF NOT EXISTS receptionist_id INTEGER NULL 
REFERENCES auth_user(id) ON DELETE SET NULL;

-- Exit
\q
```

#### Option B: Re-run Migration
```bash
# Roll back
python manage.py migrate crm_app 0019 --fake

# Re-apply
python manage.py migrate crm_app 0020
```

### Step 7: Restart Production Server
```bash
# If using systemd
sudo systemctl restart cybrikhq

# If using supervisor
supervisorctl restart cybrikhq

# If using docker
docker-compose restart web

# If using gunicorn directly
pkill -HUP gunicorn
```

### Step 8: Verify
Open production URL in browser and check if the 500 errors are gone.

## Alternative: Use Railway/Platform CLI

### Railway
```bash
railway run python manage.py migrate crm_app
railway restart
```

### Heroku
```bash
heroku run python manage.py migrate crm_app -a your-app-name
heroku restart -a your-app-name
```

### Render
Use Render dashboard to run:
```bash
python manage.py migrate crm_app
```
Then restart the service.

## Verification Script
Create `verify_schema.py` on production:
```python
#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    # PostgreSQL
    if 'postgresql' in connection.settings_dict['ENGINE']:
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'crm_app_lead'
            ORDER BY column_name;
        """)
    # SQLite
    else:
        cursor.execute("PRAGMA table_info(crm_app_lead)")
    
    columns = cursor.fetchall()
    print("Columns in crm_app_lead:")
    for col in columns:
        print(f"  - {col}")
    
    required = ['is_manual_only', 'walked_in_at', 'receptionist_id']
    existing = [col[0] if 'postgresql' in connection.settings_dict['ENGINE'] else col[1] 
                for col in columns]
    
    missing = [r for r in required if r not in existing]
    
    if missing:
        print(f"\n❌ MISSING COLUMNS: {missing}")
    else:
        print(f"\n✅ All required columns present!")
```

Run it:
```bash
python verify_schema.py
```
