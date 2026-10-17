"""Supabase JWT verification (HS256 legacy secret or asymmetric JWKS signing keys)."""

from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from companion.config import Settings, get_settings

_bearer = HTTPBearer(auto_error=False)
ASYMMETRIC_ALGS = ("ES256", "RS256", "EdDSA")


@dataclass(frozen=True)
class User:
    id: str
    email: str | None
    is_anonymous: bool
    is_admin: bool


@lru_cache
def _jwks_client(supabase_url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json",
                           cache_keys=True, lifespan=3600)


def decode_token(token: str, settings: Settings) -> dict[str, object]:
    alg = jwt.get_unverified_header(token).get("alg")
    if alg == "HS256":
        if not settings.supabase_jwt_secret:
            raise jwt.InvalidTokenError("HS256 token but SUPABASE_JWT_SECRET is not set")
        key: object = settings.supabase_jwt_secret
    elif alg in ASYMMETRIC_ALGS and settings.supabase_url:
        key = _jwks_client(settings.supabase_url).get_signing_key_from_jwt(token).key
    else:
        raise jwt.InvalidTokenError(f"unsupported token algorithm {alg}")
    return jwt.decode(token, key, algorithms=[alg], audience="authenticated")


def current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in required")
    try:
        claims = decode_token(creds.credentials, settings)
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session") from exc
    email = str(claims.get("email") or "").lower() or None
    anonymous = bool(claims.get("is_anonymous", False))
    return User(id=str(claims["sub"]), email=email, is_anonymous=anonymous,
                is_admin=not anonymous and email in settings.admin_email_set)


def signed_in_user(user: Annotated[User, Depends(current_user)]) -> User:
    if user.is_anonymous:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Create a free account to use this")
    return user


def admin_user(user: Annotated[User, Depends(current_user)]) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admins only")
    return user
