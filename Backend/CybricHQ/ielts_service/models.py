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
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    module = models.ForeignKey(TestModule, on_delete=models.CASCADE, related_name='question_groups')
    
    title = models.CharField(max_length=255, blank=True)
    instructions = models.TextField(blank=True)
    
    # Content
    content = models.TextField(blank=True, help_text="Reading passage text or transcript")
    
    # Type of question group (e.g. true_false, multiple_choice)
    group_type = models.CharField(max_length=50, default='text_input', help_text="Type of questions in this group")
    
    # Rich text container for complex question types (tables, diagrams)
    container = models.JSONField(null=True, blank=True, help_text="Structure for table completion, flow charts etc.")
    
    # Shared options for the group (e.g. List of Words for summary completion)
    options = models.JSONField(default=list, blank=True, help_text="List of options shared by questions in this group")
    
    # Image for the group (e.g. diagram for labelling)
    image = models.ImageField(upload_to='ielts/images/', null=True, blank=True, help_text="Image for diagram/flowchart questions")
    
    media_file = models.FileField(upload_to='ielts/media/', null=True, blank=True, help_text="Audio for listening or Image for reading")
    
    # Audio timestamp (in seconds) - when this part/section starts in the audio
    audio_start_time = models.PositiveIntegerField(
        default=0, 
        help_text="Time in seconds when this section starts in the audio file. Used for auto-switching parts."
    )
    
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
    data = models.JSONField(default=dict, blank=True, help_text="Detailed results/feedback JSON")

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


class IELTSUserProfile(models.Model):
    """
    User profile for IELTS students.
    Stores onboarding answers and user preferences.
    """
    PURPOSE_CHOICES = [
        ('study_abroad', 'Study abroad'),
        ('immigration', 'Immigration'),
        ('work_abroad', 'Work abroad'),
        ('local_university', 'Study at local university'),
        ('other', 'Other'),
        ('teacher', 'IELTS teacher'),
    ]
    
    TEST_TYPE_CHOICES = [
        ('general', 'General Training'),
        ('academic', 'Academic'),
    ]
    
    ATTEMPT_TYPE_CHOICES = [
        ('first', 'First time'),
        ('writing', 'Writing retake'),
        ('speaking', 'Speaking retake'),
        ('listening', 'Listening retake'),
        ('reading', 'Reading retake'),
        ('full', 'Full test retake'),
    ]
    
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='ielts_profile'
    )
    
    # Onboarding data
    purpose = models.CharField(max_length=50, choices=PURPOSE_CHOICES, blank=True)
    test_type = models.CharField(max_length=20, choices=TEST_TYPE_CHOICES, blank=True)
    attempt_type = models.CharField(max_length=20, choices=ATTEMPT_TYPE_CHOICES, blank=True)
    target_score = models.DecimalField(max_digits=2, decimal_places=1, null=True, blank=True)
    exam_date = models.CharField(max_length=20, blank=True, help_text="Date string YYYY-MM-DD or 'unknown'")
    referral_source = models.CharField(max_length=50, blank=True)
    
    onboarding_completed = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "IELTS User Profile"
        verbose_name_plural = "IELTS User Profiles"
    
    def __str__(self):
        return f"{self.user.email} - IELTS Profile"


class SupportTicket(models.Model):
    """
    Support ticket raised by a student.
    """
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('in_progress', 'In Progress'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    ]
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]
    CATEGORY_CHOICES = [
        ('technical', 'Technical Issue'),
        ('billing', 'Billing/Payment'),
        ('test', 'Test Related'),
        ('account', 'Account Issue'),
        ('other', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='support_tickets')
    subject = models.CharField(max_length=255)
    description = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    is_read = models.BooleanField(default=False, help_text="True if admin has read the new ticket")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Support Ticket"
        verbose_name_plural = "Support Tickets"

    def __str__(self):
        return f"#{str(self.id)[:8]} - {self.subject}"


class TicketReply(models.Model):
    """
    Reply to a support ticket (by student or admin).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='replies')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    message = models.TextField()
    is_admin = models.BooleanField(default=False)
    is_read = models.BooleanField(default=False, help_text="True if the recipient has read this reply")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = "Ticket Reply"
        verbose_name_plural = "Ticket Replies"

    def __str__(self):
        return f"Reply to {self.ticket} by {self.user.email}"
