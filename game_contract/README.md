# Quai Game Rewards Contract

This project contains the `QuaiGameRewards` smart contract and scripts for the full gameplay payout flow on Quai:

- 5-minute challenge window
- 9 NPC talks required to complete
- 3 reward points (3x3 complete) per challenge
- 1 reward unit claimable per completed challenge
- `0.1 QUAI` payout per reward unit by default

## Contract Gameplay Flow

1. Player starts challenge with `startChallenge()`.
2. Backend/game server (authorized operator) calls `recordNpcTalk(player)` for each NPC interaction.
3. At 9 talks within 5 minutes, challenge becomes complete and player gets 1 pending reward unit.
4. Player calls `redeemMyRewards()` to receive payout from contract treasury.

## Setup

```bash
cd game_contract
npm install
cp .env.example .env
```

Fill `.env` with your values.

## Environment Variables

Required for network calls:

- `RPC_URL` (Cyprus1 RPC endpoint)
- `CYPRUS1_PK` (owner/deployer private key)
- `CHAIN_ID` (Cyprus1 chain id, usually `15000`)
- `CONTRACT_ADDRESS` (after deployment)

Used by integration scripts:

- `SIGNER_PK` optional override signer key for player/operator actions
- `OPERATOR_ADDRESS` address to authorize with `setGameOperator`
- `PLAYER_ADDRESS` player address for `recordNpcTalk` / `getProgress`
- `AMOUNT` QUAI amount string for `fundContract` (example: `0.1`)
- `COUNT` number of NPC talks to record in one command (example: `9`)
- `ALLOWED` `true` or `false` for `setGameOperator`

## Commands

```bash
npm run compile
npm test
```

Deploy on Cyprus1:

```bash
npm run deploy:cyprus1
```

Then set `CONTRACT_ADDRESS` in `.env` and run:

```bash
npm run fund:cyprus1
npm run set-operator:cyprus1
npm run start:cyprus1
npm run record:cyprus1
npm run progress:cyprus1
npm run redeem:cyprus1
```

## Example End-to-End (Main Integration)

1. Deploy contract and copy address to `CONTRACT_ADDRESS`.
2. Fund contract treasury:
   - `AMOUNT=1 npm run fund:cyprus1`
3. Authorize backend operator:
   - `OPERATOR_ADDRESS=<backend_wallet> npm run set-operator:cyprus1`
4. Player starts challenge:
   - `SIGNER_PK=<player_pk> npm run start:cyprus1`
5. Backend records 9 NPC talks:
   - `SIGNER_PK=<backend_pk> PLAYER_ADDRESS=<player_wallet> COUNT=9 npm run record:cyprus1`
6. Check progress:
   - `PLAYER_ADDRESS=<player_wallet> npm run progress:cyprus1`
7. Player redeems:
   - `SIGNER_PK=<player_pk> npm run redeem:cyprus1`

## Scripts Added

- `scripts/deploy.js` deploys `QuaiGameRewards`
- `scripts/setOperator.js`
- `scripts/fundContract.js`
- `scripts/startChallenge.js`
- `scripts/recordNpcTalk.js`
- `scripts/getProgress.js`
- `scripts/redeemRewards.js`

## Notes

- Existing deployed contracts cannot be modified. New logic requires deploying this updated contract.
- Keep private keys in `.env` only. Never commit them.
