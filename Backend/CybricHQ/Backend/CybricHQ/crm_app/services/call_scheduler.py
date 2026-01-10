import threading
import time
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)

_scheduler_started = False
_scheduler_lock = threading.Lock()

def process_due_calls():
    """Process all AI calls that are due."""
    from crm_app.models import FollowUp, Applicant
    from crm_app.elevenlabs_client import create_outbound_call
    from crm_app.services.followup_generator import FollowUpGenerator
    
    now = timezone.now()
    due_followups = FollowUp.objects.filter(
        channel='ai_call',
        status='scheduled',
        due_at__lte=now,
        completed=False
    ).select_related('lead', 'application')
    
    count = due_followups.count()
    if count > 0:
        logger.info(f"[CallScheduler] Found {count} due AI calls to process")
    
    for followup in due_followups:
        try:
            applicant = None
            if followup.lead:
                applicant = followup.lead
            elif followup.application:
                applicant = followup.application.lead
                
            if not applicant:
                logger.warning(f"[CallScheduler] FollowUp {followup.id} has no lead/applicant, skipping")
                followup.status = 'failed'
                followup.save(update_fields=['status'])
                continue
            
            phone = applicant.phone
            if not phone:
                logger.warning(f"[CallScheduler] Lead {applicant.id} has no phone, skipping")
                followup.status = 'failed'
                followup.save(update_fields=['status'])
                continue
            
            followup.status = 'in_progress'
            followup.save(update_fields=['status'])
            
            call_context = followup.metadata.get('call_context') if followup.metadata else None
            if not call_context:
                generator = FollowUpGenerator()
                call_context = generator.generate_call_context(
                    applicant, 
                    reason=followup.notes or "General follow-up",
                    task=followup
                )
            
            logger.info(f"[CallScheduler] Initiating call for FollowUp {followup.id} to {phone}")
            
            # Ensure name is set in call_context for ElevenLabs
            if 'name' not in call_context or not call_context.get('name'):
                call_context['name'] = call_context.get('student_name', 'Student')
            
            # Pass dynamic_variables in both formats for ElevenLabs compatibility
            result = create_outbound_call(
                to_number=phone,
                metadata=call_context,
                extra_payload={
                    "conversation_initiation_client_data": {
                        "dynamic_variables": call_context
                    }
                }
            )
            
            if result.get('ok'):
                followup.status = 'completed'
                followup.completed = True
                logger.info(f"[CallScheduler] Call initiated successfully for FollowUp {followup.id}")
            else:
                followup.status = 'failed'
                error_msg = result.get('error') or result.get('body_text', 'Unknown error')
                logger.error(f"[CallScheduler] Call failed for FollowUp {followup.id}: {error_msg}")
            
            followup.save(update_fields=['status', 'completed'])
            
        except Exception as e:
            logger.exception(f"[CallScheduler] Error processing FollowUp {followup.id}: {e}")
            followup.status = 'failed'
            followup.save(update_fields=['status'])

def scheduler_loop():
    """Background loop that checks for due calls every 60 seconds."""
    logger.info("[CallScheduler] Background scheduler started")
    
    time.sleep(10)
    
    while True:
        try:
            process_due_calls()
        except Exception as e:
            logger.exception(f"[CallScheduler] Error in scheduler loop: {e}")
        
        time.sleep(60)

def start_scheduler():
    """Start the background scheduler thread if not already running."""
    global _scheduler_started
    
    with _scheduler_lock:
        if _scheduler_started:
            return
        
        _scheduler_started = True
        thread = threading.Thread(target=scheduler_loop, daemon=True)
        thread.start()
        logger.info("[CallScheduler] Scheduler thread launched")
