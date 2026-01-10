from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET

@require_GET
def health(request):
    return JsonResponse({"status": "ok", "host": request.get_host()})

@ensure_csrf_cookie
def csrf_cookie(request):
    return JsonResponse({"detail": "csrf cookie set"})