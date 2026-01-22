import logging
import django.db
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from .models import Lead, CallRecord, FollowUp, Transcript

logger = logging.getLogger(__name__)

def send_welcome_message(lead_id, phone, source):
    """
    Send welcome message via WhatsApp after first contact.
    Uses Meta WhatsApp Business API.
    """
    try:
        from .services.whatsapp_client import send_welcome_message as wa_send_welcome
        from .models import Lead, WhatsAppMessage
        
        lead = Lead.objects.get(id=lead_id)
        name = lead.name or "there"
        
        # Send via WhatsApp API
        result = wa_send_welcome(phone, name)
        
        # Log the message
        WhatsAppMessage.objects.create(
            lead=lead,
            tenant=lead.tenant,
            direction="outbound",
            message_type="template",
            template_name="welcome_after_call",
            from_phone="",  # Will be filled by config
            to_phone=phone,
            message_body=f"Welcome message sent to {name}",
            message_id=result.get("message_id"),
            status="sent" if result.get("success") else "failed",
            error_message=result.get("error") if not result.get("success") else None,
        )
        
        if result.get("success"):
            logger.info(f"WhatsApp welcome sent to {phone} for lead {lead_id}")
        else:
            logger.error(f"WhatsApp welcome failed for {phone}: {result.get('error')}")
        
        return result
        
    except Lead.DoesNotExist:
        logger.error(f"Lead {lead_id} not found for welcome message.")
        return {"success": False, "error": "Lead not found"}
    except Exception as e:
        logger.exception(f"Error sending WhatsApp welcome: {e}")
        return {"success": False, "error": str(e)}

def schedule_elevenlabs_call(lead_id=None, applicant_id=None, extra_context=None):
    """
    Schedule and initiate an ElevenLabs call for a lead OR applicant.
    Uses conversation_initiation_client_data.dynamic_variables to pass data to agent.
    
    Args:
        lead_id: ID of the Lead to call (optional)
        applicant_id: ID of the Applicant to call (optional)
        extra_context: Optional dict of extra context to pass to the agent (e.g. {"reason": "follow_up"})
    """
    try:
        from .elevenlabs_client import create_outbound_call
        from .models import Applicant
        
        entity = None
        entity_type = "unknown"
        phone = None
        name = "Student"
        source = "unknown"
        
        # Resolve Entity (Lead or Applicant)
        if applicant_id:
            try:
                entity = Applicant.objects.get(id=applicant_id)
                entity_type = "applicant"
                phone = entity.phone
                name = entity.first_name
                # Applicant metadata might contain source
                source = entity.metadata.get("lead_source", "applicant") if entity.metadata else "applicant"
            except Applicant.DoesNotExist:
                logger.error(f"Applicant {applicant_id} not found for call.")
                return {"ok": False, "error": "applicant_not_found"}
        elif lead_id:
            try:
                entity = Lead.objects.get(id=lead_id)
                entity_type = "lead"
                phone = entity.phone
                name = entity.name
                source = entity.source
            except Lead.DoesNotExist:
                logger.error(f"Lead {lead_id} not found for call.")
                return {"ok": False, "error": "lead_not_found"}
        else:
            return {"ok": False, "error": "missing_id"}

        logger.info(f"Initiating AI call for {entity_type} {entity.id} ({name})")
        
        if not phone:
            logger.error(f"{entity_type} {entity.id} has no phone number")
            return {"ok": False, "error": "no_phone"}
        
        # Prepare dynamic variables - must match ElevenLabs agent config exactly
        dynamic_vars = {}
        
        if entity_type == "lead":
            lead_data = entity.raw_payload or {}
            dynamic_vars = {
                "counsellorName": "Cybric Assistant",
                "name": name or "Student",
                "preferredCountry": (entity.country or lead_data.get("country_of_interest") or ""),
                "highestQualification": (getattr(entity, 'highest_qualification', None) or lead_data.get("highest_qualification") or ""),
                "marksHighestQualification": (getattr(entity, 'qualification_marks', None) or lead_data.get("highest_qualification_marks") or ""),
                "yearCompletion": (getattr(entity, 'year_completion', None) or lead_data.get("year_completion") or ""),
                "ieltsPteStatus": (getattr(entity, 'english_test_scores', None) or lead_data.get("english_scores") or ""),
            }
        elif entity_type == "applicant":
            # Map Applicant fields to dynamic vars - must match ElevenLabs agent config exactly
            meta = entity.metadata or {}
            dynamic_vars = {
                "counsellorName": "Cybric Assistant",
                "name": name or "Student",
                "preferredCountry": meta.get("country_of_interest", ""),
                "highestQualification": meta.get("highest_qualification", ""),
                "marksHighestQualification": meta.get("qualification_marks", ""),
                "yearCompletion": meta.get("year_completion", ""),
                "ieltsPteStatus": meta.get("english_test_scores", ""),
            }

        # Merge extra context (CRITICAL for follow-ups)
        if extra_context:
            dynamic_vars.update(extra_context)

        # Create CallRecord
        call_record = CallRecord.objects.create(
            lead=None if entity_type == "applicant" else entity,
            applicant=entity if entity_type == "applicant" else None,
            direction="outbound",
            status="initiated",
            provider="smartflo",
            metadata={
                "entity_type": entity_type,
                "entity_id": str(entity.id),
                "name": name,
                "source": source,
                "dynamic_variables_sent": dynamic_vars,
                "extra_context": extra_context
            }
        )
        
        # Use SmartFlow Click2Call API (routes to Voice Bot -> ElevenLabs via WebSocket)
        from .smartflo_api import initiate_smartflo_call
        
        # Build custom params for SmartFlow (passed to WebSocket consumer)
        # is_followup is True if this call is from a scheduled task (has task_id, reason, or followUpReason)
        is_followup_call = bool(extra_context and (
            extra_context.get('task_id') or  # Any task-based call is a follow-up
            extra_context.get('followUpReason') or
            extra_context.get('reason')
        ))
        
        custom_params = {
            'lead_id': str(entity.id),
            'entity_type': entity_type,
            'call_record_id': str(call_record.id),
            'is_followup': 'True' if is_followup_call else 'False',
            **dynamic_vars  # Include all the ElevenLabs dynamic variables
        }
        
        result = initiate_smartflo_call(
            destination_number=phone,
            custom_params=custom_params
        )
        
        # Update call record
        if result.get("success"):
            logger.info(f"Successfully initiated SmartFlow call for {entity_type} {entity.id}")
            call_record.status = "in_progress"
            call_record.external_call_id = result.get("call_sid")
            call_record.metadata["call_sid"] = result.get("call_sid")
            call_record.metadata["full_response"] = result.get("full_response")
            call_record.save()
            return {"ok": True, "call_sid": result.get("call_sid"), "call_record_id": call_record.id}
        else:
            logger.error(f"Failed to initiate SmartFlow call: {result.get('error', 'unknown')}")
            call_record.status = "failed"
            call_record.metadata["error"] = result.get("error")
            call_record.save()
            return {"ok": False, "error": result.get("error")}
    
    except Exception as e:
        logger.exception(f"Error scheduling SmartFlow call: {e}")
        return {"ok": False, "error": str(e)}


