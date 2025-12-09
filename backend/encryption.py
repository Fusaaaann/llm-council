"""
Encryption module for LLM Council conversation storage.

Provides symmetric encryption (Fernet/AES-128) with extensible architecture
for future asymmetric encryption support.
"""

import json
import base64
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from cryptography.fernet import Fernet, InvalidToken

from backend.config import ENCRYPTION_ENABLED, ENCRYPTION_KEY


class EncryptionProvider(ABC):
    """Abstract base class for encryption providers."""

    @abstractmethod
    def encrypt(self, data: bytes) -> bytes:
        """Encrypt data and return ciphertext."""
        pass

    @abstractmethod
    def decrypt(self, ciphertext: bytes) -> bytes:
        """Decrypt ciphertext and return plaintext."""
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """Return the provider identifier."""
        pass


class FernetProvider(EncryptionProvider):
    """Symmetric encryption using Fernet (AES-128-CBC)."""

    def __init__(self, key: bytes):
        """
        Initialize Fernet provider with encryption key.

        Args:
            key: Base64-encoded Fernet key (32 bytes after decoding)

        Raises:
            ValueError: If key is invalid
        """
        try:
            self.fernet = Fernet(key)
        except Exception as e:
            raise ValueError(f"Invalid Fernet key: {e}")

    def encrypt(self, data: bytes) -> bytes:
        """Encrypt data using Fernet."""
        return self.fernet.encrypt(data)

    def decrypt(self, ciphertext: bytes) -> bytes:
        """Decrypt ciphertext using Fernet."""
        try:
            return self.fernet.decrypt(ciphertext)
        except InvalidToken:
            raise ValueError("Decryption failed: Invalid token or corrupted data")

    def get_provider_name(self) -> str:
        return "fernet"


class RSAProvider(EncryptionProvider):
    """
    Placeholder for future RSA (asymmetric) encryption support.

    Would use hybrid encryption: RSA for key wrapping + AES for data.
    NOT IMPLEMENTED in current version.
    """

    def __init__(self, public_key: bytes, private_key: Optional[bytes] = None):
        raise NotImplementedError("RSA provider not yet implemented")

    def encrypt(self, data: bytes) -> bytes:
        raise NotImplementedError("RSA provider not yet implemented")

    def decrypt(self, ciphertext: bytes) -> bytes:
        raise NotImplementedError("RSA provider not yet implemented")

    def get_provider_name(self) -> str:
        return "rsa"


# Module-level encryption utilities

def generate_fernet_key() -> bytes:
    """
    Generate a new Fernet encryption key.

    Returns:
        Base64-encoded key (44 bytes)
    """
    return Fernet.generate_key()


def validate_fernet_key(key: bytes) -> bool:
    """
    Validate a Fernet key format.

    Args:
        key: Base64-encoded key to validate

    Returns:
        True if key is valid, False otherwise
    """
    try:
        Fernet(key)
        return True
    except Exception:
        return False


def encrypt_data(data: Any, provider: EncryptionProvider) -> str:
    """
    Encrypt arbitrary data (dict/list/etc.) to base64 string.

    Args:
        data: Data to encrypt (must be JSON-serializable)
        provider: Encryption provider instance

    Returns:
        Base64-encoded ciphertext string

    Raises:
        ValueError: If data is not JSON-serializable
    """
    try:
        json_bytes = json.dumps(data).encode('utf-8')
    except (TypeError, ValueError) as e:
        raise ValueError(f"Data is not JSON-serializable: {e}")

    ciphertext = provider.encrypt(json_bytes)
    return base64.b64encode(ciphertext).decode('utf-8')


def decrypt_data(ciphertext_b64: str, provider: EncryptionProvider) -> Any:
    """
    Decrypt base64 ciphertext to original data structure.

    Args:
        ciphertext_b64: Base64-encoded ciphertext string
        provider: Encryption provider instance

    Returns:
        Decrypted data (dict/list/etc.)

    Raises:
        ValueError: If decryption fails or data is corrupted
    """
    try:
        ciphertext = base64.b64decode(ciphertext_b64)
    except Exception as e:
        raise ValueError(f"Invalid base64 encoding: {e}")

    plaintext = provider.decrypt(ciphertext)

    try:
        return json.loads(plaintext.decode('utf-8'))
    except (ValueError, UnicodeDecodeError) as e:
        raise ValueError(f"Decrypted data is not valid JSON: {e}")


def create_encryption_metadata(provider: EncryptionProvider) -> Dict[str, str]:
    """
    Create encryption metadata for storage.

    Args:
        provider: Encryption provider instance

    Returns:
        Dict with version and provider information
    """
    return {
        "version": "1.0",
        "provider": provider.get_provider_name()
    }


def is_encrypted(data: Dict) -> bool:
    """
    Check if conversation data is encrypted.

    Args:
        data: Conversation dictionary

    Returns:
        True if data has encryption metadata, False otherwise
    """
    return "_encryption" in data or "messages_encrypted" in data


def get_encryption_provider() -> Optional[FernetProvider]:
    """
    Get encryption provider if encryption is enabled.

    Returns:
        FernetProvider instance or None if encryption disabled
    """
    if not ENCRYPTION_ENABLED:
        return None

    if not ENCRYPTION_KEY:
        raise ValueError("ENCRYPTION_KEY not configured but encryption is enabled")

    return FernetProvider(ENCRYPTION_KEY.encode('utf-8'))
