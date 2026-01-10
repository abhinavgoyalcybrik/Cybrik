"""
Smartflo Outbound Call API

Initiates outbound calls to leads using Smartflo Click2Call API.
When the call connects, Smartflo streams audio to our WebSocket for AI handling.
"""

import requests
import logging
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings

from .models import Lead

logger = logging.getLogger(__name__)

# Smartflo API Configuration (add these to your .env)
SMARTFLO_API_BASE = getattr(settings, 'SMARTFLO_API_BASE', 'https://api.smartflo.tatatelebusiness.com')
SMARTFLO_API_KEY = getattr(settings, 'SMARTFLO_API_KEY', '')
SMARTFLO_CALLER_ID = getattr(settings, 'SMARTFLO_CALLER_ID', '')  # Your Smartflo DID number
SMARTFLO_AGENT_ID = getattr(settings, 'SMARTFLO_AGENT_ID', '')  # Your Smartflo agent ID
# Voice Bot API key - routes calls directly to WSS instead of agent phone
SMARTFLO_VOICEBOT_API_KEY = getattr(settings, 'SMARTFLO_VOICEBOT_API_KEY', '')


def build_lead_context(lead: Lead) -> dict:
    """
    Build comprehensive lead context for AI personalization.
    
    This data is passed to Smartflo custom_parameters and used by
    the WebSocket consumer to create personalized AI conversations.
    
    ElevenLabs Dynamic Variables Required:
    - name, preferredCountry, highestQualification, stream12th,
    - marksHighestQualification, yearCompletion, ieltsPteScores, counsellorName
    """
    # Extract first name for greeting
    full_name = lead.name or ''
    first_name = full_name.split()[0] if full_name else ''
    
    return {
        # Basic Info
        'lead_id': str(lead.id),
        'name': lead.name or 'there',  # "Hello there" if no name
        'first_name': first_name,
        'email': lead.email or '',
        'phone': lead.phone or '',
        
        # Location - maps to "preferredCountry" in ElevenLabs
        'city': lead.city or '',
        'country': lead.country or 'not specified',
        
        # Interest & Source
        'interested_service': lead.interested_service or 'study abroad services',
        'source': lead.source or 'website',
        'preferred_language': lead.preferred_language or 'English',
        
        # Qualification Details - maps to ElevenLabs variables
        'highest_qualification': lead.highest_qualification or '12th',  # Default: 12th
        'qualification_marks': lead.qualification_marks or '82%',  # Default: 82%
        'english_test_scores': lead.english_test_scores or 'IELTS 7.0 Overall',  # Default score
        
        # Additional ElevenLabs fields (from raw_payload or defaults)
        'stream12th': (lead.raw_payload or {}).get('stream12th', 'not specified'),
        'year_completion': (lead.raw_payload or {}).get('year_completion', 'not specified'),
        'counsellor_name': (lead.raw_payload or {}).get('counsellor_name', 'Jess'),  # Default: Jess
        
        # Message/Notes
        'message': lead.message or '',
        'status': lead.status or 'NEW',
        
        # Consent
        'consent_given': lead.consent_given,
        
        # Context summary for AI system prompt
        'ai_context': build_ai_context_prompt(lead),
    }


