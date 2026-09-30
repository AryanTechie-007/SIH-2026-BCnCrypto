"""init_db must add the new WatermarkRecord columns to a database created before they existed."""

import asyncio
import os
import sqlite3
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


class TestAddMissingColumns(unittest.TestCase):
    def test_adds_columns_to_old_table_and_is_idempotent(self):
        from sqlalchemy.ext.asyncio import create_async_engine
        from app.database import _add_missing_columns

        fd, path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        try:
            con = sqlite3.connect(path)
            con.execute(
                "CREATE TABLE watermark_records (id INTEGER PRIMARY KEY, event_id INTEGER, "
                "watermark_id TEXT, watermarked_path TEXT)"
            )
            con.execute("INSERT INTO watermark_records (event_id, watermark_id, watermarked_path) VALUES (1,'a','p')")
            con.commit()
            con.close()

            async def run():
                eng = create_async_engine(f"sqlite+aiosqlite:///{path}")
                for _ in range(2):                       # second pass must be a no-op
                    async with eng.begin() as conn:
                        await conn.run_sync(_add_missing_columns)
                await eng.dispose()

            asyncio.run(run())

            con = sqlite3.connect(path)
            cols = {r[1] for r in con.execute("PRAGMA table_info(watermark_records)")}
            row = con.execute("SELECT render_width, render_height FROM watermark_records").fetchone()
            con.close()
            self.assertTrue({"render_width", "render_height"} <= cols)
            self.assertEqual(row, (None, None))          # existing rows keep working, size unknown
        finally:
            os.remove(path)


if __name__ == '__main__':
    unittest.main()
