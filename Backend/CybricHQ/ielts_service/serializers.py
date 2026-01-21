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
    feedback = serializers.SerializerMethodField()
    
    class Meta:
        model = UserModuleAttempt
        fields = ['id', 'module', 'module_type', 'start_time', 'end_time', 'is_completed', 'band_score', 'answers', 'data', 'feedback']
        read_only_fields = ['band_score', 'raw_score', 'start_time', 'end_time']
    
    def get_feedback(self, obj):
        """Extract feedback from data field for frontend convenience."""
        if obj.data and isinstance(obj.data, dict):
            feedback = obj.data.get('feedback', {})
            # Also include parts if available
            parts = obj.data.get('parts', [])
            if feedback or parts:
                result = dict(feedback) if feedback else {}
                if parts:
                    result['parts'] = parts
                return result
        return None

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
    modules = AdminTestModuleSerializer(many=True, required=False)
    
    class Meta:
        model = IELTSTest
        fields = ['id', 'title', 'description', 'test_type', 'active', 'created_at', 'updated_at', 'modules']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        modules_data = validated_data.pop('modules', [])
        test = IELTSTest.objects.create(**validated_data)
        
        for module_data in modules_data:
            # We need to remove nested read-only fields if they exist in data to avoid potential issues,
            # though usually pop is enough. AdminTestModuleSerializer handles groups too? 
            # For now, just basic module creation.
            # Pop nested read-only or complicated fields if necessary
            module_data.pop('question_groups', None)
            TestModule.objects.create(test=test, **module_data)
            
        return test

    def update(self, instance, validated_data):
        modules_data = validated_data.pop('modules', [])
        instance = super().update(instance, validated_data)
        
        # For updates, we usually don't wipe out everything.
        # But if the frontend sends modules, maybe we should sync?
        # For this specific bug (creation), handling create is enough.
        # Handling update for modules is complex (sync vs append).
        # We will assume update only touches test fields for now, as modules are managed separately 
        # or we rely on the fact that existing modules aren't usually changed this way in this app.
        
        return instance


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

# --- Admin Student Serializer ---

from django.contrib.auth import get_user_model
User = get_user_model()

class AdminStudentSerializer(serializers.ModelSerializer):
    account_type = serializers.CharField(source='ielts_profile.account_type', read_only=True, default='crm')
    subscription_status = serializers.CharField(source='ielts_profile.subscription_status', read_only=True, default='free')
    password = serializers.CharField(write_only=True, required=False)
    username = serializers.CharField(required=False, allow_blank=True)
    full_name = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name', 'first_name', 'last_name', 'account_type', 'subscription_status', 'password', 'is_active', 'date_joined']
        read_only_fields = ['id', 'date_joined']

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        full_name = validated_data.pop('full_name', '')
        
        # Auto-generate username from email if not provided
        if not validated_data.get('username'):
            email = validated_data.get('email', '')
            validated_data['username'] = email.split('@')[0] if email else f"student_{User.objects.count() + 1}"
        
        # Split full_name into first/last name
        if full_name and not (validated_data.get('first_name') or validated_data.get('last_name')):
            name_parts = full_name.strip().split(' ', 1)
            validated_data['first_name'] = name_parts[0]
            validated_data['last_name'] = name_parts[1] if len(name_parts) > 1 else ''
        
        user = User.objects.create_user(**validated_data)
        if password:
            user.set_password(password)
        else:
            # Generate random password if not provided (for CRM creation usually)
            import secrets
            import string
            alphabet = string.ascii_letters + string.digits
            password = ''.join(secrets.choice(alphabet) for i in range(12))
            user.set_password(password)
            # We want to return this password so the admin can give it to the student
            # But create_user hashes it. We can attach it to the instance temporarily?
            user._plain_password = password
            
        user.save()
        
        # Ensure IELTS Profile exists?
        from .models import IELTSUserProfile
        IELTSUserProfile.objects.get_or_create(user=user)
        
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user
