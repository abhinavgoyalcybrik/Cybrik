from pathlib import Path
import os
from datetime import timedelta
from dotenv import load_dotenv

try:
    import sentry_sdk
    SENTRY_AVAILABLE = True
except ImportError:
    SENTRY_AVAILABLE = False

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")
NGROK_HOST = os.environ.get("NGROK_HOST", "sauciest-westin-noniridescently.ngrok-free.dev")
if NGROK_HOST.startswith("https://"):
    NGROK_HOST = NGROK_HOST[8:]
elif NGROK_HOST.startswith("http://"):
    NGROK_HOST = NGROK_HOST[7:]

# --- Basic ---
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-secret-key")
# Dedicated secret for upload token signing (fallback if not set)
UPLOAD_TOKEN_SECRET = os.getenv("UPLOAD_TOKEN_SECRET", "default-upload-secret")
DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")
REPLIT_DOMAIN = os.getenv("REPLIT_DEV_DOMAIN", "")
RAILWAY_DOMAIN = os.getenv("RAILWAY_PUBLIC_DOMAIN", "")

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    "192.168.1.72",
    "0.0.0.0",
    "testserver",
    NGROK_HOST,
    "api.cybriksolutions.com",
]

if REPLIT_DOMAIN:
    ALLOWED_HOSTS.append(REPLIT_DOMAIN)

if RAILWAY_DOMAIN:
    ALLOWED_HOSTS.append(RAILWAY_DOMAIN)

# Also allow all Railway.app subdomains in production
if not DEBUG:
    ALLOWED_HOSTS.append(".railway.app")


# --- Database: SQLite for local dev, PostgreSQL for production ---
import dj_database_url

# Default to SQLite for local development
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}


# If DATABASE_URL is set (Railway/Replit/production), use PostgreSQL
if os.getenv("DATABASE_URL"):
    DATABASES["default"] = dj_database_url.config(
        default=os.getenv("DATABASE_URL")
    )



# --- Installed apps & middleware (keep same apps as your main settings) ---
INSTALLED_APPS = [
    "daphne",  # ASGI server for WebSockets
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "crm_app",
    "billing",  # Billing & subscription management
    "ielts_service",  # IELTS Preparation App
    "rest_framework",
    "corsheaders",
    'drf_spectacular',
    "rest_framework_simplejwt.token_blacklist",
    "channels",  # Django Channels for WebSockets
]

MIDDLEWARE = [
    "crm_app.middleware.DebugMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "crm_app.tenant_middleware.TenantMiddleware",  # Multi-tenant detection
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


ROOT_URLCONF = "CybricHQ.urls"
WSGI_APPLICATION = "CybricHQ.wsgi.application"
ASGI_APPLICATION = "CybricHQ.asgi.application"

# Channel layers for WebSocket support
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer"
    }
}

# --- Templates ---
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# --- Password validators (dev: keep defaults) ---
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "crm_app.authentication.JWTAuthFromCookie",
        "rest_framework.authentication.BasicAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.AllowAny",),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ),
    "DEFAULT_THROTTLE_RATES": {
            "lead_webhook": "10/minute",  # adjust as needed
            "anon": "100/day",
            "user": "1000/day",
        },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

# --- I18n & timezone ---
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
USE_TZ = True
DEV_FRONTEND_LAN = "http://192.168.1.72:5000"
FRONTEND_URL = os.getenv("FRONTEND_URL", os.getenv("APP_URL", "https://crm.cybriksolutions.com"))
if DEBUG:
    FRONTEND_URL = "http://localhost:3000"


# --- Static & Media (local) ---
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# --- Local storage backend explicitly set for dev (FileSystemStorage) ---
DEFAULT_FILE_STORAGE = "django.core.files.storage.FileSystemStorage"

# --- Celery: run tasks synchronously in-process for dev (no Redis required) ---
# When CELERY_TASK_ALWAYS_EAGER is True, celery tasks execute immediately (task.delay() runs sync)
# Default to False in production (so tasks go to queue), True in dev if configured
CELERY_TASK_ALWAYS_EAGER = os.getenv("CELERY_TASK_ALWAYS_EAGER", "False").lower() in ("true", "1", "yes")
CELERY_TASK_EAGER_PROPAGATES = True

# --- Simple caching for dev ---
CACHES = {
    "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "unique-snowflake"}
}

APPEND_SLASH = False
# --- CORS / CSRF for local frontend dev ---
CORS_ALLOW_CREDENTIALS = True

CORS_ALLOWED_ORIGINS = [
    "https://sauciest-westin-noniridescently.ngrok-free.dev",
    "https://cybrik-hq.vercel.app",
    "https://*.vercel.app",
    "http://localhost:3000",
    "http://localhost:5000",
    "http://192.168.1.72:5000",
    "https://api.cybriksolutions.com",
    "https://crm.cybriksolutions.com",
]
CORS_ALLOW_ALL_ORIGINS = True

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",  # admin-panel
    "http://localhost:5000",
    "http://192.168.1.72:5000",
    f"https://{NGROK_HOST}",
    "https://cybrik-hq.vercel.app",
    "https://*.vercel.app",
    "https://api.cybriksolutions.com",
]

USE_HTTPS_FOR_DEMO = os.environ.get("DJANGO_USE_HTTPS_DEMO", "1") == "1"
if USE_HTTPS_FOR_DEMO:
    SESSION_COOKIE_SAMESITE = "None"
    CSRF_COOKIE_SAMESITE = "None"
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
else:
    SESSION_COOKIE_SAMESITE = "Lax"
    CSRF_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False

