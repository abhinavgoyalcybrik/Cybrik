"""
IELTS Speaking Evaluator

Evaluates speaking responses using GPT-4 with official IELTS criteria:
- Fluency and Coherence (FC)
- Lexical Resource (LR)
- Grammatical Range and Accuracy (GRA)
- Pronunciation (P)

All evaluation happens ONLY after speaking ends.
"""

import os
import json
import logging
from typing import Dict, Optional, Any
from decimal import Decimal

logger = logging.getLogger(__name__)


# IELTS Band Descriptors Summary
BAND_DESCRIPTORS = {
    9: "Expert - Fully operational command, complete accuracy with only rare minor errors",
    8: "Very Good - Fully operational command with occasional unsystematic inaccuracies", 
    7: "Good - Operational command with occasional inaccuracies and inappropriate usage",
    6: "Competent - Generally effective command despite some inaccuracies",
    5: "Modest - Partial command, copes with overall meaning despite errors",
    4: "Limited - Basic competence limited to familiar situations",
    3: "Extremely Limited - Conveys and understands only general meaning",
    2: "Intermittent - Communication limited to isolated words/phrases",
    1: "Non-user - Essentially no ability beyond isolated words",
    0: "Did not attempt - No assessable language"
}


class IELTSSpeakingEvaluator:
    """
    IELTS Speaking evaluation engine using GPT-4.
    
    Evaluates responses based on official IELTS Speaking band descriptors:
    - Fluency and Coherence
    - Lexical Resource
    - Grammatical Range and Accuracy
    - Pronunciation (inferred from fluency metrics)
    """
    
    def __init__(self):
        from openai import OpenAI
        
        api_key = os.getenv('IELTS_OPENAI_API_KEY') or os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("IELTS_OPENAI_API_KEY or OPENAI_API_KEY required for evaluation")
        
        self.client = OpenAI(api_key=api_key)
        self.model = "gpt-4o"  # Use GPT-4o for best results
    
    def evaluate(
        self,
        transcript: str,
        question_text: str,
        part: int,
        metrics_dict: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Evaluate a speaking response using IELTS criteria.
        
        Args:
            transcript: The transcribed speech text
            question_text: The question that was asked
            part: IELTS part (1, 2, or 3)
            metrics_dict: Real-time metrics from VAD
        
        Returns:
            Dictionary with band scores and feedback for each criterion
        """
        if not transcript or len(transcript.strip()) < 10:
            return self._empty_evaluation("Insufficient speech content")
        
        # Build evaluation prompt
        prompt = self._build_evaluation_prompt(transcript, question_text, part, metrics_dict)
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": self._get_system_prompt()
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                response_format={"type": "json_object"},
                temperature=0.3,  # Lower temperature for consistent scoring
                max_tokens=2000,
            )
            
            # Parse response
            content = response.choices[0].message.content
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            result = json.loads(content)
            return self._process_evaluation(result)
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            return self._empty_evaluation("Evaluation parsing error")
        except Exception as e:
            logger.error(f"Evaluation failed: {e}")
            return self._empty_evaluation(str(e))
    
    def _get_system_prompt(self) -> str:
        """System prompt for IELTS examiner role."""
        return """You are an official IELTS Speaking examiner with extensive experience.

Your task is to evaluate speaking responses exactly as a real IELTS examiner would.

IMPORTANT RULES:
1. Evaluate ONLY the language skills, NOT the content or opinions
2. Be fair and objective - follow the official band descriptors
3. Consider the FULL response, not just isolated errors
4. Award bands in 0.5 increments (e.g., 6.0, 6.5, 7.0)
5. Provide specific, actionable feedback with examples from the transcript

BAND SCORE GUIDANCE:
- Band 9: Near-native fluency, sophisticated vocabulary, rare minor slips
- Band 8: Very fluent, wide vocabulary, minor errors don't impede
- Band 7: Fluent with occasional repetition/self-correction, good vocabulary range
- Band 6: Generally fluent but with noticeable pauses, some vocabulary limitations
- Band 5: Noticeable pauses, limited vocabulary, basic structures dominant
- Band 4-: Significant limitations affecting communication

You must respond in valid JSON format."""
    
    def _build_evaluation_prompt(
        self,
        transcript: str,
        question_text: str,
        part: int,
        metrics: Optional[Dict]
    ) -> str:
        """Build the evaluation prompt with all context."""
        
        part_context = {
            1: "Part 1 (Introduction and Interview): Short answers to familiar topics",
            2: "Part 2 (Long Turn): 2-minute monologue on a given topic",
            3: "Part 3 (Two-way Discussion): Abstract discussion with deeper analysis"
        }
        
        metrics_text = ""
        if metrics:
            metrics_text = f"""
SPEAKING METRICS (from real-time analysis):
- Total speaking time: {metrics.get('total_speaking_time_ms', 0) / 1000:.1f} seconds
- Number of pauses: {metrics.get('pause_count', 0)}
- Average pause duration: {metrics.get('avg_pause_duration_ms', 0)}ms
- Words per minute: {metrics.get('estimated_words_per_minute', 0)}
- Fluency score (0-1): {metrics.get('fluency_score', 0):.2f}

Use these metrics to inform your Fluency and Pronunciation scores.
"""
        
        return f"""Evaluate this IELTS Speaking response:

CONTEXT:
{part_context.get(part, 'Unknown Part')}

QUESTION:
{question_text}

TRANSCRIPT:
\"\"\"{transcript}\"\"\"
{metrics_text}

Evaluate this response on the four IELTS Speaking criteria.
For each criterion, provide:
1. A band score (0-9 in 0.5 increments)
2. Specific feedback with examples from the transcript
3. What the candidate did well
4. What they need to improve

Respond in this exact JSON format:
{{
    "fluency_coherence": {{
        "band": <number>,
        "feedback": "<detailed feedback>",
        "strengths": "<what was done well>",
        "improvements": "<what to improve>"
    }},
    "lexical_resource": {{
        "band": <number>,
        "feedback": "<detailed feedback>",
        "strengths": "<what was done well>",
        "improvements": "<what to improve>"
    }},
    "grammatical_range": {{
        "band": <number>,
        "feedback": "<detailed feedback>",
        "strengths": "<what was done well>",
        "improvements": "<what to improve>"
    }},
    "pronunciation": {{
        "band": <number>,
        "feedback": "<detailed feedback>",
        "strengths": "<what was done well>",
        "improvements": "<what to improve>"
    }},
    "overall_summary": "<2-3 sentence overall assessment>",
    "top_improvement_tips": ["<tip 1>", "<tip 2>", "<tip 3>"]
}}"""
    
    def _process_evaluation(self, result: Dict) -> Dict[str, Any]:
        """Process and validate the evaluation result."""
        
        def extract_band(criterion: Dict) -> Decimal:
            """Extract and validate band score."""
            band = criterion.get('band', 0)
            # Ensure valid band score (0-9 in 0.5 increments)
            band = max(0, min(9, float(band)))
            band = round(band * 2) / 2  # Round to nearest 0.5
            return Decimal(str(band))
        
        def extract_feedback(criterion: Dict) -> str:
            """Extract feedback text."""
            parts = []
            if criterion.get('feedback'):
                parts.append(criterion['feedback'])
            if criterion.get('strengths'):
                parts.append(f"Strengths: {criterion['strengths']}")
            if criterion.get('improvements'):
                parts.append(f"Areas to improve: {criterion['improvements']}")
            return " ".join(parts)
        
        # Extract scores
        fc = result.get('fluency_coherence', {})
        lr = result.get('lexical_resource', {})
        gra = result.get('grammatical_range', {})
        p = result.get('pronunciation', {})
        
        fluency_coherence = extract_band(fc)
        lexical_resource = extract_band(lr)
        grammatical_range = extract_band(gra)
        pronunciation = extract_band(p)
        
        # Calculate overall (average, rounded to 0.5)
        scores = [fluency_coherence, lexical_resource, grammatical_range, pronunciation]
        overall = sum(scores) / len(scores)
        overall = round(overall * 2) / 2
        overall_band = Decimal(str(overall))
        
        return {
            'fluency_coherence': fluency_coherence,
            'lexical_resource': lexical_resource,
            'grammatical_range': grammatical_range,
            'pronunciation': pronunciation,
            'overall_band': overall_band,
            'feedback': {
                'fluency_coherence': extract_feedback(fc),
                'lexical_resource': extract_feedback(lr),
                'grammatical_range': extract_feedback(gra),
                'pronunciation': extract_feedback(p),
            },
            'improvement_suggestions': "\n".join(result.get('top_improvement_tips', [])),
            'strengths': self._extract_strengths(result),
            'weaknesses': self._extract_weaknesses(result),
            'overall_summary': result.get('overall_summary', ''),
            'raw_result': result,
        }
    
    def _extract_strengths(self, result: Dict) -> str:
        """Extract and combine all strengths."""
        strengths = []
        for key in ['fluency_coherence', 'lexical_resource', 'grammatical_range', 'pronunciation']:
            criterion = result.get(key, {})
            if criterion.get('strengths'):
                strengths.append(f"• {criterion['strengths']}")
        return "\n".join(strengths)
    
    def _extract_weaknesses(self, result: Dict) -> str:
        """Extract and combine all areas for improvement."""
        weaknesses = []
        for key in ['fluency_coherence', 'lexical_resource', 'grammatical_range', 'pronunciation']:
            criterion = result.get(key, {})
            if criterion.get('improvements'):
                weaknesses.append(f"• {criterion['improvements']}")
        return "\n".join(weaknesses)
    
    def _empty_evaluation(self, reason: str) -> Dict[str, Any]:
        """Return empty evaluation with reason."""
        return {
            'fluency_coherence': Decimal('0'),
            'lexical_resource': Decimal('0'),
            'grammatical_range': Decimal('0'),
            'pronunciation': Decimal('0'),
            'overall_band': Decimal('0'),
            'feedback': {
                'fluency_coherence': f"Could not evaluate: {reason}",
                'lexical_resource': f"Could not evaluate: {reason}",
                'grammatical_range': f"Could not evaluate: {reason}",
                'pronunciation': f"Could not evaluate: {reason}",
            },
            'improvement_suggestions': '',
            'strengths': '',
            'weaknesses': '',
            'error': reason,
        }


def evaluate_speaking_response(
    transcript: str,
    question_text: str,
    part: int = 1,
    metrics: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Convenience function to evaluate a speaking response.
    
    Usage:
        result = evaluate_speaking_response(
            transcript="Well, I really enjoy...",
            question_text="What hobbies do you have?",
            part=1,
            metrics={'pause_count': 3, 'estimated_words_per_minute': 120}
        )
    """
    evaluator = IELTSSpeakingEvaluator()
    return evaluator.evaluate(transcript, question_text, part, metrics)
