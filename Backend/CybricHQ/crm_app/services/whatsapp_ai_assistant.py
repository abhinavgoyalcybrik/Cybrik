"""
WhatsApp AI Assistant Service
Generates personalized WhatsApp messages using OpenAI GPT-4
Handles both post-call welcome messages and incoming message responses
"""

from openai import OpenAI
import os
import json
import logging
from typing import Dict, Optional, List
from django.conf import settings

logger = logging.getLogger(__name__)


class WhatsAppAssistant:
    """AI-powered WhatsApp assistant for generating personalized messages"""
    
    def __init__(self):
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        self.client = OpenAI(api_key=api_key)
        self.model = os.getenv('OPENAI_MODEL', 'gpt-4-turbo-preview')
    
    def generate_post_call_message(self, call_record, lead_or_applicant) -> Dict:
        """
        Generate a personalized post-call WhatsApp welcome message.
        
        Args:
            call_record: CallRecord object with call metadata
            lead_or_applicant: Lead or Applicant object
            
        Returns:
            Dict with: {
                "success": bool,
                "message": str (the message text),
                "error": str (if failed)
            }
        """
        try:
            # Build context - Lead has 'name', Applicant has 'first_name'
            target_name = getattr(lead_or_applicant, 'name', None) or getattr(lead_or_applicant, 'first_name', 'Student')
            
            # Get call status and outcome
            call_status = call_record.status
            duration = call_record.metadata.get('duration_seconds', 0) if call_record.metadata else 0
            
            # Get AI analysis result if available
            ai_analysis = call_record.metadata.get('ai_analysis_result', {}) if call_record.metadata else {}
            next_steps = ai_analysis.get('next_steps', []) if isinstance(ai_analysis, dict) else []
            
            # Get document status if available
            qualified_data = ai_analysis.get('qualified_data', {}) if isinstance(ai_analysis, dict) else {}
            missing_docs = qualified_data.get('missing_documents', []) if isinstance(qualified_data, dict) else []
            
            context = f"""
Target Name: {target_name}
Call Status: {call_status}
Call Duration: {duration} seconds
Country Interest: {getattr(lead_or_applicant, 'country', 'Not specified')}
Qualification: {getattr(lead_or_applicant, 'highest_qualification', 'Not specified')}
Missing Documents: {', '.join(missing_docs) if missing_docs else 'None identified'}
Next Steps: {', '.join(next_steps) if next_steps else 'Pending documents'}
"""
            
            prompt = f"""Generate a brief, friendly WhatsApp message for a student after an education counseling call.
The message should:
1. Thank them for the call
2. Mention 1-2 specific next steps discussed
3. Be encouraging and professional
4. Keep under 160 characters if possible (but can be longer if needed)
5. Not include any links or attachments

Student Context:
{context}

Generate only the message text, no other formatting or explanation."""

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a friendly education counselor at Cybrik Solutions. Generate personalized WhatsApp messages."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=200
            )
            
            message = response.choices[0].message.content.strip()
            
            logger.info(f"[WHATSAPP-AI] Generated post-call message for {target_name}")
            
            return {
                "success": True,
                "message": message
            }
            
        except Exception as e:
            logger.error(f"[WHATSAPP-AI] Error generating post-call message: {e}")
            # Fallback message with safe attribute access
            target_name = getattr(lead_or_applicant, 'name', None) or getattr(lead_or_applicant, 'first_name', 'there')
            fallback = f"Hi {target_name}, thanks for chatting with us! We'll help you with your application journey. 🎓"
            return {
                "success": False,
                "message": fallback,
                "error": str(e)
            }
    
    def generate_reply_to_student(
        self, 
        incoming_text: str, 
        lead_or_applicant, 
        conversation_history: List[Dict] = None,
        call_context: Dict = None
    ) -> Dict:
        """
        Generate an AI reply to a student's WhatsApp message.
        
        Args:
            incoming_text: The student's WhatsApp message
            lead_or_applicant: Lead or Applicant object
            conversation_history: List of recent WhatsApp messages [{"role": "user/assistant", "content": "..."}]
            call_context: Context from the most recent call (transcript summary, AI analysis, etc.)
            
        Returns:
            Dict with: {
                "success": bool,
                "reply": str (the reply message),
                "requires_escalation": bool,
                "error": str (if failed)
            }
        """
        try:
            # Lead has 'name', Applicant has 'first_name'
            target_name = getattr(lead_or_applicant, 'name', None) or getattr(lead_or_applicant, 'first_name', 'Student')
            
            # Build conversation context
            conversation_str = ""
            if conversation_history:
                for msg in conversation_history[-5:]:  # Last 5 messages for context
                    role = "Student" if msg.get("role") == "user" else "Counselor"
                    conversation_str += f"\n{role}: {msg.get('content', '')}"
            
            # Build call context
            call_context_str = ""
            if call_context:
                call_context_str = f"""
Recent Call Context:
- Country Interest: {call_context.get('country', 'Not specified')}
- Program Interest: {call_context.get('program_interest', 'Not specified')}
- Document Status: {call_context.get('document_status', 'Unknown')}
- Key Discussion Points: {call_context.get('discussion_points', 'N/A')}
- Pending Follow-ups: {call_context.get('pending_followups', 'N/A')}
"""
            
            # Check for escalation triggers
            escalation_keywords = ['angry', 'complaint', 'issue', 'problem', 'refund', 'cancel', 'speak to human', 'manager']
            requires_escalation = any(keyword.lower() in incoming_text.lower() for keyword in escalation_keywords)
            
            prompt = f"""You are an AI counselor assistant for Cybrik Solutions, an education consultancy.
A student has sent you a message via WhatsApp. Respond helpfully and professionally.

Student Name: {target_name}
Student Message: "{incoming_text}"

{call_context_str}

Previous Conversation (if any):
{conversation_str if conversation_str else "No previous conversation"}

Guidelines:
1. Be helpful, friendly, and professional
2. Answer based on the student's profile and previous conversations
3. Keep response under 300 characters when possible
4. If asked about specific documents, visa processes, or timelines, be accurate
5. If you don't have enough information, offer to connect them with a human counselor
6. Do NOT make promises about outcomes or timelines you cannot guarantee
7. Use WhatsApp-friendly format (no markdown, keep it simple)

Generate ONLY the reply message, no other text or formatting."""

            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": prompt
                    },
                    {
                        "role": "user",
                        "content": f"Reply to: {incoming_text}"
                    }
                ],
                temperature=0.7,
                max_tokens=300
            )
            
            reply = response.choices[0].message.content.strip()
            
            logger.info(f"[WHATSAPP-AI] Generated reply for {target_name} - Escalation needed: {requires_escalation}")
            
            return {
                "success": True,
                "reply": reply,
                "requires_escalation": requires_escalation
            }
            
        except Exception as e:
            logger.error(f"[WHATSAPP-AI] Error generating reply: {e}")
            return {
                "success": False,
                "reply": "Thanks for reaching out! Our team will get back to you shortly. 😊",
                "requires_escalation": True,
                "error": str(e)
            }