# Trust the X-Forwarded-Proto header for determining if the request is secure (HTTPS)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
# USE_HTTPS_FOR_DEMO = True  <-- Removed to allow local dev without HTTPS 
# Reload trigger
CORS_EXPOSE_HEADERS = ["Set-Cookie"]

if REPLIT_DOMAIN:
    CORS_ALLOWED_ORIGINS.append(f"https://{REPLIT_DOMAIN}")
    CSRF_TRUSTED_ORIGINS.append(f"https://{REPLIT_DOMAIN}")
    # Add both -00- and -01- worker variants for Replit proxy failover
    domain_00 = REPLIT_DOMAIN.replace('-01-', '-00-')
    domain_01 = REPLIT_DOMAIN.replace('-00-', '-01-')
    if domain_00 != REPLIT_DOMAIN:
        CORS_ALLOWED_ORIGINS.append(f"https://{domain_00}")
        CSRF_TRUSTED_ORIGINS.append(f"https://{domain_00}")
    if domain_01 != REPLIT_DOMAIN:
        CORS_ALLOWED_ORIGINS.append(f"https://{domain_01}")
        CSRF_TRUSTED_ORIGINS.append(f"https://{domain_01}")

# --- Misc / feature flags (dev-friendly defaults) ---
VOICE_ENABLED = False
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "mock")

# --- Default auto field ---
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SPECTACULAR_SETTINGS = {
    "TITLE": "CybricHQ API",
    "DESCRIPTION": "API schema for CybricHQ backend (dev)",
    "VERSION": "1.0.0",
}

ELEVENLABS_BASE = os.environ.get("ELEVENLABS_BASE", "https://api.elevenlabs.io")
ELEVENLABS_OUTBOUND_PATH = os.environ.get("ELEVENLABS_OUTBOUND_PATH", "/v1/convai/twilio/outbound-call")
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
ELEVENLABS_AGENT_ID = os.environ.get("ELEVENLABS_AGENT_ID", "")
ELEVENLABS_POSTCALL_WEBHOOK = "https://sauciest-westin-noniridescently.ngrok-free.dev/api/webhooks/elevenlabs/postcall/" # os.environ.get("ELEVENLABS_POSTCALL_WEBHOOK", "")
ELEVENLABS_PHONE_ID = os.getenv("ELEVENLABS_PHONE_ID")
ELEVENLABS_WEBHOOK_SECRET = os.getenv("ELEVENLABS_WEBHOOK_SECRET", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "")  # Default: Sarah

# ====== Smartflo Configuration ======
SMARTFLO_API_BASE = os.getenv("SMARTFLO_API_BASE", "https://api.smartflo.tatatelebusiness.com")
SMARTFLO_API_KEY = os.getenv("SMARTFLO_API_KEY", "")
SMARTFLO_CALLER_ID = os.getenv("SMARTFLO_CALLER_ID", "")  # Your Smartflo DID number
SMARTFLO_AGENT_ID = os.getenv("SMARTFLO_AGENT_ID", "")  # Your Smartflo agent/extension ID
SMARTFLO_VOICEBOT_API_KEY = os.getenv("SMARTFLO_VOICEBOT_API_KEY", "")  # Voice Bot API key for AI outbound


EXTERNAL_BASE_URL = os.getenv("EXTERNAL_BASE_URL", "http://localhost:8000")
ASR_PROVIDER = os.getenv("ASR_PROVIDER", "mock")

SENTRY_DSN = os.environ.get("SENTRY_DSN", "")
if SENTRY_DSN and SENTRY_AVAILABLE:
    from sentry_sdk.integrations.django import DjangoIntegration
    sentry_sdk.init(dsn=SENTRY_DSN, integrations=[DjangoIntegration()], traces_sample_rate=0.0)



ACCESS_COOKIE_NAME = os.getenv("ACCESS_COOKIE_NAME", "cyb_access_v2")
REFRESH_COOKIE_NAME = os.getenv("REFRESH_COOKIE_NAME", "cyb_refresh_v2")

if USE_HTTPS_FOR_DEMO:
    COOKIE_SECURE = True
    COOKIE_SAMESITE = "None"
else:
    COOKIE_SECURE = os.getenv("COOKIE_SECURE", "False").lower() in ("1","true","yes")
    COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "Lax")


# ====== Billing & Stripe Configuration ======
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

# Company info for invoices
COMPANY_NAME = os.getenv("COMPANY_NAME", "CybrikHQ")
COMPANY_ADDRESS = os.getenv("COMPANY_ADDRESS", "")
COMPANY_EMAIL = os.getenv("COMPANY_EMAIL", "billing@cybrikhq.com")

# Admin email for billing alerts
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")


# ====== Celery Configuration ======
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"

# Celery Beat schedule for billing tasks
CELERY_BEAT_SCHEDULE = {
    "generate-invoices-daily": {
        "task": "billing.tasks.generate_invoices",
        "schedule": 86400.0,  # Daily (24 * 60 * 60 seconds)
    },
    "reconcile-payments-daily": {
        "task": "billing.tasks.reconcile_payments",
        "schedule": 86400.0,
    },
    "send-payment-reminders": {
        "task": "billing.tasks.send_payment_reminders",
        "schedule": 86400.0,
    },
    "cleanup-webhook-events": {
        "task": "billing.tasks.cleanup_old_webhook_events",
        "schedule": 604800.0,  # Weekly
    },
    # AI Follow-up call scheduler - checks every minute for due follow-ups
    "check-ai-followups": {
        "task": "crm_app.tasks.check_and_initiate_followups",
        "schedule": 60.0,  # Every minute
    },
}

