"""
Follow-up Generator Service

Generates AI-ready follow-up tasks with comprehensive metadata
so ElevenLabs AI agent knows exactly what to discuss with the student.
"""

import logging
from datetime import timedelta
from django.utils import timezone

logger = logging.getLogger(__name__)


class FollowUpGenerator:
    """
    Generates follow-up tasks with complete context for AI calls.
    Collects all relevant student data to pass to ElevenLabs.
    """
    
    def generate_call_context(self, applicant, reason=None, notes=None, task=None):
        """
        Generate comprehensive context for an AI call.
        
        Args:
            applicant: The Applicant model instance
            reason: Why this call is being made (e.g., "document_collection", "enrollment_followup")
            notes: Additional notes/instructions for the call
            task: Optional FollowUp task that triggered this
            
        Returns:
            dict: Complete context for ElevenLabs dynamic_variables
        """
        if not applicant:
            return {"error": "No applicant provided"}
        
        context = {
            "student_name": self._get_student_name(applicant),
            "phone": applicant.phone or "",
            "email": applicant.email or "",
            "call_reason": reason or "general_followup",
            "call_notes": notes or "",
        }
        
        context.update(self._get_application_context(applicant))
        context.update(self._get_document_context(applicant))
        context.update(self._get_academic_context(applicant))
        context.update(self._get_call_history_context(applicant))
        context.update(self._get_pending_tasks_context(applicant, exclude_task=task))
        context.update(self._get_counseling_context(applicant))
        
        context["talking_points"] = self._generate_talking_points(context, reason)
        
        flattened = self._flatten_for_elevenlabs(context)
        return flattened
    
    def _flatten_for_elevenlabs(self, context):
        """
        Flatten context to ElevenLabs-compatible format.
        ElevenLabs only accepts string, number, boolean values.
        """
        flat = {}
        
        student_name = str(context.get("student_name", "Student"))
        flat["name"] = student_name
        flat["student_name"] = student_name
        flat["phone"] = str(context.get("phone", ""))
        flat["email"] = str(context.get("email", ""))
        flat["call_reason"] = str(context.get("call_reason", "general_followup"))
        flat["call_notes"] = str(context.get("call_notes", ""))
        
        flat["has_applications"] = "yes" if context.get("has_applications") else "no"
        flat["application_count"] = str(context.get("application_count", 0))
        
        apps = context.get("applications", [])
        if apps:
            app_summary = "; ".join([
                f"{a.get('university', 'Unknown')} - {a.get('program', 'Unknown')} ({a.get('status', 'pending')})"
                for a in apps[:3]
            ])
            flat["applications_summary"] = app_summary
        else:
            flat["applications_summary"] = "No applications yet"
        
        flat["target_countries"] = ", ".join(context.get("target_countries", [])) or "Not specified"
        flat["target_universities"] = ", ".join(context.get("target_universities", [])) or "Not specified"
        flat["latest_application_status"] = str(context.get("latest_application_status", "none"))
        
        flat["document_status"] = str(context.get("document_status", "unknown"))
        flat["missing_documents"] = ", ".join(context.get("missing_documents", [])) or "None identified"
        flat["submitted_documents"] = ", ".join(context.get("submitted_documents", [])) or "None yet"
        
        records = context.get("academic_records", [])
        if records:
            academic_summary = "; ".join([
                f"{r.get('degree', '')} from {r.get('institution', 'Unknown')} ({r.get('year', '')})"
                for r in records[:2]
            ])
            flat["academic_summary"] = academic_summary
        else:
            flat["academic_summary"] = "No academic records"
        
        flat["highest_qualification"] = str(context.get("highest_qualification", "Unknown"))
        flat["english_proficiency"] = str(context.get("english_proficiency", "Unknown"))
        
        flat["previous_calls_count"] = str(context.get("previous_calls_count", 0))
        flat["last_call_date"] = str(context.get("last_call_date", "Never"))
        flat["last_call_summary"] = str(context.get("last_call_summary", "No previous calls"))
        flat["overall_interest_level"] = str(context.get("overall_interest_level", "unknown"))
        flat["qualification_score"] = str(context.get("qualification_score", 0))
        
        if context.get("previous_discussion_points"):
            flat["previous_discussion_points"] = "; ".join(context["previous_discussion_points"][:3])
        else:
            flat["previous_discussion_points"] = "None"
        
        flat["pending_tasks_count"] = str(context.get("pending_tasks_count", 0))
        pending = context.get("pending_tasks", [])
        if pending:
            tasks_summary = "; ".join([t.get("notes", "")[:50] for t in pending[:3]])
            flat["pending_tasks_summary"] = tasks_summary
        else:
            flat["pending_tasks_summary"] = "No pending tasks"
        
        notes = context.get("counseling_notes", "")
        flat["counseling_notes"] = notes[:500] if notes else "No notes"
        
        flat["special_requirements"] = ", ".join(context.get("special_requirements", [])) or "None"
        flat["preferred_country"] = str(context.get("preferred_country", "Not specified"))
        
        talking_points = context.get("talking_points", [])
        if talking_points:
            flat["talking_points"] = " | ".join(talking_points)
        else:
            flat["talking_points"] = "General follow-up conversation"
        
        return flat
    
    def _get_student_name(self, applicant):
        """Get full student name. Handles both Applicant and Lead models."""
        if hasattr(applicant, 'first_name') and hasattr(applicant, 'last_name'):
            parts = [applicant.first_name or "", applicant.last_name or ""]
            name = " ".join(p for p in parts if p).strip()
            if name:
                return name
        
        if hasattr(applicant, 'name') and applicant.name:
            return applicant.name
        
        return "Student"
    
    def _get_application_context(self, applicant):
        """Get application status and details."""
        from ..models import Application
        
        context = {
            "has_applications": False,
            "application_count": 0,
            "applications": [],
            "latest_application_status": None,
            "target_countries": [],
            "target_universities": [],
        }
        
        try:
            applications = Application.objects.filter(applicant=applicant).order_by('-created_at')
            
            if applications.exists():
                context["has_applications"] = True
                context["application_count"] = applications.count()
                
                for app in applications[:5]:
                    app_info = {
                        "university": app.university or "Unknown",
                        "program": app.program or "Unknown",
                        "status": app.status or "pending",
                        "intake": app.intake or "",
                    }
                    context["applications"].append(app_info)
                    
                    if app.country and app.country not in context["target_countries"]:
                        context["target_countries"].append(app.country)
                    if app.university and app.university not in context["target_universities"]:
                        context["target_universities"].append(app.university)
                
                context["latest_application_status"] = applications.first().status
        except Exception as e:
            logger.error(f"Error getting application context: {e}")
        
        return context
    
    def _get_document_context(self, applicant):
        """Get document submission status."""
        context = {
            "document_status": "unknown",
            "missing_documents": [],
            "submitted_documents": [],
        }
        
        try:
            meta = applicant.metadata or {}
            context["document_status"] = meta.get("document_status", "unknown")
            context["missing_documents"] = meta.get("missing_documents", [])
            context["submitted_documents"] = meta.get("submitted_documents", [])
            
            if not context["missing_documents"] and context["document_status"] == "unknown":
                context["missing_documents"] = [
                    "passport", "academic_transcripts", "english_test_scores",
                    "statement_of_purpose", "recommendation_letters"
                ]
                context["document_status"] = "not_started"
        except Exception as e:
            logger.error(f"Error getting document context: {e}")
        
        return context
    
    def _get_academic_context(self, applicant):
        """Get academic background."""
        from ..models import AcademicRecord
        
        context = {
            "academic_records": [],
            "highest_qualification": None,
            "english_proficiency": None,
        }
        
        try:
            records = AcademicRecord.objects.filter(applicant=applicant).order_by('-year_of_completion')
            
            for record in records[:3]:
                context["academic_records"].append({
                    "degree": record.degree or "",
                    "institution": record.institution or "",
                    "year": record.year_of_completion or "",
                    "grade": record.grade or record.score or "",
                })
            
            if context["academic_records"]:
                context["highest_qualification"] = context["academic_records"][0]["degree"]
            
            if applicant.lead:
                context["english_proficiency"] = applicant.lead.english_test_scores or ""
                if not context["highest_qualification"]:
                    context["highest_qualification"] = applicant.lead.highest_qualification or ""
        except Exception as e:
            logger.error(f"Error getting academic context: {e}")
        
        return context
    
    def _get_call_history_context(self, applicant):
        """Get previous call history and summaries."""
        from ..models import CallRecord
        
        context = {
            "previous_calls_count": 0,
            "last_call_date": None,
            "last_call_summary": None,
            "overall_interest_level": "unknown",
            "qualification_score": 0,
        }
        
        try:
            calls = CallRecord.objects.filter(applicant=applicant).order_by('-created_at')
            context["previous_calls_count"] = calls.count()
            
            if calls.exists():
                last_call = calls.first()
                context["last_call_date"] = last_call.created_at.strftime("%Y-%m-%d")
                
                if last_call.ai_analysis_result:
                    analysis = last_call.ai_analysis_result
                    context["last_call_summary"] = analysis.get("summary", "")
                    context["overall_interest_level"] = analysis.get("interest_level", "unknown")
                    context["qualification_score"] = analysis.get("qualification_score", 0)
                    
                    key_points = analysis.get("key_points", [])
                    if key_points:
                        context["previous_discussion_points"] = key_points[:5]
        except Exception as e:
            logger.error(f"Error getting call history context: {e}")
        
        return context
    
    def _get_pending_tasks_context(self, applicant, exclude_task=None):
        """Get pending follow-up tasks."""
        from ..models import FollowUp
        
        context = {
            "pending_tasks": [],
            "pending_tasks_count": 0,
        }
        
        try:
            tasks = FollowUp.objects.filter(
                lead=applicant,
                completed=False
            ).exclude(status__in=['completed', 'cancelled'])
            
            if exclude_task:
                tasks = tasks.exclude(id=exclude_task.id)
            
            context["pending_tasks_count"] = tasks.count()
            
            for task in tasks[:5]:
                context["pending_tasks"].append({
                    "notes": task.notes or "",
                    "due_at": task.due_at.strftime("%Y-%m-%d %H:%M") if task.due_at else "",
                    "channel": task.channel,
                })
        except Exception as e:
            logger.error(f"Error getting pending tasks context: {e}")
        
        return context
    
    def _get_counseling_context(self, applicant):
        """Get counseling notes and remarks."""
        context = {
            "counseling_notes": "",
            "special_requirements": [],
        }
        
        try:
            if applicant.counseling_notes:
                notes = applicant.counseling_notes[-2000:]
                context["counseling_notes"] = notes
            
            meta = applicant.metadata or {}
            if meta.get("special_requirements"):
                context["special_requirements"] = meta["special_requirements"]
            if meta.get("country_of_interest"):
                context["preferred_country"] = meta["country_of_interest"]
        except Exception as e:
            logger.error(f"Error getting counseling context: {e}")
        
        return context
    
    def _generate_talking_points(self, context, reason):
        """Generate AI talking points based on context."""
        points = []
        
        if reason == "document_collection":
            missing = context.get("missing_documents", [])
            if missing:
                points.append(f"Collect missing documents: {', '.join(missing[:3])}")
            points.append("Explain document requirements and deadlines")
            points.append("Offer assistance with document preparation")
            
        elif reason == "enrollment_followup":
            points.append("Discuss enrollment decision and any concerns")
            points.append("Answer questions about university/program")
            points.append("Confirm next steps in admission process")
            
        elif reason == "application_status":
            status = context.get("latest_application_status", "pending")
            points.append(f"Update student on application status: {status}")
            points.append("Address any concerns or questions")
            if status == "pending":
                points.append("Explain expected timeline")
                
        else:
            if context.get("document_status") in ["pending", "partial", "not_started"]:
                points.append("Inquire about document preparation progress")
            
            if context.get("has_applications"):
                points.append("Provide update on application status")
            else:
                points.append("Discuss study abroad interests and program options")
            
            if context.get("previous_calls_count", 0) > 0:
                points.append("Follow up on previous discussion points")
            else:
                points.append("Introduce services and gather student requirements")
            
            interest = context.get("overall_interest_level", "unknown")
            if interest == "high":
                points.append("Encourage enrollment and offer fast-track support")
            elif interest == "low":
                points.append("Address concerns and re-engage interest")
        
        return points[:5]
    
    def create_ai_followup(self, applicant, reason=None, notes=None, due_at=None, 
                           assigned_to=None, priority="MEDIUM"):
        """
        Create a follow-up task with AI call channel and full context.
        
        Args:
            applicant: The Applicant to follow up with
            reason: Reason for the call
            notes: Additional notes
            due_at: When to schedule the call (defaults to based on priority)
            assigned_to: Staff member to assign to
            priority: HIGH/MEDIUM/LOW
            
        Returns:
            FollowUp: The created follow-up task
        """
        from ..models import FollowUp
        
        if not due_at:
            if priority == "HIGH":
                due_at = timezone.now() + timedelta(minutes=5)
            elif priority == "MEDIUM":
                due_at = timezone.now() + timedelta(minutes=30)
            else:
                due_at = timezone.now() + timedelta(hours=2)
        
        call_context = self.generate_call_context(
            applicant=applicant,
            reason=reason,
            notes=notes,
        )
        
        metadata = {
            "call_context": call_context,
            "priority": priority,
            "auto_generated": True,
            "generated_at": timezone.now().isoformat(),
        }
        
        if not notes and reason:
            notes = self._generate_task_notes(reason, call_context)
        
        followup = FollowUp.objects.create(
            lead=applicant,
            channel="ai_call",
            notes=notes or f"AI call follow-up: {reason or 'general'}",
            due_at=due_at,
            status="scheduled",
            assigned_to=assigned_to,
            metadata=metadata,
        )
        
        logger.info(f"Created AI follow-up {followup.id} for applicant {applicant.id}")
        return followup
    
    def _generate_task_notes(self, reason, context):
        """Generate descriptive task notes based on reason and context."""
        student = context.get("student_name", "Student")
        
        if reason == "document_collection":
            missing = context.get("missing_documents", [])
            if missing:
                return f"Call {student} to collect: {', '.join(missing[:3])}"
            return f"Call {student} to discuss document requirements"
            
        elif reason == "enrollment_followup":
            return f"Follow up with {student} regarding enrollment decision"
            
        elif reason == "application_status":
            status = context.get("latest_application_status", "pending")
            return f"Update {student} on application status ({status})"
            
        elif reason == "new_lead":
            return f"Initial call with {student} - gather requirements and introduce services"
            
        else:
            return f"Follow-up call with {student}"
    
    def enrich_existing_task(self, task):
        """
        Enrich an existing task with full call context.
        Updates the task's metadata with comprehensive context.
        
        Args:
            task: FollowUp instance to enrich
            
        Returns:
            dict: The generated call context
        """
        if not task.lead:
            return None
        
        context = self.generate_call_context(
            applicant=task.lead,
            reason=task.metadata.get("reason") if task.metadata else None,
            notes=task.notes,
            task=task,
        )
        
        if not task.metadata:
            task.metadata = {}
        
        task.metadata["call_context"] = context
        task.metadata["context_enriched_at"] = timezone.now().isoformat()
        task.save(update_fields=["metadata"])
        
        logger.info(f"Enriched task {task.id} with call context")
        return context


followup_generator = FollowUpGenerator()
