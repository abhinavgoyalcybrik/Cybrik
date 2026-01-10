"""
IELTS Speaking API Views

REST endpoints for speaking session management:
- Create new speaking sessions
- Get session status and results
- List speaking history
"""

from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.conf import settings
import logging

from .speaking_models import SpeakingSession, SpeakingResponse, SpeakingEvaluation, SpeakingMetrics
from .models import SpeakingRecording

# ... (rest of imports remain same)

# ... (add this function at the end, before the last functions)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])  # Allow unauthenticated for now, or match existing
def save_speaking_results(request):
    """
    Save aggregated speaking results from frontend.
    Creates SpeakingSession and related records from client-side evaluation.
    
    POST /api/ielts/speaking/save-results/
    
    Body:
        {
            "session_id": "session-xxx", (client string)
            "test_id": "1",
            "overall_band": 6.5,
            "parts": [
                {
                    "part": 1,
                    "score": { "fluency": 6.0, ... },
                    "feedback": { "strengths": "...", "improvements": "..." },
                    "recording_label": "Part 1.webm"
                },
                ...
            ]
        }
    """
    session_id_str = request.data.get('session_id')
    test_id = request.data.get('test_id')
    overall_band = request.data.get('overall_band')
    parts_data = request.data.get('parts', [])
    
    if not session_id_str:
        return Response({'error': 'session_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
    user = request.user if request.user.is_authenticated else None
    
    try:
        # 1. Create SpeakingSession
        # Look for existing IELTSTest if test_id provided
        # For now, we might not link to IELTSTest object if ID is integer "1" and DB uses UUID
        test_obj = None
        
        session = SpeakingSession.objects.create(
            user=user if user else None,  # Handle anonymous if needed, or enforce auth
            status='completed',
            overall_band_score=overall_band,
            ended_at=timezone.now()
        )
        
        # 2. Process Parts
        for part_data in parts_data:
            part_num = part_data.get('part')
            scores = part_data.get('score', {})
            feedback = part_data.get('feedback', {})
            label = part_data.get('recording_label')
            
            # Find recording
            recording = None
            if label:
                # Try to find by session_id_str and label
                # Note: label might be "Part 1.webm" or "Part 1"
                recs = SpeakingRecording.objects.filter(session_id=session_id_str, label__icontains=f"Part {part_num}")
                if recs.exists():
                    recording = recs.first()
            
            # Create Response
            response = SpeakingResponse.objects.create(
                session=session,
                part=part_num,
                question_index=0, # Whole part
                question_text=f"Part {part_num} Response",
                status='completed',
                audio_file=recording.audio_file if recording else None,
                transcript=recording.transcript if recording else ""
            )
            
            # Create Evaluation
            SpeakingEvaluation.objects.create(
                response=response,
                fluency_coherence=scores.get('fluency'),
                lexical_resource=scores.get('lexical'),
                grammatical_range=scores.get('grammar'),
                pronunciation=scores.get('pronunciation'),
                overall_band=scores.get('overall_band') or overall_band, # Use part band if avail
                strengths=feedback.get('strengths', ''),
                improvement_suggestions=feedback.get('improvements', '')
            )
            
        # Calculate/Update averages on session if provided
        # But we already set overall_band. The method calculate_overall_score works too.
        session.calculate_overall_score()
        
        return Response({
            'success': True,
            'session_id': str(session.id), # DB UUID
            'client_session_id': session_id_str
        })
        
    except Exception as e:
        logger.exception(f"Failed to save speaking results: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

from .speaking_serializers import (
    SpeakingSessionSerializer,
    SpeakingSessionListSerializer,
    SpeakingResponseSerializer,
    CreateSpeakingSessionSerializer,
)

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def upload_speaking_recording(request):
    """
    Upload a speaking test audio recording.
    
    POST /api/ielts/speaking/recordings/upload/
    
    Multipart form data:
        - audio: Audio file (webm, mp3, wav)
        - test_id: Speaking test ID
        - session_id: Unique session identifier
        - label: Recording label (e.g., "Part 1 - Q1")
        - transcript: Optional transcript text
    
    Returns:
        {"success": true, "recording_id": "..."}
    """
    audio_file = request.FILES.get('audio')
    test_id = request.POST.get('test_id', '')
    session_id = request.POST.get('session_id', '')
    label = request.POST.get('label', 'Recording')
    transcript = request.POST.get('transcript', '')
    
    if not audio_file:
        return Response(
            {'error': 'No audio file provided'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get user if authenticated
    user = request.user if request.user.is_authenticated else None
    
    try:
        recording = SpeakingRecording.objects.create(
            user=user,
            test_id=test_id,
            session_id=session_id,
            label=label,
            audio_file=audio_file,
            transcript=transcript
        )
        
        logger.info(f"Saved speaking recording: {recording.id} - {label}")
        
        return Response({
            'success': True,
            'recording_id': str(recording.id),
            'label': label,
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Failed to save recording: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([permissions.AllowAny])  # TODO: Change to IsAdminUser in production
def list_speaking_recordings(request):
    """
    List all speaking recordings (admin endpoint).
    
    GET /api/ielts/speaking/recordings/
    
    Returns:
        List of recordings with download URLs
    """
    recordings = SpeakingRecording.objects.all().order_by('-created_at')
    
    data = []
    for recording in recordings:
        data.append({
            'id': str(recording.id),
            'user_id': recording.user_id,
            'user_email': recording.user.email if recording.user else 'Anonymous',
            'test_id': recording.test_id,
            'session_id': recording.session_id,
            'label': recording.label,
            'audio_url': recording.audio_file.url if recording.audio_file else None,
            'transcript': recording.transcript,
            'duration_seconds': recording.duration_seconds,
            'created_at': recording.created_at.isoformat(),
        })
    
    return Response({
        'total': len(data),
        'recordings': data
    })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])  # Allow unauthenticated for now
def evaluate_speaking_session(request):
    """
    Evaluate speaking recordings using AI (Whisper + GPT-4).
    
    POST /api/ielts/speaking/evaluate/
    
    Body:
        {
            "session_id": "session-xxx",
            "test_id": "1",
            "responses": {
                "Part 1 - Q1": "transcript or audio blob reference",
                ...
            }
        }
    
    Returns:
        Band scores, feedback, and detailed evaluation for each part
    """
    import os
    from .speaking_evaluator import IELTSSpeakingEvaluator
    from .voice_service import VoiceService
    
    session_id = request.data.get('session_id')
    test_id = request.data.get('test_id')
    responses = request.data.get('responses', {})
    
    if not session_id:
        return Response({'error': 'session_id is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Get recordings for this session
    recordings = SpeakingRecording.objects.filter(session_id=session_id).order_by('created_at')
    
    if not recordings.exists() and not responses:
        return Response({
            'error': 'No recordings found for this session',
            'session_id': session_id
        }, status=status.HTTP_404_NOT_FOUND)
    
    try:
        evaluator = IELTSSpeakingEvaluator()
    except ValueError as e:
        logger.error(f"Evaluator init failed: {e}")
        return Response({
            'error': 'AI evaluation service not configured',
            'details': str(e)
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    
    results = []
    overall_scores = {
        'fluency_coherence': [],
        'lexical_resource': [],
        'grammatical_range': [],
        'pronunciation': []
    }
    
    # Try to transcribe and evaluate each recording
    for recording in recordings:
        try:
            transcript = recording.transcript
            
            # If no transcript, try to transcribe the audio
            if not transcript and recording.audio_file:
                try:
                    voice_service = VoiceService()
                    with open(recording.audio_file.path, 'rb') as audio_file:
                        transcript = voice_service.transcribe(audio_file.read())
                    # Save transcript
                    recording.transcript = transcript
                    recording.save()
                except Exception as e:
                    logger.warning(f"Transcription failed for {recording.id}: {e}")
                    transcript = ""
            
            if transcript:
                # Determine part from label
                part = 1
                if 'Part 2' in recording.label:
                    part = 2
                elif 'Part 3' in recording.label:
                    part = 3
                
                # Evaluate this response
                evaluation = evaluator.evaluate(
                    transcript=transcript,
                    question_text=recording.label,  # Use label as question context
                    part=part
                )
                
                results.append({
                    'label': recording.label,
                    'transcript': transcript,
                    'evaluation': {
                        'fluency_coherence': float(evaluation['fluency_coherence']),
                        'lexical_resource': float(evaluation['lexical_resource']),
                        'grammatical_range': float(evaluation['grammatical_range']),
                        'pronunciation': float(evaluation['pronunciation']),
                        'feedback': evaluation['feedback'],
                        'improvement_suggestions': evaluation.get('improvement_suggestions', ''),
                    }
                })
                
                # Collect scores for overall
                overall_scores['fluency_coherence'].append(float(evaluation['fluency_coherence']))
                overall_scores['lexical_resource'].append(float(evaluation['lexical_resource']))
                overall_scores['grammatical_range'].append(float(evaluation['grammatical_range']))
                overall_scores['pronunciation'].append(float(evaluation['pronunciation']))
                
        except Exception as e:
            logger.error(f"Evaluation failed for recording {recording.id}: {e}")
            results.append({
                'label': recording.label,
                'error': str(e)
            })
    
    # Calculate overall band score
    def avg_score(scores):
        return round(sum(scores) / len(scores) * 2) / 2 if scores else 0
    
    overall_band = 0
    if any(overall_scores.values()):
        fc = avg_score(overall_scores['fluency_coherence'])
        lr = avg_score(overall_scores['lexical_resource'])
        gra = avg_score(overall_scores['grammatical_range'])
        p = avg_score(overall_scores['pronunciation'])
        overall_band = round((fc + lr + gra + p) / 4 * 2) / 2
    
    return Response({
        'success': True,
        'session_id': session_id,
        'test_id': test_id,
        'overall_band': overall_band,
        'criterion_scores': {
            'fluency_coherence': avg_score(overall_scores['fluency_coherence']),
            'lexical_resource': avg_score(overall_scores['lexical_resource']),
            'grammatical_range': avg_score(overall_scores['grammatical_range']),
            'pronunciation': avg_score(overall_scores['pronunciation']),
        },
        'detailed_results': results,
        'total_evaluated': len([r for r in results if 'evaluation' in r]),
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_speaking_session(request):
    """
    Create a new speaking test session.
    
    POST /api/ielts/speaking/sessions/
    
    Body:
        {
            "test_id": "<optional UUID>",
            "part": 1
        }
    
    Returns:
        {
            "session_id": "...",
            "status": "initializing",
            "websocket_url": "ws://host/ws/speaking/<session_id>/",
            "config": {...}
        }
    """
    serializer = CreateSpeakingSessionSerializer(
        data=request.data,
        context={'request': request}
    )
    
    if serializer.is_valid():
        session = serializer.save()
        
        # Build WebSocket URL
        protocol = 'wss' if request.is_secure() else 'ws'
        host = request.get_host()
        websocket_url = f"{protocol}://{host}/ws/speaking/{session.id}/"
        
        return Response({
            'session_id': str(session.id),
            'status': session.status,
            'current_part': session.current_part,
            'websocket_url': websocket_url,
            'config': {
                1: {
                    'name': 'Introduction and Interview',
                    'time_limit_seconds': 300,
                    'silence_threshold_seconds': 3,
                },
                2: {
                    'name': 'Long Turn',
                    'prep_time_seconds': 60,
                    'time_limit_seconds': 120,
                    'silence_threshold_seconds': 5,
                },
                3: {
                    'name': 'Two-way Discussion',
                    'time_limit_seconds': 300,
                    'silence_threshold_seconds': 4,
                }
            }
        }, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_speaking_session(request, session_id):
    """
    Get speaking session details and results.
    
    GET /api/ielts/speaking/sessions/<session_id>/
    
    Returns:
        Full session data with all responses and evaluations
    """
    session = get_object_or_404(
        SpeakingSession.objects.select_related('user', 'test')
            .prefetch_related('responses__metrics', 'responses__evaluation'),
        id=session_id,
        user=request.user
    )
    
    serializer = SpeakingSessionSerializer(session)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_speaking_sessions(request):
    """
    List user's speaking test history.
    
    GET /api/ielts/speaking/history/
    
    Query params:
        - status: Filter by status (completed, active, etc.)
        - limit: Number of results (default 20)
        - offset: Pagination offset
    
    Returns:
        List of sessions with summary info
    """
    queryset = SpeakingSession.objects.filter(user=request.user)
    
    # Filter by status
    status_filter = request.query_params.get('status')
    if status_filter:
        queryset = queryset.filter(status=status_filter)
    
    # Order by most recent
    queryset = queryset.order_by('-started_at')
    
    # Pagination
    limit = int(request.query_params.get('limit', 20))
    offset = int(request.query_params.get('offset', 0))
    
    total = queryset.count()
    sessions = queryset[offset:offset + limit]
    
    serializer = SpeakingSessionListSerializer(sessions, many=True)
    
    return Response({
        'total': total,
        'limit': limit,
        'offset': offset,
        'results': serializer.data,
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_speaking_response(request, response_id):
    """
    Get a single speaking response with evaluation.
    
    GET /api/ielts/speaking/responses/<response_id>/
    """
    response = get_object_or_404(
        SpeakingResponse.objects.select_related('metrics', 'evaluation'),
        id=response_id,
        session__user=request.user
    )
    
    serializer = SpeakingResponseSerializer(response)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def complete_speaking_session(request, session_id):
    """
    Mark a speaking session as completed and calculate final score.
    
    POST /api/ielts/speaking/sessions/<session_id>/complete/
    """
    session = get_object_or_404(
        SpeakingSession,
        id=session_id,
        user=request.user
    )
    
    if session.status == 'completed':
        return Response(
            {'message': 'Session already completed'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Calculate overall score
    session.status = 'completed'
    session.ended_at = timezone.now()
    session.calculate_overall_score()
    
    serializer = SpeakingSessionSerializer(session)
    return Response(serializer.data)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def cancel_speaking_session(request, session_id):
    """
    Cancel an active speaking session.
    
    DELETE /api/ielts/speaking/sessions/<session_id>/
    """
    session = get_object_or_404(
        SpeakingSession,
        id=session_id,
        user=request.user
    )
    
    if session.status == 'completed':
        return Response(
            {'message': 'Cannot cancel completed session'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    session.status = 'cancelled'
    session.ended_at = timezone.now()
    session.save()
    
    return Response({'message': 'Session cancelled'})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def speaking_statistics(request):
    """
    Get speaking test statistics for the user.
    
    GET /api/ielts/speaking/stats/
    
    Returns:
        {
            "total_sessions": 10,
            "completed_sessions": 8,
            "average_band": 6.5,
            "best_band": 7.5,
            "recent_trend": [6.0, 6.5, 7.0],
            ...
        }
    """
    from django.db.models import Avg, Max, Count
    
    sessions = SpeakingSession.objects.filter(
        user=request.user,
        status='completed'
    )
    
    stats = sessions.aggregate(
        total_completed=Count('id'),
        average_band=Avg('overall_band_score'),
        best_band=Max('overall_band_score'),
        avg_fluency=Avg('fluency_coherence_avg'),
        avg_lexical=Avg('lexical_resource_avg'),
        avg_grammar=Avg('grammatical_range_avg'),
        avg_pronunciation=Avg('pronunciation_avg'),
    )
    
    # Get recent trend (last 5 sessions)
    recent = sessions.order_by('-ended_at')[:5].values_list(
        'overall_band_score', flat=True
    )
    
    # Total sessions (including incomplete)
    total_sessions = SpeakingSession.objects.filter(user=request.user).count()
    
    return Response({
        'total_sessions': total_sessions,
        'completed_sessions': stats['total_completed'] or 0,
        'average_band': float(stats['average_band']) if stats['average_band'] else None,
        'best_band': float(stats['best_band']) if stats['best_band'] else None,
        'criterion_averages': {
            'fluency_coherence': float(stats['avg_fluency']) if stats['avg_fluency'] else None,
            'lexical_resource': float(stats['avg_lexical']) if stats['avg_lexical'] else None,
            'grammatical_range': float(stats['avg_grammar']) if stats['avg_grammar'] else None,
            'pronunciation': float(stats['avg_pronunciation']) if stats['avg_pronunciation'] else None,
        },
        'recent_trend': [float(b) for b in recent if b is not None],
    })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def evaluate_speaking_part_proxy(request):
    """
    Proxy endpoint to forward audio to the AI Evaluator service.
    
    POST /api/ielts/speaking/evaluate-part/
    
    Multipart form data:
        - file: Audio file (webm, mp3, wav)
        - part: Speaking part number (1, 2, or 3)
        - attempt_id: Optional attempt ID for tracking
    
    Returns:
        Evaluation result from AI Evaluator with band scores and feedback
    """
    import requests
    
    audio_file = request.FILES.get('file')
    part = request.POST.get('part', '1')
    attempt_id = request.POST.get('attempt_id', '')
    
    if not audio_file:
        return Response(
            {'error': 'No audio file provided'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Validate part number
    try:
        part_num = int(part)
        if part_num not in [1, 2, 3]:
            raise ValueError()
    except ValueError:
        return Response(
            {'error': 'Part must be 1, 2, or 3'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # AI Evaluator URL - configurable via settings or environment
    # Default to 8001 for local dev, set AI_EVALUATOR_URL in settings for production (e.g., http://127.0.0.1:9000)
    import os
    evaluator_url = getattr(settings, 'AI_EVALUATOR_URL', os.environ.get('AI_EVALUATOR_URL', 'http://127.0.0.1:8001'))
    endpoint = f"{evaluator_url}/speaking/part/{part_num}/audio"
    
    if attempt_id:
        endpoint += f"?attempt_id={attempt_id}"
    
    try:
        # Forward the audio file to the evaluator
        files = {
            'file': (audio_file.name, audio_file.read(), audio_file.content_type or 'audio/webm')
        }
        
        logger.info(f"Forwarding audio to evaluator: {endpoint}")
        response = requests.post(endpoint, files=files, timeout=120)
        
        if response.status_code == 200:
            result = response.json()
            logger.info(f"Evaluation successful for part {part_num}")
            return Response(result)
        else:
            logger.error(f"Evaluator returned {response.status_code}: {response.text}")
            return Response(
                {'error': 'Evaluation failed', 'details': response.text},
                status=response.status_code
            )
            
    except requests.exceptions.ConnectionError:
        logger.error("Could not connect to AI Evaluator service")
        return Response(
            {'error': 'AI Evaluator service unavailable'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    except requests.exceptions.Timeout:
        logger.error("AI Evaluator request timed out")
        return Response(
            {'error': 'Evaluation timed out'},
            status=status.HTTP_504_GATEWAY_TIMEOUT
        )
    except Exception as e:
        logger.exception(f"Evaluation proxy error: {e}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

