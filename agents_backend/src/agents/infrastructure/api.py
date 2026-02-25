from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from opik.integrations.langchain import OpikTracer
from pydantic import BaseModel

from agents.application.conversation_service.generate_response import (
    get_response,
    get_streaming_response,
)
from agents.application.conversation_service.reset_conversation import (
    reset_conversation_state,
)
from agents.domain.philosopher_factory import PhilosopherFactory
from agents.infrastructure.token_server import token_router

from .opik_utils import configure
from .token_server import token_router

configure()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles startup and shutdown events for the API."""
    # Startup code (if any) goes here
    yield
    # Shutdown code goes here
    opik_tracer = OpikTracer()
    opik_tracer.flush()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(token_router)


class ChatMessage(BaseModel):
    message: str
    character_id: str | None = None
    philosopher_id: str | None = None


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
#         opik_tracer = OpikTracer()
#         opik_tracer.flush()

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
                opik_tracer = OpikTracer()
                opik_tracer.flush()

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
        result = await reset_conversation_state()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