def build_ai_context_prompt(lead: Lead) -> str:
    """
    Build a structured context string for the AI system prompt.
    This helps GPT understand who it's talking to.
    """
    parts = []
    
    # Name
    name = lead.name or 'a prospective student'
    parts.append(f"You are speaking with {name}")
    
    # Location
    if lead.city or lead.country:
        location = f"{lead.city or ''}{', ' if lead.city and lead.country else ''}{lead.country or ''}"
        parts.append(f"from {location}")
    
    # Interest
    if lead.interested_service:
        parts.append(f"They are interested in: {lead.interested_service}")
    
    # Qualification
    if lead.highest_qualification:
        qual = lead.highest_qualification
        if lead.qualification_marks:
            qual += f" with {lead.qualification_marks}"
        parts.append(f"Their highest qualification: {qual}")
    
    # English scores
    if lead.english_test_scores:
        parts.append(f"English test scores: {lead.english_test_scores}")
    
    # Their message/query
    if lead.message:
        parts.append(f"Their query: {lead.message}")
    
    # Lead status
    parts.append(f"Current status: {lead.status or 'NEW'}")
    
    return ". ".join(parts) + "."


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def initiate_ai_call(request):
    """
    Initiate an AI-powered outbound call to a lead.
    
    Request body:
    {
        "lead_id": "uuid",  // OR
        "phone_number": "+919876543210",
        "context": "Follow up on study abroad inquiry"  // Optional extra context
    }
    """
    lead_id = request.data.get('lead_id')
    phone_number = request.data.get('phone_number')
    extra_context = request.data.get('context', '')
    
    lead = None
    lead_context = {}
    
    # Get lead data if lead_id provided
    if lead_id:
        try:
            lead = Lead.objects.get(id=lead_id)
            phone_number = lead.phone
            lead_context = build_lead_context(lead)
        except Lead.DoesNotExist:
            return Response(
                {'error': 'Lead not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    # If no lead_id, try to use ad-hoc context from request
    # All ElevenLabs dynamic variables with defaults matching agent config
    if not lead:
        lead_context = {
            'phone': phone_number,
            'name': request.data.get('name', 'Harpreet Singh'),  # Default name
            'first_name': request.data.get('first_name', 'Harpreet'),
            'email': request.data.get('email', ''),
            'city': request.data.get('city', ''),
            'country': request.data.get('country', 'Australia'),  # preferredCountry
            'interested_service': request.data.get('interested_service', 'study abroad'),
            'highest_qualification': request.data.get('highest_qualification', '12th'),  # Default
            'qualification_marks': request.data.get('qualification_marks', '82%'),  # marksHighestQualification
            'year_completion': request.data.get('year_completion', 'not specified'),  # yearCompletion
            'english_test_scores': request.data.get('english_test_scores', 'IELTS 7.0 Overall'),  # ieltsPteScores
            'stream12th': request.data.get('stream12th', 'not specified'),  # stream12th
            'counsellor_name': request.data.get('counsellor_name', 'Jess'),  # counsellorName
            'message': extra_context or request.data.get('message', ''),
        }

    # Clean phone number
    phone_number = phone_number.strip().replace(' ', '').replace('-', '').replace('+', '')
    
    # If 10 digits, add 91
    if len(phone_number) == 10:
        phone_number = '91' + phone_number
        
    # Validation
    if not phone_number.isdigit() or len(phone_number) < 10:
         return Response(
            {'error': 'Invalid phone number format'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check configuration
    if not SMARTFLO_API_KEY:
        return Response(
            {'error': 'Smartflo API not configured. Please set SMARTFLO_API_KEY in .env'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    try:
        # Get WebSocket URL for audio streaming
        ws_url = get_websocket_url(request)
        
        # Build custom parameters with full lead context
        custom_params = {
            **lead_context,  # All lead info
            'extra_context': extra_context,
            'user_id': str(request.user.id),
            'caller_name': request.user.get_full_name() or request.user.username,
        }
        
        # Call Smartflo Click2Call API
        response = initiate_smartflo_call(
            destination_number=phone_number,
            websocket_url=ws_url,
            custom_params=custom_params
        )
        
        if response.get('success'):
            logger.info(f"Call initiated to {phone_number} (Lead: {lead_context.get('name', 'N/A')}), call_sid: {response.get('call_sid')}")
            return Response({
                'success': True,
                'message': 'Call initiated successfully',
                'call_sid': response.get('call_sid'),
                'to_number': phone_number,
                'lead_name': lead_context.get('name', ''),
                'full_response': response.get('full_response')
            })
        else:
            return Response({
                'success': False,
                'error': response.get('error', 'Failed to initiate call')
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
    except Exception as e:
        logger.error(f"Error initiating call: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def get_websocket_url(request):
    """
    Construct the WebSocket URL for audio streaming based on the request host.
    """
    host = request.get_host()
    protocol = "wss" if request.is_secure() else "ws"
    
    # If using Ngrok (likely), we force WSS as modern browsers/APIs require secure websockets
    if "ngrok" in host:
        protocol = "wss"
        
    return f"{protocol}://{host}/ws/smartflo/audio/"


def initiate_smartflo_call(destination_number: str, websocket_url: str = None, custom_params: dict = None, tenant_settings=None):
    """
    Call Smartflo Click to Call Support API to initiate outbound Voice Bot call.
    Accepts optional tenant_settings to use tenant-specific credentials.
    """
    
    # Smartflo Click to Call Support API endpoint
    url = f"{SMARTFLO_API_BASE}/v1/click_to_call_support"
    
    # Default keys from env
    api_key = SMARTFLO_VOICEBOT_API_KEY or SMARTFLO_API_KEY
    
    # Override with tenant specific keys if available
    if tenant_settings:
        if getattr(tenant_settings, 'smartflo_voicebot_api_key', None):
            api_key = tenant_settings.smartflo_voicebot_api_key
        elif getattr(tenant_settings, 'smartflo_api_key', None):
            api_key = tenant_settings.smartflo_api_key
    
    headers = {
        'Content-Type': 'application/json'
    }
    
    # Payload for Click to Call Support API
    # The API key goes in the body, not the Authorization header
    payload = {
        'customer_number': destination_number,
        'api_key': api_key,
    }
    
    # Add optional parameters if needed
    if custom_params:
        # Custom fields can be passed for tracking via webhooks
        # Increase limit from 3 to 10 to allow rich context
        for i, (key, value) in enumerate(list(custom_params.items())[:10]):
            payload[f'custom_field_{i+1}'] = f"{key}:{value}"
    
    logger.info(f"Initiating Smartflo Voice Bot call to {destination_number}")
    logger.info(f"Using endpoint: {url}")
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            logger.info(f"Smartflo Response: {data}")
            return {
                'success': True,
                'call_sid': data.get('call_sid') or data.get('callSid') or data.get('id') or data.get('request_id') or data.get('ref_id'),
                'status': data.get('status', 'initiated'),
                'full_response': data
            }
        else:
            logger.error(f"Smartflo API error: {response.status_code} - {response.text}")
            return {
                'success': False,
                'error': f"Smartflo API error: {response.status_code} - {response.text}"
            }
            
    except requests.RequestException as e:
        logger.error(f"Smartflo request failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }


def get_websocket_url(request):
    """
    Get the public WebSocket URL for Smartflo to connect to.
    Uses the request host or configured external URL.
    """
    # Try to get from settings first
    external_url = getattr(settings, 'EXTERNAL_BASE_URL', '')
    
    if external_url:
        # Replace http with wss
        ws_url = external_url.replace('https://', 'wss://').replace('http://', 'ws://')
        return f"{ws_url}/ws/smartflo/audio/"
    
    # Fallback to request host
    host = request.get_host()
    scheme = 'wss' if request.is_secure() else 'ws'
    return f"{scheme}://{host}/ws/smartflo/audio/"


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def end_call(request):
    """
    End an active call.
    
    Request body:
    {
        "call_sid": "CAXXXXXX"
    }
    """
    call_sid = request.data.get('call_sid')
    
    if not call_sid:
        return Response(
            {'error': 'call_sid is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Call Smartflo API to end the call
        url = f"{SMARTFLO_API_BASE}/v1/calls/{call_sid}/end"
        headers = {
            'Authorization': f'Bearer {SMARTFLO_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        response = requests.post(url, headers=headers, timeout=10)
        logger.info(f"Call {call_sid} ended, response: {response.status_code}")
        
        return Response({
            'success': True,
            'message': 'Call ended'
        })
        
    except Exception as e:
        logger.error(f"Error ending call: {e}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_call_status(request, call_sid):
    """
    Get the status of a call from Smartflo.
    """
    try:
        # Call Smartflo API to get call status
        url = f"{SMARTFLO_API_BASE}/v1/calls/{call_sid}"
        headers = {
            'Authorization': f'Bearer {SMARTFLO_API_KEY}',
            'Content-Type': 'application/json'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            return Response({
                'call_sid': call_sid,
                'status': data.get('status', 'unknown'),
                'duration': data.get('duration'),
            })
        else:
            return Response({
                'call_sid': call_sid,
                'status': 'unknown',
                'error': f'Smartflo API returned {response.status_code}'
            })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([])  # Public endpoint for webhook
def dialplan_webhook(request):
    """
    Handle Smartflo API Dialplan Webhook.
    
    When a call is initiated (or received), Smartflo hits this endpoint to ask for instructions.
    Values passed by Smartflo:
    - uuid, call_to_number, caller_id_number, start_stamp, etc.
    """
    try:
        data = request.data
        logger.info(f"Smartflo Dialplan Webhook received: {data}")
        
        # Determine the WebSocket URL for audio streaming
        ws_url = get_websocket_url(request)
        
        # Connect instruction
        # Based on "Dynamic Endpoint" documentation, we need to return the WSS URL.
        # Smartflo expects a JSON with the URL to connect to.
        # Format often used: { "url": "wss://..." } or just the fields if it's a variable replacement.
        # However, for Dynamic Endpoint in Voice Bot, it expects the URL in the response.
        
        # Connect instruction
        # Since Tata support is configuring the WSS URL internally (Static Endpoint),
        # this webhook primarily serves as a status/logging endpoint for the call start.
        # We return a 200 OK to acknowledge the call event.
        
        response_payload = {
            "status": "success",
            "message": "Webhook received"
        }
        
        logger.info(f"Responding to Smartflo Dialplan with: {response_payload}")
        return Response(response_payload, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error handling dialplan webhook: {e}")
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

