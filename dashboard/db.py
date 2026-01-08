"""Database operations for the blog dashboard."""

import json
from datetime import datetime
from typing import Optional

import aiosqlite

from .config import DATABASE_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS link_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    tags TEXT,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    error_output TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    tags TEXT,
    content TEXT DEFAULT '',
    audience_notes TEXT,
    ai_analysis TEXT,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP,
    published_path TEXT
);

CREATE INDEX IF NOT EXISTS idx_link_queue_status ON link_queue(status);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
"""


async def get_db() -> aiosqlite.Connection:
    """Get a database connection."""
    db = await aiosqlite.connect(DATABASE_PATH)
    db.row_factory = aiosqlite.Row
    return db


async def init_db():
    """Initialize the database with schema."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.executescript(SCHEMA)
        await db.commit()


# Link queue operations
async def add_link(url: str, tags: list[str]) -> int:
    """Add a link to the queue. Returns the new link ID."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        cursor = await db.execute(
            "INSERT INTO link_queue (url, tags) VALUES (?, ?)",
            (url, json.dumps(tags)),
        )
        await db.commit()
        return cursor.lastrowid


async def get_links(status: Optional[str] = None) -> list[dict]:
    """Get all links, optionally filtered by status."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        if status:
            cursor = await db.execute(
                "SELECT * FROM link_queue WHERE status = ? ORDER BY created_at DESC",
                (status,),
            )
        else:
            cursor = await db.execute(
                "SELECT * FROM link_queue ORDER BY created_at DESC"
            )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def get_link(link_id: int) -> Optional[dict]:
    """Get a single link by ID."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM link_queue WHERE id = ?", (link_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def update_link_status(
    link_id: int,
    status: str,
    error_message: Optional[str] = None,
    error_output: Optional[str] = None,
):
    """Update a link's status."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        processed_at = datetime.now().isoformat() if status in ("completed", "failed") else None
        await db.execute(
            """UPDATE link_queue
               SET status = ?, error_message = ?, error_output = ?, processed_at = ?
               WHERE id = ?""",
            (status, error_message, error_output, processed_at, link_id),
        )
        await db.commit()


async def delete_link(link_id: int):
    """Delete a link from the queue."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute("DELETE FROM link_queue WHERE id = ?", (link_id,))
        await db.commit()


async def get_next_pending_link() -> Optional[dict]:
    """Get the next pending link (oldest first)."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM link_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1"
        )
        row = await cursor.fetchone()
        return dict(row) if row else None


# Draft operations
async def create_draft(title: str) -> int:
    """Create a new draft. Returns the new draft ID."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        cursor = await db.execute(
            "INSERT INTO drafts (title) VALUES (?)",
            (title,),
        )
        await db.commit()
        return cursor.lastrowid


async def get_drafts(status: Optional[str] = None) -> list[dict]:
    """Get all drafts, optionally filtered by status."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        if status:
            cursor = await db.execute(
                "SELECT * FROM drafts WHERE status = ? ORDER BY updated_at DESC",
                (status,),
            )
        else:
            cursor = await db.execute("SELECT * FROM drafts ORDER BY updated_at DESC")
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def get_draft(draft_id: int) -> Optional[dict]:
    """Get a single draft by ID."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def update_draft(
    draft_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    tags: Optional[list[str]] = None,
    content: Optional[str] = None,
    audience_notes: Optional[str] = None,
    ai_analysis: Optional[list] = None,
):
    """Update a draft's fields."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        updates = []
        params = []

        if title is not None:
            updates.append("title = ?")
            params.append(title)
        if description is not None:
            updates.append("description = ?")
            params.append(description)
        if tags is not None:
            updates.append("tags = ?")
            params.append(json.dumps(tags))
        if content is not None:
            updates.append("content = ?")
            params.append(content)
        if audience_notes is not None:
            updates.append("audience_notes = ?")
            params.append(audience_notes)
        if ai_analysis is not None:
            updates.append("ai_analysis = ?")
            params.append(json.dumps(ai_analysis))

        if updates:
            updates.append("updated_at = ?")
            params.append(datetime.now().isoformat())
            params.append(draft_id)

            await db.execute(
                f"UPDATE drafts SET {', '.join(updates)} WHERE id = ?",
                params,
            )
            await db.commit()


async def mark_draft_published(draft_id: int, published_path: str):
    """Mark a draft as published."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute(
            """UPDATE drafts
               SET status = 'published', published_at = ?, published_path = ?, updated_at = ?
               WHERE id = ?""",
            (datetime.now().isoformat(), published_path, datetime.now().isoformat(), draft_id),
        )
        await db.commit()


async def delete_draft(draft_id: int):
    """Delete a draft."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute("DELETE FROM drafts WHERE id = ?", (draft_id,))
        await db.commit()
