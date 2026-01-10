"""
Handwriting Analysis Service using OpenAI Vision API.
Analyzes uploaded images of handwritten text for IELTS writing tests.
"""
import os
import base64
import logging
from openai import OpenAI

logger = logging.getLogger(__name__)


class HandwritingAnalyzer:
    """Analyzes handwritten text images using OpenAI Vision API."""
    
    def __init__(self):
        # Use separate API key for IELTS service
        api_key = os.getenv('IELTS_OPENAI_API_KEY')
        if not api_key:
            raise ValueError("IELTS_OPENAI_API_KEY environment variable not set")
        self.client = OpenAI(api_key=api_key)
    
    def analyze_image(self, image_data: bytes, image_type: str = 'image/jpeg') -> dict:
        """
        Analyze a handwritten image and extract text.
        
        Args:
            image_data: Raw image bytes
            image_type: MIME type of the image (image/jpeg, image/png, etc.)
            
        Returns:
            dict with keys:
                - success: bool
                - is_clear: bool - whether the image is clear enough
                - clarity_score: float 0-1
                - extracted_text: str - the extracted handwritten text
                - word_count: int
                - feedback: str - any feedback about the image quality
                - error: str (if success is False)
        """
        try:
            # Convert to base64
            base64_image = base64.b64encode(image_data).decode('utf-8')
            
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert at reading handwritten text, especially for IELTS writing tests.
Your task is to:
1. Assess the image clarity (is it readable? well-lit? focused?)
2. Extract ALL handwritten text from the image accurately
3. Provide a word count
4. Give brief feedback on image quality if needed

Respond in JSON format:
{
    "is_clear": true/false,
    "clarity_score": 0.0-1.0,
    "extracted_text": "the full text you can read...",
    "word_count": 150,
    "feedback": "Brief feedback about image quality or readability issues"
}

Be thorough - extract every word you can read. If parts are unclear, include [unclear] markers.
For IELTS, typical responses are 150-250+ words."""
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Please analyze this handwritten IELTS writing response. Extract all the text and assess the image quality."
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{image_type};base64,{base64_image}",
                                    "detail": "high"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=2000,
                response_format={"type": "json_object"}
            )
            
            # Parse the response
            import json
            result = json.loads(response.choices[0].message.content)
            
            return {
                "success": True,
                "is_clear": result.get("is_clear", True),
                "clarity_score": result.get("clarity_score", 0.8),
                "extracted_text": result.get("extracted_text", ""),
                "word_count": result.get("word_count", 0),
                "feedback": result.get("feedback", "")
            }
            
        except Exception as e:
            logger.error(f"Error analyzing handwritten image: {e}")
            return {
                "success": False,
                "is_clear": False,
                "clarity_score": 0,
                "extracted_text": "",
                "word_count": 0,
                "feedback": "",
                "error": str(e)
            }
    
    def quick_clarity_check(self, image_data: bytes, image_type: str = 'image/jpeg') -> dict:
        """
        Quick check if image is clear enough before full analysis.
        Uses lower token count for efficiency.
        
        Returns:
            dict with is_clear (bool) and reason (str)
        """
        try:
            base64_image = base64.b64encode(image_data).decode('utf-8')
            
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": """Is this image of handwritten text clear enough to read? 
Check: lighting, focus, angle, legibility.
Reply in JSON: {"is_clear": true/false, "reason": "brief explanation"}"""
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{image_type};base64,{base64_image}",
                                    "detail": "low"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=100,
                response_format={"type": "json_object"}
            )
            
            import json
            result = json.loads(response.choices[0].message.content)
            return {
                "success": True,
                "is_clear": result.get("is_clear", False),
                "reason": result.get("reason", "")
            }
            
        except Exception as e:
            logger.error(f"Error in clarity check: {e}")
            return {
                "success": False,
                "is_clear": False,
                "reason": str(e)
            }
