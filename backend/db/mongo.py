"""
MongoDB async client using Motor.
Gracefully falls back to in-memory storage if MongoDB is unavailable.
"""
import os
from datetime import datetime, timezone
from typing import Any, Optional
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../.env"))
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../.env"))

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = "antigravity_db"

# In-memory fallback
_memory_sessions: list[dict] = []
_memory_leaderboard: dict[str, list] = {}
_memory_chats: dict[str, list] = {}

_mongo_client = None
_db = None
_mongo_available = False


async def init_db():
    global _mongo_client, _db, _mongo_available
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        _mongo_client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=3000)
        # Test connection
        await _mongo_client.admin.command("ping")
        _db = _mongo_client[DB_NAME]
        _mongo_available = True
        print("[OK] MongoDB connected")

        # Indexes
        await _db.sessions.create_index("session_id", unique=True)
        await _db.sessions.create_index("timestamp")
        await _db.leaderboard.create_index([("room", 1), ("score", -1)])
    except Exception as e:
        print(f"[WARN] MongoDB unavailable ({e}) - using in-memory storage")
        _mongo_available = False


# ─── Sessions ──────────────────────────────────────────────────────────────────

async def save_session(doc: dict) -> str:
    doc["saved_at"] = datetime.now(timezone.utc).isoformat()
    if _mongo_available:
        try:
            await _db.sessions.replace_one(
                {"session_id": doc["session_id"]},
                doc,
                upsert=True
            )
            return doc["session_id"]
        except Exception as e:
            print(f"MongoDB write error: {e}")

    # Memory fallback
    _memory_sessions.append(doc)
    return doc["session_id"]


async def get_sessions(limit: int = 50) -> list[dict]:
    if _mongo_available:
        try:
            cursor = _db.sessions.find(
                {},
                {"_id": 0},
                sort=[("timestamp", -1)],
                limit=limit
            )
            return await cursor.to_list(length=limit)
        except Exception:
            pass
    return sorted(_memory_sessions, key=lambda x: x.get("timestamp", ""), reverse=True)[:limit]


async def get_session(session_id: str) -> Optional[dict]:
    if _mongo_available:
        try:
            doc = await _db.sessions.find_one({"session_id": session_id}, {"_id": 0})
            return doc
        except Exception:
            pass
    return next((s for s in _memory_sessions if s.get("session_id") == session_id), None)


async def delete_session(session_id: str) -> bool:
    if _mongo_available:
        try:
            result = await _db.sessions.delete_one({"session_id": session_id})
            return result.deleted_count > 0
        except Exception:
            pass
    orig = len(_memory_sessions)
    _memory_sessions[:] = [s for s in _memory_sessions if s.get("session_id") != session_id]
    return len(_memory_sessions) < orig


# ─── Leaderboard ───────────────────────────────────────────────────────────────

async def get_leaderboard(room: str) -> list[dict]:
    if _mongo_available:
        try:
            cursor = _db.leaderboard.find(
                {"room": room},
                {"_id": 0},
                sort=[("score", -1)],
                limit=50
            )
            return await cursor.to_list(length=50)
        except Exception:
            pass
    return sorted(_memory_leaderboard.get(room, []), key=lambda x: x.get("score", 0), reverse=True)


async def submit_leaderboard(room: str, entry: dict) -> None:
    entry["room"] = room
    entry["submitted_at"] = datetime.now(timezone.utc).isoformat()
    if _mongo_available:
        try:
            await _db.leaderboard.insert_one(entry)
            return
        except Exception:
            pass
    _memory_leaderboard.setdefault(room, []).append(entry)


# ─── Chat Logs ─────────────────────────────────────────────────────────────────

async def save_chat_message(session_id: str, role: str, content: str) -> None:
    msg = {"role": role, "content": content, "ts": datetime.now(timezone.utc).isoformat()}
    if _mongo_available:
        try:
            await _db.chat_logs.update_one(
                {"session_id": session_id},
                {"$push": {"messages": msg}},
                upsert=True
            )
            return
        except Exception:
            pass
    _memory_chats.setdefault(session_id, []).append(msg)


async def get_chat_history(session_id: str) -> list[dict]:
    if _mongo_available:
        try:
            doc = await _db.chat_logs.find_one({"session_id": session_id}, {"_id": 0})
            return doc.get("messages", []) if doc else []
        except Exception:
            pass
    return _memory_chats.get(session_id, [])
