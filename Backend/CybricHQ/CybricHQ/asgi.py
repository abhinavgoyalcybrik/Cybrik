"""
ASGI config for CybricHQ project with Django Channels WebSocket support.

Supports both HTTP and WebSocket connections for Smartflo audio streaming.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'CybricHQ.settings')

# Initialize Django ASGI application early to populate AppRegistry
django_asgi_app = get_asgi_application()

# Import after Django setup to avoid AppRegistryNotReady
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from crm_app.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(
            websocket_urlpatterns
        )
    ),
})