@shared_task
def check_and_initiate_followups():
    """
    Periodic task (Beat) to check for due follow-ups.
    Dispatch-only: Enqueues tasks and exits immediately.
    """
    now = timezone.now()
    
    # 1. Query for due, pending AI calls
    # We use select_for_update or just rely on the worker to handle state
    # Ideally, we grab IDs and let the worker lock the row.
    
    due_tasks = FollowUp.objects.filter(
        due_at__lte=now,
        completed=False,
        channel__in=['ai_call', 'phone'],
        status__in=['pending', 'scheduled']
    ).values_list('id', flat=True)
    
    count = 0
    for task_id in due_tasks:
        # Enqueue the heavy lifting
        execute_single_ai_call_task.delay(task_id)
        count += 1
        
    return f"Queued {count} AI calls for execution"


@shared_task(
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3, 'countdown': 60},
    retry_backoff=True
)
def execute_single_ai_call_task(self, followup_id):
    """
    Worker task to execute a single AI call.
    Handles locking, API calling, and status updates.
    """
    try:
        # Lock the row to prevent race conditions
        with django.db.transaction.atomic():
            # select_for_update(skip_locked=True) is safer for high concurrency 
            # but standard select_for_update is fine for this scale
            try:
                task = FollowUp.objects.select_for_update(nowait=True).get(id=followup_id)
            except django.db.OperationalError:
                # Row is locked by another worker (or manual trigger), skip this run
                logger.info(f"Skipping task {followup_id} - locked by another transaction")
                return "locked"
                
            # Double check status inside the lock
            if task.completed or task.status not in ['pending', 'scheduled']:
                logger.info(f"Task {followup_id} already processed or invalid status: {task.status}")
                return "skipped_status"

            # Check due date again just to be safe (though query handles it)
            if task.due_at and task.due_at > timezone.now():
                logger.info(f"Task {followup_id} is not due yet (future due_at)")
                return "not_due"

            # Determine Target
            target_id = None
            is_applicant = False
            
            if task.lead:
                target_id = task.lead.id
                is_applicant = True
            elif task.crm_lead:
                target_id = task.crm_lead.id
                is_applicant = False
            else:
                logger.warning(f"FollowUp {task.id} has no lead/applicant, skipping")
                task.status = "failed"
                task.metadata = task.metadata or {}
                task.metadata["error"] = "No linked lead/applicant"
                task.save()
                return "failed_no_user"

            logger.info(f"Processing AI call {task.id} for {'Applicant' if is_applicant else 'Lead'} {target_id}")
            
            # Update status to keep invalid other workers from picking it up?
            # Actually, `in_progress` is good.
            task.status = "in_progress"
            task.save(update_fields=['status'])

        # --- OUTSIDE ATOMIC BLOCK (Network Calls) ---
        # We changed status to in_progress, so other workers won't pick it up via filter
        
        # Fetch previous call summary for context
        previous_call_summary = "No previous calls"
        try:
            if is_applicant and task.lead:
                last_call = CallRecord.objects.filter(applicant=task.lead).order_by('-created_at').first()
            elif task.crm_lead:
                last_call = CallRecord.objects.filter(lead=task.crm_lead).order_by('-created_at').first()
            else:
                last_call = None
                
            if last_call and last_call.transcript:
                previous_call_summary = last_call.ai_analysis.get('summary', '') if last_call.ai_analysis else ''
                if not previous_call_summary and last_call.transcript:
                    previous_call_summary = last_call.transcript[:500] + "..." if len(last_call.transcript) > 500 else last_call.transcript
        except Exception as e:
            logger.warning(f"Could not fetch previous call summary: {e}")
        
        context = {}
        if task.metadata and task.metadata.get('call_context'):
            context = task.metadata['call_context'].copy()
            context['task_id'] = str(task.id)
            context['reason'] = 'scheduled_follow_up'
        else:
            from .services.followup_generator import followup_generator
            context = followup_generator.generate_call_context(
                applicant=task.lead if is_applicant else None,
                reason='scheduled_follow_up',
                notes=task.notes,
                task=task,
            )
            context['task_id'] = str(task.id)
        
        # Add follow-up specific context
        context['followUpReason'] = task.notes or context.get('followUpReason', 'Scheduled follow-up call')
        context['callObjective'] = context.get('callObjective', task.notes or 'Follow up with student regarding their inquiry')
        context['previousCallSummary'] = previous_call_summary
        context['task_notes'] = task.notes or "Follow up call as scheduled."
        
        # Initiate Call (BLOCKING)
        res = schedule_elevenlabs_call(
            applicant_id=target_id if is_applicant else None,
            lead_id=target_id if not is_applicant else None,
            extra_context=context
        )
        
        # Update Task based on result
        if res.get("ok"):
            task.status = "completed"
            task.completed = True
            task.metadata = task.metadata or {}
            task.metadata["automated_call_triggered"] = True
            task.metadata["triggered_at"] = timezone.now().isoformat()
            
            if res.get("call_record_id"):
                try:
                    task.call_record_id = res["call_record_id"]
                except Exception:
                    pass
            
            task.save()
            logger.info(f"Successfully triggered AI call for FollowUp {task.id}")
            return "success"
        else:
            task.status = "failed"
            task.metadata = task.metadata or {}
            task.metadata["error"] = res.get("error", "unknown")
            task.metadata["failed_at"] = timezone.now().isoformat()
            task.save()
            logger.error(f"Failed to trigger AI call for FollowUp {task.id}: {res.get('error')}")
            # Raising exception triggers retry if configured
            raise Exception(f"Call initiation failed: {res.get('error')}")

    except Exception as e:
        logger.exception(f"Error executing AI call task {followup_id}: {e}")
        # Re-raise to let Celery handle retry
        raise e


