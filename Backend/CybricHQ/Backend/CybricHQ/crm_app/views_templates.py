# crm_app/views_templates.py
"""
API views for managing message templates.
"""
import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from .models import MessageTemplate

logger = logging.getLogger(__name__)


def get_tenant_from_request(request):
    """Get tenant from request or user profile."""
    tenant = getattr(request, 'tenant', None)
    if not tenant and hasattr(request, 'user') and request.user.is_authenticated:
        if hasattr(request.user, 'profile') and request.user.profile:
            tenant = request.user.profile.tenant
    return tenant


class MessageTemplateListView(APIView):
    """
    GET: List all message templates
    POST: Create a new template
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        tenant = get_tenant_from_request(request)
        templates = MessageTemplate.objects.filter(tenant=tenant) if tenant else MessageTemplate.objects.all()
        
        # Filter by trigger if specified
        trigger = request.query_params.get('trigger')
        if trigger:
            templates = templates.filter(trigger=trigger)
        
        # Filter by active status
        active_only = request.query_params.get('active')
        if active_only == 'true':
            templates = templates.filter(is_active=True)
        
        data = [{
            'id': t.id,
            'name': t.name,
            'trigger': t.trigger,
            'trigger_display': t.get_trigger_display(),
            'channel': t.channel,
            'channel_display': t.get_channel_display(),
            'content': t.content,
            'is_active': t.is_active,
            'is_default': t.is_default,
            'created_at': t.created_at.isoformat(),
            'updated_at': t.updated_at.isoformat(),
        } for t in templates]
        
        return Response({
            'templates': data,
            'available_triggers': MessageTemplate.TRIGGER_CHOICES,
            'available_channels': MessageTemplate.CHANNEL_CHOICES,
            'available_variables': [
                {'key': 'name', 'description': 'Full name'},
                {'key': 'first_name', 'description': 'First name only'},
                {'key': 'application_id', 'description': 'Application reference number'},
                {'key': 'phone', 'description': 'Phone number'},
                {'key': 'upload_link', 'description': 'Document upload link'},
                {'key': 'call_date', 'description': 'Date of the call'},
            ]
        })
    
    def post(self, request):
        data = request.data
        
        # Validate required fields
        if not data.get('name') or not data.get('content'):
            return Response(
                {'error': 'name and content are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get tenant from user profile
        tenant = None
        if hasattr(request.user, 'profile') and request.user.profile:
            tenant = request.user.profile.tenant
        
        # If setting as default, unset other defaults for this trigger
        if data.get('is_default'):
            MessageTemplate.objects.filter(
                trigger=data.get('trigger', 'post_call'),
                tenant=tenant,
                is_default=True
            ).update(is_default=False)
        
        template = MessageTemplate.objects.create(
            tenant=tenant,
            name=data.get('name'),
            trigger=data.get('trigger', 'post_call'),
            channel=data.get('channel', 'whatsapp'),
            content=data.get('content'),
            is_active=data.get('is_active', True),
            is_default=data.get('is_default', False),
            created_by=request.user
        )
        
        return Response({
            'id': template.id,
            'name': template.name,
            'trigger': template.trigger,
            'content': template.content,
            'is_active': template.is_active,
            'is_default': template.is_default,
            'message': 'Template created successfully'
        }, status=status.HTTP_201_CREATED)


class MessageTemplateDetailView(APIView):
    """
    GET: Get single template
    PUT: Update template
    DELETE: Delete template
    """
    permission_classes = [IsAuthenticated]
    
    def get_template(self, request, pk):
        tenant = get_tenant_from_request(request)
        queryset = MessageTemplate.objects.filter(tenant=tenant) if tenant else MessageTemplate.objects.all()
        return get_object_or_404(queryset, pk=pk)
    
    def get(self, request, pk):
        template = self.get_template(request, pk)
        return Response({
            'id': template.id,
            'name': template.name,
            'trigger': template.trigger,
            'trigger_display': template.get_trigger_display(),
            'channel': template.channel,
            'channel_display': template.get_channel_display(),
            'content': template.content,
            'is_active': template.is_active,
            'is_default': template.is_default,
            'created_at': template.created_at.isoformat(),
            'updated_at': template.updated_at.isoformat(),
        })
    
    def put(self, request, pk):
        template = self.get_template(request, pk)
        data = request.data
        
        # Get tenant
        tenant = None
        if hasattr(request.user, 'profile') and request.user.profile:
            tenant = request.user.profile.tenant
        
        # If setting as default, unset other defaults
        if data.get('is_default') and not template.is_default:
            MessageTemplate.objects.filter(
                trigger=data.get('trigger', template.trigger),
                tenant=tenant,
                is_default=True
            ).exclude(pk=pk).update(is_default=False)
        
        # Update fields
        if 'name' in data:
            template.name = data['name']
        if 'trigger' in data:
            template.trigger = data['trigger']
        if 'channel' in data:
            template.channel = data['channel']
        if 'content' in data:
            template.content = data['content']
        if 'is_active' in data:
            template.is_active = data['is_active']
        if 'is_default' in data:
            template.is_default = data['is_default']
        
        template.save()
        
        return Response({
            'id': template.id,
            'name': template.name,
            'content': template.content,
            'is_active': template.is_active,
            'is_default': template.is_default,
            'message': 'Template updated successfully'
        })
    
    def delete(self, request, pk):
        template = self.get_template(request, pk)
        template_name = template.name
        template.delete()
        
        return Response({
            'message': f'Template "{template_name}" deleted successfully'
        })


class TemplatePreviewView(APIView):
    """
    POST: Preview a template with sample data
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        content = request.data.get('content', '')
        
        # Sample context for preview
        sample_context = {
            'name': 'John Smith',
            'first_name': 'John',
            'application_id': 'APP-12345',
            'phone': '+919876543210',
            'upload_link': 'https://yoursite.com/upload?id=12345',
            'call_date': 'December 23, 2024',
        }
        
        # Override with any provided context
        if request.data.get('context'):
            sample_context.update(request.data['context'])
        
        # Render template
        rendered = content
        for key, value in sample_context.items():
            placeholder = "{" + key + "}"
            rendered = rendered.replace(placeholder, str(value))
        
        return Response({
            'original': content,
            'rendered': rendered,
            'context': sample_context
        })


