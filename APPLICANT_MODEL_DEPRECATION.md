# Applicant Model Deprecation Summary

## Overview
The Applicant model has been deprecated and consolidated into the Lead model. This is a major refactoring to simplify the data model and reduce redundancy.

## Changes Made

### Models (crm_app/models.py)
1. **Applicant Model**: Marked as DEPRECATED
   - Kept in codebase for backwards compatibility and data migration purposes only
   - Added deprecation warning in verbose_name: "[DEPRECATED] Applicant"
   - All new code should use Lead model instead

2. **Document Model**: 
   - Removed `applicant` FK
   - Kept only `lead` FK

3. **AcademicRecord Model**:
   - Removed `applicant` FK
   - Kept only `lead` FK

4. **Application Model**:
   - Removed `applicant` FK
   - Updated `__str__` method to use `self.lead` instead of `self.applicant`

5. **CallRecord Model**:
   - Removed `applicant` FK
   - Kept only `lead` FK

6. **FollowUp Model**:
   - Removed `lead` FK that pointed to Applicant
   - Kept only `lead` FK that points to Lead model
   - Simplified from dual-FK pattern to single FK

7. **AuditLog Model**:
   - Removed `applicant` FK
   - Added `lead` FK pointing to Lead model

8. **ConsentRecord Model**:
   - Removed `applicant` FK
   - Added `lead` FK pointing to Lead model

9. **WhatsAppMessage Model**:
   - Removed `applicant` FK
   - Kept only `lead` FK

10. **Lead Model**: Enhanced with personal details
    - Added `first_name`, `last_name`, `dob`, `passport_number`, `address`, `preferred_country` fields
    - Now contains all information previously split between Lead and Applicant

11. **transcript_upload_path Function**:
    - Updated to check for `lead` instead of `applicant`
    - Changed path structure from `applicant_<id>` to `lead_<id>`

### Serializers (crm_app/serializers.py)
1. **Removed**: `ApplicantSerializer` class
2. **Removed**: Import of `Applicant` model
3. **Updated**: `ApplicationSerializer`
   - Changed `applicant` field to use Lead model
   - Renamed `applicant_name` to `lead_name`, `applicant_email` to `lead_email`
   - Updated serializer methods accordingly

4. **Updated**: `CallRecordSerializer`
   - Removed `applicant` field
   - Updated phone number fallback to use `lead.phone` instead

5. **Updated**: `FollowUpSerializer`
   - Changed `lead` FK queryset to use Lead model
   - Removed `crm_lead` field (now redundant)
   - Renamed `applicant_name` to `lead_name`
   - Simplified by removing dual-FK references

6. **Updated**: `AuditLogSerializer`
   - Changed `applicant` field to `lead`

7. **Updated**: `ConsentRecordSerializer`
   - Changed `applicant` field to `lead`

8. **Updated**: `ScheduleAICallSerializer`
   - Removed deprecated `applicant_id` and `crm_lead_id` aliases
   - Now requires only `lead_id`

9. **Updated**: `WhatsAppMessageSerializer`
   - Removed `applicant` field

### Views (crm_app/views.py)
1. **Removed**: `ApplicantViewSet` class (entire class removed)
   - All 275+ lines removed
   - Functionality consolidated into Lead management
   - Added deprecation comment in code

2. **Removed**: Import of `Applicant` model
3. **Removed**: Import of `ApplicantSerializer`

### Admin Interface (crm_app/admin.py)
1. **Removed**: `ApplicantAdmin` registration
2. **Updated**: `ApplicationAdmin`
   - Changed `list_display` from `applicant` to `lead`
   - Updated `search_fields` to use `lead__name`

3. **Updated**: `AcademicRecordAdmin`
   - Changed `list_display` from `applicant` to `lead`
   - Updated `search_fields` to use `lead__name`
   - Updated `raw_id_fields` to reference `lead`

4. **Updated**: `ConsentRecordAdmin`
   - Changed `list_display` from `applicant` to `lead`
   - Updated `raw_id_fields` to reference `lead`

### URLs (crm_app/urls.py)
1. **Removed**: `ApplicantViewSet` registration
   - Commented out: `router.register(r"applicants", views.ApplicantViewSet, basename="applicant")`
   - API endpoint `/api/applicants/` no longer available

### WhatsApp Views (crm_app/views_whatsapp.py)
1. **Updated**: `send_whatsapp_message()` function
   - Removed `applicant_id` parameter handling
   - Now requires only `lead_id`
   - Updated to use Lead model exclusively

2. **Updated**: `send_document_upload_request()` function
   - Removed `applicant_id` parameter handling
   - Now requires only `lead_id`

## Migration Path for Existing Data

### Before Creating Migrations:
1. Backup PostgreSQL database (AWS RDS)
2. Test migrations on staging environment first

### Migration Strategy:
1. Create Django migrations: `python manage.py makemigrations crm_app`
2. Data migration (if needed): Transfer any remaining applicant data to Lead model
3. Apply migrations: `python manage.py migrate crm_app`

### API Endpoint Changes:
| Old Endpoint | New Endpoint | Notes |
|---|---|---|
| `/api/applicants/` | `/api/leads/` | ApplicantViewSet removed, use LeadViewSet |
| `/api/applications/?applicant_id=X` | `/api/applications/?lead_id=X` | Filter parameter updated |

## Backwards Compatibility Notes

1. **Applicant Model**: Still exists in database for backwards compatibility
   - Should be used ONLY for data migration purposes
   - All new code should use Lead model
   - Mark for future removal after data migration complete

2. **Serializers**: No longer reference Applicant model
   - Will break if old API clients try to use applicant fields
   - Must migrate client code to use Lead model

3. **Admin Interface**: Updated to use Lead instead of Applicant
   - Applicant model no longer appears in admin
   - All CRUD operations should go through Lead

## Testing Recommendations

1. **Unit Tests**: Update all tests that reference Applicant to use Lead
2. **Integration Tests**: 
   - Test Lead creation with all applicant-related fields
   - Test relationships (Documents, AcademicRecords, Applications, etc.)
   - Test WhatsApp message sending with Lead ID
3. **Migration Tests**: Test migration path on staging database

## Next Steps

1. Create database migrations
2. Apply migrations to staging environment
3. Run integration tests
4. Update frontend to use `/api/leads/` instead of `/api/applicants/`
5. Update any client applications using old API endpoints
6. Deploy to production with proper database backup

## Files Modified

- crm_app/models.py (10+ models updated)
- crm_app/serializers.py (9 serializers updated/removed)
- crm_app/views.py (ApplicantViewSet removed)
- crm_app/admin.py (Updated admin registrations)
- crm_app/urls.py (Removed applicants router)
- crm_app/views_whatsapp.py (Updated to use Lead only)

## Related Documentation

- See PRODUCTION_FIX_QUICK.md for deployment procedures
- See DATABASE_FIX_PRODUCTION.md for database-specific notes
- See TENANT_SEPARATION_PLAN.md for multi-tenant considerations
