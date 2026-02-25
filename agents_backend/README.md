# Agents API

Check the [INSTALL_AND_USAGE.md](../INSTALL_AND_USAGE.md) file for instructions on how to install and use the API.

# 🔧 Utlity Commands

## Formatting

```
make format-check
make format-fix
```

## Linting

```bash
make lint-check
make lint-fix
```

## Tests

```bash
make test
```

## LiveKit Multi-Character Voice Agent

Use `tools/livekit_multi_character.py` to run one LiveKit session that dynamically switches between 5 NPC personas (and voice IDs) per turn.

UI control packets:
- Topic `active_agent`: `{"agent_name":"npc-guard"}`
- Topic `distance_update`: `{"distances":{"npc-guard":0.8,"npc-healer":2.1}}`

Only the active/nearest NPC persona will generate replies.
Transcripts are stored in `data/call_transcripts/<room>.jsonl`.

No-UI test mode:
- `NPC_TEST_ACTIVE_AGENT=npc-guard` forces one NPC as active speaker.
- `NPC_TEST_MODE=round_robin` rotates active speaker every user utterance.

Single-agent file from base snippet:
- `tools/my_agent.py`
