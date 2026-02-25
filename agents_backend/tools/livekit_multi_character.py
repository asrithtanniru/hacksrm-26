from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from livekit import agents, rtc
from livekit.agents import Agent, AgentServer, AgentSession, room_io
from livekit.plugins import deepgram, elevenlabs, noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_ROOT / '.env.local')
load_dotenv(_ROOT / '.env')


@dataclass(frozen=True)
class CharacterConfig:
    agent_name: str
    display_name: str
    prompt: str
    voice: str


CHARACTERS: dict[str, CharacterConfig] = {
    'npc-blacksmith': CharacterConfig(
        agent_name='npc-blacksmith',
        display_name='Borin',
        voice='Rachel',
        prompt=(
            'You are Borin the blacksmith. You are practical, blunt, and kind. '
            'Keep responses short and spoken-style only.'
        ),
    ),
    'npc-scholar': CharacterConfig(
        agent_name='npc-scholar',
        display_name='Elyra',
        voice='Domi',
        prompt=(
            'You are Elyra the scholar. You are curious and precise. '
            'Speak clearly, in short lines, no formatting.'
        ),
    ),
    'npc-merchant': CharacterConfig(
        agent_name='npc-merchant',
        display_name='Kesh',
        voice='Adam',
        prompt=(
            'You are Kesh the merchant. You are friendly and persuasive. '
            'Use concise spoken replies without symbols or emoji.'
        ),
    ),
    'npc-guard': CharacterConfig(
        agent_name='npc-guard',
        display_name='Marda',
        voice='Antoni',
        prompt=(
            'You are Marda the guard captain. You are direct and protective. '
            'Keep responses short, practical, and voice-friendly.'
        ),
    ),
    'npc-healer': CharacterConfig(
        agent_name='npc-healer',
        display_name='Suri',
        voice='Bella',
        prompt=(
            'You are Suri the healer. You are warm and calm. '
            'Give concise voice replies without special formatting.'
        ),
    ),
}

DEFAULT_AGENT = 'npc-blacksmith'


class CharacterAgent(Agent):
    def __init__(self, character: CharacterConfig) -> None:
        super().__init__(instructions=character.prompt)


class RoomRouter:
    """Tracks active speaker per room from UI packets.

    Expected packet topics:
    - active_agent: {"agent_name": "npc-guard"}
    - distance_update: {"distances": {"npc-guard": 0.8, "npc-healer": 2.1}}
    """

    def __init__(self) -> None:
        self._active_by_room: dict[str, str] = {}
        self._rr_by_room: dict[str, int] = {}

    def active_agent(self, room_name: str) -> str:
        selected = self._active_by_room.get(room_name, DEFAULT_AGENT)
        if selected not in CHARACTERS:
            return DEFAULT_AGENT
        return selected

    def set_active_agent(self, room_name: str, agent_name: str) -> None:
        if agent_name in CHARACTERS:
            self._active_by_room[room_name] = agent_name

    def update_from_distances(self, room_name: str, distances: dict[str, float]) -> None:
        candidates = {k: v for k, v in distances.items() if k in CHARACTERS}
        if not candidates:
            return
        nearest_agent, _ = min(candidates.items(), key=lambda item: item[1])
        self._active_by_room[room_name] = nearest_agent

    def round_robin_next(self, room_name: str) -> str:
        keys = list(CHARACTERS.keys())
        index = self._rr_by_room.get(room_name, 0) % len(keys)
        agent_name = keys[index]
        self._rr_by_room[room_name] = (index + 1) % len(keys)
        self._active_by_room[room_name] = agent_name
        return agent_name


class TranscriptStore:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def append(self, room_name: str, payload: dict[str, Any]) -> None:
        ts = datetime.now(tz=timezone.utc).isoformat()
        path = self.root / f'{room_name}.jsonl'
        with path.open('a', encoding='utf-8') as f:
            f.write(json.dumps({'timestamp': ts, **payload}, ensure_ascii=True) + '\n')


