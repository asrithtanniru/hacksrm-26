from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from dotenv import load_dotenv
from livekit import api
from livekit.api.twirp_client import TwirpError
from livekit.protocol.models import DataPacket
from livekit.protocol.room import ListRoomsRequest, SendDataRequest

_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_ROOT / '.env.local')
load_dotenv(_ROOT / '.env')


def _build_payload(args: argparse.Namespace) -> tuple[str, bytes]:
    if args.active_agent:
        topic = 'active_agent'
        payload = {'agent_name': args.active_agent}
        return topic, json.dumps(payload).encode('utf-8')

    if args.distances:
        topic = 'distance_update'
        payload = {'distances': json.loads(args.distances)}
        return topic, json.dumps(payload).encode('utf-8')

    raise ValueError('Either --active-agent or --distances is required')


async def _main() -> None:
    parser = argparse.ArgumentParser(description='Send room control data to LiveKit room')
    parser.add_argument('--room', help='LiveKit room name')
    parser.add_argument('--list-rooms', action='store_true', help='List active rooms and exit')
    parser.add_argument('--active-agent', help='Set active NPC, e.g. npc-guard')
    parser.add_argument(
        '--distances',
        help='JSON object, e.g. {"npc-guard":0.6,"npc-healer":2.1}',
    )
    args = parser.parse_args()

    async with api.LiveKitAPI() as lkapi:
        rooms_resp = await lkapi.room.list_rooms(ListRoomsRequest())
        room_names = [r.name for r in rooms_resp.rooms]

        if args.list_rooms:
            for room in room_names:
                print(room)
            return

        room_name = args.room
        if not room_name:
            if len(room_names) == 1:
                room_name = room_names[0]
            else:
                playground_rooms = [r for r in room_names if r.startswith('playground-')]
                if len(playground_rooms) == 1:
                    room_name = playground_rooms[0]

        if not room_name:
            raise SystemExit(
                'Room not provided and could not auto-detect uniquely. '
                'Use --room <name> or --list-rooms.'
            )

        topic, data = _build_payload(args)
        try:
            await lkapi.room.send_data(
                SendDataRequest(
                    room=room_name,
                    data=data,
                    kind=DataPacket.Kind.RELIABLE,
                    topic=topic,
                )
            )
        except TwirpError as err:
            if err.code == 'not_found':
                raise SystemExit(
                    f'Room "{room_name}" not found. Active rooms: {room_names}'
                ) from err
            raise

    print(f'Sent topic={topic} room={room_name} payload={data.decode("utf-8")}')


if __name__ == '__main__':
    asyncio.run(_main())
