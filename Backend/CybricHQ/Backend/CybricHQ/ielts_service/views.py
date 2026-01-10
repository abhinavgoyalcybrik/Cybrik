from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import IELTSTest, UserTestSession, UserModuleAttempt, UserAnswer, Question, TestModule, QuestionGroup
from .serializers import (
    IELTSTestListSerializer, IELTSTestDetailSerializer, 
    UserTestSessionSerializer, UserAnswerSerializer,
    AdminIELTSTestSerializer, AdminTestModuleSerializer,
    AdminQuestionGroupSerializer, AdminQuestionSerializer,
    AdminStudentSerializer
)
from django.contrib.auth import get_user_model
import secrets
import string


class IELTSTestViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.AllowAny]  # Public access for listing tests

    def get_queryset(self):
        queryset = IELTSTest.objects.filter(active=True)
        module_type = self.request.query_params.get('module_type')
        
        if module_type:
            # Filter tests that have modules of the specified type
            queryset = queryset.filter(modules__module_type=module_type).distinct()
        
        return queryset

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return IELTSTestDetailSerializer
        return IELTSTestListSerializer

    @action(detail=True, methods=['post'])
    def start_session(self, request, pk=None):
        """
        Start a new test session for the user.
        """
        test = self.get_object()
        user = request.user
        
        # Create session
        session = UserTestSession.objects.create(
            user=user,
            test=test,
            start_time=timezone.now()
        )
        
        # Initialize module attempts
        for module in test.modules.all():
            UserModuleAttempt.objects.create(
                session=session,
                module=module
            )
            
        serializer = UserTestSessionSerializer(session)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class UserTestSessionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserTestSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserTestSession.objects.filter(user=self.request.user)

    @action(detail=True, methods=['post'])
    def submit_answer(self, request, pk=None):
        """
        Submit an answer for a specific question.
        Expects: { "question_id": "...", "answer_text": "...", "audio_file": ... }
        """
        session = self.get_object()
        if session.is_completed:
            return Response({"error": "Test already completed"}, status=status.HTTP_400_BAD_REQUEST)
            
        data = request.data
        question_id = data.get('question_id')
        
        try:
            question = Question.objects.get(id=question_id)
        except Question.DoesNotExist:
            return Response({"error": "Invalid question ID"}, status=status.HTTP_404_NOT_FOUND)
            
        # Find the correct module attempt
        # Question -> Group -> Module
        module = question.group.module
        try:
            attempt = UserModuleAttempt.objects.get(session=session, module=module)
        except UserModuleAttempt.DoesNotExist:
            return Response({"error": "Module attempt not found"}, status=status.HTTP_404_NOT_FOUND)

        # Save or Update Answer
        answer, created = UserAnswer.objects.update_or_create(
            attempt=attempt,
            question=question,
            defaults={
                'answer_text': data.get('answer_text', ''),
                # Handle file upload if present
                # 'audio_file': request.FILES.get('audio_file') 
            }
        )
        
        return Response(UserAnswerSerializer(answer).data)


    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """
        Mark test as completed.
        """
        session = self.get_object()
        session.is_completed = True
        session.end_time = timezone.now()
        session.save()
        
        # TODO: Trigger Grading Logic Here
        
        return Response(UserTestSessionSerializer(session).data)


# --- Admin ViewSets for CRUD Operations ---

class IsAdminUser(permissions.BasePermission):
    """Custom permission to only allow admin users"""
    def has_permission(self, request, view):
        return request.user and request.user.is_staff




