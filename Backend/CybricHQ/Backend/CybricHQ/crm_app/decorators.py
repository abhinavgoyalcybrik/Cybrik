# crm_app/decorators.py
from django.conf import settings
from django.http import HttpResponse

def require_webhook_token(view_func):
    """
    Require incoming header 'X-Webhook-Token' to equal ELEVENLABS_WEBHOOK_TOKEN.
    Also allow ?token=... for quick dev testing.
    """
    def _wrapped(request, *args, **kwargs):
        token = request.headers.get("X-Webhook-Token") or request.GET.get("token")
        expected = getattr(settings, "ELEVENLABS_WEBHOOK_TOKEN", None)
        if expected and token != expected:
            return HttpResponse("Invalid webhook token", status=401)
        return view_func(request, *args, **kwargs)
    return _wrapped
