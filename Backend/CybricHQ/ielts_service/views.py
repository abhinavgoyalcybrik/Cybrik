from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction

from .models import IELTSTest, UserTestSession, UserModuleAttempt, UserAnswer, Question, TestModule, QuestionGroup, IELTSUserProfile
from .serializers import (
    IELTSTestListSerializer, IELTSTestDetailSerializer, 
    UserTestSessionSerializer, UserAnswerSerializer,
    AdminIELTSTestSerializer, AdminTestModuleSerializer,
    AdminQuestionGroupSerializer, AdminQuestionSerializer,
    AdminStudentSerializer
)
from crm_app.authentication import JWTAuthFromCookie

import logging
logger = logging.getLogger(__name__)

class IELTSTestViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.AllowAny]  # Public access for listing tests

    def get_queryset(self):
        queryset = IELTSTest.objects.filter(active=True)
        module_type = self.request.query_params.get('module_type')
        
        if module_type:
            # Filter tests that have modules of the specified type
            queryset = queryset.filter(modules__module_type=module_type).distinct()
        
        # Access Control Logic
        user = self.request.user
        has_premium = False
        if user.is_authenticated:
            try:
                from billing.models import Subscription
                # Check for active Premium Plan subscription (Tenant level or User level)
                # Supporting both legacy user-linked and new tenant-linked subs
                has_premium = Subscription.objects.filter(
                    user=user, 
                    status='active', 
                    plan__name='Premium Plan'
                ).exists()
                
                # Also check tenant level if applicable
                if not has_premium and hasattr(user, 'profile') and user.profile.tenant:
                     has_premium = Subscription.objects.filter(
                        tenant=user.profile.tenant,
                        status='active',
                        plan__name='Premium Plan'
                    ).exists()
            except ImportError:
                pass
        
        if not has_premium:
            # Free/Start Plan: Access to only 1 test per section
            # We must identify WHICH tests are allowed so that detail/retrieve actions also respect this.
            # Strategy: Get the first active test for each module type.
            
            allowed_ids = set()
            module_types = ['listening', 'reading', 'writing', 'speaking']
            
            for m_type in module_types:
                # Find the first test for this module type
                first_test = IELTSTest.objects.filter(
                    active=True, 
                    modules__module_type=m_type
                ).order_by('created_at').first()
                
                if first_test:
                    allowed_ids.add(first_test.id)
            
            # Apply filter
            queryset = queryset.filter(id__in=allowed_ids)
            
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


    @action(detail=False, methods=['post'])
    @transaction.atomic
    def save_module_result(self, request):
        """
        Save a complete result for a test module (e.g., Reading/Listening).
        Expects:
        {
            "test_id": "...",
            "module_type": "reading", 
            "band_score": 7.5,
            "raw_score": 32,
            "answers": {...}  // Optional
            "feedback": {...}  // Optional - AI evaluation feedback
        }
        """
        # DEBUG: Log authentication details
        logger.info(f"=== save_module_result DEBUG ===")
        logger.info(f"User authenticated: {request.user.is_authenticated}")
        logger.info(f"User: {request.user}")
        logger.info(f"Origin: {request.headers.get('Origin', 'No Origin header')}")
        logger.info(f"Cookies: {list(request.COOKIES.keys())}")
        logger.info(f"Request method: {request.method}")
        
        user = request.user
        data = request.data
        test_id = data.get('test_id')
        module_type = data.get('module_type')
        
        if not test_id or not module_type:
            return Response({"error": "test_id and module_type are required"}, status=status.HTTP_400_BAD_REQUEST)

        # Normalize module_type to lowercase
        module_type = module_type.lower()

        # Try to find existing test by UUID, or create a placeholder for JSON-based tests
        test = None
        try:
            # First try as UUID
            import uuid as uuid_module
            test_uuid = uuid_module.UUID(str(test_id))
            test = IELTSTest.objects.filter(id=test_uuid).first()
        except (ValueError, AttributeError):
            # Not a valid UUID, this is a JSON-based test ID (e.g., "1", "2")
            pass

        if not test:
            # Get or create a placeholder test for JSON-based tests
            # Use a standardized title based on module_type and test_id
            test_title = f"{module_type.capitalize()} Test {test_id}"
            test, created = IELTSTest.objects.get_or_create(
                title=test_title,
                defaults={
                    'description': f'Auto-created test record for JSON-based {module_type} test #{test_id}',
                    'test_type': 'academic',
                    'active': True
                }
            )
            if created:
                logger.info(f"Created placeholder IELTSTest: {test_title}")

        # Get or create the module for this test
        module, module_created = TestModule.objects.get_or_create(
            test=test,
            module_type=module_type,
            defaults={
                'duration_minutes': 60,
                'order': {'listening': 1, 'reading': 2, 'writing': 3, 'speaking': 4}.get(module_type, 0)
            }
        )
        if module_created:
            logger.info(f"Created TestModule: {test.title} - {module_type}")

        # Create new session (each save creates a new completed session)
        session = UserTestSession.objects.create(
            user=user,
            test=test,
            start_time=timezone.now(),
            is_completed=True,
            end_time=timezone.now()
        )

        # Create Module Attempt with score
        try:
            # Ensure feedback includes proper structure for speaking evaluation results
            feedback_data = data.get('feedback', {})
            
            # For speaking module, ensure parts are properly structured
            if module_type == 'speaking' and 'parts' not in feedback_data:
                # Transform flat parts list into structured format if needed
                parts = data.get('parts', [])
                if isinstance(parts, list) and len(parts) > 0:
                    feedback_data['parts'] = parts
                else:
                    # Create empty parts structure for 3 parts
                    feedback_data['parts'] = [
                        {'part': 1, 'transcript': '', 'result': {}, 'audio_url': None},
                        {'part': 2, 'transcript': '', 'result': {}, 'audio_url': None},
                        {'part': 3, 'transcript': '', 'result': {}, 'audio_url': None},
                    ]
            
            attempt = UserModuleAttempt.objects.create(
                session=session,
                module=module,
                start_time=timezone.now(),
                end_time=timezone.now(),
                is_completed=True,
                band_score=data.get('band_score'),
                raw_score=data.get('raw_score'),
                data={
                    'answers': data.get('answers', {}),
                    'feedback': feedback_data,
                    'parts': data.get('parts', []),
                    'audio_files': data.get('audio_files', {}),
                    'extra_data': {k: v for k, v in data.items() if k not in ['test_id', 'module_type', 'band_score', 'raw_score', 'answers', 'feedback', 'parts', 'audio_files']}
                }
            )
            
            # Store feedback if provided (for AI evaluation results)
            if feedback_data:
                logger.info(f"Feedback stored for attempt {attempt.id}: {list(feedback_data.keys())}")
            
            # Update session overall score
            session.overall_band_score = data.get('band_score')
            session.save()
            
            logger.info(f"Saved module result: user={user.email}, test={test.title}, module={module_type}, band={data.get('band_score')}")
            
            return Response(UserTestSessionSerializer(session).data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error saving module result: {e}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """
        Mark test as completed.
        """
        session = self.get_object()
        session.is_completed = True
        session.end_time = timezone.now()
        session.save()
        
        return Response(UserTestSessionSerializer(session).data)


# --- Admin ViewSets for CRUD Operations ---

class IsAdminUser(permissions.BasePermission):
    """Custom permission to only allow admin users"""
    def has_permission(self, request, view):
        return request.user and request.user.is_staff


from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt


from rest_framework.authentication import SessionAuthentication, BasicAuthentication

class CsrfExemptSessionAuthentication(SessionAuthentication):
    def enforce_csrf(self, request):
        return  # To not perform the csrf check previously happening

@method_decorator(csrf_exempt, name='dispatch')
class AdminIELTSTestViewSet(viewsets.ModelViewSet):
    """
    Admin CRUD for IELTS Tests.
    GET /admin/tests/ - List all tests
    POST /admin/tests/ - Create test
    GET /admin/tests/{id}/ - Get test details
    PUT /admin/tests/{id}/ - Update test
    DELETE /admin/tests/{id}/ - Delete test
    """
    queryset = IELTSTest.objects.all()
    serializer_class = AdminIELTSTestSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication, BasicAuthentication, JWTAuthFromCookie]

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

    @action(detail=False, methods=['get'])
    def student_reports(self, request):
        """Get aggregated student performance reports"""
        from django.contrib.auth import get_user_model
        from django.db.models import Count, Avg, Max
        
        User = get_user_model()
        
        # Get users who have an IELTSUserProfile (actual IELTS students)
        ielts_profiles = IELTSUserProfile.objects.select_related('user').all()

        # Multi-Tenancy: Filter by Admin's Tenant
        if not request.user.is_superuser:
            try:
                if hasattr(request.user, 'profile') and request.user.profile.tenant:
                    ielts_profiles = ielts_profiles.filter(user__profile__tenant=request.user.profile.tenant)
                else:
                    return Response({'students': []}) # No tenant context
            except Exception:
                return Response({'students': []})
        
        student_data = []
        for profile in ielts_profiles:
            student = profile.user
            
            # Get all sessions for this student
            sessions = UserTestSession.objects.filter(user=student)
            attempts = UserModuleAttempt.objects.filter(session__user=student)
            
            # Aggregate scores by module type
            module_scores = {}
            for module_type in ['reading', 'writing', 'speaking', 'listening']:
                module_attempts = attempts.filter(module__module_type=module_type)
                if module_attempts.exists():
                    avg_band = module_attempts.aggregate(avg=Avg('band_score'))['avg']
                    best_band = module_attempts.aggregate(best=Max('band_score'))['best']
                    count = module_attempts.count()
                    module_scores[module_type] = {
                        'attempts': count,
                        'average_band': float(avg_band) if avg_band else None,
                        'best_band': float(best_band) if best_band else None,
                    }
                else:
                    module_scores[module_type] = {
                        'attempts': 0,
                        'average_band': None,
                        'best_band': None,
                    }
            
            # Overall stats
            total_attempts = attempts.count()
            completed_sessions = sessions.filter(is_completed=True).count()
            
            # Calculate overall average band (if any)
            overall_avg = attempts.exclude(band_score__isnull=True).aggregate(avg=Avg('band_score'))['avg']
            
            # Use profile data where available
            target_band = profile.target_score
            
            student_data.append({
                'id': student.id,
                'email': student.email,
                'username': student.username or student.email.split('@')[0],
                'full_name': f"{student.first_name} {student.last_name}".strip() or student.email.split('@')[0],
                'date_joined': student.date_joined.isoformat() if student.date_joined else None,
                'target_band': float(target_band) if target_band else None,
                'test_purpose': profile.purpose,
                'total_attempts': total_attempts,
                'completed_sessions': completed_sessions,
                'overall_average_band': float(overall_avg) if overall_avg else None,
                'module_scores': module_scores,
                'onboarding_completed': profile.onboarding_completed,
            })
        
        # Sort by total attempts (most active first)
        student_data.sort(key=lambda x: x['total_attempts'], reverse=True)
        
        return Response({
            'total_students': len(student_data),
            'students': student_data,
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


@method_decorator(csrf_exempt, name='dispatch')
class AdminQuestionGroupViewSet(viewsets.ModelViewSet):
    """Admin CRUD for Question Groups"""
    queryset = QuestionGroup.objects.all()
    serializer_class = AdminQuestionGroupSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    
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


@method_decorator(csrf_exempt, name='dispatch')
class AdminStudentViewSet(viewsets.ModelViewSet):
    """Admin CRUD for Students (IELTS users with profiles)"""
    from django.contrib.auth import get_user_model
    queryset = get_user_model().objects.all()
    serializer_class = AdminStudentSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication, BasicAuthentication, JWTAuthFromCookie]

    def get_queryset(self):
        # Multi-tenancy: Filter students by the admin's tenant
        user = self.request.user
        base_qs = self.queryset.filter(ielts_profile__isnull=False)

        # 1. Superusers see everything
        if user.is_superuser:
            return base_qs.order_by('-date_joined')

        # 2. Tenant Admins see only users in their tenant
        try:
            if hasattr(user, 'profile') and user.profile.tenant:
                return base_qs.filter(profile__tenant=user.profile.tenant).order_by('-date_joined')
        except Exception:
            pass
            
        # 3. If no tenant context, show nothing (security by default)
        return base_qs.none()

    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            user = serializer.save()
            
            # Assign Client/Tenant Relationship
            # If the creator is a Tenant Admin, assign the new student to that Tenant
            creator = request.user
            if hasattr(creator, 'profile') and creator.profile.tenant:
                from crm_app.models import UserProfile
                # Ensure student has a CRM profile linked to the tenant
                profile, _ = UserProfile.objects.get_or_create(user=user)
                profile.tenant = creator.profile.tenant
                profile.save()
            
            # Helper to return the plain password if generated
            response_data = serializer.data
            if hasattr(user, '_plain_password'):
                response_data['password'] = user._plain_password
                
            return Response(response_data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Error creating student: {e}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def count(self, request):
        return Response({'count': self.get_queryset().count()})


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


@api_view(['POST'])
@permission_classes([AllowAny])
def evaluate_speaking_part(request):
    """
    Evaluate a speaking test part by proxying to AI Evaluator.
    
    Expects multipart form data:
    - file: Audio file (webm)
    - part: Part number (1, 2, or 3)
    - attempt_id: Optional attempt ID
    
    Returns speaking evaluation result from AI.
    """
    import requests
    import os
    
    try:
        if 'file' not in request.FILES:
            return Response(
                {"error": "No audio file provided"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        audio_file = request.FILES['file']
        part = request.data.get('part', '1')
        attempt_id = request.data.get('attempt_id', '')
        
        # Get the evaluator API URL from environment
        evaluator_url = os.getenv('EVALUATOR_API_URL', 'http://localhost:8001')
        
        # Forward to the AI evaluator service
        # External evaluator expects: POST /speaking/part/{part}/audio
        # Form data: file (audio), attempt_id (optional)
        
        files = {'file': (audio_file.name, audio_file.read(), audio_file.content_type)}
        data = {}
        if attempt_id:
            data['attempt_id'] = attempt_id
        
        response = requests.post(
            f"{evaluator_url}/speaking/part/{part}/audio",
            files=files,
            data=data,
            timeout=120  # 2 minute timeout for AI evaluation
        )
        
        if response.ok:
            result = response.json()
            return Response(result)
        else:
            logger.error(f"Evaluator error: {response.text}")
            return Response(
                {"error": f"AI evaluation failed: {response.text}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
    except requests.exceptions.ConnectionError:
        logger.error("Could not connect to AI evaluator service")
        return Response(
            {"error": "AI evaluator service unavailable"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    except Exception as e:
        logger.error(f"Error evaluating speaking: {e}")
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
@transaction.atomic
def save_speaking_results(request):
    """
    Save aggregated speaking test results to the database.
    
    Expects JSON:
    - session_id: Session ID
    - test_id: Test ID
    - overall_band: Overall band score
    - parts: Array of part results
    
    Returns success status.
    """
    from django.utils import timezone
    
    try:
        data = request.data
        session_id = data.get('session_id')
        test_id = data.get('test_id')
        overall_band = data.get('overall_band', 0)
        parts = data.get('parts', [])
        
        if not test_id:
            return Response(
                {"error": "test_id is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get or create the test record
        test_title = f"Speaking Test {test_id}"
        test, _ = IELTSTest.objects.get_or_create(
            title=test_title,
            defaults={
                'description': f'Speaking test #{test_id}',
                'test_type': 'academic',
                'active': True
            }
        )
        
        # Get or create the speaking module
        module, _ = TestModule.objects.get_or_create(
            test=test,
            module_type='speaking',
            defaults={
                'duration_minutes': 15,
                'order': 4
            }
        )
        
        # Get user if authenticated
        user = request.user if request.user.is_authenticated else None
        
        if not user:
            # For unauthenticated requests, just log and return success
            logger.info(f"Speaking results received (unauthenticated): test={test_id}, band={overall_band}")
            return Response({"success": True, "message": "Results logged (user not authenticated)"})
        
        # Create session and attempt
        session = UserTestSession.objects.create(
            user=user,
            test=test,
            start_time=timezone.now(),
            end_time=timezone.now(),
            is_completed=True,
            overall_band_score=overall_band
        )
        
        attempt = UserModuleAttempt.objects.create(
            session=session,
            module=module,
            start_time=timezone.now(),
            end_time=timezone.now(),
            is_completed=True,
            band_score=overall_band,
            data={
                'feedback': data.get('feedback', {}),
                'parts': data.get('parts', []),
                'is_evaluated': True
            }
        )
        
        logger.info(f"Speaking results saved: user={user.email}, test={test_id}, band={overall_band}")
        
        return Response({
            "success": True,
            "session_id": str(session.id),
            "attempt_id": str(attempt.id)
        })
        
    except Exception as e:
        logger.error(f"Error saving speaking results: {e}")
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def check_test_completion(request, module_type, test_id):
    """
    Check if the authenticated user has completed a specific test.
    
    URL: /api/ielts/check-completion/<module_type>/<test_id>/
    
    Returns:
    - is_completed: bool
    - session_id: str (if completed)
    - band_score: float (if completed)
    """
    try:
        user = request.user
        
        if not user.is_authenticated:
            return Response({
                "is_completed": False,
                "message": "User not authenticated"
            })
        
        # Normalize module_type
        module_type = module_type.lower()
        
        # Build test title pattern to search
        test_title = f"{module_type.capitalize()} Test {test_id}"
        
        # Find completed sessions for this user and test
        completed_session = UserTestSession.objects.filter(
            user=user,
            test__title__icontains=test_title,
            is_completed=True
        ).order_by('-end_time').first()
        
        if completed_session:
            # Get the module attempt for band score
            attempt = UserModuleAttempt.objects.filter(
                session=completed_session,
                module__module_type=module_type,
                is_completed=True
            ).first()
            
            return Response({
                "is_completed": True,
                "session_id": str(completed_session.id),
                "test_title": completed_session.test.title,
                "band_score": float(attempt.band_score) if attempt and attempt.band_score else None,
                "completed_at": completed_session.end_time.isoformat() if completed_session.end_time else None
            })
        
        return Response({
            "is_completed": False
        })
        
    except Exception as e:
        logger.error(f"Error checking test completion: {e}")
        return Response({
            "is_completed": False,
            "error": str(e)
        })

@api_view(['POST'])
@permission_classes([AllowAny])
def upload_speaking_recording(request):
    """
    Upload and archive a speaking recording chunk.
    This is for record-keeping, separate from evaluation.
    
    Expects multipart form data:
    - audio: The audio file
    - test_id: Test ID
    - session_id: Session ID
    - label: Recording label (e.g., "Part 1")
    """
    try:
        if 'audio' not in request.FILES:
            return Response({"error": "No audio file provided"}, status=status.HTTP_400_BAD_REQUEST)
            
        audio_file = request.FILES['audio']
        test_id = request.data.get('test_id')
        session_id = request.data.get('session_id')
        label = request.data.get('label', 'unknown')
        
        # In a real user-session scenarios, we would link this to a UserTestSession
        # For now, we'll just save it to a media directory organized by session
        
        # save path: media/speaking_recordings/{session_id}/{label}.webm
        import os
        from django.conf import settings
        
        save_dir = os.path.join(settings.MEDIA_ROOT, 'speaking_recordings', str(session_id))
        os.makedirs(save_dir, exist_ok=True)
        
        # Sanitize filename
        filename = f"{label}.webm".replace(" ", "_").replace("/", "-")
        file_path = os.path.join(save_dir, filename)
        
        with open(file_path, 'wb+') as destination:
            for chunk in audio_file.chunks():
                destination.write(chunk)
                
        logger.info(f"Archived speaking recording: {file_path}")
        
        return Response({"success": True, "path": file_path})
        
    except Exception as e:
        logger.error(f"Error archiving recording: {e}")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def check_evaluator_health(request):
    """
    Check if the local AI Evaluator service is running.
    Proxies request to localhost:8001/health
    """
    import requests
    import os
    
    evaluator_url = os.getenv('EVALUATOR_API_URL', 'http://localhost:8001')
    
    try:
        response = requests.get(f"{evaluator_url}/health", timeout=2)
        if response.ok:
            return Response({
                "status": "online",
                "service": "IELTS AI Evaluator",
                "details": response.json()
            })
        else:
            return Response({
                "status": "error",
                "code": response.status_code,
                "details": response.text
            }, status=status.HTTP_502_BAD_GATEWAY)
            
    except requests.exceptions.ConnectionError:
        return Response({
            "status": "offline",
            "message": f"Could not connect to evaluator at {evaluator_url}. Service might be down."
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    except Exception as e:
        return Response({
            "status": "error",
            "message": str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
@transaction.atomic
def import_test(request):
    """
    Import a test from JSON data.
    
    Expects JSON:
    - title: Test title (required)
    - module_type: 'reading' or 'listening' (required)
    - json_data: The test JSON structure (required)
    
    Returns: Created test ID and status
    """
    import json as json_module
    import re
    
    try:
        data = request.data
        title = data.get('title', '').strip()
        module_type = data.get('module_type', '').lower()
        json_data = data.get('json_data', {})
        
        if not title:
            return Response({"error": "title is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        if module_type not in ['reading', 'listening']:
            return Response({"error": "module_type must be 'reading' or 'listening'"}, status=status.HTTP_400_BAD_REQUEST)
        
        if not json_data:
            return Response({"error": "json_data is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if test with this title already exists
        if IELTSTest.objects.filter(title=title).exists():
            return Response({"error": f"Test with title '{title}' already exists"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Create the IELTSTest
        test = IELTSTest.objects.create(
            title=title,
            description=json_data.get('description', f'Imported {module_type.capitalize()} Test'),
            test_type='academic',
            active=True
        )
        
        # Create the module
        duration = 60 if module_type == 'reading' else 30
        order = 2 if module_type == 'reading' else 1
        
        module = TestModule.objects.create(
            test=test,
            module_type=module_type,
            duration_minutes=duration,
            order=order
        )
        
        # Process based on module type
        if module_type == 'reading':
            _import_reading_content(module, json_data)
        else:
            _import_listening_content(module, json_data)
        
        logger.info(f"Imported test: {title} ({module_type})")
        
        return Response({
            "success": True,
            "test_id": str(test.id),
            "title": title,
            "module_type": module_type
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Error importing test: {e}")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _import_reading_content(module, data):
    """Import reading test content from JSON."""
    import json as json_module
    
    global_order = 1
    
    # Get passages/sections
    content_sections = data.get('passages', [])
    if not content_sections:
        content_sections = data.get('sections', [])
    
    for p_idx, content in enumerate(content_sections):
        section_title = content.get('title', f'Passage {p_idx + 1}')
        section_text = content.get('text', '')
        
        # Get groups within passage
        groups = content.get('groups', [])
        if not groups and 'questions' in content:
            groups = [{
                'items': content['questions'],
                'instructions': content.get('question_type', 'Answer the questions')
            }]
        
        for g_idx, group in enumerate(groups):
            q_group = QuestionGroup.objects.create(
                module=module,
                title=f"{section_title} - Group {g_idx + 1}",
                content=section_text,
                instructions=group.get('instructions', ''),
                group_type=group.get('type', 'text_input').lower().replace(' ', '_'),
                container=group.get('container'),
                options=group.get('options', []),
                image=group.get('image'),
                order=global_order
            )
            global_order += 1
            
            # Process items (questions)
            items = group.get('items', [])
            if not items and 'questions' in group:
                items = group['questions']
            
            for item in items:
                json_type = group.get('type', 'TEXT')
                if 'type' in item:
                    json_type = item['type']
                
                db_type = 'text_input'
                options_list = []
                
                if json_type in ['TRUE_FALSE_NOT_GIVEN', 'YES_NO_NOT_GIVEN', 'mcq']:
                    db_type = 'multiple_choice'
                    if json_type == 'TRUE_FALSE_NOT_GIVEN':
                        options_list = ['TRUE', 'FALSE', 'NOT GIVEN']
                    elif json_type == 'YES_NO_NOT_GIVEN':
                        options_list = ['YES', 'NO', 'NOT GIVEN']
                    elif 'options' in item:
                        options_list = item['options']
                        if options_list and isinstance(options_list[0], dict):
                            options_list = [opt.get('value', opt.get('key')) for opt in options_list]
                
                elif json_type in ['MATCHING_HEADINGS', 'MULTIPLE_CHOICE']:
                    db_type = 'multiple_choice'
                    if 'options' in group:
                        options_list = [opt.get('key') for opt in group['options']]
                    elif 'options' in item:
                        options_list = [opt.get('value') for opt in item['options']]
                
                # Construct prompt
                prompt = item.get('prompt', item.get('question', ''))
                if not prompt and 'number' in item:
                    prompt = f"Question {item['number']}"
                if not prompt and 'q' in item:
                    prompt = f"Question {item['q']}"
                
                # Correct answer
                correct = ''
                if 'answer' in item:
                    if isinstance(item['answer'], dict):
                        correct = item['answer'].get('value', '')
                    else:
                        correct = str(item['answer'])
                elif 'correct_answer' in item:
                    correct = item['correct_answer']
                
                Question.objects.create(
                    group=q_group,
                    question_text=prompt,
                    question_type=db_type,
                    options=options_list,
                    correct_answer=correct,
                    order=item.get('number', item.get('q', 0))
                )


def _import_listening_content(module, data):
    """Import listening test content from JSON."""
    import json as json_module
    import re
    
    answer_key = data.get('answer_key', {})
    
    for section_data in data.get('sections', []):
        section_num = section_data.get('section', 1)
        
        question_group = QuestionGroup.objects.create(
            module=module,
            title=f"Section {section_num}",
            instructions=section_data.get('question_type', ''),
            content='',
            group_type='text_input',
            options=[],
            order=section_num
        )
        
        for q_data in section_data.get('questions', []):
            q_num = q_data.get('q', 0)
            q_type = q_data.get('type', 'text')
            
            # Parse question number
            q_order = 0
            if isinstance(q_num, int):
                q_order = q_num
            elif isinstance(q_num, str):
                match = re.match(r'^(\d+)', str(q_num))
                if match:
                    q_order = int(match.group(1))
            
            # Map type
            if q_type in ['mcq', 'mcq_multi']:
                question_type = 'multiple_choice'
            else:
                question_type = 'text_input'
            
            options = q_data.get('options', [])
            
            # Get correct answer
            correct_answers = answer_key.get(str(q_num)) or answer_key.get(q_num) or []
            if isinstance(correct_answers, list):
                correct_answer = json_module.dumps(correct_answers)
            else:
                correct_answer = str(correct_answers)
            
            Question.objects.create(
                group=question_group,
                question_text=q_data.get('question', f'Question {q_num}'),
                question_type=question_type,
                options=options,
                correct_answer=correct_answer,
                order=q_order
            )


# --- Support Ticket ViewSet ---

from .models import SupportTicket, TicketReply
from .serializers import SupportTicketSerializer, TicketReplySerializer


class SupportTicketViewSet(viewsets.ModelViewSet):
    """
    API endpoint for support tickets.
    - Students see only their own tickets
    - Admins see all tickets
    """
    serializer_class = SupportTicketSerializer
    permission_classes = [permissions.IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication, BasicAuthentication, JWTAuthFromCookie]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            # Admins see all tickets
            return SupportTicket.objects.all()
        # Students see only their tickets
        return SupportTicket.objects.filter(user=user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        """Add a reply to a ticket."""
        ticket = self.get_object()
        message = request.data.get('message', '').strip()
        
        if not message:
            return Response({"error": "Message is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        is_admin = request.user.is_staff or request.user.is_superuser
        
        reply = TicketReply.objects.create(
            ticket=ticket,
            user=request.user,
            message=message,
            is_admin=is_admin
        )
        
        # If admin replies, update status to 'in_progress' if still 'open'
        if is_admin and ticket.status == 'open':
            ticket.status = 'in_progress'
            ticket.save()
        
        return Response(TicketReplySerializer(reply).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        """Update ticket status (admin only)."""
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Admin privileges required"}, status=status.HTTP_403_FORBIDDEN)
        
        ticket = self.get_object()
        new_status = request.data.get('status')
        
        valid_statuses = ['open', 'in_progress', 'resolved', 'closed']
        if new_status not in valid_statuses:
            return Response({"error": f"Invalid status. Must be one of: {valid_statuses}"}, status=status.HTTP_400_BAD_REQUEST)
        
        ticket.status = new_status
        ticket.save()
        
        return Response(SupportTicketSerializer(ticket).data)
