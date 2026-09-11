import os
import sys
import json
import logging
import pandas as pd

def get_base_path():
    """EXEの実行ディレクトリ（config.json、ログ等の外部ファイル用）"""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

def get_bundle_path():
    """バンドルデータのディレクトリ（PyInstaller展開先のstatic等用）"""
    if getattr(sys, '_MEIPASS', None):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

BASE_DIR = get_base_path()
BUNDLE_DIR = get_bundle_path()
STATIC_DIR = os.path.join(BUNDLE_DIR, "static")

# Load configuration
def get_raw_config() -> dict:
    config_path = os.path.join(BASE_DIR, 'config.json')
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8-sig') as f:
                return json.load(f)
        except Exception as e:
            logging.warning(f"Failed to load config.json: {e}")
    return {}

_RAW_CONFIG = get_raw_config()

import socket
import threading
import time

# Host reachability cache to prevent repeated socket probe delays (host -> (reachable, expire_time))
_HOST_CACHE = {}
_HOST_CACHE_LOCK = threading.Lock()

def is_network_path_accessible(path: str, timeout: float = 0.4) -> bool:
    r"""
    パスがネットワーク共有（UNCパス \\Host\Share）の場合、Windows OSのSMBタイムアウト待ち（30〜60秒）
    でプロセスがフリーズするのを防ぐため、事前にSMBポート（445）へのソケット接続を高速プローブ。
    接続できない場合は即座に False を返す。ローカルパスの場合は os.path.exists を使用。
    """
    if not path:
        return False

    # UNCパス判定 (\\server\share または //server/share)
    if path.startswith(r'\\') or path.startswith('//'):
        stripped = path.lstrip(r'\/')
        host = stripped.replace('/', '\\').split('\\')[0]
        if not host:
            return False

        now = time.time()
        with _HOST_CACHE_LOCK:
            if host in _HOST_CACHE:
                cached_res, exp = _HOST_CACHE[host]
                if now < exp:
                    if not cached_res:
                        return False
                    # ホスト疎通確認済みかつ期限内の場合、パス末尾がホスト/共有名のみなら即座にTrue
                    if path.rstrip(r'\/') == rf"\\{host}":
                        return True

        result = [False]
        def probe():
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(min(timeout, 0.25))
            try:
                err = s.connect_ex((host, 445))
                if err == 0:
                    result[0] = os.path.exists(path)
            except Exception:
                pass
            finally:
                try:
                    s.close()
                except Exception:
                    pass

        th = threading.Thread(target=probe, daemon=True)
        th.start()
        th.join(timeout=timeout)

        with _HOST_CACHE_LOCK:
            # Wi-Fi切断を即座に検知できるようTTLを短縮（3秒）
            ttl = 3.0 if result[0] else 2.0
            _HOST_CACHE[host] = (result[0], time.time() + ttl)

        return result[0]


    try:
        return os.path.exists(path)
    except Exception:
        return False

DEFAULT_NETWORK_PATH = r'\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\02：営業日報\2026年度'

def resolve_excel_dir() -> str:
    path = _RAW_CONFIG.get('excel_dir')
    if path:
        logging.info(f"Loaded raw config path: {path}")
        if not os.path.isabs(path):
            path = os.path.abspath(os.path.join(BASE_DIR, path))
            logging.info(f"Resolved relative path to absolute: {path}")
        if is_network_path_accessible(path, timeout=0.4):
            logging.info(f"Using configured Excel path: {path}")
            return path
        else:
            logging.warning(f"Configured Excel path not accessible: {path}")

    if is_network_path_accessible(DEFAULT_NETWORK_PATH, timeout=0.4):
        logging.info(f"Fallback 1: Using network shared directory: {DEFAULT_NETWORK_PATH}")
        return DEFAULT_NETWORK_PATH

    local_data_path = os.path.abspath(os.path.join(BASE_DIR, 'data'))
    if os.path.exists(local_data_path):
        logging.info(f"Fallback 2: Using local data directory (offline mode): {local_data_path}")
        return local_data_path

    simple_data_path = os.path.abspath(os.path.join(BASE_DIR, 'DailyReportSystem_2026_Simple', 'data'))
    if os.path.exists(simple_data_path):
        logging.info(f"Fallback 3: Using simple package data directory: {simple_data_path}")
        return simple_data_path

    logging.info(f"No existing paths found. Fallback to default local data path: {local_data_path}")
    return local_data_path

EXCEL_DIR = resolve_excel_dir()

# デザインデータディレクトリ（config.json で上書き可能）
DESIGN_DIR = _RAW_CONFIG.get(
    'design_dir',
    r'\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\03：デザインデータ'
)

# 企画課デザインビューアURL（config.json で上書き可能）
VIEWER_URL = _RAW_CONFIG.get('viewer_url', 'http://192.168.1.5:8888').rstrip('/')

# --- Global Sales Data Storage ---
DATA_DIR = os.path.join(BASE_DIR, 'data')
SALES_CSV_PATH = os.path.join(DATA_DIR, 'sales_data.csv')
SQLITE_CACHE_DB = _RAW_CONFIG.get('sqlite_cache_db', os.path.join(DATA_DIR, 'shadow_cache.db'))
os.makedirs(DATA_DIR, exist_ok=True)

# Global DataFrame to hold sales data
global_sales_df = None

def load_sales_data():
    """Loads sales data from CSV into global DataFrame."""
    global global_sales_df
    if not os.path.exists(SALES_CSV_PATH):
        logging.info("No existing sales data found.")
        return

    try:
        logging.info("Loading sales data from disk...")
        try:
            df = pd.read_csv(SALES_CSV_PATH, encoding='cp932')
        except Exception:
            df = pd.read_csv(SALES_CSV_PATH, encoding='utf-8')
        
        df.columns = [str(col).strip() for col in df.columns]
        
        if '得意先コード' in df.columns:
            df['得意先コード'] = df['得意先コード'].astype(str).str.split('.').str[0]
            global_sales_df = df
            logging.info(f"Sales data loaded successfully. {len(df)} rows.")
        else:
            logging.error("Sales CSV missing '得意先コード' column.")
    except Exception as e:
        logging.error(f"Failed to load sales data: {e}")

# Load on startup
load_sales_data()

# Find a default Excel file dynamically
def get_default_excel_file() -> str:
    """利用可能なExcelファイルの既定値を特定（オフライン時はSQLiteキャッシュから最新参照ファイルを特定）"""
    global EXCEL_DIR
    if is_network_path_accessible(EXCEL_DIR, timeout=0.3):
        try:
            files = [f for f in os.listdir(EXCEL_DIR) if f.endswith('.xlsm') and not f.startswith('~$')]
            if files:
                logging.info(f"Set default Excel file from directory: {files[0]}")
                return files[0]
        except Exception:
            pass

    # オフライン時: SQLiteシャドウキャッシュに保存されている最新ファイル名を使用
    try:
        if os.path.exists(SQLITE_CACHE_DB):
            import sqlite3
            with sqlite3.connect(SQLITE_CACHE_DB, timeout=2.0) as conn:
                cur = conn.execute(
                    "SELECT filename FROM _cache_meta WHERE filename LIKE '%.xlsm' ORDER BY updated_at DESC LIMIT 1"
                )
                row = cur.fetchone()
                if row and row[0]:
                    logging.info(f"Set default Excel file from SQLite cache: {row[0]}")
                    return row[0]
    except Exception as e:
        logging.debug(f"Could not read default file from SQLite cache: {e}")

    return "daily_report_template.xlsm"

DEFAULT_EXCEL_FILE = get_default_excel_file()

