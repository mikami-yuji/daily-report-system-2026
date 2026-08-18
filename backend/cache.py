import os
import shutil
import pickle
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException
import pandas as pd
import config

CACHE = {}

def cleanup_old_backups(backup_dir: str, prefix: str = "", max_keep: int = 50, max_age_days: int = 30, min_keep: int = 5) -> int:
    """
    バックアップディレクトリ内の古いバックアップファイルを自動クリーンアップします。
    - max_age_days（デフォルト30日）を超えた古いファイルを削除
    - 保持件数が max_keep（デフォルト50件）を超える場合、古い順に削除
    - 安全のため、最低 min_keep（デフォルト5件）は常に保持
    """
    if not os.path.exists(backup_dir):
        return 0

    deleted_count = 0
    now = datetime.now()
    cutoff_time = now - timedelta(days=max_age_days)

    try:
        # バックアップファイルを収集
        backup_files = []
        for f in os.listdir(backup_dir):
            if f.startswith('~$'):
                continue
            if prefix and not f.startswith(prefix):
                continue
            if f.endswith(('.xlsm', '.xlsx', '.csv')):
                fp = os.path.join(backup_dir, f)
                if os.path.isfile(fp):
                    try:
                        mtime = os.path.getmtime(fp)
                        backup_files.append((fp, datetime.fromtimestamp(mtime)))
                    except OSError:
                        continue

        # 新しい順（降順）にソート
        backup_files.sort(key=lambda x: x[1], reverse=True)

        total_files = len(backup_files)
        if total_files <= min_keep:
            return 0

        files_to_delete = []

        # 1. 30日経過したファイルを削除候補に（ただし最新min_keep件は保護）
        for idx, (fp, mtime) in enumerate(backup_files):
            if idx >= min_keep and mtime < cutoff_time:
                files_to_delete.append(fp)

        # 2. 残り件数が max_keep を超える場合、古い順に削除候補に追加
        remaining_files = [fp for fp, _ in backup_files if fp not in files_to_delete]
        if len(remaining_files) > max_keep:
            excess_files = remaining_files[max_keep:]
            files_to_delete.extend(excess_files)

        # 削除実行
        for fp in set(files_to_delete):
            try:
                os.remove(fp)
                deleted_count += 1
                logging.info(f"Cleaned up old backup: {fp}")
            except Exception as del_err:
                logging.warning(f"Failed to remove old backup {fp}: {del_err}")

    except Exception as e:
        logging.warning(f"Error during backup cleanup: {e}")

    return deleted_count


def create_backup(file_path: str, max_keep: int = 50, max_age_days: int = 30) -> Optional[str]:
    try:
        backup_dir = os.path.join(os.path.dirname(file_path), 'backup')
        if not os.path.exists(backup_dir):
            os.makedirs(backup_dir)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = os.path.basename(file_path)
        name, ext = os.path.splitext(filename)
        backup_filename = f"{name}_{timestamp}{ext}"
        backup_path = os.path.join(backup_dir, backup_filename)
        
        shutil.copy2(file_path, backup_path)
        logging.info(f"Backup created: {backup_path}")

        # バックアップ世代管理・クリーンアップ実行（同名ファイルのプレフィックスを対象）
        cleanup_old_backups(backup_dir, prefix=f"{name}_", max_keep=max_keep, max_age_days=max_age_days)

        return backup_path
    except Exception as e:
        logging.warning(f"Failed to create backup: {e}")
        return None

def get_cached_dataframe(filename: str, sheet_name: str) -> pd.DataFrame:
    filename = os.path.basename(filename)
    excel_file = os.path.join(config.EXCEL_DIR, filename)
    
    if not os.path.exists(excel_file):
        logging.error(f"File not found: {excel_file}")
        raise HTTPException(status_code=404, detail=f"Excel file '{filename}' not found at {excel_file}")
    
    try:
        current_mtime = os.path.getmtime(excel_file)
    except OSError as e:
        # ファイルのメタデータ取得失敗はそのまま上位に伝播（リトライ可能）
        logging.warning(f"Cannot access file metadata for {excel_file}: {e}")
        raise
    
    cache_key = (filename, sheet_name)
    
    if cache_key in CACHE:
        cached_data = CACHE[cache_key]
        if cached_data['mtime'] == current_mtime:
            return cached_data['df'].copy()

    CACHE_DIR = os.path.join(config.BASE_DIR, ".cache")
    if not os.path.exists(CACHE_DIR):
        os.makedirs(CACHE_DIR)
        
    cache_id = hashlib.md5(f"{filename}_{sheet_name}".encode('utf-8')).hexdigest()
    cache_path = os.path.join(CACHE_DIR, f"{cache_id}.pkl")
    
    try:
        if os.path.exists(cache_path):
            with open(cache_path, 'rb') as f:
                disk_cache = pickle.load(f)
            
            if disk_cache.get('mtime') == current_mtime:
                logging.debug(f"Loaded {filename} ({sheet_name}) from disk cache")
                df = disk_cache['df']
                CACHE[cache_key] = {'mtime': current_mtime, 'df': df}
                return df.copy()
    except Exception as e:
        logging.warning(f"Failed to load from disk cache: {e}")

    try:
        logging.debug(f"Reading Excel {excel_file}, sheet={sheet_name}")
        df = pd.read_excel(excel_file, sheet_name=sheet_name, header=0)
        
        CACHE[cache_key] = {'mtime': current_mtime, 'df': df}
        
        try:
            with open(cache_path, 'wb') as f:
                pickle.dump({'mtime': current_mtime, 'df': df}, f)
            logging.debug(f"Saved {filename} ({sheet_name}) to disk cache")
        except Exception as e:
            logging.warning(f"Failed to save disk cache: {e}")
            
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

