import json
import os
from datetime import timedelta
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

try:
    from livekit import api
    from livekit.api.twirp_client import TwirpError
    from livekit.protocol.agent_dispatch import CreateAgentDispatchRequest
    from livekit.protocol.models import DataPacket
    from livekit.protocol.room import (
        CreateRoomRequest,
        DeleteRoomRequest,
        ListRoomsRequest,
        SendDataRequest,
    )
except Exception as e:
    raise RuntimeError(
        "livekit package is required. Install with: pip install livekit-api"
    ) from e


_AGENT_INFO_PATH = Path(__file__).resolve().parents[1] / "agent_info" / "agent_info.json"
_BACKEND_ROOT = Path(__file__).resolve().parents[3]

load_dotenv(_BACKEND_ROOT / ".env.local")
load_dotenv(_BACKEND_ROOT / ".env")


def _load_characters() -> dict[str, dict[str, Any]]:
    with _AGENT_INFO_PATH.open("r", encoding="utf-8") as file:
        data = json.load(file)

    characters: dict[str, dict[str, Any]] = {}
    for agent_type, entries in data.items():
        for entry in entries:
            token = str(entry.get("id", "")).strip()
            if not token:
                continue
            characters[token.lower()] = {"agent_type": agent_type, **entry}

    return characters


def _resolve_character_token(character_token: str) -> str:
    token = character_token.strip().lower()
    if not token:
        raise HTTPException(status_code=400, detail="character_token is required")

    characters = _load_characters()
    if token not in characters:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown character_token '{character_token}'",
        )

    return token


class TokenRequest(BaseModel):
    room_name: str = Field(..., min_length=1)
    identity: str = Field(..., min_length=1)
    name: str | None = None
    metadata: str | None = None
    can_publish: bool = True
    can_subscribe: bool = True
    can_publish_data: bool = True
    ttl_minutes: int = Field(default=60, ge=1, le=1440)


class CharacterLaunchRequest(BaseModel):
    room_name: str = Field(..., min_length=1)
    character_token: str = Field(..., min_length=1)
    agent_name: str = Field(default="npc-router", min_length=1)
    replace_existing_dispatches: bool = True
    user_identity: str | None = None
    user_name: str | None = None
    ttl_minutes: int = Field(default=60, ge=1, le=1440)


class CharacterSwitchRequest(BaseModel):
    room_name: str = Field(..., min_length=1)
    character_token: str = Field(..., min_length=1)
    mode: Literal["signal", "redispatch"] = "signal"
    agent_name: str = Field(default="npc-router", min_length=1)
    replace_existing_dispatches: bool = True


class CharacterEndRequest(BaseModel):
    room_name: str = Field(..., min_length=1)
    dispatch_id: str | None = None
    close_room: bool = False


class CharacterEngagementRequest(BaseModel):
    room_name: str = Field(..., min_length=1)
    engaged: bool
    character_token: str | None = None


token_router = APIRouter(prefix="/livekit", tags=["livekit"])


def _get_livekit_credentials() -> tuple[str, str]:
    _get_livekit_server_url()
    api_key = os.getenv("LIVEKIT_API_KEY", "").strip()
    api_secret = os.getenv("LIVEKIT_API_SECRET", "").strip()

    if not api_key or not api_secret:
        raise HTTPException(
            status_code=500,
            detail="Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET in environment.",
        )

    return api_key, api_secret


def _get_livekit_server_url() -> str:
    livekit_url = os.getenv("LIVEKIT_URL", "").strip()
    if not livekit_url:
        raise HTTPException(
            status_code=500,
            detail="Missing LIVEKIT_URL in environment.",
        )
    return livekit_url


def _create_livekit_api() -> api.LiveKitAPI:
    livekit_url = _get_livekit_server_url()
    api_key, api_secret = _get_livekit_credentials()
    return api.LiveKitAPI(
        url=livekit_url,
        api_key=api_key,
        api_secret=api_secret,
    )


async def _ensure_room_exists(lkapi: api.LiveKitAPI, room_name: str) -> None:
    rooms = await lkapi.room.list_rooms(ListRoomsRequest(names=[room_name]))
    if rooms.rooms:
        return

    try:
        await lkapi.room.create_room(CreateRoomRequest(name=room_name))
    except TwirpError as err:
        if err.code != "already_exists":
            raise


def _build_join_token(
    *,
    room_name: str,
    identity: str,
    name: str | None,
    metadata: str | None,
    ttl_minutes: int,
) -> str:
    api_key, api_secret = _get_livekit_credentials()
    token_builder = (
        api.AccessToken(api_key=api_key, api_secret=api_secret)
        .with_identity(identity)
        .with_name(name or identity)
        .with_ttl(timedelta(minutes=ttl_minutes))
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
            )
        )
    )

    if metadata:
        token_builder = token_builder.with_metadata(metadata)

    return token_builder.to_jwt()


@token_router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@token_router.get("/characters")
def list_characters() -> dict[str, list[dict[str, str]]]:
    characters = _load_characters()
    items = [
        {
            "character_token": token,
            "name": str(data.get("name", "Unknown")),
            "agent_type": str(data.get("agent_type", "unknown")),
        }
        for token, data in characters.items()
    ]
    items.sort(key=lambda x: x["character_token"])
    return {"characters": items}


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


