# 🕵️ The Quite Protocol

This is a multiplayer detective-style simulation game powered by AI-driven NPCs and on-chain reward mechanics.

It combines:

- `game1` → Phaser-based pixel world (frontend)
- `agents_backend` → FastAPI backend (AI orchestration + reward validation)
- `game_contract` → Quai smart contract workspace (token payout logic)

The Quite Protocol is not just a game — it is a persistent AI interaction system with blockchain-backed incentives.

---

#  Core Concept

The Quite Protocol is a real-time multiplayer world where:

- NPCs are AI-powered agents
- Each agent has contextual awareness
- Conversations influence mission outcomes
- Social interaction unlocks rewards
- Rewards are validated and distributed on-chain

Players explore, investigate, interact, and build trust with AI agents to uncover narrative fragments and earn tokens.

Instead of combat-based gameplay, Mystverse rewards intelligence, curiosity, and engagement.

---

#  Key Features

##  AI-Powered NPCs
- Context-aware dialogue
- Stateful interactions
- Persistent agent identity
- Dynamic response generation
- Backend-validated interaction logic

## 🎮 Multiplayer Pixel World
- Built using Phaser
- Interactive NPC dialogue system
- Mission-driven detective exploration
- Real-time world environment

##  On-Chain Reward System
- Quai-based payout contract
- Backend-validated reward orchestration
- Smart contract-driven token distribution
- Transparent and verifiable payouts

##  Anti-Spam + Validation Logic
- Unique-agent interaction tracking
- Server-side reward verification
- Smart contract execution only after validation
- Protection against reward farming

---

#  High-Level Architecture

```
Player (Browser)
   ↓
Phaser Frontend (game1)
   ↓
FastAPI Backend (agents_backend)
   ↓
AI Agent Orchestration + Reward Logic
   ↓
Quai Smart Contract (game_contract)
```

### Flow Summary

1. Player interacts with an NPC.
2. Backend validates interaction eligibility.
3. Reward condition is calculated.
4. Contract call is triggered.
5. Tokens are distributed on-chain.

---

#  Repository Structure

```text
.
├── docker-compose.yml
├── agents_backend/
├── game1/
└── game_contract/
```

---

#  Preview

<img width="1600" height="1190" alt="image" src="https://github.com/user-attachments/assets/498e88a1-3e70-433d-8230-6daa3c37cd5b" />
<img width="1600" height="1185" alt="image" src="https://github.com/user-attachments/assets/4071cee6-589e-4f0d-bdde-f50ab3a87f6b" />
<img width="1600" height="1202" alt="image" src="https://github.com/user-attachments/assets/248b3658-bb37-454e-b6fa-227deba456cc" />
<img width="1600" height="1193" alt="image" src="https://github.com/user-attachments/assets/f1a19fd4-002a-4405-9f59-f5a1b545dc42" />

---

#  Prerequisites

- Docker
- Docker Compose
- Pelagus wallet (for browser wallet interaction)
- Quai testnet funds (for operator wallet)

---

#  Quick Start (Docker Compose)

##  Configure Environment Files

```bash
cp agents_backend/.env agents_backend/.env.local 2>/dev/null || true
cp game_contract/.env.example game_contract/.env 2>/dev/null || true
```

##  Start Backend + UI

```bash
docker compose up --build
```

##  Open in Browser

- UI → http://localhost:8080  
- Backend → http://localhost:8000  
- API Docs → http://localhost:8000/docs  

---

#  Docker Compose Commands

## Start

```bash
docker compose up --build
```

## Stop

```bash
docker compose down
```

## Follow Logs

```bash
docker compose logs -f backend
docker compose logs -f ui
```

## Rebuild One Service

```bash
docker compose build backend
docker compose up -d backend
```

---

# 📜 Smart Contract Commands (Via Docker Profile)

## Start Contract Tools Container

```bash
docker compose --profile tools up -d contract-tools
```

## Enter Container

```bash
docker compose --profile tools exec contract-tools bash
```

## Inside Container

```bash
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network cyprus1
```

---

#  Environment Notes

- Backend config → `agents_backend/.env`
- Contract config → `game_contract/.env`
- Frontend contract address is injected from backend responses
- Optional manual override via `GAME_CONTRACT_ADDRESS`

---

# 🛡 Security Best Practices

- Never commit private keys
- Use separate wallets for dev/testnet/production
- Restrict CORS before production deployment
- Rotate demo keys after hackathon
- Validate reward logic server-side before contract execution

---

# 📈 Scalability Design

- Backend supports horizontal scaling
- AI orchestration layer can be extracted into microservices
- Smart contract limits adjustable for gas optimization
- Event indexing can be added for analytics
- Reward rate tunable via contract parameters

---

#  Future Enhancements

- Persistent agent memory buckets
- Emotion-based NPC behavior modeling
- On-chain identity NFTs for agents
- DAO-governed world evolution
- Multi-zone world expansion
- Reputation-weighted reward multipliers
- Agent-to-agent interaction

---

# 🏆 Why This Matters

Most blockchain games add tokens to basic gameplay.

The Quite Protocol integrates:

- AI-driven interaction systems  
- Backend-validated reward logic  
- Smart contract payout enforcement  
- Multiplayer pixel world experience  

It demonstrates how:

- AI + Web3 can coexist meaningfully  
- On-chain rewards can be tied to behavior  
- Multiplayer worlds can integrate real economic logic  

Quite Protocol is a foundation for AI-integrated simulation economies.

---

# 👩‍💻 Built By

Team Jalebi Rabdi
{Praneeth, Asrith, Anurag, Muthu, Shivangi}

---