router = RoomRouter()
transcripts = TranscriptStore(Path(__file__).resolve().parent.parent / 'data' / 'call_transcripts')
server = AgentServer()


def _extract_topic_and_payload(packet: Any) -> tuple[str, dict[str, Any]]:
    topic = getattr(packet, 'topic', '') or ''
    data_bytes = getattr(packet, 'data', b'')
    if not data_bytes:
        return topic, {}

    try:
        payload = json.loads(data_bytes.decode('utf-8'))
        if isinstance(payload, dict):
            return topic, payload
    except Exception:
        return topic, {}

    return topic, {}


def _apply_test_mode(room_name: str) -> None:
    forced = os.getenv('NPC_TEST_ACTIVE_AGENT')
    if forced in CHARACTERS:
        router.set_active_agent(room_name, forced)
        return

    if os.getenv('NPC_TEST_MODE', '').lower() == 'round_robin':
        router.round_robin_next(room_name)


def _build_reply_instructions(character: CharacterConfig) -> str:
    return (
        f'You are {character.display_name} ({character.agent_name}). '
        f'{character.prompt} '
        'Reply in one or two short spoken sentences.'
    )


@server.rtc_session()
async def npc_router(ctx: agents.JobContext):
    current = {'agent_name': DEFAULT_AGENT}
    default_character = CHARACTERS[DEFAULT_AGENT]

    session = AgentSession(
        stt=deepgram.STT(model='nova-3', language='en-US'),
        llm='openai/gpt-4.1-mini',
        tts=elevenlabs.TTS(voice_id="7DkaWvcqvBstUe3167oW", model='eleven_monolingual_v1'),
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )

    @ctx.room.on('data_received')
    def _on_data_received(packet: Any):
        topic, payload = _extract_topic_and_payload(packet)
        room_name = ctx.room.name

        if topic == 'active_agent':
            agent_name = str(payload.get('agent_name', ''))
            router.set_active_agent(room_name, agent_name)
        elif topic == 'distance_update':
            distances = payload.get('distances', {})
            if isinstance(distances, dict):
                numeric_distances = {
                    str(name): float(distance)
                    for name, distance in distances.items()
                    if isinstance(distance, (int, float))
                }
                router.update_from_distances(room_name, numeric_distances)

    @session.on('user_input_transcribed')
    def _on_user_input_transcribed(event: Any):
        transcript = getattr(event, 'transcript', '').strip()
        if not transcript:
            return

        _apply_test_mode(ctx.room.name)
        selected_name = router.active_agent(ctx.room.name)
        selected_character = CHARACTERS[selected_name]

        transcripts.append(
            ctx.room.name,
            {
                'type': 'user',
                'speaker': 'user',
                'active_character': selected_name,
                'text': transcript,
            },
        )

        if current['agent_name'] != selected_name:
            current['agent_name'] = selected_name
            session.update_agent(CharacterAgent(selected_character))
            if hasattr(session.tts, 'update_options'):
                session.tts.update_options(voice=selected_character.voice)

        session.generate_reply(instructions=_build_reply_instructions(selected_character))

    @session.on('agent_speech_committed')
    def _on_agent_speech_committed(message: Any):
        text = getattr(message, 'text', '').strip()
        if not text:
            return

        transcripts.append(
            ctx.room.name,
            {
                'type': 'agent',
                'speaker': current['agent_name'],
                'text': text,
            },
        )

    await session.start(
        room=ctx.room,
        agent=CharacterAgent(default_character),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: (
                    noise_cancellation.BVCTelephony()
                    if params.participant.kind
                    == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                    else noise_cancellation.BVC()
                ),
            ),
        ),
    )

    await session.generate_reply(
        instructions='Greet the user briefly and introduce yourself as the closest NPC.'
    )


if __name__ == '__main__':
    if os.getenv('LIVEKIT_URL') is None:
        raise RuntimeError('Missing LIVEKIT_URL in environment')
    agents.cli.run_app(server)
