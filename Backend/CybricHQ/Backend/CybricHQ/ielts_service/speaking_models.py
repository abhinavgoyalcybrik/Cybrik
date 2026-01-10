"""
Django models for IELTS Speaking Test functionality.

These models capture the complete speaking test workflow:
- Session management
- Individual responses per question
- Real-time metrics from VAD
- IELTS criterion-wise evaluation
"""

import uuid
from django.db import models
from django.conf import settings


class SpeakingSession(models.Model):
    """
    A user's complete speaking test session.
    Tracks overall progress and final band score.
    """
    
    STATUS_CHOICES = [
        ('initializing', 'Initializing'),
        ('active', 'Active'),
        ('analyzing', 'Analyzing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='speaking_sessions'
    )
    test = models.ForeignKey(
        'IELTSTest',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='speaking_sessions'
    )
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='initializing')
    current_part = models.PositiveSmallIntegerField(default=1)  # 1, 2, or 3
    current_question_index = models.PositiveSmallIntegerField(default=0)
    
    # Timing
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    
    # Final scores (calculated after all parts complete)
    overall_band_score = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True
    )
    fluency_coherence_avg = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True
    )
    lexical_resource_avg = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True
    )
    grammatical_range_avg = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True
    )
    pronunciation_avg = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True
    )
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Speaking Session'
        verbose_name_plural = 'Speaking Sessions'
    
    def __str__(self):
        return f"Speaking Session {self.id} - {self.user.email} ({self.status})"
    
    def calculate_overall_score(self):
        """Calculate average band score from all completed evaluations."""
        evaluations = SpeakingEvaluation.objects.filter(
            response__session=self,
            response__status='completed'
        )
        
        if not evaluations.exists():
            return None
        
        # Calculate averages for each criterion
        fc_scores = [e.fluency_coherence for e in evaluations if e.fluency_coherence]
        lr_scores = [e.lexical_resource for e in evaluations if e.lexical_resource]
        gra_scores = [e.grammatical_range for e in evaluations if e.grammatical_range]
        p_scores = [e.pronunciation for e in evaluations if e.pronunciation]
        
        if fc_scores:
            self.fluency_coherence_avg = sum(fc_scores) / len(fc_scores)
        if lr_scores:
            self.lexical_resource_avg = sum(lr_scores) / len(lr_scores)
        if gra_scores:
            self.grammatical_range_avg = sum(gra_scores) / len(gra_scores)
        if p_scores:
            self.pronunciation_avg = sum(p_scores) / len(p_scores)
        
        # Overall is average of all criteria
        all_avgs = [
            avg for avg in [
                self.fluency_coherence_avg,
                self.lexical_resource_avg,
                self.grammatical_range_avg,
                self.pronunciation_avg
            ] if avg is not None
        ]
        
        if all_avgs:
            # Round to nearest 0.5
            raw_score = sum(all_avgs) / len(all_avgs)
            self.overall_band_score = round(raw_score * 2) / 2
        
        self.save()
        return self.overall_band_score