def trigger_scheduled_ai_call(followup_id):
    """
    Manually trigger a scheduled AI call.
    Can be called from views or management commands.
    """
    try:
        task = FollowUp.objects.get(id=followup_id)
        
        if task.channel not in ['ai_call', 'phone']:
            return {"ok": False, "error": "Not an AI call task"}
        
        if task.completed or task.status in ['completed', 'cancelled']:
            return {"ok": False, "error": "Task already completed or cancelled"}
        
        if not task.lead and not task.crm_lead:
            return {"ok": False, "error": "No applicant or lead linked to task"}
            
        target_id = None
        is_applicant = False
        if task.lead:
            target_id = task.lead.id
            is_applicant = True
        elif task.crm_lead:
            target_id = task.crm_lead.id
            is_applicant = False
        
        # Update status
        task.status = "in_progress"
        task.save(update_fields=['status'])
        
        # Fetch previous call summary for context
        previous_call_summary = "No previous calls"
        try:
            if is_applicant and task.lead:
                last_call = CallRecord.objects.filter(applicant=task.lead).order_by('-created_at').first()
            elif task.crm_lead:
                last_call = CallRecord.objects.filter(lead=task.crm_lead).order_by('-created_at').first()
            else:
                last_call = None
                
            if last_call and last_call.transcript:
                # Get a summary of the last call (first 500 chars of transcript or AI summary)
                previous_call_summary = last_call.ai_analysis.get('summary', '') if last_call.ai_analysis else ''
                if not previous_call_summary and last_call.transcript:
                    previous_call_summary = last_call.transcript[:500] + "..." if len(last_call.transcript) > 500 else last_call.transcript
        except Exception as e:
            logger.warning(f"Could not fetch previous call summary: {e}")
        
        context = {}
        if task.metadata and task.metadata.get('call_context'):
            context = task.metadata['call_context'].copy()
            context['task_id'] = str(task.id)
            context['reason'] = 'manual_trigger'
        else:
            from .services.followup_generator import followup_generator
            context = followup_generator.generate_call_context(
                applicant=task.lead if is_applicant else None,
                reason='manual_trigger',
                notes=task.notes,
                task=task,
            )
            context['task_id'] = str(task.id)
        
        # Add follow-up specific context (required by follow-up agent)
        context['followUpReason'] = task.notes or context.get('followUpReason', 'Scheduled follow-up call')
        context['callObjective'] = context.get('callObjective', task.notes or 'Follow up with student regarding their inquiry')
        context['previousCallSummary'] = previous_call_summary
        context['task_notes'] = task.notes or "Follow up call."
        
        res = schedule_elevenlabs_call(
            applicant_id=target_id if is_applicant else None,
            lead_id=target_id if not is_applicant else None,
            extra_context=context
        )
        
        if res.get("ok"):
            task.status = "completed"
            task.completed = True
            task.metadata = task.metadata or {}
            task.metadata["automated_call_triggered"] = True
            task.metadata["triggered_at"] = timezone.now().isoformat()
            task.save()
            return {"ok": True, "message": "AI call initiated successfully"}
        else:
            task.status = "failed"
            task.metadata = task.metadata or {}
            task.metadata["error"] = res.get("error", "unknown")
            task.save()
            return {"ok": False, "error": res.get("error", "Failed to initiate call")}
            
    except FollowUp.DoesNotExist:
        return {"ok": False, "error": "Task not found"}


@shared_task
def forward_lead_to_elevenlabs(lead_id):
    """
    Forward a lead to ElevenLabs for AI calling.
    This is called automatically when a lead is created.
    """
    logger.info(f"Auto-calling lead {lead_id} via ElevenLabs...")
    return schedule_elevenlabs_call(lead_id)


