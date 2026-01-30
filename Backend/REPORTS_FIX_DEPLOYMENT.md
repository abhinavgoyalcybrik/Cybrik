# Reports Fix - Production Deployment

## Issue
Country-specific reports are failing with:
- `FieldError: Unsupported lookup 'country__iexact' for ForeignKey`
- `FieldError: Cannot resolve keyword 'country' into field`

## Root Cause
Model field mismatches:
- `Applicant` model has `preferred_country` (not `country`)
- `FollowUp.lead` is FK to `Applicant` (not `Lead` model)

## Files to Deploy
**File:** `crm_app/views.py` in `Backend/CybricHQ/`

## Changes Required

### Change 1: Line ~2573 (Conversion Funnel - Applicant count)
**OLD:**
```python
total_applicants = Applicant.objects.filter(lead_filters if not tenant_id else Q(tenant_id=tenant_id)).count()
```

**NEW:**
```python
# Build applicant_filters separately since Applicant uses preferred_country, not country
applicant_filters = Q()
if tenant_id:
    applicant_filters &= Q(tenant_id=tenant_id)
if country_filter:
    applicant_filters &= Q(preferred_country__iexact=country_filter)
total_applicants = Applicant.objects.filter(applicant_filters).count()
```

### Change 2: Line ~2649 (Document Status)
**Already fixed in local code - verify on production:**
```python
doc_filters &= Q(applicant__preferred_country__iexact=country_filter)
```

### Change 3: Line ~2651 (Add missing doc_stats query)
**Verify this line exists:**
```python
doc_stats = Document.objects.filter(doc_filters).values('status').annotate(count=Count('id'))
```

### Change 4: Line ~2663 (Task Completion - FollowUp filter)
**Already fixed in local code - verify on production:**
```python
# FollowUp.lead is ForeignKey to Applicant, not Lead model
# Applicant has preferred_country, not country
task_filters &= Q(lead__preferred_country__iexact=country_filter)
```

## Quick Deployment Commands

### Option 1: Direct SSH Edit (if you have production SSH access)
```bash
# SSH to production server
ssh user@api.cybriksolutions.com

# Navigate to backend
cd /path/to/Backend/CybricHQ

# Backup current file
cp crm_app/views.py crm_app/views.py.backup_$(date +%Y%m%d_%H%M%S)

# Edit the file
nano crm_app/views.py
# Make the changes listed above

# Restart Django/Gunicorn
sudo systemctl restart gunicorn
# OR
sudo supervisorctl restart all
```

### Option 2: Git Deploy (if using Git for deployment)
```bash
# On local machine
cd "d:\cybrik server\Cybrik\Backend\CybricHQ"
git add crm_app/views.py
git commit -m "Fix: Country filter errors in Reports API"
git push origin main

# On production server
cd /path/to/Backend/CybricHQ
git pull origin main
sudo systemctl restart gunicorn
```

### Option 3: File Upload (if using FTP/SCP)
```bash
# Upload the fixed views.py from local to production
scp "d:\cybrik server\Cybrik\Backend\CybricHQ\crm_app\views.py" user@api.cybriksolutions.com:/path/to/Backend/CybricHQ/crm_app/

# Then SSH and restart
ssh user@api.cybriksolutions.com
sudo systemctl restart gunicorn
```

## Testing After Deployment
1. Open Reports page: https://your-frontend.com/reports
2. Select countries (e.g., Australia, Netherlands)
3. Verify no 500 errors in console
4. Confirm country-specific reports load correctly

## Rollback Plan
```bash
# If something goes wrong, restore backup
cp crm_app/views.py.backup_TIMESTAMP crm_app/views.py
sudo systemctl restart gunicorn
```
