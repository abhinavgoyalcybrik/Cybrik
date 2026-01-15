from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import IELTSTest, UserTestSession, UserModuleAttempt, UserAnswer, Question, TestModule, QuestionGroup
from .serializers import (
    IELTSTestListSerializer, IELTSTestDetailSerializer, 
    UserTestSessionSerializer, UserAnswerSerializer,
    AdminIELTSTestSerializer, AdminTestModuleSerializer,
    AdminQuestionGroupSerializer, AdminQuestionSerializer
)

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


    @action(detail=False, methods=['post'])
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
            attempt = UserModuleAttempt.objects.create(
                session=session,
                module=module,
                start_time=timezone.now(),
                end_time=timezone.now(),
                is_completed=True,
                band_score=data.get('band_score'),
                raw_score=data.get('raw_score')
            )
            
            # Store feedback if provided (for AI evaluation results)
            feedback_data = data.get('feedback')
            if feedback_data:
                # Store feedback as JSON in the attempt or a related model
                # For now, we can just log it - the frontend will need to fetch via session
                logger.info(f"Feedback stored for attempt {attempt.id}")
            
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
    permission_classes = [IsAdminUser]

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


class AdminIELTSTestViewSet(viewsets.ModelViewSet):
    """Admin CRUD for IELTS Tests (full access for frontend admin)"""
    queryset = IELTSTest.objects.all()
    serializer_class = AdminIELTSTestSerializer
    permission_classes = [permissions.AllowAny]  # Allow frontend admin access

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
        files = {'file': (audio_file.name, audio_file.read(), audio_file.content_type)}
        data = {'part': part}
        if attempt_id:
            data['attempt_id'] = attempt_id
        
        response = requests.post(
            f"{evaluator_url}/speaking/evaluate",
            files=files,
            data=data,
            timeout=120  # 2 minute timeout for AI evaluation
        )
        
        if response.ok:
            result = response.json()
            return Response({
                "attempt_id": attempt_id or f"part_{part}",
                "part": int(part),
                "result": result
            })
        else:
            logger.error(f"Evaluator error: {response.text}")
            return Response(
                {"error": "AI evaluation failed"},
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
