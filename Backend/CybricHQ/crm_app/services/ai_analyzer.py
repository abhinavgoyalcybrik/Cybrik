"""
AI Call Analyzer Service
Uses OpenAI GPT-4 to analyze call transcripts and extract insights
"""

from openai import OpenAI
import os
import json
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class CallAnalyzer:
    """Analyzes call transcripts using OpenAI GPT-4"""
    
    def __init__(self):
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        self.client = OpenAI(api_key=api_key)
        self.model = os.getenv('OPENAI_MODEL', 'gpt-4-turbo-preview')
    
    def analyze_transcript(self, transcript: str, metadata: dict = None, pending_tasks: list = None) -> Dict:
        """
        Analyze call transcript and extract structured insights
        
        Args:
            transcript: Full call transcript text
            metadata: Additional context about the call
            pending_tasks: List of pending FollowUp task objects (optional)
            
        Returns:
            Dict with extracted insights including:
            - applicant_info: name, email, program interest
            - interest_level: high/medium/low
            - qualification_score: 0-100
            - follow_up: recommendations
            - task_verification: list of verified tasks
        """
        if not transcript:
            return {"error": "No transcript provided"}
        
        # Format pending tasks for the prompt
        tasks_context = ""
        if pending_tasks:
            tasks_list = "\n".join([f"- Task ID {t.id}: {t.notes} (Due: {t.due_at})" for t in pending_tasks])
            tasks_context = f"""
            \nPENDING TASKS TO VERIFY:
            The following tasks are pending for this applicant. Check if the transcript indicates they have been completed.
            {tasks_list}
            """
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": """You are an AI assistant analyzing university admission counseling calls.
                        Your PRIMARY GOAL is to determine if the student has submitted their documents (Passport, Marksheets, IELTS/TOEFL, etc.).
                        If documents are missing, you MUST recommend a follow-up to collect them.
                        
                        FOLLOW-UP HANDLING:
                        - If the user explicitly asks for a callback (e.g., "call me in 10 mins", "busy now"), scheduled a 'phone' follow-up with 'high' priority.
                        - If the user is interested but busy, schedule a 'phone' follow-up.
                        - If the user asks for information, schedule an 'email' or 'whatsapp' follow-up.
                        - Be precise with timing (e.g. "5 minutes", "2 hours", "Tomorrow at 10am").
                        
                        Also extract detailed applicant information including personal details, academic history, and english proficiency scores.
                        """
                    },
                    {
                        "role": "user",
                        "content": f"Analyze this call transcript:\n\n{transcript}\n\nMetadata: {json.dumps(metadata or {})}{tasks_context}"
                    }
                ],
                functions=[{
                    "name": "extract_call_insights",
                    "description": "Extract structured insights from admission call",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "applicant_info": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string", "description": "Full name"},
                                    "email": {"type": "string", "description": "Email address"},
                                    "phone": {"type": "string", "description": "Phone number"},
                                    "program_interest": {"type": "string", "description": "Program they're interested in"},
                                    "education_background": {"type": "string", "description": "Current education level"}
                                }
                            },
                            "personal_details": {
                                "type": "object",
                                "properties": {
                                    "dob": {"type": "string", "description": "Date of Birth (YYYY-MM-DD if possible)"},
                                    "passport_number": {"type": "string", "description": "Passport Number"},
                                    "city": {"type": "string", "description": "City of residence"},
                                    "country": {"type": "string", "description": "Country of residence"},
                                    "gender": {"type": "string", "description": "Gender"}
                                }
                            },
                            "academic_history": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "institution": {"type": "string", "description": "Name of school/university"},
                                        "degree": {"type": "string", "description": "Degree/Certificate name (e.g. 10th, 12th, B.Tech)"},
                                        "year": {"type": "integer", "description": "Year of completion"},
                                        "grade": {"type": "string", "description": "Grade/Percentage/CGPA"},
                                        "score": {"type": "string", "description": "Raw score if available"}
                                    }
                                },
                                "description": "List of academic records mentioned"
                            },
                            "english_proficiency": {
                                "type": "object",
                                "properties": {
                                    "test_type": {"type": "string", "enum": ["IELTS", "TOEFL", "PTE", "Duolingo", "None"], "description": "Type of English test taken"},
                                    "overall_score": {"type": "string", "description": "Overall score/band"},
                                    "band_scores": {"type": "string", "description": "Individual band scores (e.g. L:7, R:6.5...)"}
                                }
                            },
                            "interest_level": {
                                "type": "string",
                                "enum": ["high", "medium", "low"],
                                "description": "Applicant's level of interest in the program"
                            },
                            "qualification_score": {
                                "type": "number",
                                "description": "Score from 0-100 indicating likelihood to enroll",
                                "minimum": 0,
                                "maximum": 100
                            },
                            "concerns": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "List of concerns or questions raised by applicant"
                            },
                            "document_status": {
                                "type": "object",
                                "properties": {
                                    "status": {
                                        "type": "string", 
                                        "enum": ["submitted", "pending", "partial", "unknown"],
                                        "description": "Overall status of document submission"
                                    },
                                    "missing_documents": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                        "description": "List of specific documents that are missing (e.g. 'Passport', '10th Marksheet')"
                                    },
                                    "submitted_documents": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                        "description": "List of documents explicitly mentioned as submitted"
                                    }
                                },
                                "required": ["status"]
                            },
                            "follow_up": {
                                "type": "object",
                                "properties": {
                                    "needed": {"type": "boolean", "description": "Whether follow-up is recommended"},
                                    "channel": {
                                        "type": "string", 
                                        "enum": ["phone", "email", "whatsapp", "ai_call"], 
                                        "description": "Preferred channel for follow-up. Use 'phone' or 'ai_call' for callbacks."
                                    },
                                    "priority": {"type": "string", "enum": ["HIGH", "MEDIUM", "LOW"], "description": "Priority of the task"},
                                    "timing": {"type": "string", "description": "When to follow up (e.g., '5 minutes', '2 days')"},
                                    "reason": {"type": "string", "description": "Why follow-up is needed"},
                                    "suggested_action": {"type": "string", "description": "Recommended next action"},
                                    "call_script": {"type": "string", "description": "Suggested opening line for the follow-up call"},
                                    "key_topics": {
                                        "type": "array", 
                                        "items": {"type": "string"},
                                        "description": "List of specific topics to discuss in the follow-up"
                                    },
                                    "call_objective": {"type": "string", "description": "Main goal for the follow-up call"},
                                    "previous_call_summary": {"type": "string", "description": "Brief summary of what was discussed"}
                                },
                                "required": ["needed"]
                            },
                            "task_verification": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "task_id": {"type": "integer", "description": "ID of the task being verified"},
                                        "completed": {"type": "boolean", "description": "Whether the task was completed"},
                                        "evidence": {"type": "string", "description": "Quote or reason from transcript proving completion"}
                                    },
                                    "required": ["task_id", "completed"]
                                },
                                "description": "Verification results for pending tasks"
                            },
                            "key_points": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Key discussion points from the call"
                            }
                        },
                        "required": ["interest_level", "qualification_score", "follow_up", "document_status"]
                    }
                }],
                function_call={"name": "extract_call_insights"},
                temperature=0.3  # Lower temperature for more consistent results
            )
            
            # Extract function call result
            function_call = response.choices[0].message.function_call
            result = json.loads(function_call.arguments)
            
            # Add metadata
            result['_metadata'] = {
                'model': self.model,
                'tokens_used': response.usage.total_tokens,
                'prompt_tokens': response.usage.prompt_tokens,
                'completion_tokens': response.usage.completion_tokens
            }
            
            logger.info(f"Successfully analyzed transcript. Score: {result.get('qualification_score')}")
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing transcript: {str(e)}")
            return {
                "error": str(e),
                "interest_level": "unknown",
                "qualification_score": 0,
                "follow_up": {"needed": False}
            }
    
    def get_cost_estimate(self, tokens: int) -> float:
        """
        Estimate cost for given number of tokens
        GPT-4-turbo: $0.01/1K prompt tokens, $0.03/1K completion tokens
        """
        # Rough estimate assuming 50/50 split
        return (tokens / 1000) * 0.02


class DocumentVerifier:
    """Verifies documents using GPT-4 Vision"""
    
    def __init__(self):
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        self.client = OpenAI(api_key=api_key)
    
    def verify_document(self, image_url: str, document_type: str = "passport") -> Dict:
        """
        Verify document authenticity and extract data using Vision AI
        
        Args:
            image_url: URL to document image
            document_type: Type of document (passport, degree, etc.)
            
        Returns:
            Dict with verification result and extracted data
        """
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"""Analyze this {document_type} document.
                                Extract all visible text and verify if it appears authentic.
                                Look for: name, document number, dates, and any red flags."""
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": image_url}
                            }
                        ]
                    }
                ],
                max_tokens=500
            )
            
            content = response.choices[0].message.content
            
            return {
                "status": "analyzed",
                "extracted_text": content,
                "tokens_used": response.usage.total_tokens
            }
            
        except Exception as e:
            logger.error(f"Error verifying document: {str(e)}")
            return {"status": "error", "error": str(e)}

    def verify_and_match(self, file_path: str, applicant_data: Dict) -> Dict:
        """
        Verify document and match against applicant data
        
        Args:
            file_path: Absolute path to document file
            applicant_data: Dictionary of applicant details to match against
            
        Returns:
            Dict with extraction and matching results
        """
        import base64
        import mimetypes
        import fitz  # PyMuPDF
        from PIL import Image
        import io
        from pillow_heif import register_heif_opener

        # Register HEIF opener
        register_heif_opener()
        
        def encode_image(image_path):
            with open(image_path, "rb") as image_file:
                return base64.b64encode(image_file.read()).decode('utf-8')

        def convert_to_image_base64(path):
            """Convert PDF, HEIC, or Image to base64 encoded PNG"""
            mime_type, _ = mimetypes.guess_type(path)
            
            # Handle PDF
            if mime_type == 'application/pdf':
                try:
                    doc = fitz.open(path)
                    page = doc.load_page(0)  # Get first page
                    pix = page.get_pixmap()
                    img_data = pix.tobytes("png")
                    return base64.b64encode(img_data).decode('utf-8'), "image/png"
                except Exception as e:
                    raise ValueError(f"Failed to convert PDF: {str(e)}")

            # Handle HEIC/Image
            try:
                # Pillow with pillow-heif handles both standard images and HEIC
                with Image.open(path) as img:
                    # Convert to RGB if necessary (e.g. for RGBA or CMYK)
                    if img.mode not in ('RGB', 'L'):
                        img = img.convert('RGB')
                    
                    buffered = io.BytesIO()
                    img.save(buffered, format="PNG")
                    return base64.b64encode(buffered.getvalue()).decode('utf-8'), "image/png"
            except Exception as e:
                raise ValueError(f"Failed to process image: {str(e)}")
        
        try:
            # Convert file to base64 image
            base64_image, mime_type = convert_to_image_base64(file_path)
            
            prompt = f"""
            Analyze this document image and Compare it with the provided Applicant Data.
            
            APPLICANT DATA:
            {json.dumps(applicant_data, indent=2)}
            
            YOUR TASK:
            1. Extract all visible key data from the document (Name, DOB, Passport Number, Grades, etc.)
            2. Compare extracted data with the APPLICANT DATA.
            3. Identifiy Matches (exact or fuzzy match), Mismatches (conflict), and Missing data.
            
            Return JSON format ONLY:
            {{
                "document_type": "detected type",
                "extracted_data": {{ "field": "value" }},
                "comparison": [
                    {{ "field": "Name", "document_value": "John Doe", "applicant_value": "Jon Doe", "status": "mismatch" | "match" | "missing_in_doc" | "missing_in_app" }},
                    ...
                ],
                "verification_status": "valid" | "suspicious" | "invalid",
                "summary": "Brief summary of findings"
            }}
            """

            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=1000
            )
            
            content = response.choices[0].message.content
            # Clean up code blocks if present
            if "```json" in content:
                content = content.replace("```json", "").replace("```", "")
            elif "```" in content:
                content = content.replace("```", "")
                
            return json.loads(content)
            
        except Exception as e:
            logger.error(f"Error in verify_and_match: {str(e)}")
            return {"status": "error", "error": str(e)}

