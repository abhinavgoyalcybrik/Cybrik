# 🚀 Production Deployment Guide - Database Fix

## 🐛 **Issue Fixed:**
```
ProgrammingError: column crm_app_lead.is_manual_only does not exist
```

## ✅ **Solution:**
Run pending database migration `0022_alter_lead_walked_in_at`

---

## 📋 **Production Deployment Steps**

### **1. Pull Latest Code**
```bash
cd /path/to/your/cybrik/Backend/CybricHQ
git pull origin main
```

### **2. Backup Database (CRITICAL)**
```bash
# PostgreSQL
pg_dump -U cybrik_admin -h your-rds-endpoint -d cybrikhq > backup_$(date +%Y%m%d_%H%M%S).sql

# Or if using manage.py
python manage.py dumpdata > backup_$(date +%Y%m%d_%H%M%S).json
```

### **3. Run Migrations**

**⚠️ IMPORTANT: Production Database Has Conflicts!**

The production database has columns that migrations want to re-add. Use the fix script:

```bash
# Option A: Use automated fix script (RECOMMENDED)
chmod +x fix_production_migrations.sh
./fix_production_migrations.sh

# Option B: Manual fix
python manage.py showmigrations crm_app

# Fake migrations 0018-0021 (they try to add existing columns)
python manage.py migrate crm_app 0018 --fake
python manage.py migrate crm_app 0019 --fake
python manage.py migrate crm_app 0020 --fake
python manage.py migrate crm_app 0021 --fake

# Now apply the critical migration
python manage.py migrate crm_app 0022

# Apply all remaining migrations
python manage.py migrate
```

### **4. Verify Schema**
```bash
python verify_schema.py

# Expected output:
# ✅ Column exists - Value: False
# ✅ Lead ID X: name=..., is_manual_only=False
# ✅ SUCCESS: Database schema is correct!
```

### **5. Restart Services**
```bash
# Django/Gunicorn
sudo systemctl restart your-django-service

# Or if using Docker
docker-compose restart backend

# Celery (if applicable)
sudo systemctl restart celery
```

### **6. Test Frontend**
Visit: `https://crm.cybriksolutions.com/leads`

Should now load without errors!

---

## 🔍 **Migration Details**

**Migration:** `0022_alter_lead_walked_in_at`

**Adds these fields to `crm_app_lead` table:**
- `is_manual_only` - BOOLEAN (default: FALSE)
- `walked_in_at` - TIMESTAMP (nullable)
- `receptionist_id` - INTEGER (nullable, foreign key to users)

**SQL equivalent:**
```sql
ALTER TABLE crm_app_lead 
ADD COLUMN is_manual_only BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE crm_app_lead 
ADD COLUMN walked_in_at TIMESTAMP;

ALTER TABLE crm_app_lead 
ADD COLUMN receptionist_id INTEGER REFERENCES auth_user(id);
```

---

## ⚠️ **Troubleshooting**

### **Issue: Migration fails with "column already exists" (PRODUCTION)**

**Error:** `column "logo" of relation "crm_app_tenantsettings" already exists`

**Cause:** Production database has columns that migrations want to re-add.

**Solution:**
```bash
# Use the automated fix script
chmod +x fix_production_migrations.sh
./fix_production_migrations.sh

# OR manually fake the conflicting migrations
python manage.py migrate crm_app 0018 --fake
python manage.py migrate crm_app 0019 --fake
python manage.py migrate crm_app 0020 --fake
python manage.py migrate crm_app 0021 --fake
python manage.py migrate crm_app 0022
python manage.py migrate
```

### **Issue: Migration fails with "column already exists"**
```bash
# Check if column exists
python manage.py dbshell
\d crm_app_lead;

# If column exists but migration not marked as applied
python manage.py migrate crm_app 0022 --fake
```

### **Issue: Permission denied**
```bash
# Grant permissions to database user
GRANT ALL PRIVILEGES ON DATABASE cybrikhq TO cybrik_admin;
```

### **Issue: Old migration conflicts**
```bash
# Show migration status
python manage.py showmigrations

# If needed, fake older migrations
python manage.py migrate crm_app 0021 --fake
python manage.py migrate crm_app 0022
```

---

## 📊 **Post-Deployment Checks**

1. **Frontend loads without errors** ✅
2. **Leads page displays correctly** ✅
3. **Can create new leads** ✅
4. **Walk-in leads work properly** ✅
5. **No console errors** ✅

---

## 🔄 **Rollback (if needed)**

```bash
# Revert migration
python manage.py migrate crm_app 0021

# Restore from backup
psql -U cybrik_admin -h your-rds-endpoint -d cybrikhq < backup_YYYYMMDD_HHMMSS.sql
```

---

## 📝 **Summary**

**Local:** ✅ Migration applied successfully
**Production:** ⏳ Pending - run `python manage.py migrate`

**Files added:**
- `verify_schema.py` - Schema verification script
- `check_whatsapp_billing.py` - WhatsApp diagnostics

**Commit:** `c7549c8` - fix: Run missing database migration for is_manual_only column

---

## 🎯 **Expected Timeline**

- **Pull code:** 1 minute
- **Backup database:** 2-5 minutes
- **Run migration:** 10-30 seconds
- **Restart services:** 30 seconds
- **Verification:** 1 minute

**Total:** ~5-10 minutes

---

**Once completed, your production CRM should work perfectly! 🚀**