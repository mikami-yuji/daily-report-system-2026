import os
import shutil
import sqlite3
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException
import pandas as pd
import config

import re

CACHE = {}

def _get_sqlite_conn():
    """SQLiteキャッシュデータベースへの接続を取得"""
    db_path = config.SQLITE_CACHE_DB
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=10.0, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS _cache_meta (
            cache_id TEXT PRIMARY KEY,
            filename TEXT,
            sheet_name TEXT,
            mtime REAL,
            updated_at TEXT
        );
    """)
    return conn

def invalidate_cache(filename: str, sheet_name: Optional[str] = None):
    """指定されたファイルのキャッシュ（インメモリおよびSQLite）を無効化"""
    filename = os.path.basename(filename)
    
    # 1. インメモリキャッシュの削除
    keys_to_del = [k for k in CACHE.keys() if k[0] == filename and (sheet_name is None or k[1] == sheet_name)]
    for k in keys_to_del:
        CACHE.pop(k, None)
        
    # 2. SQLiteキャッシュの削除
    try:
        with _get_sqlite_conn() as conn:
            if sheet_name:
                cache_id = hashlib.md5(f"{filename}_{sheet_name}".encode('utf-8')).hexdigest()
                table_name = f"sheet_{cache_id}"
                conn.execute(f"DROP TABLE IF EXISTS [{table_name}]")
                conn.execute("DELETE FROM _cache_meta WHERE cache_id = ?", (cache_id,))
            else:
                cursor = conn.execute("SELECT cache_id FROM _cache_meta WHERE filename = ?", (filename,))
                rows = cursor.fetchall()
                for (cid,) in rows:
                    conn.execute(f"DROP TABLE IF EXISTS [sheet_{cid}]")
                conn.execute("DELETE FROM _cache_meta WHERE filename = ?", (filename,))
            conn.commit()
        logging.debug(f"Invalidated SQLite cache for {filename} (sheet={sheet_name})")
    except Exception as e:
        logging.warning(f"Failed to invalidate SQLite cache for {filename}: {e}")

def cleanup_old_backups(
    backup_dir: str, 
    base_name: str = "", 
    ext: str = "", 
    prefix: str = "", 
    max_keep: int = 50, 
    max_age_days: int = 30, 
    min_keep: int = 5
) -> int:
    """
    バックアップディレクトリ内の古いバックアップファイルを自動クリーンアップします。
    - base_name と ext が指定されている場合は正規表現（f"{base_name}_YYYYMMDD_HHMMSS{ext}"）で厳密に一致判定
    - max_age_days（デフォルト30日）を超えた古いファイルを削除
    - 保持件数が max_keep（デフォルト50件）を超える場合、古い順に削除
    - 安全のため、最低 min_keep（デフォルト5件）は常に保持
    """
    # 【絶対安全ガード 1】対象ディレクトリが「backup」フォルダでない場合は絶対に削除処理を実行しない
    norm_backup_dir = os.path.abspath(backup_dir)
    if os.path.basename(norm_backup_dir).lower() != 'backup':
        logging.error(f"SAFETY ABORT: Attempted to run backup cleanup on non-backup directory: {backup_dir}")
        return 0

    if not os.path.exists(backup_dir):
        return 0

    deleted_count = 0
    now = datetime.now()
    cutoff_time = now - timedelta(days=max_age_days)

    # タイムスタンプ（_YYYYMMDD または _YYYYMMDD_HHMMSS）の存在を必須とする安全パターン
    TIMESTAMP_REQUIRED_PATTERN = re.compile(r'_\d{8}(?:_\d{2,6})?(?:_\d+)?\.[^.]+$', re.IGNORECASE)

    # 厳密なファイル名マッチャーの構築
    pattern = None
    if base_name and ext:
        # 例: ^2026年度日報_\d{8}_\d{6}(\.xlsm|\.xlsx|\.csv)$
        pattern = re.compile(rf"^{re.escape(base_name)}_\d{{8}}_\d{{6}}(?:_\d+)?{re.escape(ext)}$", re.IGNORECASE)
    elif base_name:
        pattern = re.compile(rf"^{re.escape(base_name)}_\d{{8}}_\d{{6}}(?:_\d+)?\.[^.]+$", re.IGNORECASE)

    try:
        # バックアップファイルを収集
        backup_files = []
        for f in os.listdir(backup_dir):
            if f.startswith('~$'):
                continue
            
            # 【絶対安全ガード 2】タイムスタンプサフィックスのない原本ファイル形式は絶対に除外
            if not TIMESTAMP_REQUIRED_PATTERN.search(f):
                continue
            
            # パターン一致またはプレフィックス一致判定
            if pattern:
                if not pattern.match(f):
                    continue
            elif prefix:
                if not f.startswith(prefix):
                    continue
            elif not f.endswith(('.xlsm', '.xlsx', '.csv')):
                continue

            fp = os.path.join(backup_dir, f)
            if os.path.isfile(fp):
                try:
                    mtime = os.path.getmtime(fp)
                    backup_files.append((fp, datetime.fromtimestamp(mtime)))
                except OSError as os_err:
                    logging.debug(f"Cannot get mtime for backup file {fp}: {os_err}")
                    continue

        # 新しい順（降順）にソート
        backup_files.sort(key=lambda x: x[1], reverse=True)

        total_files = len(backup_files)
        if total_files <= min_keep:
            return 0

        files_to_delete = []

        # 1. 30日経過したファイルを削除候補に（ただし最新min_keep件は保護）
        for idx, (fp, dt) in enumerate(backup_files):
            if idx >= min_keep and dt < cutoff_time:
                files_to_delete.append(fp)

        # 2. 残り件数が max_keep を超える場合、古い順に削除候補に追加
        remaining_files = [fp for fp, _ in backup_files if fp not in files_to_delete]
        if len(remaining_files) > max_keep:
            excess_files = remaining_files[max_keep:]
            files_to_delete.extend(excess_files)

        # 削除実行（ファイルロック時は安全にスキップ）
        for fp in set(files_to_delete):
            try:
                os.remove(fp)
                deleted_count += 1
                logging.info(f"Cleaned up old backup: {os.path.basename(fp)}")
            except PermissionError:
                logging.info(f"Backup file is currently open/locked, skipping cleanup for: {os.path.basename(fp)}")
            except OSError as del_err:
                logging.warning(f"Could not remove old backup {os.path.basename(fp)}: {del_err}")

    except Exception as e:
        logging.warning(f"Error during backup cleanup: {e}")

    return deleted_count

def create_backup(excel_file: str, backup_dir: Optional[str] = None) -> Optional[str]:
    """
    Create a timestamped backup of the Excel file.
    Returns the backup file path if successful, None otherwise.
    同時に古いバックアップの世代管理クリーンアップも実行する。
    """
    if not os.path.exists(excel_file):
        return None
        
    try:
        base_dir = os.path.dirname(excel_file)
        if backup_dir is None:
            backup_dir = os.path.join(base_dir, 'backup')
            
        os.makedirs(backup_dir, exist_ok=True)
        
        filename = os.path.basename(excel_file)
        name, ext = os.path.splitext(filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f"{name}_backup_{timestamp}{ext}"
        backup_path = os.path.join(backup_dir, backup_filename)
        
        # Copy file with metadata
        shutil.copy2(excel_file, backup_path)
        logging.info(f"Backup created: {backup_path}")

        # 世代管理クリーンアップ
        cleanup_old_backups(backup_dir, base_name=name, ext=ext.lstrip('.'), max_keep=30, max_age_days=14, min_keep=5)
        
        return backup_path
    except PermissionError as e:
        logging.warning(f"Permission denied creating backup (file may be in use): {e}")
        return None
    except Exception as e:
        logging.warning(f"Failed to create backup: {e}")
        return None

def get_cached_dataframe(filename: str, sheet_name: str) -> pd.DataFrame:
    """
    ExcelシートのDataFrameを取得。
    1. インメモリキャッシュを最優先参照
    2. SQLiteシャドウキャッシュを参照（mtimeが一致すれば超高速に復元）
    3. キャッシュ未存在またはmtime更新時はExcelから読み込み、SQLiteに保存
    """
    filename = os.path.basename(filename)
    excel_file = os.path.join(config.EXCEL_DIR, filename)
    
    if not os.path.exists(excel_file):
        logging.error(f"File not found: {excel_file}")
        raise HTTPException(status_code=404, detail=f"Excel file '{filename}' not found at {excel_file}")
    
    try:
        current_mtime = os.path.getmtime(excel_file)
    except OSError as e:
        logging.warning(f"Cannot access file metadata for {excel_file}: {e}")
        raise
    
    cache_key = (filename, sheet_name)
    
    # 1. インメモリキャッシュをチェック
    if cache_key in CACHE:
        cached_data = CACHE[cache_key]
        if cached_data['mtime'] == current_mtime:
            return cached_data['df'].copy()

    cache_id = hashlib.md5(f"{filename}_{sheet_name}".encode('utf-8')).hexdigest()
    table_name = f"sheet_{cache_id}"

    # 2. SQLiteシャドウキャッシュをチェック
    try:
        with _get_sqlite_conn() as conn:
            cursor = conn.execute(
                "SELECT mtime FROM _cache_meta WHERE cache_id = ?",
                (cache_id,)
            )
            row = cursor.fetchone()
            if row and row[0] == current_mtime:
                df = pd.read_sql_query(f'SELECT * FROM [{table_name}]', conn)
                logging.debug(f"Loaded {filename} ({sheet_name}) from SQLite cache ({len(df)} rows)")
                CACHE[cache_key] = {'mtime': current_mtime, 'df': df}
                return df.copy()
    except Exception as e:
        logging.warning(f"SQLite cache lookup failed: {e}")

    # 3. Excel原本から読み込んでSQLiteに保存
    try:
        logging.debug(f"Reading Excel {excel_file}, sheet={sheet_name}")
        df = pd.read_excel(excel_file, sheet_name=sheet_name, header=0)
        
        CACHE[cache_key] = {'mtime': current_mtime, 'df': df}
        
        try:
            with _get_sqlite_conn() as conn:
                df.to_sql(table_name, conn, if_exists='replace', index=False)
                now_str = datetime.now().isoformat()
                conn.execute(
                    """
                    INSERT OR REPLACE INTO _cache_meta 
                    (cache_id, filename, sheet_name, mtime, updated_at) 
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (cache_id, filename, sheet_name, current_mtime, now_str)
                )
                conn.commit()
            logging.debug(f"Saved {filename} ({sheet_name}) to SQLite cache")
        except Exception as e:
            logging.warning(f"Failed to save SQLite cache: {e}")
            
        return df.copy()
    except (PermissionError, OSError) as e:
        # ファイルロック・ネットワーク障害はそのまま上位に伝播（リトライ可能）
        logging.warning(f"File access error reading Excel {excel_file}: {type(e).__name__}: {e}")
        raise
    except Exception as e:
        logging.error(f"Reading Excel failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error reading Excel file: {str(e)}")