# AI Analysis Tasks
@shared_task
def analyze_call_transcript(call_record_id):
    """
    Async task to analyze call transcript using AI
    Triggered automatically after ElevenLabs call completes
    """
    from .services.ai_analyzer import CallAnalyzer
    
    try:
        call = CallRecord.objects.get(id=call_record_id)
        
        # Skip if already analyzed
        if call.ai_analyzed:
            logger.info(f"Call {call_record_id} already analyzed, skipping")
            return
        
        # Get transcript
        transcript = get_transcript_for_call(call)
        
        if not transcript:
            logger.warning(f"No transcript available for call {call_record_id}")
            return
        
        # Analyze with AI
        logger.info(f"Analyzing call {call_record_id} with AI...")
        analyzer = CallAnalyzer()
        # Fetch pending tasks for verification
        pending_tasks = []
        if call.applicant:
            pending_tasks = list(FollowUp.objects.filter(
                lead=call.applicant, 
                completed=False
            ))

        analysis = analyzer.analyze_transcript(transcript, call.metadata or {}, pending_tasks=pending_tasks)
        
        # Store results
        call.ai_analysis_result = analysis
        call.ai_quality_score = analysis.get('qualification_score', 0)
        call.ai_analyzed = True
        call.save()
        
        logger.info(f"AI analysis complete for call {call_record_id}. Score: {call.ai_quality_score}")
        
        # Update Applicant Metadata with Document Status
        if call.applicant:
            doc_status = analysis.get('document_status', {})
            if doc_status:
                if not call.applicant.metadata:
                    call.applicant.metadata = {}
                
                # Merge or overwrite document status
                call.applicant.metadata['document_status'] = doc_status.get('status', 'unknown')
                call.applicant.metadata['missing_documents'] = doc_status.get('missing_documents', [])
                call.applicant.metadata['submitted_documents'] = doc_status.get('submitted_documents', [])
                call.applicant.save(update_fields=['metadata'])
                logger.info(f"Updated document status for applicant {call.applicant.id}: {doc_status.get('status')}")

            # --- EXTRACT AND SAVE APPLICANT DETAILS ---
            try:
                # 1. Personal Details
                personal = analysis.get('personal_details', {})
                if personal:
                    updates = []
                    if personal.get('dob') and not call.applicant.dob:
                        call.applicant.dob = personal.get('dob')
                        updates.append('dob')
                    if personal.get('passport_number') and not call.applicant.passport_number:
                        call.applicant.passport_number = personal.get('passport_number')
                        updates.append('passport_number')
                    
                    # Update metadata for other fields
                    if not call.applicant.metadata:
                        call.applicant.metadata = {}
                    
                    for field in ['city', 'country', 'gender']:
                        if personal.get(field):
                            call.applicant.metadata[field] = personal.get(field)
                            updates.append('metadata')
                    
                    if updates:
                        call.applicant.save(update_fields=list(set(updates)))
                        logger.info(f"Updated personal details for applicant {call.applicant.id}: {updates}")

                # 2. Academic History
                academic_history = analysis.get('academic_history', [])
                if academic_history:
                    from .models import AcademicRecord
                    for record in academic_history:
                        # Simple deduplication: check if same degree and institution exists
                        exists = AcademicRecord.objects.filter(
                            applicant=call.applicant,
                            degree=record.get('degree'),
                            institution=record.get('institution')
                        ).exists()
                        
                        if not exists and record.get('degree'):
                            AcademicRecord.objects.create(
                                applicant=call.applicant,
                                institution=record.get('institution'),
                                degree=record.get('degree'),
                                year_of_completion=record.get('year'),
                                grade=record.get('grade'),
                                score=record.get('score')
                            )
                            logger.info(f"Created AcademicRecord for applicant {call.applicant.id}: {record.get('degree')}")

                # 3. English Proficiency & Lead Qualification
                english = analysis.get('english_proficiency', {})
                if english or analysis.get('qualification_score'):
                    # Update Lead fields if linked
                    if call.applicant.lead:
                        lead = call.applicant.lead
                        lead_updates = []
                        
                        if english:
                            score_str = f"{english.get('test_type', '')} {english.get('overall_score', '')}".strip()
                            if score_str and not lead.english_test_scores:
                                lead.english_test_scores = score_str
                                lead_updates.append('english_test_scores')
                        
                        # Update highest qualification from academic history if available
                        if academic_history:
                            # Assume the first one is highest or look for keywords? 
                            # For now, just take the first one if lead field is empty
                            latest_degree = academic_history[0].get('degree')
                            if latest_degree and not lead.highest_qualification:
                                lead.highest_qualification = latest_degree
                                lead_updates.append('highest_qualification')
                                
                            latest_grade = academic_history[0].get('grade') or academic_history[0].get('score')
                            if latest_grade and not lead.qualification_marks:
                                lead.qualification_marks = latest_grade
                                lead_updates.append('qualification_marks')

                        if lead_updates:
                            lead.save(update_fields=lead_updates)
                            logger.info(f"Updated Lead qualification fields for lead {lead.id}: {lead_updates}")

                    # --- AUTOMATIC STATUS UPDATES ---
                    target_lead = None
                    if call.lead:
                        target_lead = call.lead
                    elif call.applicant and call.applicant.lead:
                        target_lead = call.applicant.lead
                        
                    if target_lead:
                        old_status = target_lead.status
                        
                        # Logic for status transitions
                        interest = analysis.get('interest_level', 'unknown').lower()
                        score = analysis.get('qualification_score', 0)
                        
                        new_status = old_status # Default to no change
                        
                        if interest in ['high', 'medium'] or score >= 40:
                            new_status = 'qualified'
                        elif interest == 'low' and score < 20:
                            new_status = 'junk'
                        elif old_status == 'new':
                            # If it was new and we have a transcript/analysis, it's at least contacted
                            new_status = 'contacted'
                            
                        if new_status != old_status:
                            target_lead.status = new_status
                            target_lead.save(update_fields=['status'])
                            logger.info(f"Auto-transitioned Lead {target_lead.id} status from {old_status} to {new_status} (Interest: {interest}, Score: {score})")

            except Exception as e:
                logger.error(f"Error saving extracted applicant details: {e}")

            # --- ADD AI REMARKS TO COUNSELING NOTES ---
            try:
                timestamp = timezone.now().strftime("%Y-%m-%d %H:%M")
                interest = analysis.get('interest_level', 'Unknown').title()
                score = analysis.get('qualification_score', 0)
                findings = ", ".join(analysis.get('key_points', [])[:3]) # Top 3 points
                
                remark = f"\\n[{timestamp}] AI Analysis: Interest {interest} ({score}%). {findings}."
                
                # Add follow-up context if needed
                follow_up = analysis.get('follow_up', {})
                if follow_up.get('needed'):
                    remark += f" Action: Scheduled follow-up ({follow_up.get('reason')})."
                
                if call.applicant.counseling_notes:
                    call.applicant.counseling_notes += remark
                else:
                    call.applicant.counseling_notes = remark.strip()
                
                call.applicant.save(update_fields=['counseling_notes'])
                logger.info(f"Added AI remark to Applicant {call.applicant.id}")
            except Exception as e:
                logger.error(f"Failed to add AI remark: {e}")
            # --- PROCESS TASK VERIFICATION ---
            task_verification = analysis.get('task_verification', [])
            if task_verification:
                for verification in task_verification:
                    try:
                        task_id = verification.get('task_id')
                        is_completed = verification.get('completed')
                        evidence = verification.get('evidence')
                        
                        if task_id and is_completed:
                            task = FollowUp.objects.get(id=task_id)
                            task.completed = True
                            task.metadata = task.metadata or {}
                            task.metadata['verified_by_ai'] = True
                            task.metadata['verification_evidence'] = evidence
                            task.metadata['verified_at_call_id'] = call_record_id
                            task.save()
                            logger.info(f"AI verified task {task_id} as completed based on call {call_record_id}")
                    except FollowUp.DoesNotExist:
                        logger.warning(f"AI tried to verify non-existent task {task_id}")
                    except Exception as e:
                        logger.error(f"Error processing task verification: {e}")
            # ---------------------------------

        # --- UPDATE LEAD PROFILE FROM ANALYSIS ---
        if call.lead:
            try:
                lead = call.lead
                lead_updates = []
                
                # 1. Personal Details
                personal = analysis.get('personal_details', {})
                if personal:
                    if personal.get('first_name') and not lead.first_name:
                        lead.first_name = personal.get('first_name')
                        lead_updates.append('first_name')
                    if personal.get('last_name') and not lead.last_name:
                        lead.last_name = personal.get('last_name')
                        lead_updates.append('last_name')
                    if personal.get('dob') and not lead.dob:
                        lead.dob = personal.get('dob')
                        lead_updates.append('dob')
                    if personal.get('passport_number') and not lead.passport_number:
                        lead.passport_number = personal.get('passport_number')
                        lead_updates.append('passport_number')
                    if personal.get('address') and not lead.address:
                        lead.address = personal.get('address')
                        lead_updates.append('address')
                    if personal.get('city') and not lead.city:
                        lead.city = personal.get('city')
                        lead_updates.append('city')
                    if personal.get('country') and not lead.country:
                        lead.country = personal.get('country')
                        lead_updates.append('country')
                    if personal.get('preferred_country') and not lead.preferred_country:
                        lead.preferred_country = personal.get('preferred_country')
                        lead_updates.append('preferred_country')
                
                # 2. Academic History -> highest_qualification, qualification_marks
                academic_history = analysis.get('academic_history', [])
                if academic_history and len(academic_history) > 0:
                    latest = academic_history[0]
                    if latest.get('degree') and not lead.highest_qualification:
                        lead.highest_qualification = latest.get('degree')
                        lead_updates.append('highest_qualification')
                    grade = latest.get('grade') or latest.get('score')
                    if grade and not lead.qualification_marks:
                        lead.qualification_marks = str(grade)
                        lead_updates.append('qualification_marks')
                
                # 3. English Proficiency
                english = analysis.get('english_proficiency', {})
                if english and not lead.english_test_scores:
                    score_str = f"{english.get('test_type', '')} {english.get('overall_score', '')}".strip()
                    if score_str:
                        lead.english_test_scores = score_str
                        lead_updates.append('english_test_scores')
                
                # 4. Visa Consultancy Fields
                if analysis.get('enquiry_type') and not lead.enquiry_type:
                    lead.enquiry_type = analysis.get('enquiry_type')
                    lead_updates.append('enquiry_type')
                
                if analysis.get('exam_type') and not lead.exam_type:
                    lead.exam_type = analysis.get('exam_type')
                    lead_updates.append('exam_type')
                
                if analysis.get('qualification_gap') and not lead.qualification_gap:
                    lead.qualification_gap = analysis.get('qualification_gap')
                    lead_updates.append('qualification_gap')
                
                # preferred_country from top-level analysis (not nested in personal_details)
                if analysis.get('preferred_country') and not lead.preferred_country:
                    lead.preferred_country = analysis.get('preferred_country')
                    lead_updates.append('preferred_country')
                
                # 5. Store full analysis in metadata for reference
                if not lead.metadata:
                    lead.metadata = {}
                lead.metadata['last_ai_analysis'] = {
                    'call_record_id': call_record_id,
                    'qualification_score': analysis.get('qualification_score'),
                    'interest_level': analysis.get('interest_level'),
                    'analyzed_at': timezone.now().isoformat(),
                }
                lead_updates.append('metadata')
                
                if lead_updates:
                    lead.save(update_fields=list(set(lead_updates)))
                    logger.info(f"Updated Lead {lead.id} profile from AI analysis: {lead_updates}")
            except Exception as e:
                logger.error(f"Error updating Lead profile from analysis: {e}")

        # Auto-create follow-up tasks with AI call context
        follow_up = analysis.get('follow_up', {})
        doc_status = analysis.get('document_status', {})
        
        if (follow_up.get('needed') or doc_status.get('status') in ['pending', 'partial']) and (call.applicant or call.lead):
            priority = 'HIGH' if analysis.get('interest_level') == 'high' else 'MEDIUM'
            
            # Construct task notes
            notes = f"AI Recommendation: {follow_up.get('reason', 'Follow-up needed')}"
            
            # If documents are missing, explicitly mention them
            missing_docs = doc_status.get('missing_documents', [])
            if missing_docs:
                notes = f"Collect Missing Documents: {', '.join(missing_docs)}. " + notes
                priority = 'HIGH' # Document collection is usually high priority
            
            # Build comprehensive AI call context for ElevenLabs
            call_context = {
                # Follow-up specific info
                "followUpReason": follow_up.get('reason', 'General follow-up'),
                "callScript": follow_up.get('call_script', ''),
                "keyTopics": " | ".join(follow_up.get('key_topics', [])) if follow_up.get('key_topics') else '',
                "callObjective": follow_up.get('call_objective', 'Follow up with student'),
                "previousCallSummary": follow_up.get('previous_call_summary', ''),
                
                # Document status
                "missingDocuments": ", ".join(missing_docs) if missing_docs else 'None identified',
                "documentStatus": doc_status.get('status', 'unknown'),
                
                # From previous call analysis
                "studentInterestLevel": analysis.get('interest_level', 'unknown'),
                "qualificationScore": str(analysis.get('qualification_score', 0)),
                "studentConcerns": " | ".join(analysis.get('concerns', [])) if analysis.get('concerns') else '',
                
                # Key discussion points from last call
                "previousDiscussionPoints": " | ".join(analysis.get('key_points', [])) if analysis.get('key_points') else '',
            }
            
            FollowUp.objects.create(
                lead=call.applicant,
                crm_lead=call.lead,
                channel='ai_call',  # Use AI call channel for automated follow-ups
                notes=notes,
                due_at=calculate_follow_up_time(follow_up.get('timing', '2 days')),
                metadata={
                    'created_by_ai': True, 
                    'source_call_id': call_record_id, 
                    'priority': priority,
                    'call_context': call_context,  # ElevenLabs dynamic variables
                    'follow_up_analysis': follow_up,  # Full AI analysis of follow-up
                }
            )
            logger.info(f"Created AI follow-up task for {'Applicant' if call.applicant else 'Lead'} {call.applicant.id if call.applicant else call.lead.id} with call context")
            
            # Send automated email if needed
            if analysis.get('interest_level') in ['high', 'medium']:
                try:
                    from .services.email_service import EmailService
                    email_service = EmailService()
                    sent = email_service.send_follow_up(call.applicant, analysis)
                    if sent:
                        logger.info(f"Sent automated follow-up email to {call.applicant.email}")
                except Exception as e:
                    logger.error(f"Error sending automated email: {e}")
        
        return analysis
        
    except CallRecord.DoesNotExist:
        logger.error(f"CallRecord {call_record_id} not found")
    except Exception as e:
        logger.error(f"Error analyzing call {call_record_id}: {str(e)}")
        return None


