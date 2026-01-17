from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from .models import Applicant, AcademicRecord, Document, Application, FollowUp, AuditLog, Lead
import json
import logging

logger = logging.getLogger(__name__)

def get_changes(instance, created):
    """
    Helper to determine what changed in the model instance.
    This is a simplified version; for robust diffing, we'd need to fetch the old instance in pre_save.
    """
    if created:
        return {"status": "Created"}
    
    # For now, we'll just log that it was updated. 
    # To log specific field changes, we'd need to inspect instance._loaded_values or similar if available,
    # or use a library like django-simple-history.
    # Given the constraints, we'll log a generic update message.
    return {"status": "Updated"}

@receiver(pre_save, sender=Applicant)
def capture_applicant_old_state(sender, instance, **kwargs):
    if instance.pk:
        try:
            instance._old_state = Applicant.objects.get(pk=instance.pk)
        except Applicant.DoesNotExist:
            instance._old_state = None
    else:
        instance._old_state = None

@receiver(post_save, sender=Lead)
def create_application_on_lead_conversion(sender, instance, created, **kwargs):
    """
    When a Lead is converted:
    1. Ensure an Applicant profile exists.
    2. Create an Application if one doesn't exist.
    """
    if instance.status != 'converted':
        return
        
    # Check if application already exists for this lead to prevent duplicates
    if Application.objects.filter(lead=instance).exists():
        return
        
    try:
        # 1. Resolve Applicant
        applicant = instance.applicants.first()
        
        if not applicant:
            # Create new Applicant based on Lead data
            applicant = Applicant.objects.create(
                tenant=instance.tenant,
                lead=instance,
                first_name=instance.first_name or instance.name or "Unknown",
                last_name=instance.last_name or "",
                email=instance.email,
                phone=instance.phone,
                preferred_country=instance.preferred_country or instance.country,
                counseling_notes=instance.counseling_notes,
                stage="new",
                metadata={"source_lead_id": instance.id}
            )
            # Log the auto-creation
            AuditLog.objects.create(
                actor="System (Auto-Convert)",
                action="Created",
                target_type="Applicant",
                target_id=str(applicant.id),
                applicant=applicant,
                notes="Auto-created applicant from converted lead"
            )

        # 2. Create Application
        app = Application.objects.create(
            tenant=instance.tenant,
            applicant=applicant,
            lead=instance,
            program=instance.interested_service or "General Application",
            status="pending",
            assigned_to=instance.assigned_to,
            metadata={"source": "auto_conversion"}
        )
        
        # Log the application creation
        AuditLog.objects.create(
            actor="System (Auto-Convert)",
            action="Created",
            target_type="Application",
            target_id=str(app.id),
            applicant=applicant,
            data={"program": app.program},
            notes=f"Auto-created application for {app.program}"
        )
        
    except Exception as e:
        # Log error but don't blocking the save
        logger.error(f"Failed to auto-create application for converted lead {instance.id}: {e}")

@receiver(post_save, sender=Applicant)
def log_applicant_save(sender, instance, created, **kwargs):
    action = "Created" if created else "Updated"
    changes = {}
    
    if not created and hasattr(instance, '_old_state') and instance._old_state:
        old = instance._old_state
        fields_to_check = [
            'first_name', 'last_name', 'email', 'phone', 'dob', 
            'passport_number', 'address', 'preferred_country', 'stage'
        ]
        for field in fields_to_check:
            old_val = getattr(old, field)
            new_val = getattr(instance, field)
            if old_val != new_val:
                changes[field] = {'from': str(old_val), 'to': str(new_val)}
                
        # Check metadata changes if needed, but it's a JSON field so might be noisy
        # For now, let's stick to main fields
    
    data = {"name": f"{instance.first_name} {instance.last_name}"}
    if changes:
        data["changes"] = changes
        
    AuditLog.objects.create(
        actor="System", 
        action=action,
        target_type="Applicant",
        target_id=str(instance.id),
        applicant=instance,
        data=data,
        notes=f"Applicant {action}" + (f": {', '.join(changes.keys())}" if changes else "")
    )

@receiver(post_save, sender=AcademicRecord)
def log_academic_save(sender, instance, created, **kwargs):
    action = "Created" if created else "Updated"
    AuditLog.objects.create(
        actor="System",
        action=action,
        target_type="AcademicRecord",
        target_id=str(instance.id),
        applicant=instance.applicant,
        data={"degree": instance.degree, "institution": instance.institution},
        notes=f"Academic Record {action}: {instance.degree}"
    )

@receiver(post_delete, sender=AcademicRecord)
def log_academic_delete(sender, instance, **kwargs):
    AuditLog.objects.create(
        actor="System",
        action="Deleted",
        target_type="AcademicRecord",
        target_id=str(instance.id),
        applicant=instance.applicant,
        data={"degree": instance.degree},
        notes=f"Academic Record Deleted: {instance.degree}"
    )

@receiver(post_save, sender=Document)
def log_document_save(sender, instance, created, **kwargs):
    action = "Created" if created else "Updated"
    AuditLog.objects.create(
        actor="System",
        action=action,
        target_type="Document",
        target_id=str(instance.id),
        applicant=instance.applicant,
        data={"type": instance.get_document_type_display()},
        notes=f"Document {action}: {instance.get_document_type_display()}"
    )

@receiver(post_save, sender=Application)
def log_application_save(sender, instance, created, **kwargs):
    action = "Created" if created else "Updated"
    AuditLog.objects.create(
        actor="System",
        action=action,
        target_type="Application",
        target_id=str(instance.id),
        applicant=instance.applicant,
        data={"program": instance.program, "status": instance.status},
        notes=f"Application {action}: {instance.program}"
    )

@receiver(post_save, sender=FollowUp)
def log_followup_save(sender, instance, created, **kwargs):
    # FollowUp links to 'lead' which is an Applicant in this model structure (based on models.py line 204)
    if not instance.lead:
        return
        
    action = "Created" if created else "Updated"
    AuditLog.objects.create(
        actor="System",
        action=action,
        target_type="FollowUp",
        target_id=str(instance.id),
        applicant=instance.lead,
        data={"channel": instance.channel, "notes": instance.notes},
        notes=f"FollowUp {action}: {instance.channel}"
    )
