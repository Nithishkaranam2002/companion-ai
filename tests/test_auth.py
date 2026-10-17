import time

import jwt
import pytest

from api.auth import decode_token
from companion.config import Settings

SECRET = "test-secret-at-least-32-characters-long!!"


def token(**claims: object) -> str:
    base = {"sub": "u1", "aud": "authenticated", "exp": int(time.time()) + 600,
            "email": "a@b.com"}
    return jwt.encode({**base, **claims}, SECRET, algorithm="HS256")


def settings() -> Settings:
    return Settings(supabase_jwt_secret=SECRET, admin_emails="Admin@Example.com")


def test_valid_token() -> None:
    assert decode_token(token(), settings())["sub"] == "u1"


@pytest.mark.parametrize("claims", [{"exp": int(time.time()) - 10}, {"aud": "anon"}])
def test_rejects_expired_or_wrong_audience(claims: dict[str, object]) -> None:
    with pytest.raises(jwt.PyJWTError):
        decode_token(token(**claims), settings())


def test_rejects_wrong_secret() -> None:
    forged = jwt.encode({"sub": "x", "aud": "authenticated"}, "w" * 40, algorithm="HS256")
    with pytest.raises(jwt.PyJWTError):
        decode_token(forged, settings())


def test_rejects_unsigned_token() -> None:
    unsigned = jwt.encode({"sub": "x", "aud": "authenticated"}, None, algorithm="none")
    with pytest.raises(jwt.PyJWTError):
        decode_token(unsigned, settings())


def test_admin_emails_case_insensitive() -> None:
    assert "admin@example.com" in settings().admin_email_set
