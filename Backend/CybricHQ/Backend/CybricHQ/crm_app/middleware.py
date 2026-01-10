import logging
import os

logger = logging.getLogger(__name__)

DEBUG_MODE = os.environ.get('DEBUG', 'false').lower() == 'true'

class DebugMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if DEBUG_MODE:
            logger.debug(f"Request: {request.method} {request.path}")
        
        response = self.get_response(request)
        
        if response.status_code == 403 and DEBUG_MODE:
            logger.warning(f"403 Forbidden: {request.path}")
            
        return response
