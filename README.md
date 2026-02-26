# Mystverse

Mystverse is a multiplayer detective-style game experience with:

- `game1`: Phaser web client (pixel world, NPC interaction, mission UI)
- `agents_backend`: FastAPI backend (LiveKit control, reward orchestration APIs)
- `game_contract`: Quai smart contract workspace (reward payout contract + scripts)

Add your screenshots/gifs in the preview section below.

## Preview

<img width="1600" height="1190" alt="image" src="https://github.com/user-attachments/assets/498e88a1-3e70-433d-8230-6daa3c37cd5b" /> <img width="1600" height="1185" alt="image" src="https://github.com/user-attachments/assets/4071cee6-589e-4f0d-bdde-f50ab3a87f6b" />

<img width="1600" height="1202" alt="image" src="https://github.com/user-attachments/assets/248b3658-bb37-454e-b6fa-227deba456cc" /> <img width="1600" height="1193" alt="image" src="https://github.com/user-attachments/assets/f1a19fd4-002a-4405-9f59-f5a1b545dc42" />



## Repo Structure

```text
.
├── docker-compose.yml
├── agents_backend/
├── game1/
└── game_contract/
```

## Prerequisites

- Docker + Docker Compose
- Pelagus wallet (for browser wallet interactions)
- Quai testnet funds for owner/operator wallet

## Quick Start (Docker Compose)

1. Configure env files:

```bash
cp agents_backend/.env agents_backend/.env.local 2>/dev/null || true
cp game_contract/.env.example game_contract/.env 2>/dev/null || true
```

2. Start backend + UI:

```bash
docker compose up --build
```

3. Open:

- UI: `http://localhost:8080`
- Backend: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

## Docker Compose Commands

Start:

```bash
docker compose up --build
```

Stop:

```bash
docker compose down
```

Follow logs:

```bash
docker compose logs -f backend
docker compose logs -f ui
```

Rebuild one service:

```bash
docker compose build backend
docker compose up -d backend
```

## Contract Commands via Compose

Start contract tools container:

```bash
docker compose --profile tools up -d contract-tools
```

Enter container:

```bash
docker compose --profile tools exec contract-tools bash
```

Inside container:

```bash
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network cyprus1
```

## Environment Notes

- Backend runtime config: `agents_backend/.env`
- Contract config: `game_contract/.env`
- Frontend contract address is injected from backend responses, but you can still define `GAME_CONTRACT_ADDRESS` for explicit control.

## Production Checklist

- Use dedicated testnet/mainnet wallets (do not reuse dev keys)
- Restrict CORS origins in backend
- Rotate all private keys used during demos
- Disable demo fallback paths before production launch