def get_transcript_for_call(call_record):
    """Fetch transcript from ElevenLabs API or database"""
    # Try metadata first
    if call_record.metadata:
        transcript = call_record.metadata.get('transcript')
        if transcript:
            return transcript
    
    # Try transcripts relation
    if hasattr(call_record, 'transcripts') and call_record.transcripts.exists():
        transcript_obj = call_record.transcripts.first()
        if transcript_obj and transcript_obj.transcript_text:
            return transcript_obj.transcript_text
    
    # Fetch from ElevenLabs API if conversation_id available
    conv_id = call_record.metadata.get('conversation_id') if call_record.metadata else None
    if not conv_id:
        conv_id = call_record.external_call_id
    
    if conv_id:
        try:
            import requests
            import os
            # Fetch conversation details from ElevenLabs
            url = f"https://api.elevenlabs.io/v1/convai/conversations/{conv_id}"
            headers = {"xi-api-key": os.getenv('ELEVENLABS_API_KEY')}
            response = requests.get(url, headers=headers)
            
            if response.ok:
                data = response.json()
                # Extract transcript from conversation
                transcript_parts = []
                if 'transcript' in data:
                    return data['transcript']
                # Fallback: build from messages
                if 'messages' in data:
                    for msg in data['messages']:
                        text = msg.get('text', '')
                        if text:
                            transcript_parts.append(text)
                if transcript_parts:
                    return " ".join(transcript_parts)
        except Exception as e:
            logger.error(f"Error fetching transcript from ElevenLabs: {e}")
    
    return None


