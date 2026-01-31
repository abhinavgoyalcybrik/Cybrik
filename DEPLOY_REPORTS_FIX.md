# 🚨 Deploy Reports Summary Fix

## Error Fixed:
```
UnboundLocalError: cannot access local variable 'timezone' where it is not associated with a value
at /api/reports/summary/
```

## ✅ SOLUTION (Copy-Paste These Commands):

```bash
# 1. SSH into production server
ssh your-user@api.cybriksolutions.com

# 2. Pull latest code
cd ~/cybrik/Backend/CybricHQ  # or wherever your code is
git pull origin main

# 3. Restart Django service
sudo systemctl restart gunicorn  # or your service name
# OR if using supervisor:
# sudo supervisorctl restart cybrik
# OR if using Docker:
# docker-compose restart backend

# 4. Check status
sudo systemctl status gunicorn
# OR
# sudo supervisorctl status cybrik

# 5. Test the endpoint
curl https://api.cybriksolutions.com/api/reports/summary/
```

## 🔍 What Was Fixed:

**File:** `Backend/CybricHQ/crm_app/views.py`

**Problem:** The `ReportsSummary.get()` method was using `timezone.now()` before importing `timezone`, causing an UnboundLocalError.

**Solution:** 
- Added `from django.utils import timezone` at the beginning of the method
- Added `from datetime import timedelta` import
- Removed duplicate timezone import later in the function

## 📊 Test After Deploy:

Visit: https://crm.cybriksolutions.com/reports

Should now load without 500 errors!

## 📞 If Issues Persist:

Check Django logs:
```bash
# View recent logs
sudo journalctl -u gunicorn -f --lines=100

# OR if using supervisor
tail -f /var/log/supervisor/cybrik-stderr.log

# OR if using Docker
docker-compose logs -f backend
```

---

**Total deployment time: ~1 minute** ⏱️
