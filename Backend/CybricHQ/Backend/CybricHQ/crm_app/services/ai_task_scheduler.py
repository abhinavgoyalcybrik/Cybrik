"""
AI Task Scheduler Service

Analyzes task notes to:
1. Detect if a call is required
2. Parse natural language time expressions
3. Determine scheduling and auto-trigger logic
"""
import re
import logging
from datetime import datetime, timedelta
from django.utils import timezone

try:
    import dateparser
    DATEPARSER_AVAILABLE = True
except ImportError:
    DATEPARSER_AVAILABLE = False

logger = logging.getLogger(__name__)

CALL_KEYWORDS = [
    'call', 'phone', 'ring', 'contact', 'speak', 'talk', 'discuss',
    'follow up', 'follow-up', 'followup', 'reach out', 'check in',
    'ai call', 'voice call', 'conversation'
]

URGENCY_KEYWORDS = {
    'high': ['urgent', 'asap', 'immediately', 'now', 'right away', 'critical', 'priority', 'important'],
    'medium': ['soon', 'today', 'this afternoon', 'this morning'],
    'low': ['later', 'sometime', 'when possible', 'eventually', 'next week']
}

TIME_PATTERN_KEYWORDS = [
    'at', 'by', 'before', 'after', 'around', 'within', 'in',
    'tomorrow', 'today', 'tonight', 'morning', 'afternoon', 'evening',
    'hour', 'hours', 'minute', 'minutes', 'day', 'days', 'week'
]


class AITaskScheduler:
    """Analyzes tasks and determines scheduling decisions."""
    
    def __init__(self, default_call_window_minutes=30):
        self.default_call_window = timedelta(minutes=default_call_window_minutes)
    
    def analyze_task(self, notes: str, existing_due_at=None, channel=None):
        """
        Analyze task notes and return scheduling recommendations.
        
        Returns:
            dict with keys:
            - requires_call: bool
            - parsed_time: datetime or None
            - time_expression: str or None (the text that was parsed)
            - urgency: 'high', 'medium', 'low'
            - confidence: float 0-1
            - recommended_channel: str
            - auto_schedule_at: datetime or None
            - analysis_notes: list of strings explaining decisions
        """
        if not notes:
            return self._default_result(channel)
        
        notes_lower = notes.lower()
        analysis_notes = []
        
        requires_call = self._detect_call_required(notes_lower)
        if requires_call:
            analysis_notes.append("Detected call-related keywords in task notes")
        
        urgency = self._detect_urgency(notes_lower)
        analysis_notes.append(f"Urgency level: {urgency}")
        
        parsed_time, time_expression, confidence = self._parse_time_expression(notes)
        if parsed_time:
            analysis_notes.append(f"Parsed time expression: '{time_expression}' -> {parsed_time.isoformat()}")
        
        recommended_channel = channel if channel else ('ai_call' if requires_call else 'email')
        
        auto_schedule_at = None
        if requires_call or channel == 'ai_call':
            if parsed_time:
                auto_schedule_at = parsed_time
                analysis_notes.append(f"Scheduling call at parsed time: {parsed_time}")
            elif existing_due_at:
                auto_schedule_at = existing_due_at
                analysis_notes.append(f"Using existing due_at: {existing_due_at}")
            else:
                if urgency == 'high':
                    auto_schedule_at = timezone.now() + timedelta(minutes=5)
                    analysis_notes.append("High urgency: scheduling call in 5 minutes")
                elif urgency == 'medium':
                    auto_schedule_at = timezone.now() + timedelta(minutes=30)
                    analysis_notes.append("Medium urgency: scheduling call in 30 minutes")
                else:
                    auto_schedule_at = timezone.now() + timedelta(hours=2)
                    analysis_notes.append("Low urgency: scheduling call in 2 hours")
        
        return {
            'requires_call': requires_call,
            'parsed_time': parsed_time,
            'time_expression': time_expression,
            'urgency': urgency,
            'confidence': confidence,
            'recommended_channel': recommended_channel,
            'auto_schedule_at': auto_schedule_at,
            'analysis_notes': analysis_notes,
        }
    
    def _detect_call_required(self, notes_lower: str) -> bool:
        """Check if the notes indicate a call is required."""
        for keyword in CALL_KEYWORDS:
            if keyword in notes_lower:
                return True
        return False
    
    def _detect_urgency(self, notes_lower: str) -> str:
        """Detect urgency level from notes."""
        for level, keywords in URGENCY_KEYWORDS.items():
            for keyword in keywords:
                if keyword in notes_lower:
                    return level
        return 'medium'
    
    def _parse_time_expression(self, notes: str):
        """
        Parse natural language time expressions from notes.
        
        Returns: (parsed_datetime, matched_expression, confidence)
        """
        if not DATEPARSER_AVAILABLE:
            logger.warning("dateparser not available, skipping time parsing")
            return None, None, 0.0
        
        time_patterns = [
            r'(?:call|contact|reach|speak|follow up|schedule)?\s*(?:at|by|around|before)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)',
            r'(tomorrow\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?)',
            r'(today\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?)',
            r'(in\s+\d+\s+(?:hour|minute|day|week)s?)',
            r'(within\s+\d+\s+(?:hour|minute|day|week)s?)',
            r'(\d+\s+(?:hour|minute|day|week)s?\s+from\s+now)',
            r'(next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))',
            r'(this\s+(?:afternoon|morning|evening))',
            r'(tomorrow(?:\s+morning|\s+afternoon|\s+evening)?)',
        ]
        
        best_match = None
        best_parsed = None
        best_confidence = 0.0
        
        for pattern in time_patterns:
            matches = re.findall(pattern, notes, re.IGNORECASE)
            for match in matches:
                if isinstance(match, tuple):
                    match = match[0] if match else ''
                if not match:
                    continue
                    
                parsed = dateparser.parse(
                    match,
                    settings={
                        'PREFER_DATES_FROM': 'future',
                        'RELATIVE_BASE': timezone.now().replace(tzinfo=None),
                        'RETURN_AS_TIMEZONE_AWARE': False,
                    }
                )
                
                if parsed:
                    parsed = timezone.make_aware(parsed) if timezone.is_naive(parsed) else parsed
                    if parsed > timezone.now():
                        confidence = 0.9 if ':' in match or 'am' in match.lower() or 'pm' in match.lower() else 0.7
                        if confidence > best_confidence:
                            best_match = match.strip()
                            best_parsed = parsed
                            best_confidence = confidence
        
        if not best_parsed:
            parsed = dateparser.parse(
                notes,
                settings={
                    'PREFER_DATES_FROM': 'future',
                    'RELATIVE_BASE': timezone.now().replace(tzinfo=None),
                    'RETURN_AS_TIMEZONE_AWARE': False,
                }
            )
            if parsed:
                parsed = timezone.make_aware(parsed) if timezone.is_naive(parsed) else parsed
                if parsed > timezone.now():
                    best_parsed = parsed
                    best_match = "inferred from notes"
                    best_confidence = 0.5
        
        return best_parsed, best_match, best_confidence
    
    def _default_result(self, channel=None):
        """Return default analysis result, preserving existing channel if provided."""
        return {
            'requires_call': False,
            'parsed_time': None,
            'time_expression': None,
            'urgency': 'medium',
            'confidence': 0.0,
            'recommended_channel': channel if channel else 'email',
            'auto_schedule_at': None,
            'analysis_notes': ['No notes provided'],
        }
    
    def should_auto_trigger(self, task) -> tuple:
        """
        Determine if a task should auto-trigger an AI call.
        
        Returns: (should_trigger: bool, reason: str)
        """
        if not hasattr(task, 'channel') or task.channel != 'ai_call':
            return False, "Not an AI call task"
        
        if hasattr(task, 'status') and task.status in ['completed', 'in_progress', 'failed']:
            return False, f"Task already {task.status}"
        
        if not hasattr(task, 'lead') or not task.lead:
            return False, "No applicant linked"
        
        if not task.lead.phone:
            return False, "Applicant has no phone number"
        
        if not task.due_at:
            return False, "No scheduled time set"
        
        if task.due_at <= timezone.now():
            return True, "Scheduled time has arrived"
        
        return False, f"Scheduled for {task.due_at}"