def calculate_follow_up_time(timing_str):
    """Calculate follow-up datetime from string like '5 minutes', '2 hours', '2 days' or '1 week'"""
    try:
        now = timezone.now()
        timing_lower = str(timing_str).lower().strip()
        logger.info(f"Calculating follow-up time for: '{timing_str}' (lower: '{timing_lower}')")
        
        # Handle immediate / ASAP requests
        if any(word in timing_lower for word in ['now', 'immediate', 'asap', 'right away', 'soon']):
            logger.info("Matched IMMEDIATE/ASAP -> 5 minutes")
            return now + timedelta(minutes=5)  # 5 minutes from now
        
        # Handle minutes
        if 'minute' in timing_lower or 'min' in timing_lower:
            minutes = int(''.join(filter(str.isdigit, timing_lower)) or 5)
            logger.info(f"Matched matching MINUTES -> {minutes} minutes")
            return now + timedelta(minutes=minutes)
        
        # Handle hours
        if 'hour' in timing_lower:
            hours = int(''.join(filter(str.isdigit, timing_lower)) or 1)
            logger.info(f"Matched matching HOURS -> {hours} hours")
            return now + timedelta(hours=hours)
    
        # Handle days
        if 'day' in timing_lower:
            days = int(''.join(filter(str.isdigit, timing_lower)) or 2)
            return now + timedelta(days=days)
        
        # Handle weeks
        if 'week' in timing_lower:
            weeks = int(''.join(filter(str.isdigit, timing_lower)) or 1)
            return now + timedelta(weeks=weeks)
        
        # Default: 2 hours (more reasonable than 2 days for callbacks)
        return now + timedelta(hours=2)
        
    except Exception as e:
        logger.error(f"Error calculating follow-up time for '{timing_str}': {e}")
        return timezone.now() + timedelta(hours=2)  # Safe fallback


@shared_task
def fetch_and_store_conversation_task(call_record_id, conversation_id):
    """
    Fetch conversation details from ElevenLabs and store in DB.
    """
    try:
        import requests
        import os
        from django.conf import settings
        
        call_record = CallRecord.objects.get(id=call_record_id)
        
        xi_key = os.environ.get("ELEVENLABS_API_KEY") or getattr(settings, "ELEVENLABS_API_KEY", None)
        if not xi_key:
            logger.error("ELEVENLABS_API_KEY not set")
            return

        url = f"https://api.elevenlabs.io/v1/convai/conversations/{conversation_id}"
        resp = requests.get(url, headers={"xi-api-key": xi_key}, timeout=30)
        
        if resp.status_code == 200:
            data = resp.json()
            
            # Update CallRecord
            call_record.status = data.get("status", call_record.status)
            
            # ElevenLabs stores duration and cost in nested metadata object
            el_metadata = data.get("metadata", {}) or {}
            
            # Extract duration from nested metadata
            duration = el_metadata.get("call_duration_secs") or data.get("call_duration_secs") or data.get("call_length")
            if duration:
                try:
                    call_record.duration_seconds = int(float(duration))
                except (ValueError, TypeError):
                    logger.warning(f"Could not parse duration: {duration}")
            
            # Extract actual LLM cost in dollars from charging object
            # Note: metadata.cost is credits, not dollars - we need charging.llm_price
            charging = el_metadata.get("charging", {}) or {}
            llm_cost = charging.get("llm_price")  # Actual dollar cost
            if llm_cost:
                try:
                    call_record.cost = float(llm_cost)
                except (ValueError, TypeError):
                    logger.warning(f"Could not parse llm_cost: {llm_cost}")
            else:
                # Fallback: try analysis.cost if llm_price not available
                if "analysis" in data and isinstance(data["analysis"], dict):
                    analysis_data = data["analysis"]
                    cost = analysis_data.get("cost")
                    if cost:
                        call_record.cost = float(cost)
                        
                    # Extract Summary
                    summary = analysis_data.get("transcript_summary")
                    if summary:
                        if not call_record.metadata:
                            call_record.metadata = {}
                        call_record.metadata["elevenlabs_summary"] = summary
                        
                    # Extract Evaluation Criteria
                    eval_results = analysis_data.get("evaluation_criteria_results")
                    if eval_results:
                         if not call_record.metadata:
                            call_record.metadata = {}
                         call_record.metadata["elevenlabs_evaluation"] = eval_results
            
            # Save raw conversation data
            if not call_record.metadata:
                call_record.metadata = {}
            call_record.metadata["conversation_data"] = data
            call_record.metadata["conversation_id"] = conversation_id
            
            # Store phone number from lead if available
            if call_record.lead and call_record.lead.phone:
                call_record.metadata["phone_number"] = call_record.lead.phone
            
            # Extract and create Transcript if available
            raw_transcript = data.get("transcript")
            logger.info(f"ElevenLabs Data Keys: {list(data.keys())}")
            logger.info(f"Raw Transcript present: {bool(raw_transcript)}")
            if raw_transcript:
                 logger.info(f"Raw Transcript type: {type(raw_transcript)}")
                 if isinstance(raw_transcript, list) and len(raw_transcript) > 0:
                      logger.info(f"First turn keys: {list(raw_transcript[0].keys())}")
            
            if raw_transcript and not Transcript.objects.filter(call=call_record).exists():
                # Format transcript into clean, readable text
                formatted_messages = []
                if isinstance(raw_transcript, list):
                    for turn in raw_transcript:
                        role = turn.get("role", "unknown").capitalize()
                        message = turn.get("message")
                        if message:  # Only include turns with actual messages
                            formatted_messages.append(f"{role}: {message}")
                    transcript_text = "\n\n".join(formatted_messages)
                else:
                    transcript_text = str(raw_transcript)
                
                Transcript.objects.create(
                    call=call_record,
                    transcript_text=transcript_text,
                    metadata={"source": "elevenlabs_api", "raw_transcript": raw_transcript}
                )
                logger.info(f"Stored transcript for call {call_record_id}")
            
            call_record.save()
            logger.info(f"Updated CallRecord {call_record_id} with ElevenLabs data")
            
            # Trigger AI analysis if status is completed/done
            if data.get("status") in ["done", "completed"]:
                analyze_call_transcript.delay(call_record_id)
                
            # --- Fetch Audio Recording ---
            try:
                audio_url = f"https://api.elevenlabs.io/v1/convai/conversations/{conversation_id}/audio"
                audio_resp = requests.get(audio_url, headers={"xi-api-key": xi_key}, timeout=60)
                
                if audio_resp.status_code == 200:
                    from django.core.files.base import ContentFile
                    from django.core.files.storage import default_storage
                    
                    file_name = f"conversations/{conversation_id}.mp3"
                    # Check if file already exists to avoid overwriting or duplication logic if needed
                    if not default_storage.exists(file_name):
                        file_path = default_storage.save(file_name, ContentFile(audio_resp.content))
                        # Construct URL manually or use storage.url if available
                        # explicit /media/ prefix as per settings.py MEDIA_URL
                        call_record.recording_url = f"/media/{file_name}"
                        call_record.save()
                        logger.info(f"Saved audio recording to {call_record.recording_url}")
                    else:
                        # If existing, just ensure URL is set
                        call_record.recording_url = f"/media/{file_name}"
                        call_record.save()
                        logger.info(f"Audio recording already exists at {file_name}")
                else:
                    logger.warning(f"Failed to fetch audio for {conversation_id}: {audio_resp.status_code}")
            except Exception as e:
                logger.error(f"Error fetching audio recording: {e}")

        else:
            logger.error(f"Failed to fetch conversation {conversation_id}: {resp.status_code}")
            
    except CallRecord.DoesNotExist:
        logger.error(f"CallRecord {call_record_id} not found")
    except Exception as e:
        logger.exception(f"Error fetching conversation {conversation_id}: {e}")


