import uuid
from django.db import models
from django.conf import settings

class IELTSTest(models.Model):
    """
    A full IELTS test (e.g., 'Cambridge 18 Test 1').
    """
    TYPE_CHOICES = [
        ('academic', 'Academic'),
        ('general', 'General Training'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    test_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='academic')
    
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class TestModule(models.Model):
    """
    A module within a test (Listening, Reading, Writing, Speaking).
    """
    MODULE_TYPES = [
        ('listening', 'Listening'),
        ('reading', 'Reading'),
        ('writing', 'Writing'),
        ('speaking', 'Speaking'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    test = models.ForeignKey(IELTSTest, on_delete=models.CASCADE, related_name='modules')
    module_type = models.CharField(max_length=20, choices=MODULE_TYPES)
    
    # Time limit in minutes (e.g., 60 for Reading)
    duration_minutes = models.PositiveIntegerField(default=60)
    
    order = models.PositiveIntegerField(default=0)  # 1 for Listening, etc.

    class Meta:
        ordering = ['order']
        unique_together = ['test', 'module_type']

    def __str__(self):
        return f"{self.test.title} - {self.get_module_type_display()}"

class QuestionGroup(models.Model):
    """
    A group of questions sharing common context (e.g., a Reading Passage or Audio Clip).
    """
    GROUP_TYPES = [
        ('standard', 'Standard Questions'),
        ('summary_completion', 'Summary Completion'),
        ('table_completion', 'Table Completion'),
        ('matching_features', 'Matching Features'),
        ('matching_headings', 'Matching Headings'),
        ('true_false_ng', 'True/False/Not Given'),
        ('yes_no_ng', 'Yes/No/Not Given'),
        ('multiple_choice', 'Multiple Choice'),
        ('sentence_completion', 'Sentence Completion'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    module = models.ForeignKey(TestModule, on_delete=models.CASCADE, related_name='question_groups')
    
    title = models.CharField(max_length=255, blank=True)
    instructions = models.TextField(blank=True)
    group_type = models.CharField(max_length=30, choices=GROUP_TYPES, default='standard')
    
    # Content
    content = models.TextField(blank=True, help_text="Reading passage text or transcript")
    
    # Rich container for inline questions (summary completion, etc.)
    container = models.JSONField(default=dict, blank=True, help_text="Rich text container with slots for inline answers")
    
    # Options for the group (word bank for summary completion, matching options, etc.)
    options = models.JSONField(default=list, blank=True, help_text="List of options/word bank for this question group")
    
    media_file = models.FileField(upload_to='ielts/media/', null=True, blank=True, help_text="Audio for listening or Image for reading")
    
    # Audio timestamp (in seconds) - when this part/section starts in the audio
    audio_start_time = models.PositiveIntegerField(
        default=0, 
        help_text="Time in seconds when this section starts in the audio file. Used for auto-switching parts."
    )
    
    # Image URL for diagram/flowchart questions
    image = models.CharField(max_length=500, blank=True, help_text="URL to an image for diagram/flowchart questions")
    
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.module} - Group {self.order}"


class Question(models.Model):
    """
    An individual question.
    """
    QUESTION_TYPES = [
        ('multiple_choice', 'Multiple Choice'),
        ('text_input', 'Text Input (Gap Fill)'),
        ('true_false', 'True/False/Not Given'),
        ('matching', 'Matching'),
        ('essay', 'Essay (Writing)'),
        ('speech', 'Speech Recording (Speaking)'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(QuestionGroup, on_delete=models.CASCADE, related_name='questions')
    
    question_text = models.TextField()
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPES)
    
    # For multiple choice
    options = models.JSONField(default=list, blank=True, help_text="List of options for MCQs")
    
    # Correct Answer (for auto-grading)
    correct_answer = models.TextField(blank=True, help_text="Correct answer string or JSON")
    
    order = models.PositiveIntegerField(default=0)
    
    def __str__(self):
        return f"{self.group} - Q{self.order}"

class UserTestSession(models.Model):
    """
    A student's attempt at a full test.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ielts_attempts')
    test = models.ForeignKey(IELTSTest, on_delete=models.PROTECT)
    
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)
    
    # Overall Score
    overall_band_score = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)

    def __str__(self):
        return f"{self.user} - {self.test}"

class UserModuleAttempt(models.Model):
    """
    Progress for a specific module within a session.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(UserTestSession, on_delete=models.CASCADE, related_name='module_attempts')
    module = models.ForeignKey(TestModule, on_delete=models.PROTECT)
    
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    is_completed = models.BooleanField(default=False)
    
    band_score = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    raw_score = models.PositiveIntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.session} - {self.module.module_type}"

class UserAnswer(models.Model):
    """
    Student's answer to a question.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    attempt = models.ForeignKey(UserModuleAttempt, on_delete=models.CASCADE, related_name='answers')
    question = models.ForeignKey(Question, on_delete=models.PROTECT)
    
    answer_text = models.TextField(blank=True)
    audio_file = models.FileField(upload_to='ielts/responses/', null=True, blank=True, help_text="For Speaking tasks")
    
    is_correct = models.BooleanField(null=True, blank=True)
    marks_awarded = models.PositiveIntegerField(default=0)
    
    feedback = models.TextField(blank=True, help_text="AI or Tutor feedback")


class IELTSStudentProfile(models.Model):
    """
    IELTS-specific profile for students. Stores onboarding data and preferences.
    """
    TEST_TYPE_CHOICES = [
        ('academic', 'Academic'),
        ('general', 'General'),
    ]
    
    PURPOSE_CHOICES = [
        ('study_abroad', 'Study Abroad'),
        ('immigration', 'Immigration'),
        ('work_abroad', 'Work Abroad'),
        ('local_university', 'Study at Local University'),
        ('other', 'Other Reasons'),
        ('teacher', 'IELTS Teacher'),
    ]
    
    ACCOUNT_TYPE_CHOICES = [
        ('crm', 'CRM Enrolled Student'),
        ('self_signup', 'Self-Signup Student'),
    ]
    
    SUBSCRIPTION_CHOICES = [
        ('free', 'Free Tier'),
        ('premium', 'Premium Subscription'),
        ('crm_full', 'CRM Full Access'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='ielts_profile'
    )
    
    # Account type and subscription
    account_type = models.CharField(
        max_length=20, 
        choices=ACCOUNT_TYPE_CHOICES, 
        default='self_signup'
    )
    subscription_status = models.CharField(
        max_length=20, 
        choices=SUBSCRIPTION_CHOICES, 
        default='free'
    )
    
    # Usage tracking for free tier
    evaluations_this_week = models.PositiveIntegerField(default=0)
    weekly_evaluation_limit = models.PositiveIntegerField(default=3)  # 3 for free, unlimited (9999) for premium
    last_evaluation_reset = models.DateField(null=True, blank=True)
    
    # Google OAuth
    google_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    
    # Onboarding data
    target_score = models.DecimalField(max_digits=2, decimal_places=1, null=True, blank=True)
    exam_date = models.DateField(null=True, blank=True)
    test_type = models.CharField(max_length=20, choices=TEST_TYPE_CHOICES, blank=True)
    attempt_type = models.CharField(max_length=50, blank=True)  # first, writing, speaking, etc.
    purpose = models.CharField(max_length=50, choices=PURPOSE_CHOICES, blank=True)
    referral_source = models.CharField(max_length=50, blank=True)
    
    onboarding_completed = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def has_full_access(self):
        """Check if user has full access (CRM or Premium)"""
        return self.subscription_status in ['premium', 'crm_full']
    
    def can_use_evaluation(self):
        """Check if user can use AI evaluation (based on quota)"""
        if self.has_full_access():
            return True
        return self.evaluations_this_week < self.weekly_evaluation_limit
    
    def __str__(self):
        return f"IELTS Profile: {self.user.email}"


class SpeakingRecording(models.Model):
    """
    Audio recording from a speaking test session.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='speaking_recordings',
        null=True,
        blank=True
    )
    
    # Test info
    test_id = models.CharField(max_length=50, help_text="Speaking test ID")
    session_id = models.CharField(max_length=100, blank=True, help_text="Unique session identifier")
    
    # Recording details
    label = models.CharField(max_length=100, help_text="Part 1 - Q1, Part 2, etc.")
    audio_file = models.FileField(upload_to='ielts/speaking_recordings/')
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    
    # Transcript (if available from speech recognition)
    transcript = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['created_at']
    
    def __str__(self):
        return f"Recording: {self.label} - Test {self.test_id}"
