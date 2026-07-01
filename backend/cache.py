import os
import shutil
import pickle
import hashlib
import logging
from datetime import datetime
from fastapi import HTTPException
import pandas as pd
import config

CACHE = {}

def create_backup(file_path):
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
    except Exception as e:
        logging.warning(f"Failed to create backup: {e}")

def get_cached_dataframe(filename: str, sheet_name: str) -> pd.DataFrame:
    filename = os.path.basename(filename)
    excel_file = os.path.join(config.EXCEL_DIR, filename)
    
    if not os.path.exists(excel_file):
        logging.error(f"File not found: {excel_file}")
        raise HTTPException(status_code=404, detail=f"Excel file '{filename}' not found at {excel_file}")
    
    current_mtime = os.path.getmtime(excel_file)
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
    except Exception as e:
        logging.error(f"Reading Excel failed: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error reading Excel file: {str(e)}")
