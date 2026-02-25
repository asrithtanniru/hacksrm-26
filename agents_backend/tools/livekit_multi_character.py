from __future__ import annotations

import json
import logging
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

_AGENT_INFO_PATH = _ROOT / 'src' / 'agents' / 'agent_info' / 'agent_info.json'
_DEFAULT_CHARACTER_TOKEN = os.getenv('NPC_DEFAULT_CHARACTER_TOKEN', 'common1').strip().lower()
# ElevenLabs LiveKit plugin expects voice_id, not voice name.
_DEFAULT_VOICE_ID = os.getenv('NPC_DEFAULT_VOICE_ID', '7DkaWvcqvBstUe3167oW').strip() or '7DkaWvcqvBstUe3167oW'
_AUTO_GREET = os.getenv('NPC_AUTO_GREET', 'false').strip().lower() == 'true'
_LOGGER_PATH = _ROOT / 'logs.log'


def _create_logger() -> logging.Logger:
    _LOGGER_PATH.parent.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger('quiet_protocol_multi_character')
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    logger.propagate = False

    handler = logging.FileHandler(_LOGGER_PATH, encoding='utf-8')
    formatter = logging.Formatter(
        fmt='%(asctime)s | %(levelname)s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    return logger


APP_LOGGER = _create_logger()


@dataclass(frozen=True)
class CharacterProfile:
    token: str
    name: str
    role: str
    agent_type: str
    access: str


def _load_character_profiles() -> dict[str, CharacterProfile]:
    with _AGENT_INFO_PATH.open('r', encoding='utf-8') as file:
        raw = json.load(file)

    profiles: dict[str, CharacterProfile] = {}
    for agent_type, entries in raw.items():
        for entry in entries:
            token = str(entry.get('id', '')).strip().lower()
            if not token:
                continue

            profiles[token] = CharacterProfile(
                token=token,
                name=str(entry.get('name', 'Unknown Character')).strip(),
                role=str(entry.get('role', '')).strip(),
                agent_type=str(agent_type),
                access=str(entry.get('access', 'N/A')),
            )

    return profiles


PROFILES = _load_character_profiles()
if _DEFAULT_CHARACTER_TOKEN not in PROFILES and PROFILES:
    _DEFAULT_CHARACTER_TOKEN = next(iter(PROFILES.keys()))


def _render_prompt(profile: CharacterProfile) -> str:
    return (
        f'You are now fully embodying {profile.name}. '\
        'This is a live high stakes role play and you must stay in character. '\
        f'Character ID: {profile.token}. '\
        f'Character Type: {profile.agent_type}. '\
        f'Access Level: {profile.access}. '\
        f'Core Character Profile: {profile.role} '\
        'Do not mention being AI. Keep replies concise spoken and immersive. '\
        'If a request is unsafe, refuse briefly in character and offer a safe alternative.'
    )


class CharacterAgent(Agent):
    def __init__(self, profile: CharacterProfile) -> None:
        super().__init__(instructions=_render_prompt(profile))


class TranscriptStore:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def append(self, room_name: str, payload: dict[str, Any]) -> None:
        ts = datetime.now(tz=timezone.utc).isoformat()
        path = self.root / f'{room_name}.jsonl'
        with path.open('a', encoding='utf-8') as f:
            f.write(json.dumps({'timestamp': ts, **payload}, ensure_ascii=True) + '\n')


def _parse_metadata(raw: str) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


def _resolve_profile(token: str | None) -> CharacterProfile:
    if token:
        key = token.strip().lower()
        if key in PROFILES:
            return PROFILES[key]
    return PROFILES[_DEFAULT_CHARACTER_TOKEN]


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


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {'1', 'true', 'yes', 'on'}
    if isinstance(value, (int, float)):
        return value != 0
    return False


transcripts = TranscriptStore(_ROOT / 'data' / 'call_transcripts')
server = AgentServer()


@server.rtc_session(agent_name='npc-router')
async def npc_router(ctx: agents.JobContext):
    if not PROFILES:
        raise RuntimeError(f'No character profiles found in {_AGENT_INFO_PATH}')

    metadata = _parse_metadata(getattr(ctx.job, 'metadata', ''))
    initial_profile = _resolve_profile(metadata.get('character_token'))
    state = {
        'token': initial_profile.token,
        'engaged': False,
        'locked_token': None,
        'pending_token': None,
    }

    session = AgentSession(
        stt=deepgram.STT(model='nova-3', language='en-US'),
        llm='openai/gpt-4.1-mini',
        tts=elevenlabs.TTS(voice_id=_DEFAULT_VOICE_ID, model='eleven_monolingual_v1'),
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )

    APP_LOGGER.info(
        "session_start room=%s job=%s initial_character=%s",
        getattr(ctx.room, 'name', 'unknown'),
        getattr(ctx.job, 'id', 'unknown'),
        initial_profile.token,
    )

    def _hard_stop_current_turn() -> None:
        # Prevent carry-over speech/transcript when disengaging or switching character.
        try:
            session.clear_user_turn()
        except Exception:
            APP_LOGGER.exception(
                "clear_user_turn_failed room=%s character=%s",
                getattr(ctx.room, 'name', 'unknown'),
                state.get('token'),
            )
        try:
            session.interrupt(force=True)
        except Exception:
            APP_LOGGER.exception(
                "interrupt_failed room=%s character=%s",
                getattr(ctx.room, 'name', 'unknown'),
                state.get('token'),
            )

    def _switch_profile(token: str) -> None:
        profile = _resolve_profile(token)
        if state['token'] == profile.token:
            APP_LOGGER.info(
                "switch_skipped_same_character room=%s character=%s",
                getattr(ctx.room, 'name', 'unknown'),
                profile.token,
            )
            return

        _hard_stop_current_turn()
        state['token'] = profile.token
        session.update_agent(CharacterAgent(profile))
        APP_LOGGER.info(
            "switch_profile room=%s character=%s",
            getattr(ctx.room, 'name', 'unknown'),
            profile.token,
        )

        if hasattr(session.tts, 'update_options'):
            session.tts.update_options(voice_id=_DEFAULT_VOICE_ID)

    def _set_engagement(engaged: bool, token: str | None = None) -> None:
        if engaged:
            if token and state['engaged'] and state['locked_token'] is not None:
                state['pending_token'] = token
            elif token:
                _switch_profile(token)
            state['engaged'] = True
            if state['locked_token'] is None:
                state['locked_token'] = state['token']
            APP_LOGGER.info(
                "engagement_on room=%s character=%s",
                getattr(ctx.room, 'name', 'unknown'),
                state.get('locked_token') or state.get('token'),
            )
            return

        _hard_stop_current_turn()
        state['engaged'] = False
        state['locked_token'] = None
        pending = state['pending_token']
        state['pending_token'] = None
        if pending:
            _switch_profile(pending)
        APP_LOGGER.info(
            "engagement_off room=%s next_pending=%s",
            getattr(ctx.room, 'name', 'unknown'),
            pending or '',
        )

    @ctx.room.on('data_received')
    def _on_data_received(packet: Any):
        topic, payload = _extract_topic_and_payload(packet)
        if topic == 'character_switch':
            token = str(payload.get('character_token', '')).strip().lower()
            if token:
                if state['engaged'] and state['locked_token'] is not None:
                    state['pending_token'] = token
                else:
                    _switch_profile(token)
        elif topic == 'character_engagement':
            engaged = _as_bool(payload.get('engaged', False))
            token = str(payload.get('character_token', '')).strip().lower() or None
            _set_engagement(engaged, token)

    @session.on('user_input_transcribed')
    def _on_user_input_transcribed(event: Any):
        if not getattr(event, 'is_final', True):
            return

        transcript = getattr(event, 'transcript', '').strip()
        if not transcript:
            return

        if not state['engaged']:
            transcripts.append(
                ctx.room.name,
                {
                    'type': 'user_ignored',
                    'speaker': 'user',
                    'active_character': state['token'],
                    'text': transcript,
                    'reason': 'not_engaged',
                },
            )
            return

        if state['locked_token'] is None:
            state['locked_token'] = state['token']

        active_token = str(state['locked_token'])
        transcripts.append(
            ctx.room.name,
            {
                'type': 'user',
                'speaker': 'user',
                'active_character': active_token,
                'text': transcript,
            },
        )

        profile = _resolve_profile(active_token)
        session.generate_reply(
            instructions=(
                f'You are {profile.name} ({profile.token}). '
                'Reply in one or two short spoken sentences.'
            )
        )

    @session.on('agent_speech_committed')
    def _on_agent_speech_committed(message: Any):
        text = getattr(message, 'text', '').strip()
        if not text:
            return

        transcripts.append(
            ctx.room.name,
            {
                'type': 'agent',
                'speaker': str(state['locked_token'] or state['token']),
                'text': text,
            },
        )

    await session.start(
        room=ctx.room,
        agent=CharacterAgent(initial_profile),
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

    if _AUTO_GREET:
        await session.generate_reply(
            instructions=(
                f'Greet the user briefly as {initial_profile.name} and offer help in character.'
            )
        )


if __name__ == '__main__':
    if os.getenv('LIVEKIT_URL') is None:
        raise RuntimeError('Missing LIVEKIT_URL in environment')
    agents.cli.run_app(server)