@token_router.post("/character/launch")
async def launch_character(payload: CharacterLaunchRequest) -> dict[str, Any]:
    character_token = _resolve_character_token(payload.character_token)
    dispatch_metadata = json.dumps({"character_token": character_token}, ensure_ascii=True)

    async with _create_livekit_api() as lkapi:
        await _ensure_room_exists(lkapi, payload.room_name)

        if payload.replace_existing_dispatches:
            existing = await lkapi.agent_dispatch.list_dispatch(payload.room_name)
            for dispatch in existing:
                await lkapi.agent_dispatch.delete_dispatch(
                    dispatch_id=dispatch.id,
                    room_name=payload.room_name,
                )

        dispatch = await lkapi.agent_dispatch.create_dispatch(
            CreateAgentDispatchRequest(
                agent_name=payload.agent_name,
                room=payload.room_name,
                metadata=dispatch_metadata,
            )
        )

    response: dict[str, Any] = {
        "room_name": payload.room_name,
        "dispatch_id": dispatch.id,
        "agent_name": payload.agent_name,
        "character_token": character_token,
    }

    if payload.user_identity:
        response["user_token"] = _build_join_token(
            room_name=payload.room_name,
            identity=payload.user_identity,
            name=payload.user_name,
            metadata=json.dumps({"character_token": character_token}, ensure_ascii=True),
            ttl_minutes=payload.ttl_minutes,
        )

    return response


@token_router.post("/character/switch")
async def switch_character(payload: CharacterSwitchRequest) -> dict[str, Any]:
    character_token = _resolve_character_token(payload.character_token)

    async with _create_livekit_api() as lkapi:
        if payload.mode == "redispatch":
            if payload.replace_existing_dispatches:
                existing = await lkapi.agent_dispatch.list_dispatch(payload.room_name)
                for dispatch in existing:
                    await lkapi.agent_dispatch.delete_dispatch(
                        dispatch_id=dispatch.id,
                        room_name=payload.room_name,
                    )

            dispatch = await lkapi.agent_dispatch.create_dispatch(
                CreateAgentDispatchRequest(
                    agent_name=payload.agent_name,
                    room=payload.room_name,
                    metadata=json.dumps(
                        {"character_token": character_token},
                        ensure_ascii=True,
                    ),
                )
            )
            return {
                "mode": payload.mode,
                "room_name": payload.room_name,
                "dispatch_id": dispatch.id,
                "character_token": character_token,
            }

        try:
            await lkapi.room.send_data(
                SendDataRequest(
                    room=payload.room_name,
                    data=json.dumps(
                        {"character_token": character_token},
                        ensure_ascii=True,
                    ).encode("utf-8"),
                    kind=DataPacket.Kind.RELIABLE,
                    topic="character_switch",
                )
            )
        except TwirpError as err:
            if err.code == "not_found":
                raise HTTPException(
                    status_code=404,
                    detail=f"Room '{payload.room_name}' does not exist",
                ) from err
            raise

    return {
        "mode": payload.mode,
        "room_name": payload.room_name,
        "character_token": character_token,
    }


@token_router.post("/character/end")
async def end_character(payload: CharacterEndRequest) -> dict[str, Any]:
    deleted_dispatches = 0

    async with _create_livekit_api() as lkapi:
        if payload.dispatch_id:
            await lkapi.agent_dispatch.delete_dispatch(
                dispatch_id=payload.dispatch_id,
                room_name=payload.room_name,
            )
            deleted_dispatches = 1
        else:
            dispatches = await lkapi.agent_dispatch.list_dispatch(payload.room_name)
            for dispatch in dispatches:
                await lkapi.agent_dispatch.delete_dispatch(
                    dispatch_id=dispatch.id,
                    room_name=payload.room_name,
                )
                deleted_dispatches += 1

        room_closed = False
        if payload.close_room:
            try:
                await lkapi.room.delete_room(DeleteRoomRequest(room=payload.room_name))
                room_closed = True
            except TwirpError as err:
                if err.code != "not_found":
                    raise

    return {
        "room_name": payload.room_name,
        "deleted_dispatches": deleted_dispatches,
        "room_closed": room_closed,
    }


@token_router.post("/character/engagement")
async def set_character_engagement(
    payload: CharacterEngagementRequest,
) -> dict[str, Any]:
    character_token: str | None = None
    if payload.character_token is not None:
        character_token = _resolve_character_token(payload.character_token)

    packet = {"engaged": payload.engaged}
    if character_token is not None:
        packet["character_token"] = character_token

    async with _create_livekit_api() as lkapi:
        try:
            await lkapi.room.send_data(
                SendDataRequest(
                    room=payload.room_name,
                    data=json.dumps(packet, ensure_ascii=True).encode("utf-8"),
                    kind=DataPacket.Kind.RELIABLE,
                    topic="character_engagement",
                )
            )
        except TwirpError as err:
            if err.code == "not_found":
                raise HTTPException(
                    status_code=404,
                    detail=f"Room '{payload.room_name}' does not exist",
                ) from err
            raise

    return {
        "room_name": payload.room_name,
        "engaged": payload.engaged,
        "character_token": character_token,
    }
