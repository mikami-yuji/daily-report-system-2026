"""
backend/db_utils.py
SQLiteデータベース接続の共通化および同時書き込みロック（database is locked）耐性向上モジュール
- WALモード、busy_timeout、synchronous=NORMALを共通適用
- リトライデコレータ @sqlite_retry による自動指数バックオフ
"""

import sqlite3
import time
import functools
import logging
from contextlib import contextmanager
from typing import Generator, Callable, Any

logger = logging.getLogger(__name__)

DEFAULT_BUSY_TIMEOUT_MS = 30000  # 30秒

def configure_sqlite_connection(conn: sqlite3.Connection) -> None:
    """SQLiteコネクションに対して並行性能と耐久性の最適化PRAGMAを設定する"""
    try:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute(f"PRAGMA busy_timeout={DEFAULT_BUSY_TIMEOUT_MS};")
        conn.execute("PRAGMA synchronous=NORMAL;")
    except Exception as e:
        logger.warning(f"Failed to apply PRAGMA settings to SQLite connection: {e}")

@contextmanager
def get_db_connection(
    db_path: str,
    timeout: float = 30.0,
    check_same_thread: bool = False,
    row_factory: Any = None
) -> Generator[sqlite3.Connection, None, None]:
    """
    安全なSQLite接続を提供するコンテキストマネージャ
    使用例:
        with get_db_connection(config.SQLITE_CACHE_DB) as conn:
            cursor = conn.cursor()
            cursor.execute(...)
    """
    conn = sqlite3.connect(
        db_path,
        timeout=timeout,
        check_same_thread=check_same_thread
    )
    if row_factory is not None:
        conn.row_factory = row_factory
    configure_sqlite_connection(conn)
    try:
        yield conn
    finally:
        conn.close()

def sqlite_retry(max_retries: int = 4, initial_delay: float = 0.1, backoff: float = 2.0):
    """
    SQLiteのOperationalError (database is locked / busy) 発生時に自動リトライを行うデコレータ
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            delay = initial_delay
            last_err = None
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except sqlite3.OperationalError as e:
                    err_msg = str(e).lower()
                    if "locked" in err_msg or "busy" in err_msg:
                        last_err = e
                        logger.warning(
                            f"SQLite lock/busy detected in {func.__name__} (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {delay:.2f}s..."
                        )
                        time.sleep(delay)
                        delay *= backoff
                    else:
                        raise
            logger.error(f"SQLite operation failed after {max_retries} attempts: {last_err}")
            raise last_err
        return wrapper
    return decorator
