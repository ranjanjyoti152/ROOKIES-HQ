import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken
from app.config import settings


def _derive_fernet_key(secret: str) -> bytes:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _get_fernet() -> Fernet:
    # If AI_ENCRYPTION_KEY is not set, we deterministically derive one from JWT_SECRET
    # so existing environments keep working without extra setup.
    root_secret = settings.AI_ENCRYPTION_KEY or settings.JWT_SECRET
    return Fernet(_derive_fernet_key(root_secret))


def encrypt_secret(value: str) -> str:
    return _get_fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(value: str) -> str:
    try:
        return _get_fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Unable to decrypt stored secret") from exc
