from contextlib import asynccontextmanager
import os

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .rewards_service import rewards_service
from .token_server import token_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles startup and shutdown events for the API."""
    # Startup code (if any) goes here
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(token_router)


@app.get("/debug/routes")
async def debug_routes():
    return {
        "routes": [
            {
                "path": route.path,
                "name": route.name,
                "methods": sorted(route.methods) if getattr(route, "methods", None) else [],
            }
            for route in app.routes
        ]
    }


class ChatMessage(BaseModel):
    message: str
    character_id: str | None = None
    philosopher_id: str | None = None


class ChallengeStartRequest(BaseModel):
    player_address: str
    room_name: str
    session_id: str


class NpcTalkRequest(BaseModel):
    player_address: str
    npc_id: str
    room_name: str
    engagement_ms: int = 0


class ClaimRequest(BaseModel):
    player_address: str
    room_name: str


class ForcePayoutRequest(BaseModel):
    player_address: str
    units: int = 1
    admin_token: str | None = None


def _resolve_character_id(
    character_id: str | None, philosopher_id: str | None
) -> str:
    if character_id:
        return character_id
    if philosopher_id:
        return philosopher_id
    raise HTTPException(
        status_code=400, detail="Missing required field: character_id"
    )


# @app.post("/chat")
# async def chat(chat_message: ChatMessage):
#     try:
#         charter_factory = PhilosopherFactory()
#         philosopher = charter_factory.get_philosopher(chat_message.philosopher_id)

#         response, _ = await get_response(
#             messages=chat_message.message,
#             philosopher_id=chat_message.philosopher_id,
#             philosopher_name=philosopher.name,
#             philosopher_perspective=philosopher.perspective,
#             philosopher_style=philosopher.style,
#             philosopher_context="",
#         )
#         return {"response": response}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_json()

            character_id = data.get("character_id") or data.get("philosopher_id")
            if "message" not in data or not character_id:
                await websocket.send_json(
                    {
                        "error": "Invalid message format. Required fields: 'message' and 'character_id'"
                    }
                )
                continue

            try:
                from agents.application.conversation_service.generate_response import (
                    get_streaming_response,
                )
                from agents.domain.philosopher_factory import PhilosopherFactory

                charter_factory = PhilosopherFactory()
                philosopher = charter_factory.get_character(character_id)

                # Use streaming response instead of get_response
                response_stream = get_streaming_response(
                    messages=data["message"],
                    philosopher_id=character_id,
                    philosopher_name=philosopher.name,
                    philosopher_perspective=philosopher.perspective,
                    philosopher_style=philosopher.style,
                    philosopher_context="",
                )

                # Send initial message to indicate streaming has started
                await websocket.send_json({"streaming": True})

                # Stream each chunk of the response
                full_response = ""
                async for chunk in response_stream:
                    full_response += chunk
                    await websocket.send_json({"chunk": chunk})

                await websocket.send_json(
                    {"response": full_response, "streaming": False}
                )

            except Exception as e:
                await websocket.send_json({"error": str(e)})

    except WebSocketDisconnect:
        pass


@app.post("/reset-memory")
async def reset_conversation():
    """Resets the conversation state. It deletes the two collections needed for keeping LangGraph state in MongoDB.

    Raises:
        HTTPException: If there is an error resetting the conversation state.
    Returns:
        dict: A dictionary containing the result of the reset operation.
    """
    try:
        from agents.application.conversation_service.reset_conversation import (
            reset_conversation_state,
        )

        result = await reset_conversation_state()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/game/challenge/start")
async def start_game_challenge(payload: ChallengeStartRequest):
    result = rewards_service.start_challenge_session(
        player_address=payload.player_address,
        room_name=payload.room_name,
        session_id=payload.session_id,
    )
    return {
        "ok": True,
        "challenge_started": result["challenge_started"],
        "txHash": result["txHash"],
        "progress": result["progress"],
        "contractAddress": os.getenv("GAME_CONTRACT_ADDRESS", "").strip(),
    }


@app.post("/game/challenge/npc-talk")
async def record_game_npc_talk(payload: NpcTalkRequest):
    result = rewards_service.record_npc_talk(
        player_address=payload.player_address,
        npc_id=payload.npc_id,
        room_name=payload.room_name,
        engagement_ms=payload.engagement_ms,
    )
    return {
        "ok": True,
        "accepted": result["accepted"],
        "txHash": result["txHash"],
        "autoPayoutTxHash": result.get("autoPayoutTxHash"),
        "progress": result["progress"],
        "contractAddress": os.getenv("GAME_CONTRACT_ADDRESS", "").strip(),
    }


@app.get("/game/challenge/progress")
async def get_game_challenge_progress(player_address: str):
    result = rewards_service.get_progress(player_address)
    result["contractAddress"] = os.getenv("GAME_CONTRACT_ADDRESS", "").strip()
    return result


@app.post("/game/challenge/claim")
async def claim_game_challenge_reward(payload: ClaimRequest):
    result = rewards_service.claim_reward(
        player_address=payload.player_address,
        room_name=payload.room_name,
    )
    return {"ok": True, **result}


@app.post("/game/admin/force-payout")
async def force_game_payout(payload: ForcePayoutRequest):
    required = os.getenv("DEMO_ADMIN_TOKEN", "").strip()
    if required and payload.admin_token != required:
        raise HTTPException(status_code=403, detail="Invalid admin token")
    result = rewards_service.force_payout(
        player_address=payload.player_address,
        units=payload.units,
    )
    return {"ok": True, **result}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
