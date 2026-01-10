"""
WebSocket URL routing for CRM app.
"""

from django.urls import re_path
from . import smartflo_consumer

websocket_urlpatterns = [
    # Smartflo bi-directional audio streaming endpoint
    re_path(r'ws/smartflo/audio/$', smartflo_consumer.SmartfloAudioConsumer.as_asgi()),
]