ai_scheduler = AITaskScheduler()


def analyze_and_schedule_task(task, notes=None, existing_due_at=None, channel=None):
    """
    Convenience function to analyze a task and apply scheduling.
    
    Args:
        task: FollowUp model instance
        notes: Override notes (uses task.notes if not provided)
        existing_due_at: Override due_at
        channel: Override channel
    
    Returns:
        dict with analysis results and actions taken
    """
    notes = notes or getattr(task, 'notes', '')
    existing_due_at = existing_due_at or getattr(task, 'due_at', None)
    channel = channel or getattr(task, 'channel', None)
    
    analysis = ai_scheduler.analyze_task(notes, existing_due_at, channel)
    
    actions_taken = []
    
    if analysis['auto_schedule_at'] and (not task.due_at or task.due_at != analysis['auto_schedule_at']):
        task.due_at = analysis['auto_schedule_at']
        actions_taken.append(f"Auto-scheduled for {analysis['auto_schedule_at'].strftime('%Y-%m-%d %H:%M')}")
    
    if analysis['requires_call'] and task.channel != 'ai_call':
        task.channel = 'ai_call'
        task.status = 'scheduled'
        actions_taken.append("Changed channel to AI call based on notes analysis")
    
    if analysis['requires_call'] or task.channel == 'ai_call':
        if not hasattr(task, 'status') or task.status in [None, 'pending']:
            task.status = 'scheduled'
            actions_taken.append("Status set to scheduled")
    
    if actions_taken:
        task.save()
    
    return {
        'analysis': analysis,
        'actions_taken': actions_taken,
        'task_updated': len(actions_taken) > 0,
    }