class TestSendTemplateView(APIView):
    """
    POST: Send a test message using a template
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        from .services.post_call_messaging import send_template_message
        
        phone = request.data.get('phone')
        if not phone:
            return Response(
                {'error': 'phone is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        tenant = get_tenant_from_request(request)
        queryset = MessageTemplate.objects.filter(tenant=tenant) if tenant else MessageTemplate.objects.all()
        template = get_object_or_404(queryset, pk=pk)
        
        # Get tenant
        tenant = None
        if hasattr(request.user, 'profile') and request.user.profile:
            tenant = request.user.profile.tenant
        
        # Build test context
        context = {
            'name': request.data.get('name', 'Test User'),
            'first_name': request.data.get('first_name', 'Test'),
            'application_id': 'TEST-12345',
            'phone': phone,
            'upload_link': 'https://yoursite.com/upload?test=true',
            'call_date': 'December 23, 2024',
        }
        
        # Override with custom context if provided
        if request.data.get('context'):
            context.update(request.data['context'])
        
        # Send message
        result = send_template_message(
            phone=phone,
            template_trigger=template.trigger,
            context=context,
            tenant=tenant
        )
        
        if result['success']:
            return Response({
                'success': True,
                'message': f'Test message sent to {phone}',
                'message_id': result.get('message_id')
            })
        else:
            return Response({
                'success': False,
                'error': result.get('error', 'Failed to send message')
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
