import aiosqlite
import os
from pathlib import Path

DB_PATH = os.getenv("DB_PATH", "./data/lumoria.db")


async def init_db():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                telegram_id INTEGER PRIMARY KEY,
                username    TEXT,
                wallet      TEXT,
                sap_balance REAL DEFAULT 0,
                created_at  INTEGER DEFAULT (strftime('%s','now'))
            );

            CREATE TABLE IF NOT EXISTS lands (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id    INTEGER REFERENCES users(telegram_id),
                rarity      TEXT DEFAULT 'Common',
                slot_count  INTEGER DEFAULT 2,
                nft_address TEXT,
                created_at  INTEGER DEFAULT (strftime('%s','now'))
            );

            CREATE TABLE IF NOT EXISTS crops (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                land_id      INTEGER REFERENCES lands(id),
                crop_type    TEXT DEFAULT 'lumen_apple',
                planted_at   INTEGER DEFAULT (strftime('%s','now')),
                harvest_at   INTEGER,
                harvested    INTEGER DEFAULT 0,
                sap_reward   REAL DEFAULT 10
            );
        """)
        await db.commit()


async def get_user(telegram_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM users WHERE telegram_id = ?", (telegram_id,)
        ) as cur:
            return await cur.fetchone()


async def create_user(telegram_id: int, username: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR IGNORE INTO users (telegram_id, username) VALUES (?, ?)",
            (telegram_id, username),
        )
        # هر کاربر جدید یک زمین Common رایگان می‌گیرد
        await db.execute(
            "INSERT INTO lands (owner_id) SELECT ? WHERE NOT EXISTS "
            "(SELECT 1 FROM lands WHERE owner_id = ?)",
            (telegram_id, telegram_id),
        )
        await db.commit()


async def get_user_land(telegram_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM lands WHERE owner_id = ? LIMIT 1", (telegram_id,)
        ) as cur:
            return await cur.fetchone()


async def plant_crop(land_id: int, harvest_seconds: int = 14400):
    """۱۴۴۰۰ ثانیه = ۴ ساعت"""
    import time
    now = int(time.time())
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO crops (land_id, planted_at, harvest_at) VALUES (?, ?, ?)",
            (land_id, now, now + harvest_seconds),
        )
        await db.commit()


async def harvest_ready(land_id: int):
    import time
    now = int(time.time())
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM crops WHERE land_id = ? AND harvested = 0 AND harvest_at <= ?",
            (land_id, now),
        ) as cur:
            return await cur.fetchall()


async def do_harvest(telegram_id: int, land_id: int):
    import time
    now = int(time.time())
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT SUM(sap_reward) as total FROM crops "
            "WHERE land_id = ? AND harvested = 0 AND harvest_at <= ?",
            (land_id, now),
        ) as cur:
            row = await cur.fetchone()
            earned = row[0] or 0

        await db.execute(
            "UPDATE crops SET harvested = 1 WHERE land_id = ? AND harvested = 0 AND harvest_at <= ?",
            (land_id, now),
        )
        await db.execute(
            "UPDATE users SET sap_balance = sap_balance + ? WHERE telegram_id = ?",
            (earned, telegram_id),
        )
        await db.commit()
        return earned