class AdminIELTSTestViewSet(viewsets.ModelViewSet):
    """Admin CRUD for IELTS Tests (full access for frontend admin)"""
    queryset = IELTSTest.objects.all()
    serializer_class = AdminIELTSTestSerializer

    permission_classes = [permissions.AllowAny]  # Allow frontend admin access

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get test statistics for admin dashboard"""
        total_tests = IELTSTest.objects.count()
        active_tests = IELTSTest.objects.filter(active=True).count()
        
        # Count by module type
        writing_count = TestModule.objects.filter(module_type='writing').count()
        speaking_count = TestModule.objects.filter(module_type='speaking').count()
        listening_count = TestModule.objects.filter(module_type='listening').count()
        reading_count = TestModule.objects.filter(module_type='reading').count()
        
        return Response({
            'total_tests': total_tests,
            'active_tests': active_tests,
            'writing_modules': writing_count,
            'speaking_modules': speaking_count,
            'listening_modules': listening_count,
            'reading_modules': reading_count,
        })

    def get_queryset(self):
        queryset = IELTSTest.objects.all()
        module_type = self.request.query_params.get('module_type')
        
        if module_type:
            queryset = queryset.filter(modules__module_type=module_type).distinct()
        
        return queryset.order_by('-created_at')


class AdminTestModuleViewSet(viewsets.ModelViewSet):
    """Admin CRUD for Test Modules"""
    queryset = TestModule.objects.all()
    serializer_class = AdminTestModuleSerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        queryset = TestModule.objects.all()
        test_id = self.request.query_params.get('test_id')
        module_type = self.request.query_params.get('module_type')
        
        if test_id:
            queryset = queryset.filter(test_id=test_id)
        if module_type:
            queryset = queryset.filter(module_type=module_type)
            
        return queryset


class AdminQuestionGroupViewSet(viewsets.ModelViewSet):
    """Admin CRUD for Question Groups"""
    queryset = QuestionGroup.objects.all()
    serializer_class = AdminQuestionGroupSerializer
    permission_classes = [permissions.AllowAny]  # Allow frontend admin access
    
    def get_queryset(self):
        queryset = QuestionGroup.objects.all()
        module_id = self.request.query_params.get('module_id')
        
        if module_id:
            queryset = queryset.filter(module_id=module_id)
            
        return queryset


class AdminQuestionViewSet(viewsets.ModelViewSet):
    """Admin CRUD for Questions"""
    queryset = Question.objects.all()
    serializer_class = AdminQuestionSerializer
    permission_classes = [IsAdminUser]
    
    def get_queryset(self):
        queryset = Question.objects.all()
        group_id = self.request.query_params.get('group_id')
        
        if group_id:
            queryset = queryset.filter(group_id=group_id)
            
        return queryset


class AdminStudentViewSet(viewsets.ModelViewSet):
    """
    Admin CRUD for Students.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    serializer_class = AdminStudentSerializer

    def get_queryset(self):
        User = get_user_model()
        return User.objects.all().order_by('-date_joined')

    def create(self, request, *args, **kwargs):
        """
        Create a new student with CRM defaults.
        Auto-generates password if not provided.
        """
        print("DEBUG: create student called")
        try:
            email = request.data.get('email')
            name = request.data.get('name', '')
            
            if not email:
                return Response({"error": "Email is required"}, status=status.HTTP_400_BAD_REQUEST)
                
            User = get_user_model()
            if User.objects.filter(email=email).exists():
                return Response({"error": "User with this email already exists"}, status=status.HTTP_400_BAD_REQUEST)
                
            # Generate random password
            alphabet = string.ascii_letters + string.digits
            password = ''.join(secrets.choice(alphabet) for i in range(10))
            
            # Create User
            username = email.split('@')[0]
            # Ensure unique username
            base_username = username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1
                
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=name.split(' ')[0],
                last_name=' '.join(name.split(' ')[1:]) if ' ' in name else ''
            )
            
            # Create Profile
            from .models import IELTSStudentProfile
            IELTSStudentProfile.objects.create(
                user=user,
                account_type='crm',
                subscription_status='crm_full',
                onboarding_completed=True  # Skip onboarding for CRM students
            )
            
            return Response({
                "id": user.id,
                "username": username,
                "password": password,
                "email": email,
                "account_type": "crm",
                "subscription_status": "crm_full"
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        data = []
        for user in queryset:
            try:
                profile = user.ielts_profile
            except:
                profile = None
                
            data.append({
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "name": user.get_full_name(),
                "account_type": profile.account_type if profile else 'unknown',
                "subscription_status": profile.subscription_status if profile else 'unknown',
            })
        return Response({"students": data})


from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
import logging

logger = logging.getLogger(__name__)



@api_view(['POST'])
@permission_classes([AllowAny])  # For testing; use IsAuthenticated in production
def analyze_handwriting(request):
    """
    Analyze a handwritten image submission.
    
    Expects multipart form data with:
    - image: The uploaded image file
    - quick_check: Optional boolean, if true only checks clarity
    
    Returns:
    - success: bool
    - is_clear: bool
    - clarity_score: float
    - extracted_text: str
    - word_count: int
    - feedback: str
    """
    try:
        if 'image' not in request.FILES:
            return Response(
                {"success": False, "error": "No image file provided"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        image_file = request.FILES['image']
        image_data = image_file.read()
        image_type = image_file.content_type or 'image/jpeg'
        
        # Validate file size (max 10MB)
        if len(image_data) > 10 * 1024 * 1024:
            return Response(
                {"success": False, "error": "Image too large. Maximum size is 10MB."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from .handwriting_analyzer import HandwritingAnalyzer
        analyzer = HandwritingAnalyzer()
        
        # Quick clarity check or full analysis
        quick_check = request.data.get('quick_check', 'false').lower() == 'true'
        
        if quick_check:
            result = analyzer.quick_clarity_check(image_data, image_type)
        else:
            result = analyzer.analyze_image(image_data, image_type)
        
        return Response(result)
        
    except ValueError as e:
        # Missing API key
        logger.error(f"Configuration error: {e}")
        return Response(
            {"success": False, "error": "Service not configured properly"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    except Exception as e:
        logger.error(f"Error analyzing handwriting: {e}")
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def text_to_speech(request):
    """
    Convert text to speech using OpenAI TTS.
    
    Expects JSON:
    - text: The text to convert to speech
    - voice: Optional voice (alloy, echo, fable, onyx, nova, shimmer)
    
    Returns: Audio file (mp3)
    """
    try:
        text = request.data.get('text', '')
        voice = request.data.get('voice', 'alloy')
        
        if not text:
            return Response(
                {"success": False, "error": "No text provided"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Limit text length
        if len(text) > 2000:
            return Response(
                {"success": False, "error": "Text too long. Maximum 2000 characters."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from .voice_service import VoiceService
        voice_service = VoiceService()
        
        audio_bytes = voice_service.text_to_speech(text, voice)
        
        # Return audio as base64 for easy frontend handling
        import base64
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
        
        return Response({
            "success": True,
            "audio": audio_base64,
            "format": "mp3"
        })
        
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        return Response(
            {"success": False, "error": "Service not configured properly"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    except Exception as e:
        logger.error(f"Error in TTS: {e}")
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def speech_to_text(request):
    """
    Transcribe speech to text using OpenAI Whisper.
    
    Expects multipart form data:
    - audio: Audio file (webm, mp3, wav, etc.)
    
    Returns:
    - success: bool
    - text: Transcribed text
    - word_count: int
    """
    try:
        if 'audio' not in request.FILES:
            return Response(
                {"success": False, "error": "No audio file provided"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        audio_file = request.FILES['audio']
        audio_data = audio_file.read()
        
        # Get format from content type
        content_type = audio_file.content_type or 'audio/webm'
        audio_format = content_type.split('/')[-1].split(';')[0]  # e.g., webm, mp3
        
        # Validate file size (max 25MB - Whisper limit)
        if len(audio_data) > 25 * 1024 * 1024:
            return Response(
                {"success": False, "error": "Audio too large. Maximum size is 25MB."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from .voice_service import VoiceService
        voice_service = VoiceService()
        
        result = voice_service.speech_to_text(audio_data, audio_format)
        
        return Response(result)
        
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        return Response(
            {"success": False, "error": "Service not configured properly"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    except Exception as e:
        logger.error(f"Error in STT: {e}")
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def ping_view(request):
    return Response({"message": "pong", "status": "ok"})

