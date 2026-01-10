
import base64
import logging
from django.conf import settings
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

def get_fernet():
    """Returns a Fernet instance using the platform master key."""
    key = getattr(settings, 'TENANT_MASTER_KEY', None)
    if not key:
        raise ValueError("TENANT_MASTER_KEY is not set in environment or settings.")
    # Ensure key is bytes
    if isinstance(key, str):
        key = key.encode('utf-8')
    return Fernet(key)

def encrypt_secret(secret_value):
    """Encrypts a string secret. Returns base64 string of encrypted bytes."""
    if not secret_value:
        return ""
    f = get_fernet()
    # Encrypt returns bytes
    encrypted = f.encrypt(secret_value.encode('utf-8'))
    # Helper: encode encrypted bytes to base64 string for storage
    return base64.b64encode(encrypted).decode('utf-8')

def decrypt_secret(encrypted_value):
    """Decrypts an encrypted string secret. Returns original string."""
    if not encrypted_value:
        return ""
    try:
        f = get_fernet()
        # Decode base64 string back to encrypted bytes
        encrypted_bytes = base64.b64decode(encrypted_value.encode('utf-8'))
        decrypted = f.decrypt(encrypted_bytes)
        return decrypted.decode('utf-8')
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        # In case of failure, we might return None or raise. Returning None is safer for now.
        return None
