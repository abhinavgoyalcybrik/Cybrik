"""
Serializers for IELTS Speaking Test models.
"""

from rest_framework import serializers
from .speaking_models import (
    SpeakingSession,
    SpeakingResponse,
    SpeakingMetrics,
    SpeakingEvaluation
)


class SpeakingMetricsSerializer(serializers.ModelSerializer):
    """Serializer for speaking metrics."""
    
    class Meta:
        model = SpeakingMetrics
        fields = [
            'total_speaking_time_ms',
            'total_silence_time_ms',
            'total_duration_ms',
            'pause_count',
            'avg_pause_duration_ms',
            'max_pause_duration_ms',
            'long_pause_count',
            'estimated_words_per_minute',
            'speech_ratio',
            'fluency_score',
            'continuity_score',
        ]


class SpeakingEvaluationSerializer(serializers.ModelSerializer):
    """Serializer for IELTS evaluation scores."""
    
    class Meta:
        model = SpeakingEvaluation
        fields = [
            'fluency_coherence',
            'fluency_coherence_feedback',
            'lexical_resource',
            'lexical_resource_feedback',
            'grammatical_range',
            'grammatical_range_feedback',
            'pronunciation',
            'pronunciation_feedback',
            'overall_band',
            'improvement_suggestions',
            'strengths',
            'weaknesses',
            'created_at',
        ]


class SpeakingResponseSerializer(serializers.ModelSerializer):
    """Serializer for individual speaking responses."""
    
    metrics = SpeakingMetricsSerializer(read_only=True)
    evaluation = SpeakingEvaluationSerializer(read_only=True)
    
    class Meta:
        model = SpeakingResponse
        fields = [
            'id',
            'part',
            'question_index',
            'question_text',
            'transcript',
            'word_count',
            'audio_duration_ms',
            'status',
            'end_reason',
            'started_at',
            'ended_at',
            'metrics',
            'evaluation',
        ]


class SpeakingResponseListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for response lists."""
    
    overall_band = serializers.SerializerMethodField()
    
    class Meta:
        model = SpeakingResponse
        fields = [
            'id',
            'part',
            'question_index',
            'question_text',
            'word_count',
            'status',
            'overall_band',
            'started_at',
        ]
    
    def get_overall_band(self, obj):
        if hasattr(obj, 'evaluation') and obj.evaluation:
            return obj.evaluation.overall_band
        return None


class SpeakingSessionSerializer(serializers.ModelSerializer):
    """Full serializer for speaking sessions with responses."""
    
    responses = SpeakingResponseSerializer(many=True, read_only=True)
    user_email = serializers.SerializerMethodField()
    test_name = serializers.SerializerMethodField()
    
    class Meta:
        model = SpeakingSession
        fields = [
            'id',
            'user_email',
            'test_name',
            'status',
            'current_part',
            'current_question_index',
            'overall_band_score',
            'fluency_coherence_avg',
            'lexical_resource_avg',
            'grammatical_range_avg',
            'pronunciation_avg',
            'started_at',
            'ended_at',
            'responses',
        ]
    
    def get_user_email(self, obj):
        return obj.user.email if obj.user else None
    
    def get_test_name(self, obj):
        return obj.test.name if obj.test else None


class SpeakingSessionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for session lists."""
    
    response_count = serializers.SerializerMethodField()
    
    class Meta:
        model = SpeakingSession
        fields = [
            'id',
            'status',
            'current_part',
            'overall_band_score',
            'started_at',
            'ended_at',
            'response_count',
        ]
    
    def get_response_count(self, obj):
        return obj.responses.count()


class CreateSpeakingSessionSerializer(serializers.Serializer):
    """Serializer for creating a new speaking session."""
    
    test_id = serializers.UUIDField(required=False, allow_null=True)
    part = serializers.IntegerField(default=1, min_value=1, max_value=3)
    
    def create(self, validated_data):
        user = self.context['request'].user
        test_id = validated_data.get('test_id')
        
        from .models import IELTSTest
        
        test = None
        if test_id:
            try:
                test = IELTSTest.objects.get(id=test_id)
            except IELTSTest.DoesNotExist:
                pass
        
        session = SpeakingSession.objects.create(
            user=user,
            test=test,
            current_part=validated_data.get('part', 1),
            status='initializing',
        )
        
        return session
