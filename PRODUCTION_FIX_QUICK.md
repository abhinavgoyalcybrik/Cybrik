# 🚨 PRODUCTION MIGRATION FIX - Quick Commands

## Error You're Seeing:
```
django.db.utils.ProgrammingError: column "logo" of relation "crm_app_tenantsettings" already exists
```

## ✅ SOLUTION (Copy-Paste These Commands):

```bash
# 1. Pull latest code
cd ~/cybrik/Backend/CybricHQ
git pull origin main

# 2. Make script executable
chmod +x fix_production_migrations.sh

# 3. Run the fix script
./fix_production_migrations.sh

# 4. Restart Django
sudo systemctl restart gunicorn  # or your service name
# OR if using supervisor:
# sudo supervisorctl restart cybrik

# 5. Check status
sudo systemctl status gunicorn
# OR
# sudo supervisorctl status cybrik
```

## 📋 What The Script Does:

1. ✅ Shows current migration status
2. ✅ Fakes migrations 0018-0021 (skips adding existing columns)
3. ✅ Applies migration 0022 (adds `is_manual_only` field)
4. ✅ Applies all remaining migrations
5. ✅ Verifies database schema

## 🔍 Manual Alternative (If Script Fails):

```bash
cd ~/cybrik/Backend/CybricHQ

# Check current state
python manage.py showmigrations crm_app

# Fake the problematic migrations
python manage.py migrate crm_app 0018 --fake
python manage.py migrate crm_app 0019 --fake
python manage.py migrate crm_app 0020 --fake
python manage.py migrate crm_app 0021 --fake

# Apply the important migration
python manage.py migrate crm_app 0022

# Apply all remaining
python manage.py migrate

# Verify
python verify_schema.py
```

## ✅ Expected Output:

```
✅ Column exists - Value: False
✅ Lead ID X: name=..., is_manual_only=False
✅ SUCCESS: Database schema is correct!
```

## 🎯 After Success:

1. ✅ Frontend loads: https://crm.cybriksolutions.com/leads
2. ✅ No more ProgrammingError
3. ✅ CRM fully functional

## 📞 If Issues Persist:

Check logs:
```bash
# Django logs
sudo journalctl -u gunicorn -f --lines=100

# OR supervisor logs
tail -f /var/log/supervisor/cybrik-stderr.log
```

---

**Total time: ~2 minutes** ⏱️
