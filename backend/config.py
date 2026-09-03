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

def resolve_excel_dir() -> str:
    default_path = r'\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\02：営業日報\2026年度'
    path = _RAW_CONFIG.get('excel_dir')
    if path:
        logging.info(f"Loaded raw config path: {path}")
        if not os.path.isabs(path):
            path = os.path.abspath(os.path.join(BASE_DIR, path))
            logging.info(f"Resolved relative path to absolute: {path}")
        if os.path.exists(path):
            logging.info(f"Using configured Excel path: {path}")
            return path
        else:
            logging.warning(f"Configured Excel path does not exist: {path}")

    if os.path.exists(default_path):
        logging.info(f"Fallback 1: Using network shared directory: {default_path}")
        return default_path

    local_data_path = os.path.abspath(os.path.join(BASE_DIR, 'data'))
    if os.path.exists(local_data_path):
        logging.info(f"Fallback 2: Using local data directory: {local_data_path}")
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
DEFAULT_EXCEL_FILE = "daily_report_template.xlsm" # Fallback
if os.path.exists(EXCEL_DIR):
    files = [f for f in os.listdir(EXCEL_DIR) if f.endswith('.xlsm') and not f.startswith('~$')]
    if files:
        DEFAULT_EXCEL_FILE = files[0]
        logging.info(f"Set default Excel file to: {DEFAULT_EXCEL_FILE}")
    else:
        logging.warning("No .xlsm files found in directory. Using fallback default.")
