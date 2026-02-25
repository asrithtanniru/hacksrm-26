import os
from datetime import timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

try:
    from livekit import api
except Exception as e:
    raise RuntimeError(
        "livekit package is required. Install with: pip install livekit-api"
    ) from e


class TokenRequest(BaseModel):
    room_name: str = Field(..., min_length=1)
    identity: str = Field(..., min_length=1)
    name: str | None = None
    metadata: str | None = None
    can_publish: bool = True
    can_subscribe: bool = True
    can_publish_data: bool = True
    ttl_minutes: int = Field(default=60, ge=1, le=1440)


token_router = APIRouter(prefix="/livekit", tags=["livekit"])


def _get_livekit_credentials() -> tuple[str, str]:
    api_key = os.getenv("LIVEKIT_API_KEY", "").strip()
    api_secret = os.getenv("LIVEKIT_API_SECRET", "").strip()

    if not api_key or not api_secret:
        raise HTTPException(
            status_code=500,
            detail="Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET in environment.",
        )

    return api_key, api_secret


@token_router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@token_router.post("/token")
def create_livekit_token(payload: TokenRequest) -> dict[str, str]:
    api_key, api_secret = _get_livekit_credentials()

    token_builder = (
        api.AccessToken(api_key=api_key, api_secret=api_secret)
        .with_identity(payload.identity)
        .with_name(payload.name or payload.identity)
        .with_ttl(timedelta(minutes=payload.ttl_minutes))
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=payload.room_name,
                can_publish=payload.can_publish,
                can_subscribe=payload.can_subscribe,
                can_publish_data=payload.can_publish_data,
            )
        )
    )

    if payload.metadata:
        token_builder = token_builder.with_metadata(payload.metadata)

    jwt_token = token_builder.to_jwt()
    return {"token": jwt_token}
