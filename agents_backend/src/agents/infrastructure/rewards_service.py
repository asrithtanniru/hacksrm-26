from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass, field
from typing import Any

from fastapi import HTTPException

try:
    from web3 import Web3
except Exception as exc:  # pragma: no cover
    Web3 = None
    _IMPORT_ERROR = exc
else:
    _IMPORT_ERROR = None


_CONTRACT_ABI: list[dict[str, Any]] = [
    {
        "inputs": [{"internalType": "address", "name": "player", "type": "address"}],
        "name": "startChallengeFor",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "address", "name": "player", "type": "address"}],
        "name": "recordNpcTalk",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "address", "name": "player", "type": "address"}],
        "name": "getPlayerProgress",
        "outputs": [
            {"internalType": "uint256", "name": "challengeStartedAt", "type": "uint256"},
            {"internalType": "uint256", "name": "challengeEndsAt", "type": "uint256"},
            {"internalType": "uint256", "name": "npcTalks", "type": "uint256"},
            {"internalType": "uint256", "name": "rewardPoints", "type": "uint256"},
            {"internalType": "bool", "name": "completed", "type": "bool"},
            {"internalType": "bool", "name": "expired", "type": "bool"},
            {"internalType": "uint256", "name": "claimableUnits", "type": "uint256"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "address", "name": "player", "type": "address"},
            {"internalType": "uint256", "name": "units", "type": "uint256"},
            {"internalType": "bytes32", "name": "rewardId", "type": "bytes32"},
        ],
        "name": "rewardPlayer",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]


@dataclass
class ChallengeSession:
    player_address: str
    room_name: str
    session_id: str
    started_at_unix: int
    seen_npc_ids: set[str] = field(default_factory=set)
    auto_paid: bool = False


