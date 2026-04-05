"""
In-memory OTP store. No Redis required.
Each pending registration is stored until:
  - The OTP is verified (consumed), or
  - It expires (10 minutes).
"""
import random
import string
from datetime import datetime, timezone, timedelta
from typing import Optional

OTP_TTL_MINUTES = 10

# Structure: { email_lower: { "otp": str, "expires_at": datetime, "data": dict } }
_store: dict[str, dict] = {}


def generate_otp() -> str:
    """Generate a secure 6-digit numeric OTP."""
    return "".join(random.choices(string.digits, k=6))


def create_otp(email: str, registration_data: dict) -> str:
    """Store a new OTP for the given email, overwriting any previous one."""
    otp = generate_otp()
    _store[email.lower()] = {
        "otp": otp,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES),
        "data": registration_data,
    }
    return otp


def verify_otp(email: str, otp: str) -> Optional[dict]:
    """
    Verify OTP. Returns registration_data on success and removes the entry.
    Returns None if OTP is invalid or expired.
    """
    entry = _store.get(email.lower())
    if not entry:
        return None
    if datetime.now(timezone.utc) > entry["expires_at"]:
        _store.pop(email.lower(), None)
        return None
    if entry["otp"] != otp:
        return None
    # Consume it
    _store.pop(email.lower(), None)
    return entry["data"]


def has_pending(email: str) -> bool:
    """Check if there's a still-valid pending OTP for this email."""
    entry = _store.get(email.lower())
    if not entry:
        return False
    return datetime.now(timezone.utc) <= entry["expires_at"]
