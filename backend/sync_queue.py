import os
import sqlite3
import json
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

import config

def _get_sqlite_conn():
    """SQLite接続を取得し、sync_queueテーブルを初期化"""
    db_path = config.SQLITE_CACHE_DB
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=10.0, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sync_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_type TEXT NOT NULL,
            filename TEXT NOT NULL,
            management_number INTEGER,
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            retry_count INTEGER NOT NULL DEFAULT 0,
            last_error TEXT
        );
    """)
    conn.commit()
    return conn

def enqueue_sync_task(
    task_type: str, 
    filename: str, 
    payload: Dict[str, Any], 
    management_number: Optional[int] = None
) -> int:
    """ネットワーク切断時に日報操作タスクをローカルキューに安全に一時退避"""
    filename = os.path.basename(filename)
    now_str = datetime.now().isoformat()
    payload_json = json.dumps(payload, ensure_ascii=False)
    
    with _get_sqlite_conn() as conn:
        cursor = conn.execute(
            """
            INSERT INTO sync_queue 
            (task_type, filename, management_number, payload_json, created_at, status, retry_count)
            VALUES (?, ?, ?, ?, ?, 'pending', 0)
            """,
            (task_type, filename, management_number, payload_json, now_str)
        )
        conn.commit()
        task_id = cursor.lastrowid
        logging.info(f"Enqueued sync task #{task_id}: {task_type} for {filename} (mgmt_num={management_number})")
        return task_id

def get_pending_tasks() -> List[Dict[str, Any]]:
    """未同期のタスクを登録日時順（FIFO）に取得"""
    with _get_sqlite_conn() as conn:
        cursor = conn.execute(
            """
            SELECT id, task_type, filename, management_number, payload_json, created_at, retry_count
            FROM sync_queue
            WHERE status IN ('pending', 'error')
            ORDER BY id ASC
            """
        )
        rows = cursor.fetchall()
        tasks = []
        for r in rows:
            tasks.append({
                "id": r[0],
                "task_type": r[1],
                "filename": r[2],
                "management_number": r[3],
                "payload": json.loads(r[4]),
                "created_at": r[5],
                "retry_count": r[6]
            })
        return tasks

def get_pending_task_count() -> int:
    """未同期のタスク件数を取得"""
    try:
        with _get_sqlite_conn() as conn:
            cursor = conn.execute(
                "SELECT COUNT(*) FROM sync_queue WHERE status IN ('pending', 'error')"
            )
            return cursor.fetchone()[0]
    except Exception as e:
        logging.warning(f"Failed to get pending task count: {e}")
        return 0

def mark_task_completed(task_id: int):
    """タスクを完了状態に更新"""
    with _get_sqlite_conn() as conn:
        conn.execute(
            "UPDATE sync_queue SET status = 'completed', last_error = NULL WHERE id = ?",
            (task_id,)
        )
        conn.commit()
        logging.info(f"Sync task #{task_id} completed successfully.")

def mark_task_failed(task_id: int, error_msg: str):
    """タスク失敗を記録しリトライカウントを増加"""
    with _get_sqlite_conn() as conn:
        conn.execute(
            """
            UPDATE sync_queue 
            SET status = 'error', retry_count = retry_count + 1, last_error = ? 
            WHERE id = ?
            """,
            (error_msg, task_id)
        )
        conn.commit()
        logging.warning(f"Sync task #{task_id} failed: {error_msg}")

def check_file_server_connected(filename: Optional[str] = None) -> bool:
    """ファイルサーバーまたは対象Excelファイルにアクセス可能かチェック"""
    try:
        if filename:
            target = os.path.join(config.EXCEL_DIR, os.path.basename(filename))
        else:
            target = config.EXCEL_DIR
        return os.path.exists(target)
    except Exception:
        return False

def process_sync_queue() -> Dict[str, int]:
    """
    未同期キューのタスクを順次原本Excelへ反映。
    ファイルサーバー接続時のみ実行。
    戻り値: {"processed": N, "failed": M, "remaining": K}
    """
    import routes_reports
    import excel_io
    import cache

    pending = get_pending_tasks()
    if not pending:
        return {"processed": 0, "failed": 0, "remaining": 0}

    processed_count = 0
    failed_count = 0

    for task in pending:
        task_id = task["id"]
        task_type = task["task_type"]
        filename = task["filename"]
        mgmt_num = task["management_number"]
        payload = task["payload"]
        excel_file = os.path.join(config.EXCEL_DIR, filename)

        if not os.path.exists(excel_file):
            logging.warning(f"Sync task #{task_id}: Excel file '{excel_file}' not reachable yet.")
            failed_count += 1
            continue

        try:
            with excel_io.get_file_write_lock(excel_file, timeout=20.0):
                if task_type == "create":
                    routes_reports._apply_add_report_to_excel(excel_file, payload)
                elif task_type == "update":
                    routes_reports._apply_update_report_to_excel(excel_file, mgmt_num, payload)
                elif task_type == "reply":
                    routes_reports._apply_reply_to_excel(excel_file, mgmt_num, payload)
                elif task_type == "comment":
                    routes_reports._apply_comment_to_excel(excel_file, mgmt_num, payload)
                elif task_type == "approval":
                    routes_reports._apply_approval_to_excel(excel_file, mgmt_num, payload)
                elif task_type == "delete":
                    routes_reports._apply_delete_to_excel(excel_file, mgmt_num)
                else:
                    logging.error(f"Unknown sync task type: {task_type}")

                mark_task_completed(task_id)
                cache.invalidate_cache(filename, '営業日報')
                processed_count += 1

        except Exception as e:
            err_msg = f"{type(e).__name__}: {str(e)}"
            mark_task_failed(task_id, err_msg)
            failed_count += 1
            logging.error(f"Error processing sync task #{task_id}: {e}")

    remaining = get_pending_task_count()
    return {"processed": processed_count, "failed": failed_count, "remaining": remaining}