class SpeakingResponse(models.Model):
    """
    Individual response for each question in a speaking test.
    Contains audio, transcript, and links to metrics/evaluation.
    """
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('listening', 'Listening'),
        ('processing', 'Processing'),
        ('analyzing', 'Analyzing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('skipped', 'Skipped'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        SpeakingSession,
        on_delete=models.CASCADE,
        related_name='responses'
    )
    
    # Question info
    part = models.PositiveSmallIntegerField()  # 1, 2, or 3
    question_index = models.PositiveSmallIntegerField(default=0)
    question_text = models.TextField()
    
    # Audio storage
    audio_file = models.FileField(
        upload_to='speaking_audio/%Y/%m/%d/',
        null=True,
        blank=True
    )
    audio_duration_ms = models.PositiveIntegerField(null=True, blank=True)
    
    # Transcript (from Whisper)
    transcript = models.TextField(blank=True)
    word_count = models.PositiveIntegerField(default=0)
    
    # Status and timing
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    
    # Boundary detection reason
    end_reason = models.CharField(
        max_length=50,
        blank=True,
        help_text="Why speaking ended: silence_threshold, time_limit, manual_stop"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['session', 'part', 'question_index']
        unique_together = ['session', 'part', 'question_index']
        verbose_name = 'Speaking Response'
        verbose_name_plural = 'Speaking Responses'
    
    def __str__(self):
        return f"Response {self.id} - Part {self.part} Q{self.question_index + 1}"


class SpeakingMetrics(models.Model):
    """
    Real-time and final metrics collected during speaking.
    Populated by VAD engine during the speaking turn.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    response = models.OneToOneField(
        SpeakingResponse,
        on_delete=models.CASCADE,
        related_name='metrics'
    )
    
    # Core timing metrics (in milliseconds)
    total_speaking_time_ms = models.PositiveIntegerField(default=0)
    total_silence_time_ms = models.PositiveIntegerField(default=0)
    total_duration_ms = models.PositiveIntegerField(default=0)
    
    # Pause analysis
    pause_count = models.PositiveIntegerField(default=0)
    avg_pause_duration_ms = models.PositiveIntegerField(default=0)
    max_pause_duration_ms = models.PositiveIntegerField(default=0)
    long_pause_count = models.PositiveIntegerField(
        default=0,
        help_text="Pauses > 2 seconds"
    )
    
    # Speech rate
    estimated_words_per_minute = models.PositiveIntegerField(default=0)
    syllables_per_minute = models.PositiveIntegerField(default=0)
    
    # Fluency indicators (0.0 to 1.0)
    speech_ratio = models.FloatField(
        default=0.0,
        help_text="Ratio of speaking time to total time"
    )
    fluency_score = models.FloatField(
        default=0.0,
        help_text="Computed fluency based on pauses and continuity"
    )
    continuity_score = models.FloatField(
        default=0.0,
        help_text="How continuous the speech was (fewer interruptions = higher)"
    )
    
    # Audio characteristics
    avg_amplitude = models.FloatField(default=0.0)
    amplitude_variance = models.FloatField(default=0.0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Speaking Metrics'
        verbose_name_plural = 'Speaking Metrics'
    
    def __str__(self):
        return f"Metrics for Response {self.response_id}"
    
    def calculate_derived_metrics(self):
        """Calculate derived metrics from raw values."""
        # Speech ratio
        if self.total_duration_ms > 0:
            self.speech_ratio = self.total_speaking_time_ms / self.total_duration_ms
        
        # Average pause duration
        if self.pause_count > 0:
            self.avg_pause_duration_ms = self.total_silence_time_ms // self.pause_count
        
        # Continuity score (inverse of pause frequency)
        if self.total_speaking_time_ms > 0:
            # Penalize frequent pauses
            pause_rate = self.pause_count / (self.total_speaking_time_ms / 60000)  # pauses per minute
            self.continuity_score = max(0, 1 - (pause_rate / 20))  # 20+ pauses/min = 0 score
        
        # Fluency score (combination of speech ratio and continuity)
        self.fluency_score = (self.speech_ratio * 0.4) + (self.continuity_score * 0.6)
        
        self.save()


class SpeakingEvaluation(models.Model):
    """
    IELTS criterion-wise scores and feedback for a speaking response.
    Populated by the evaluation engine after transcription.
    """
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    response = models.OneToOneField(
        SpeakingResponse,
        on_delete=models.CASCADE,
        related_name='evaluation'
    )
    
    # Fluency and Coherence (Band 0-9)
    fluency_coherence = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True
    )
    fluency_coherence_feedback = models.TextField(blank=True)
    
    # Lexical Resource (Band 0-9)
    lexical_resource = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True
    )
    lexical_resource_feedback = models.TextField(blank=True)
    
    # Grammatical Range and Accuracy (Band 0-9)
    grammatical_range = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True
    )
    grammatical_range_feedback = models.TextField(blank=True)
    
    # Pronunciation (Band 0-9)
    pronunciation = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True
    )
    pronunciation_feedback = models.TextField(blank=True)
    
    # Overall for this response
    overall_band = models.DecimalField(
        max_digits=3, decimal_places=1, null=True, blank=True
    )
    
    # Improvement suggestions
    improvement_suggestions = models.TextField(blank=True)
    strengths = models.TextField(blank=True)
    weaknesses = models.TextField(blank=True)
    
    # Raw LLM response (for debugging)
    raw_evaluation_response = models.JSONField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Speaking Evaluation'
        verbose_name_plural = 'Speaking Evaluations'
    
    def __str__(self):
        return f"Evaluation for Response {self.response_id} (Band {self.overall_band})"
    
    def calculate_overall(self):
        """Calculate overall band from individual criteria."""
        scores = [
            self.fluency_coherence,
            self.lexical_resource,
            self.grammatical_range,
            self.pronunciation
        ]
        valid_scores = [s for s in scores if s is not None]
        
        if valid_scores:
            raw_score = sum(valid_scores) / len(valid_scores)
            # Round to nearest 0.5
            self.overall_band = round(raw_score * 2) / 2
            self.save()
        
        return self.overall_band
