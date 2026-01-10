from django.contrib import admin
from .speaking_models import (
    SpeakingSession,
    SpeakingResponse,
    SpeakingMetrics,
    SpeakingEvaluation
)


class SpeakingResponseInline(admin.TabularInline):
    model = SpeakingResponse
    extra = 0
    readonly_fields = ['id', 'part', 'question_index', 'status', 'started_at', 'ended_at']
    fields = ['part', 'question_index', 'question_text', 'status', 'transcript', 'word_count']


@admin.register(SpeakingSession)
class SpeakingSessionAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'status', 'current_part', 'overall_band_score', 'started_at']
    list_filter = ['status', 'current_part']
    search_fields = ['user__email', 'id']
    readonly_fields = ['id', 'started_at', 'ended_at', 'created_at', 'updated_at']
    inlines = [SpeakingResponseInline]


@admin.register(SpeakingResponse)
class SpeakingResponseAdmin(admin.ModelAdmin):
    list_display = ['id', 'session', 'part', 'question_index', 'status', 'word_count']
    list_filter = ['status', 'part']
    search_fields = ['session__user__email', 'transcript']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(SpeakingMetrics)
class SpeakingMetricsAdmin(admin.ModelAdmin):
    list_display = [
        'response', 'total_speaking_time_ms', 'pause_count', 
        'estimated_words_per_minute', 'fluency_score'
    ]
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(SpeakingEvaluation)
class SpeakingEvaluationAdmin(admin.ModelAdmin):
    list_display = [
        'response', 'fluency_coherence', 'lexical_resource', 
        'grammatical_range', 'pronunciation', 'overall_band'
    ]
    readonly_fields = ['id', 'created_at', 'updated_at']