@shared_task
def create_applicant_from_call(call_record_id):
    """
    Convert a qualified Lead (with successful call) into an Applicant.
    """
    try:
        from .models import Applicant
        
        call_record = CallRecord.objects.get(id=call_record_id)
        lead = call_record.lead
        
        if not lead:
            logger.error(f"No lead associated with call {call_record_id}")
            return
        
        # Check if applicant already exists
        if Applicant.objects.filter(email=lead.email).exists():
            logger.info(f"Applicant with email {lead.email} already exists")
            return
        
        # Create applicant from lead data
        applicant = Applicant.objects.create(
            name=lead.name,
            email=lead.email,
            phone=lead.phone,
            country_of_interest=lead.country,
            source=f"CALL_{lead.source}",
            metadata={
                "created_from_lead_id": lead.id,
                "created_from_call_id": call_record_id,
                "original_source": lead.source
            }
        )
        
        # Link call record to applicant
        call_record.applicant = applicant
        call_record.save()
        
        logger.info(f"Created Applicant {applicant.id} from Lead {lead.id}")
        return applicant.id
        
    except CallRecord.DoesNotExist:
        logger.error(f"CallRecord {call_record_id} not found")
    except Exception as e:
        logger.exception(f"Error creating applicant from call {call_record_id}: {e}")


@shared_task
def process_call_result(call_record_id):
    """
    Process call result after ElevenLabs webhook is received.
    """
    try:
        call_record = CallRecord.objects.get(id=call_record_id)
        
        # Extract metadata from the call
        metadata = call_record.metadata or {}
        conversation_id = metadata.get("conversation_id") or call_record.external_call_id
        
        if conversation_id:
            # Fetch full conversation data
            fetch_and_store_conversation_task.delay(call_record_id, conversation_id)
        else:
            logger.warning(f"No conversation_id for call {call_record_id}")
        
    except CallRecord.DoesNotExist:
        logger.error(f"CallRecord {call_record_id} not found")
    except Exception as e:
        logger.exception(f"Error processing call result {call_record_id}: {e}")


@shared_task
def run_llm_extraction_task(call_record_id, extraction_spec):
    """
    Run LLM extraction task on call transcript.
    Extract specific information from call based on extraction spec.
    """
    try:
        call_record = CallRecord.objects.get(id=call_record_id)
        transcript = get_transcript_for_call(call_record)
        
        if not transcript:
            logger.warning(f"No transcript for extraction task on call {call_record_id}")
            return None
        
        # Use OpenAI or configured LLM to extract data
        try:
            import openai
            import os
            
            openai.api_key = os.getenv("OPENAI_API_KEY")
            
            prompt = f"""Extract the following information from this call transcript:
{extraction_spec}

Transcript:
{transcript}

Return the extracted information in JSON format."""
            
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": prompt}],
                temperature=0
            )
            
            extracted_data = response.choices[0].message.content
            
            # Store in call record metadata
            if not call_record.metadata:
                call_record.metadata = {}
            call_record.metadata["llm_extraction"] = extracted_data
            call_record.save()
            
            logger.info(f"LLM extraction completed for call {call_record_id}")
            return extracted_data
            
        except Exception as e:
            logger.error(f"LLM extraction failed: {e}")
            return None
        
    except CallRecord.DoesNotExist:
        logger.error(f"CallRecord {call_record_id} not found")
        return None
    except Exception as e:
        logger.exception(f"Error in LLM extraction task: {e}")
        return None


