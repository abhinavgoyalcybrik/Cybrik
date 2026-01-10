import logging
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from .models import Lead, CallRecord, FollowUp, Transcript

logger = logging.getLogger(__name__)

def send_welcome_message(lead_id, phone, source):
    """
    Mock function to send welcome message via WhatsApp/SMS.
    In production, integrate with Twilio/Meta API.
    """
    try:
        lead = Lead.objects.get(id=lead_id)
        message = ""
        if source == "PORTAL":
            message = f"Hi {lead.name}, thanks for your inquiry at CybricHQ! We will call you shortly for verification."
        elif source == "WALK_IN":
            message = f"Welcome to CybricHQ, {lead.name}! We have registered your visit. You can reply here with documents."
        
        # Note: In production, integrate with Twilio/Meta API
        logger.info(f"[MOCK SMS] To: {phone} | Body: {message}")
        
    except Lead.DoesNotExist:
        logger.error(f"Lead {lead_id} not found for welcome message.")

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
        custom_params = {
            'lead_id': str(entity.id),
            'entity_type': entity_type,
            'call_record_id': str(call_record.id),
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
    Periodic task to check for due follow-ups and initiate AI calls.
    Runs every minute to check for scheduled AI calls that are due.
    """
    now = timezone.now()
    
    # Find due AI call follow-ups (ai_call channel, pending/scheduled status)
    due_ai_calls = FollowUp.objects.filter(
        due_at__lte=now,
        completed=False,
        channel__in=['ai_call', 'phone'],
        status__in=['pending', 'scheduled']
    ).select_related('lead')
    
    count = 0
    failed = 0
    
    for task in due_ai_calls:
        if not task.lead:
            logger.warning(f"FollowUp {task.id} has no lead/applicant, skipping")
            continue
            
        logger.info(f"Processing scheduled AI call {task.id} for Applicant {task.lead.id}")
        
        # Update status to in_progress
        task.status = "in_progress"
        task.save(update_fields=['status'])
        
        context = {}
        if task.metadata and task.metadata.get('call_context'):
            context = task.metadata['call_context'].copy()
            context['task_id'] = str(task.id)
            context['reason'] = 'scheduled_follow_up'
        else:
            from .services.followup_generator import followup_generator
            context = followup_generator.generate_call_context(
                applicant=task.lead,
                reason='scheduled_follow_up',
                notes=task.notes,
                task=task,
            )
            context['task_id'] = str(task.id)
        
        context['task_notes'] = task.notes or "Follow up call as scheduled."
        
        # Initiate Call
        res = schedule_elevenlabs_call(applicant_id=task.lead.id, extra_context=context)
        
        if res.get("ok"):
            task.status = "completed"
            task.completed = True
            task.metadata = task.metadata or {}
            task.metadata["automated_call_triggered"] = True
            task.metadata["triggered_at"] = now.isoformat()
            
            # Link the call record if available
            if res.get("call_record_id"):
                try:
                    task.call_record_id = res["call_record_id"]
                except Exception:
                    pass
            
            task.save()
            count += 1
            logger.info(f"Successfully triggered AI call for FollowUp {task.id}")
        else:
            task.status = "failed"
            task.metadata = task.metadata or {}
            task.metadata["error"] = res.get("error", "unknown")
            task.metadata["failed_at"] = now.isoformat()
            task.save()
            failed += 1
            logger.error(f"Failed to trigger AI call for FollowUp {task.id}: {res.get('error')}")
            
    return f"Triggered {count} AI calls, {failed} failed"


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
        
        if not task.lead:
            return {"ok": False, "error": "No applicant linked to task"}
        
        # Update status
        task.status = "in_progress"
        task.save(update_fields=['status'])
        
        context = {}
        if task.metadata and task.metadata.get('call_context'):
            context = task.metadata['call_context'].copy()
            context['task_id'] = str(task.id)
            context['reason'] = 'manual_trigger'
        else:
            from .services.followup_generator import followup_generator
            context = followup_generator.generate_call_context(
                applicant=task.lead,
                reason='manual_trigger',
                notes=task.notes,
                task=task,
            )
            context['task_id'] = str(task.id)
        
        context['task_notes'] = task.notes or "Follow up call."
        
        res = schedule_elevenlabs_call(applicant_id=task.lead.id, extra_context=context)
        
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

        # Auto-create follow-up tasks with AI call context
        follow_up = analysis.get('follow_up', {})
        doc_status = analysis.get('document_status', {})
        
        if (follow_up.get('needed') or doc_status.get('status') in ['pending', 'partial']) and call.applicant:
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
            logger.info(f"Created AI follow-up task for applicant {call.applicant.id} with call context")
            
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
    """Calculate follow-up datetime from string like '2 days' or '1 week'"""
    now = timezone.now()
    timing_lower = timing_str.lower()
    
    if 'hour' in timing_lower:
        hours = int(''.join(filter(str.isdigit, timing_lower)) or 1)
        return now + timedelta(hours=hours)
    elif 'day' in timing_lower:
        days = int(''.join(filter(str.isdigit, timing_lower)) or 2)
        return now + timedelta(days=days)
    elif 'week' in timing_lower:
        weeks = int(''.join(filter(str.isdigit, timing_lower)) or 1)
        return now + timedelta(weeks=weeks)
    else:
        return now + timedelta(days=2)  # Default: 2 days


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
                call_record.duration_seconds = int(duration)
            
            # Extract actual LLM cost in dollars from charging object
            # Note: metadata.cost is credits, not dollars - we need charging.llm_price
            charging = el_metadata.get("charging", {}) or {}
            llm_cost = charging.get("llm_price")  # Actual dollar cost
            if llm_cost:
                call_record.cost = float(llm_cost)
            else:
                # Fallback: try analysis.cost if llm_price not available
                if "analysis" in data and isinstance(data["analysis"], dict):
                    cost = data["analysis"].get("cost")
                    if cost:
                        call_record.cost = float(cost)
            
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
        "call_successful": "true",  # Only successful calls
    }
    if agent_id:
        params["agent_id"] = agent_id
    
    headers = {"xi-api-key": xi_key}
    
    try:
        resp = requests.get(url, headers=headers, params=params, timeout=30)
        
        if resp.status_code != 200:
            logger.error(f"Failed to list ElevenLabs conversations: {resp.status_code} - {resp.text}")
            return {"ok": False, "error": f"API error: {resp.status_code}"}
        
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