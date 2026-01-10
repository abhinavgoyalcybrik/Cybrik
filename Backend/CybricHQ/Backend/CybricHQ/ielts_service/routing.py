"""
WebSocket URL routing for IELTS Speaking tests.
"""

from django.urls import re_path
from . import speaking_consumer

websocket_urlpatterns = [
    # IELTS Speaking real-time audio streaming endpoint
    re_path(
        r'ws/speaking/(?P<session_id>[0-9a-f-]+)/$',
        speaking_consumer.IELTSSpeakingConsumer.as_asgi()
    ),
]