class RewardsService:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._sessions_by_player: dict[str, ChallengeSession] = {}

    @staticmethod
    def _require_web3() -> Any:
        if Web3 is None:
            raise HTTPException(
                status_code=500,
                detail=f"web3 dependency is missing: {_IMPORT_ERROR}",
            )
        return Web3

    @staticmethod
    def _get_env(name: str, fallback: str | None = None) -> str:
        value = os.getenv(name, fallback or "").strip()
        if not value:
            raise HTTPException(status_code=500, detail=f"Missing environment variable: {name}")
        return value

    def _get_w3(self) -> Any:
        web3_cls = self._require_web3()
        rpc_url = self._get_env("QUAI_RPC_URL", os.getenv("RPC_URL"))
        provider = web3_cls.HTTPProvider(rpc_url)
        w3 = web3_cls(provider)
        if not w3.is_connected():
            raise HTTPException(status_code=500, detail="Unable to connect to QUAI RPC")
        return w3

    def _get_contract(self, w3: Any) -> Any:
        contract_address = self._get_env("GAME_CONTRACT_ADDRESS")
        if not w3.is_address(contract_address):
            raise HTTPException(status_code=500, detail="Invalid GAME_CONTRACT_ADDRESS")
        checksum = w3.to_checksum_address(contract_address)
        return w3.eth.contract(address=checksum, abi=_CONTRACT_ABI)

    def _get_operator_account(self, w3: Any) -> Any:
        private_key = self._get_env("GAME_OPERATOR_PK")
        if not private_key.startswith("0x"):
            private_key = f"0x{private_key}"
        return w3.eth.account.from_key(private_key)

    def _get_owner_account(self, w3: Any) -> Any:
        private_key = os.getenv("GAME_OWNER_PK", "").strip() or self._get_env("GAME_OPERATOR_PK")
        if not private_key.startswith("0x"):
            private_key = f"0x{private_key}"
        return w3.eth.account.from_key(private_key)

    def _fetch_progress(self, player_address: str) -> dict[str, Any]:
        w3 = self._get_w3()
        if not w3.is_address(player_address):
            raise HTTPException(status_code=400, detail="Invalid player_address")
        contract = self._get_contract(w3)
        checksum_player = w3.to_checksum_address(player_address)
        result = contract.functions.getPlayerProgress(checksum_player).call()
        return {
            "challengeStartedAt": int(result[0]),
            "challengeEndsAt": int(result[1]),
            "npcTalks": int(result[2]),
            "rewardPoints": int(result[3]),
            "completed": bool(result[4]),
            "expired": bool(result[5]),
            "claimableUnits": int(result[6]),
        }

    def _record_npc_talk_onchain(self, player_address: str) -> str:
        w3 = self._get_w3()
        if not w3.is_address(player_address):
            raise HTTPException(status_code=400, detail="Invalid player_address")
        contract = self._get_contract(w3)
        operator = self._get_operator_account(w3)
        player_checksum = w3.to_checksum_address(player_address)

        nonce = w3.eth.get_transaction_count(operator.address, "pending")
        gas_price = w3.eth.gas_price
        chain_id_env = os.getenv("GAME_CHAIN_ID", "").strip() or os.getenv("CHAIN_ID", "").strip()
        chain_id = int(chain_id_env) if chain_id_env else w3.eth.chain_id

        tx = contract.functions.recordNpcTalk(player_checksum).build_transaction(
            {
                "from": operator.address,
                "nonce": nonce,
                "chainId": chain_id,
                "gasPrice": gas_price,
            }
        )

        try:
            estimated_gas = w3.eth.estimate_gas(tx)
        except Exception:
            estimated_gas = 220000
        tx["gas"] = int(estimated_gas * 1.2)

        signed = operator.sign_transaction(tx)
        raw_tx = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction", None)
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        return tx_hash.hex()

    def _start_challenge_for_onchain(self, player_address: str) -> str:
        w3 = self._get_w3()
        if not w3.is_address(player_address):
            raise HTTPException(status_code=400, detail="Invalid player_address")
        contract = self._get_contract(w3)
        operator = self._get_operator_account(w3)
        player_checksum = w3.to_checksum_address(player_address)

        nonce = w3.eth.get_transaction_count(operator.address, "pending")
        gas_price = w3.eth.gas_price
        chain_id_env = os.getenv("GAME_CHAIN_ID", "").strip() or os.getenv("CHAIN_ID", "").strip()
        chain_id = int(chain_id_env) if chain_id_env else w3.eth.chain_id

        tx = contract.functions.startChallengeFor(player_checksum).build_transaction(
            {
                "from": operator.address,
                "nonce": nonce,
                "chainId": chain_id,
                "gasPrice": gas_price,
            }
        )

        try:
            estimated_gas = w3.eth.estimate_gas(tx)
        except Exception:
            estimated_gas = 220000
        tx["gas"] = int(estimated_gas * 1.2)

        signed = operator.sign_transaction(tx)
        raw_tx = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction", None)
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        return tx_hash.hex()

    def _reward_player_onchain(self, player_address: str, units: int, reward_id_hex: str) -> str:
        w3 = self._get_w3()
        if not w3.is_address(player_address):
            raise HTTPException(status_code=400, detail="Invalid player_address")
        contract = self._get_contract(w3)
        owner = self._get_owner_account(w3)
        player_checksum = w3.to_checksum_address(player_address)

        nonce = w3.eth.get_transaction_count(owner.address, "pending")
        gas_price = w3.eth.gas_price
        chain_id_env = os.getenv("GAME_CHAIN_ID", "").strip() or os.getenv("CHAIN_ID", "").strip()
        chain_id = int(chain_id_env) if chain_id_env else w3.eth.chain_id

        tx = contract.functions.rewardPlayer(player_checksum, int(units), reward_id_hex).build_transaction(
            {
                "from": owner.address,
                "nonce": nonce,
                "chainId": chain_id,
                "gasPrice": gas_price,
            }
        )
        try:
            estimated_gas = w3.eth.estimate_gas(tx)
        except Exception:
            estimated_gas = 240000
        tx["gas"] = int(estimated_gas * 1.2)

        signed = owner.sign_transaction(tx)
        raw_tx = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction", None)
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        return tx_hash.hex()

    def _direct_transfer_native_onchain(self, player_address: str, wei_amount: int) -> str:
        w3 = self._get_w3()
        if not w3.is_address(player_address):
            raise HTTPException(status_code=400, detail="Invalid player_address")
        owner = self._get_owner_account(w3)
        player_checksum = w3.to_checksum_address(player_address)

        nonce = w3.eth.get_transaction_count(owner.address, "pending")
        gas_price = w3.eth.gas_price
        chain_id_env = os.getenv("GAME_CHAIN_ID", "").strip() or os.getenv("CHAIN_ID", "").strip()
        chain_id = int(chain_id_env) if chain_id_env else w3.eth.chain_id

        tx = {
            "from": owner.address,
            "to": player_checksum,
            "value": int(wei_amount),
            "nonce": nonce,
            "chainId": chain_id,
            "gasPrice": gas_price,
            "gas": 21000,
        }
        signed = owner.sign_transaction(tx)
        raw_tx = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction", None)
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        return tx_hash.hex()

    def start_challenge_session(self, *, player_address: str, room_name: str, session_id: str) -> dict[str, Any]:
        normalized_player = player_address.strip().lower()
        normalized_room = room_name.strip()
        normalized_session_id = session_id.strip()
        if not normalized_player or not normalized_room or not normalized_session_id:
            raise HTTPException(status_code=400, detail="player_address, room_name, session_id are required")

        progress_before = self._fetch_progress(normalized_player)
        now_unix = int(time.time())
        onchain_start_tx_hash = None
        should_start_onchain = (
            progress_before["challengeStartedAt"] == 0
            or progress_before["expired"]
            or (progress_before["challengeEndsAt"] > 0 and now_unix > progress_before["challengeEndsAt"])
            or progress_before["completed"]
        )

        if should_start_onchain:
            try:
                onchain_start_tx_hash = self._start_challenge_for_onchain(normalized_player)
            except HTTPException:
                # Allow flow to continue if challenge was already started by player wallet.
                pass

        with self._lock:
            existing = self._sessions_by_player.get(normalized_player)
            challenge_started = existing is None or existing.session_id != normalized_session_id
            self._sessions_by_player[normalized_player] = ChallengeSession(
                player_address=normalized_player,
                room_name=normalized_room,
                session_id=normalized_session_id,
                started_at_unix=int(time.time()),
            )
        progress_after = self._fetch_progress(normalized_player)
        if progress_after["challengeStartedAt"] == 0:
            raise HTTPException(
                status_code=409,
                detail="Challenge did not start on-chain. Ensure operator is authorized or start from wallet.",
            )
        return {
            "challenge_started": challenge_started,
            "txHash": onchain_start_tx_hash,
            "progress": progress_after,
        }

    def record_npc_talk(
        self,
        *,
        player_address: str,
        npc_id: str,
        room_name: str,
        engagement_ms: int,
    ) -> dict[str, Any]:
        normalized_player = player_address.strip().lower()
        normalized_npc = npc_id.strip().lower()
        normalized_room = room_name.strip()
        if not normalized_player or not normalized_npc or not normalized_room:
            raise HTTPException(status_code=400, detail="player_address, npc_id, room_name are required")
        if engagement_ms < 0:
            raise HTTPException(status_code=400, detail="engagement_ms cannot be negative")

        with self._lock:
            session = self._sessions_by_player.get(normalized_player)
            if session is None:
                raise HTTPException(status_code=404, detail="No active challenge session for player")
            if session.room_name != normalized_room:
                raise HTTPException(status_code=409, detail="Room mismatch for active challenge session")
            if normalized_npc in session.seen_npc_ids:
                progress = self._fetch_progress(normalized_player)
                return {"accepted": False, "txHash": None, "progress": progress}

        progress_before = self._fetch_progress(normalized_player)
        now_unix = int(time.time())
        challenge_started_at = progress_before["challengeStartedAt"]
        challenge_ends_at = progress_before["challengeEndsAt"]

        if challenge_started_at == 0:
            raise HTTPException(status_code=409, detail="Challenge not active on-chain")
        if challenge_ends_at > 0 and now_unix > challenge_ends_at:
            raise HTTPException(status_code=409, detail="Challenge window expired")

        tx_hash = self._record_npc_talk_onchain(normalized_player)
        auto_payout_tx_hash = None

        with self._lock:
            session = self._sessions_by_player.get(normalized_player)
            if session is not None:
                session.seen_npc_ids.add(normalized_npc)
                demo_goal = int(os.getenv("DEMO_NPC_GOAL", "6") or "6")
                should_auto_pay = len(session.seen_npc_ids) >= demo_goal and not session.auto_paid
            else:
                should_auto_pay = False

        if should_auto_pay:
            payout_units = int(os.getenv("DEMO_PAYOUT_UNITS", "1") or "1")
            reward_seed = f"{normalized_player}:{normalized_room}:{int(time.time())}"
            reward_id_hex = self._get_w3().keccak(text=reward_seed).hex()
            try:
                auto_payout_tx_hash = self._reward_player_onchain(normalized_player, payout_units, reward_id_hex)
                with self._lock:
                    session = self._sessions_by_player.get(normalized_player)
                    if session is not None:
                        session.auto_paid = True
            except Exception as exc:
                auto_payout_tx_hash = f"FAILED:{exc}"

        progress_after = self._fetch_progress(normalized_player)
        return {
            "accepted": True,
            "txHash": tx_hash,
            "progress": progress_after,
            "autoPayoutTxHash": auto_payout_tx_hash,
        }

    def claim_reward(self, *, player_address: str, room_name: str) -> dict[str, Any]:
        normalized_player = player_address.strip().lower()
        normalized_room = room_name.strip()
        if not normalized_player or not normalized_room:
            raise HTTPException(status_code=400, detail="player_address and room_name are required")

        with self._lock:
            session = self._sessions_by_player.get(normalized_player)
            if session is None:
                raise HTTPException(status_code=404, detail="No active challenge session for player")
            if session.room_name != normalized_room:
                raise HTTPException(status_code=409, detail="Room mismatch for active challenge session")
            if session.auto_paid:
                return {"paid": False, "alreadyPaid": True, "txHash": None}
            npc_count = len(session.seen_npc_ids)

        goal = int(os.getenv("DEMO_NPC_GOAL", "6") or "6")
        if npc_count < goal:
            raise HTTPException(status_code=409, detail=f"Not eligible yet. Need {goal} NPCs.")

        payout_units = int(os.getenv("DEMO_PAYOUT_UNITS", "1") or "1")
        reward_seed = f"claim:{normalized_player}:{normalized_room}:{int(time.time())}"
        reward_id_hex = self._get_w3().keccak(text=reward_seed).hex()
        tx_hash = None
        payout_mode = "contract_reward"
        try:
            tx_hash = self._reward_player_onchain(normalized_player, payout_units, reward_id_hex)
        except Exception as primary_exc:
            allow_fallback = os.getenv("DEMO_ALLOW_DIRECT_TRANSFER", "false").strip().lower() in {"1", "true", "yes", "on"}
            if not allow_fallback:
                raise HTTPException(status_code=500, detail=f"Contract payout failed: {primary_exc}")
            # Emergency demo fallback: direct native transfer from owner wallet.
            fallback_wei = int(os.getenv("DEMO_DIRECT_TRANSFER_WEI", "10000000000000000"))  # 0.01 QUAI default
            tx_hash = self._direct_transfer_native_onchain(normalized_player, fallback_wei)
            payout_mode = "direct_native_fallback"

        with self._lock:
            session = self._sessions_by_player.get(normalized_player)
            if session is not None:
                session.auto_paid = True

        return {"paid": True, "alreadyPaid": False, "txHash": tx_hash, "mode": payout_mode}

    def force_payout(self, *, player_address: str, units: int = 1) -> dict[str, Any]:
        normalized_player = player_address.strip().lower()
        if not normalized_player:
            raise HTTPException(status_code=400, detail="player_address is required")

        reward_seed = f"force:{normalized_player}:{int(time.time())}"
        reward_id_hex = self._get_w3().keccak(text=reward_seed).hex()
        try:
            tx_hash = self._reward_player_onchain(normalized_player, int(units), reward_id_hex)
            return {"paid": True, "txHash": tx_hash, "mode": "contract_reward"}
        except Exception as primary_exc:
            allow_fallback = os.getenv("DEMO_ALLOW_DIRECT_TRANSFER", "false").strip().lower() in {"1", "true", "yes", "on"}
            if not allow_fallback:
                raise HTTPException(status_code=500, detail=f"Force payout failed: {primary_exc}")
            fallback_wei = int(os.getenv("DEMO_DIRECT_TRANSFER_WEI", "10000000000000000"))  # 0.01 QUAI
            tx_hash = self._direct_transfer_native_onchain(normalized_player, fallback_wei)
            return {"paid": True, "txHash": tx_hash, "mode": "direct_native_fallback"}

    def get_progress(self, player_address: str) -> dict[str, Any]:
        normalized_player = player_address.strip().lower()
        if not normalized_player:
            raise HTTPException(status_code=400, detail="player_address is required")

        try:
            progress = self._fetch_progress(normalized_player)
        except HTTPException as exc:
            if exc.status_code >= 500:
                # Graceful fallback for demo flow when backend env/RPC is temporarily misconfigured.
                progress = {
                    "challengeStartedAt": 0,
                    "challengeEndsAt": 0,
                    "npcTalks": 0,
                    "rewardPoints": 0,
                    "completed": False,
                    "expired": False,
                    "claimableUnits": 0,
                }
            else:
                raise
        with self._lock:
            session = self._sessions_by_player.get(normalized_player)
            session_meta = None
            if session is not None:
                session_meta = {
                    "roomName": session.room_name,
                    "sessionId": session.session_id,
                    "startedAt": session.started_at_unix,
                    "uniqueNpcCount": len(session.seen_npc_ids),
                }
        return {"progress": progress, "session": session_meta}


rewards_service = RewardsService()
