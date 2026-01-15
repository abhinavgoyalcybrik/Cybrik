from rest_framework import serializers
from .models import (
    IELTSTest, TestModule, QuestionGroup, Question, 
    UserTestSession, UserModuleAttempt, UserAnswer
)

class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ['id', 'question_text', 'question_type', 'options', 'order']

class QuestionGroupSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = QuestionGroup
        fields = ['id', 'title', 'instructions', 'content', 'media_file', 'audio_start_time', 'order', 'questions']

class TestModuleSerializer(serializers.ModelSerializer):
    question_groups = QuestionGroupSerializer(many=True, read_only=True)

    class Meta:
        model = TestModule
        fields = ['id', 'module_type', 'duration_minutes', 'order', 'question_groups']

class IELTSTestListSerializer(serializers.ModelSerializer):
    class Meta:
        model = IELTSTest
        fields = ['id', 'title', 'description', 'test_type', 'active', 'created_at']

class IELTSTestDetailSerializer(serializers.ModelSerializer):
    modules = TestModuleSerializer(many=True, read_only=True)
    
    class Meta:
        model = IELTSTest
        fields = ['id', 'title', 'description', 'test_type', 'modules', 'active', 'created_at']

# --- User Attempt Serializers ---

class UserAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAnswer
        fields = ['id', 'question', 'answer_text', 'audio_file', 'is_correct', 'feedback']
        read_only_fields = ['is_correct', 'feedback', 'marks_awarded']

class UserModuleAttemptSerializer(serializers.ModelSerializer):
    answers = UserAnswerSerializer(many=True, read_only=True)
    module_type = serializers.CharField(source='module.module_type', read_only=True)
    
    class Meta:
        model = UserModuleAttempt
        fields = ['id', 'module', 'module_type', 'start_time', 'end_time', 'is_completed', 'band_score', 'answers', 'data']
        read_only_fields = ['band_score', 'raw_score', 'start_time', 'end_time']

class UserTestSessionSerializer(serializers.ModelSerializer):
    module_attempts = UserModuleAttemptSerializer(many=True, read_only=True)
    test_title = serializers.CharField(source='test.title', read_only=True)
    
    class Meta:
        model = UserTestSession
        fields = ['id', 'test', 'test_title', 'start_time', 'end_time', 'is_completed', 'overall_band_score', 'module_attempts']
        read_only_fields = ['start_time', 'end_time', 'overall_band_score']


# --- Admin CRUD Serializers ---

class AdminQuestionSerializer(serializers.ModelSerializer):
    """Full CRUD serializer for questions"""
    class Meta:
        model = Question
        fields = ['id', 'group', 'question_text', 'question_type', 'options', 'correct_answer', 'order']

class AdminQuestionGroupSerializer(serializers.ModelSerializer):
    """Full CRUD serializer for question groups"""
    questions = AdminQuestionSerializer(many=True, read_only=True)
    
    class Meta:
        model = QuestionGroup
        fields = ['id', 'module', 'title', 'instructions', 'content', 'media_file', 'audio_start_time', 'order', 'questions']

class AdminTestModuleSerializer(serializers.ModelSerializer):
    """Full CRUD serializer for test modules"""
    question_groups = AdminQuestionGroupSerializer(many=True, read_only=True)
    
    class Meta:
        model = TestModule
        fields = ['id', 'test', 'module_type', 'duration_minutes', 'order', 'question_groups']

class AdminIELTSTestSerializer(serializers.ModelSerializer):
    """Full CRUD serializer for IELTS tests"""
    modules = AdminTestModuleSerializer(many=True, read_only=True)
    
    class Meta:
        model = IELTSTest
        fields = ['id', 'title', 'description', 'test_type', 'active', 'created_at', 'updated_at', 'modules']
        read_only_fields = ['id', 'created_at', 'updated_at']


# --- Simple Format Serializers (for frontend compatibility) ---

class SimpleWritingTestSerializer(serializers.Serializer):
    """Serializer for the simpler writing test format used in frontend"""
    test_id = serializers.IntegerField(source='id', read_only=True)
    difficulty = serializers.ChoiceField(choices=['easy', 'medium', 'hard'], default='medium')
    task_1 = serializers.JSONField()
    task_2 = serializers.JSONField()

class SimpleSpeakingTestSerializer(serializers.Serializer):
    """Serializer for the simpler speaking test format used in frontend"""
    test_id = serializers.IntegerField(source='id', read_only=True)
    difficulty = serializers.ChoiceField(choices=['easy', 'medium', 'hard'], default='medium')
    part_1 = serializers.JSONField()
    part_2 = serializers.JSONField()
    part_3 = serializers.JSONField()
