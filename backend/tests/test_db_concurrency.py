import os
import sys
import sqlite3
import threading
import time
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from db_utils import get_db_connection, sqlite_retry, configure_sqlite_connection

def test_configure_sqlite_connection(tmp_path):
    db_file = str(tmp_path / "test_pragma.db")
    with get_db_connection(db_file) as conn:
        journal_mode = conn.execute("PRAGMA journal_mode;").fetchone()[0]
        # In memory or file, WAL or delete/memory
        assert journal_mode.lower() in ("wal", "memory")
        busy_timeout = conn.execute("PRAGMA busy_timeout;").fetchone()[0]
        assert busy_timeout >= 30000

def test_sqlite_retry_success():
    call_count = 0

    @sqlite_retry(max_retries=3, initial_delay=0.01, backoff=1.5)
    def flaky_db_op():
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise sqlite3.OperationalError("database is locked")
        return "success"

    result = flaky_db_op()
    assert result == "success"
    assert call_count == 3

def test_sqlite_retry_exhausted():
    @sqlite_retry(max_retries=2, initial_delay=0.01, backoff=1.5)
    def always_locked():
        raise sqlite3.OperationalError("database is locked")

    with pytest.raises(sqlite3.OperationalError):
        always_locked()

def test_concurrent_writes(tmp_path):
    """複数スレッドからの同時書き込みがロックでクラッシュせず完了することを検証"""
    db_file = str(tmp_path / "test_concurrent.db")
    
    with get_db_connection(db_file) as conn:
        conn.execute("CREATE TABLE counter (id INTEGER PRIMARY KEY, count INTEGER)")
        conn.execute("INSERT INTO counter VALUES (1, 0)")
        conn.commit()

    @sqlite_retry(max_retries=10, initial_delay=0.02, backoff=1.5)
    def increment():
        with get_db_connection(db_file, timeout=10.0) as conn:
            cur = conn.cursor()
            cur.execute("BEGIN IMMEDIATE")
            cur.execute("SELECT count FROM counter WHERE id = 1")
            val = cur.fetchone()[0]
            time.sleep(0.005)  # 短い処理時間を模擬
            cur.execute("UPDATE counter SET count = ? WHERE id = 1", (val + 1,))
            conn.commit()

    threads = []
    num_threads = 8
    for _ in range(num_threads):
        t = threading.Thread(target=increment)
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    with get_db_connection(db_file) as conn:
        final_count = conn.execute("SELECT count FROM counter WHERE id = 1").fetchone()[0]
        assert final_count == num_threads
