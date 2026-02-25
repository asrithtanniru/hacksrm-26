from pathlib import Path

from dotenv import load_dotenv

from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io
from livekit.plugins import noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel
from livekit.plugins import groq,elevenlabs,deepgram

_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_ROOT / '.env.local')
load_dotenv(_ROOT / '.env')


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=(
                'You are a helpful voice AI assistant. '
                'You eagerly assist users with their questions by providing information '
                'from your extensive knowledge. '
                'Your responses are concise, to the point, and without any complex '
                'formatting or punctuation including emojis, asterisks, or other symbols. '
                'You are curious, friendly, and have a sense of humor.'
            ),
        )


server = AgentServer()


@server.rtc_session(agent_name='my-agent')
async def my_agent(ctx: agents.JobContext):
    session = AgentSession(
        stt=deepgram.STT(model='nova-3', language='en-US'),
        llm=groq.LLM(model='gpt-oss-120b'),
        tts=elevenlabs.TTS(voice='Rachel', model='eleven_monolingual_v1'),
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )

    await session.start(
        room=ctx.room,
        agent=Assistant(),
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

    await session.generate_reply(instructions='Greet the user and offer your assistance.')


if __name__ == '__main__':
    agents.cli.run_app(server)
