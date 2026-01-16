from django.core.signing import Signer, BadSignature
from django.conf import settings
import os

# Mock settings
if not settings.configured:
    settings.configure(SECRET_KEY=os.getenv("DJANGO_SECRET_KEY", "dev-secret-key"))

signer = Signer()
token = "83:7X_iCV3M3EQNYqNyXxj_fuv8K5Vji6Z-9VhOMCwWie0"

try:
    value = signer.unsign(token)
    print(f"SUCCESS: Token is valid for value: {value}")
except BadSignature:
    print("FAILURE: BadSignature")