def sync_all_elevenlabs_conversations(hours_back=24):
    """
    Sync all recent ElevenLabs conversations with local CallRecords.
    This is useful when webhooks are missed or for localhost development.
    
    1. Lists all conversations from ElevenLabs API
    2. For each conversation, finds or creates a CallRecord
    3. Fetches full conversation data (transcript, recording URL, etc.)
    
    Args:
        hours_back: How many hours back to fetch conversations (default 24)
    
    Returns:
        dict with sync results
    """
    import requests
    import os
    from django.conf import settings
    from datetime import datetime, timedelta
    import time
    
    xi_key = os.environ.get("ELEVENLABS_API_KEY") or getattr(settings, "ELEVENLABS_API_KEY", None)
    if not xi_key:
        logger.error("ELEVENLABS_API_KEY not set")
        return {"ok": False, "error": "API key not configured"}
    
    # Calculate timestamp for filtering
    cutoff_time = timezone.now() - timedelta(hours=hours_back)
    cutoff_unix = int(cutoff_time.timestamp())
    
    # Get agent ID from settings
    agent_id = os.environ.get("ELEVENLABS_AGENT_ID") or getattr(settings, "ELEVENLABS_AGENT_ID", None)
    
    # Build request URL with filters
    url = "https://api.elevenlabs.io/v1/convai/conversations"
    params = {
        "call_successful": "success",  # Only successful calls
    }
    if agent_id:
        params["agent_id"] = agent_id
    
    headers = {"xi-api-key": xi_key}
    
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=30)
        
        if resp.status_code != 200:
            error_msg = f"Failed to list ElevenLabs conversations: {resp.status_code} - {resp.text}"
            logger.error(error_msg)
            return {"ok": False, "error": error_msg}
        
        data = resp.json()
        conversations = data.get("conversations", [])
        
        synced = 0
        skipped = 0
        errors = 0
        results = []
        
        for conv in conversations:
            conv_id = conv.get("conversation_id")
            if not conv_id:
                continue
            
            # Check if call is within time range
            start_time = conv.get("start_time_unix_secs")
            if start_time and start_time < cutoff_unix:
                skipped += 1
                continue
            
            # Check if we already have this conversation synced
            existing = CallRecord.objects.filter(
                external_call_id=conv_id
            ).first() or CallRecord.objects.filter(
                metadata__conversation_id=conv_id
            ).first()
            
            if existing:
                # Already synced, but maybe need to fetch updated data
                if existing.metadata and existing.metadata.get("conversation_data"):
                    skipped += 1
                    continue
            
            try:
                # Get or create CallRecord
                if not existing:
                    # Try to find by phone number and timestamp
                    phone = None
                    if conv.get("metadata"):
                        phone = conv["metadata"].get("phone_number") or conv["metadata"].get("phone")
                    
                    if phone:
                        # Look for a recent CallRecord with matching phone
                        window_start = cutoff_time
                        existing = CallRecord.objects.filter(
                            created_at__gte=window_start,
                            metadata__phone_number=phone
                        ).first()
                
                if not existing:
                    # Create new CallRecord
                    existing = CallRecord.objects.create(
                        direction="outbound",
                        status="completed",
                        provider="elevenlabs",
                        external_call_id=conv_id,
                        metadata={
                            "conversation_id": conv_id,
                            "synced_from_api": True,
                            "sync_time": timezone.now().isoformat()
                        }
                    )
                    logger.info(f"Created new CallRecord for conversation {conv_id}")
                else:
                    # Update existing with conversation_id
                    existing.external_call_id = conv_id
                    if not existing.metadata:
                        existing.metadata = {}
                    existing.metadata["conversation_id"] = conv_id
                    existing.save()
                
                # Fetch full conversation data
                fetch_and_store_conversation_task(existing.id, conv_id)
                synced += 1
                results.append({
                    "conversation_id": conv_id,
                    "call_record_id": existing.id,
                    "status": "synced"
                })
                
                # Small delay to avoid rate limiting
                time.sleep(0.5)
                
            except Exception as e:
                logger.error(f"Error syncing conversation {conv_id}: {e}")
                errors += 1
                results.append({
                    "conversation_id": conv_id,
                    "status": "error",
                    "error": str(e)
                })
        
        return {
            "ok": True,
            "synced": synced,
            "skipped": skipped,
            "errors": errors,
            "total_found": len(conversations),
            "results": results
        }
        
    except Exception as e:
        logger.exception(f"Error syncing ElevenLabs conversations: {e}")
        return {"ok": False, "error": str(e)}


@shared_task
def verify_document_task(document_id):
    """
    Background task to verify uploaded documents using AI
    """
    try:
        from .models import Document
        from .services.ai_analyzer import DocumentVerifier
        import os
        
        try:
            document = Document.objects.get(id=document_id)
        except Document.DoesNotExist:
            logger.error(f"Document {document_id} not found for verification")
            return
            
        if not document.file:
            logger.error(f"Document {document_id} has no file")
            return
            
        # Check file existence
        if not os.path.exists(document.file.path):
            logger.error(f"File not found at {document.file.path}")
            return
            
        # Prepare Applicant Data for matching
        applicant = document.applicant
        applicant_data = {}
        if applicant:
            applicant_data = {
                "first_name": applicant.first_name,
                "last_name": applicant.last_name,
                "dob": str(applicant.dob) if applicant.dob else None,
                "passport_number": applicant.passport_number,
                "email": applicant.email,
                "phone": applicant.phone
            }
        elif document.lead:
             # Fallback to lead data if no applicant yet
             lead = document.lead
             applicant_data = {
                "name": lead.name,
                "email": lead.email,
                "phone": lead.phone
             }
            
        logger.info(f"Starting AI verification for Document {document_id} ({document.document_type})")
        
        verifier = DocumentVerifier()
        result = verifier.verify_and_match(document.file.path, applicant_data)
        
        # Update Document
        if "error" not in result:
            document.extraction_data = result
            
            # Map AI status to DB status
            ai_status = result.get("verification_status") # valid, suspicious, invalid
            if ai_status == "valid":
                document.validation_status = "valid"
                document.status = "verified"
            elif ai_status == "suspicious":
                document.validation_status = "unclear"
                document.status = "pending" # Keep pending for manual review
            elif ai_status == "invalid":
                document.validation_status = "invalid"
                document.status = "rejected"
                
            document.save()
            logger.info(f"Document {document_id} verification complete: {document.validation_status}")
        else:
            logger.error(f"AI Verification failed: {result.get('error')}")
            
    except Exception as e:
        logger.error(f"Error in verify_document_task: {str(e)}")


def calculate_follow_up_time(timing_str):
    """
    Parse a timing string (e.g., '2 days', '1 week', 'tomorrow') and return a datetime.
    """
    from django.utils import timezone
    from datetime import timedelta
    import re
    
    now = timezone.now()
    if not timing_str:
        return now + timedelta(days=2)
        
    timing_str = str(timing_str).lower().strip()
    
    try:
        nums = re.findall(r'\d+', timing_str)
        val = int(nums[0]) if nums else 1
        
        if 'hour' in timing_str:
            return now + timedelta(hours=val)
        elif 'day' in timing_str:
            return now + timedelta(days=val)
        elif 'week' in timing_str:
            return now + timedelta(weeks=val)
        elif 'month' in timing_str:
            return now + timedelta(days=val*30)
        elif 'tomorrow' in timing_str:
            return now + timedelta(days=1)
            
        return now + timedelta(days=2)
    except Exception:
        return now + timedelta(days=2)