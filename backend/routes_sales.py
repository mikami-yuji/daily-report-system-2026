from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
import os
import shutil
import json
import logging
import re
import traceback
import math
import io
from datetime import datetime, timedelta
import pandas as pd
import openpyxl
import numpy as np
from copy import copy
from typing import Optional, List, Dict, Any

import config
import cache
import models

router = APIRouter()

@router.post("/api/sales/upload")
async def upload_sales_csv(file: UploadFile = File(...)):
    """
    Uploads a global sales data CSV file, saves it, and unloads it into memory.
    """
    try:
        logging.info(f"Receiving sales CSV: {file.filename}")
        contents = await file.read()
        
        import io
        try:
            pd.read_csv(io.BytesIO(contents), encoding='cp932')
        except:
            try:
                pd.read_csv(io.BytesIO(contents), encoding='utf-8')
            except Exception as e:
                raise HTTPException(status_code=400, detail="Invalid CSV format. Please use Shift-JIS or UTF-8.")

        with open(config.SALES_CSV_PATH, "wb") as f:
            f.write(contents)
        
        logging.info("Sales CSV saved to disk.")
        config.load_sales_data()
        
        return {"message": "Sales data uploaded and processed successfully."}

    except Exception as e:
        logging.error(f"Error uploading sales CSV: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")




@router.get("/api/sales/all")
async def get_all_sales_data():
    """
    Retrieves ALL sales data as a list.
    """
    if config.global_sales_df is None:
        return []

    try:
        # Convert NaN to None for JSON compliance
        df_clean = config.global_sales_df.where(pd.notnull(config.global_sales_df), None)
        
        # Select relevant columns and rename for consistency
        records = []
        for _, row in df_clean.iterrows():
            records.append({
                "rank": row.get('順位'),
                "rank_class": row.get('ランク'),
                "customer_code": row.get('得意先コード'),
                "customer_name": row.get('得意先名称'),
                "sales_amount": row.get('売上金額'),
                "gross_profit": row.get('粗利金額'),
                "sales_yoy": row.get('前年対比率'),
                "sales_last_year": row.get('前年売上'),
                "profit_last_year": row.get('前年粗利'),
                "sales_2y_ago": row.get('前々年売上'),
                "profit_2y_ago": row.get('前々年粗利'),
                # Attempt to get area from '地域名称' or '地域' or Column M (index 12)
                "area": row.get('地域名称') or row.get('地域') or (row.iloc[12] if len(row) > 12 else None),
                # 担当者 from Column I (index 8)
                "sales_rep": row.get('担当者') or (row.iloc[8] if len(row) > 8 else None),
            })
            
        return records

    except Exception as e:
        logging.error(f"Error retrieving all sales data: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving data: {str(e)}")




@router.get("/api/sales/{customer_code}")
async def get_sales_data(customer_code: str):
    """
    Retrieves sales data for a specific customer from the global dataset.
    """
    if config.global_sales_df is None:
        return {"found": False, "message": "Sales data not yet uploaded."}
    
    try:
        target_code = str(customer_code).split('.')[0]
        matched_row = config.global_sales_df[config.global_sales_df['得意先コード'] == target_code]
        
        if matched_row.empty:
            return {"found": False, "message": "Customer not found in sales data."}
        
        row = matched_row.iloc[0]
        
        def get_val(col):
            val = row.get(col)
            if pd.isna(val):
                return None
            if hasattr(val, 'item'): 
                return val.item() 
            return val

        from datetime import datetime
        data = {
            "found": True,
            "rank": get_val('順位'),
            "rank_class": get_val('ランク'),
            "sales_amount": get_val('売上金額'),
            "gross_profit": get_val('粗利金額'),
            "sales_yoy": get_val('前年対比率'),
            "sales_last_year": get_val('前年売上'),
            "profit_last_year": get_val('前年粗利'),
            "sales_2y_ago": get_val('前々年売上'),
            "profit_2y_ago": get_val('前々年粗利'),
            "customer_name": get_val('得意先名称'),
            "updated_at": datetime.now().isoformat()
        }
        return data

    except Exception as e:
        logging.error(f"Error retrieving sales data: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving data: {str(e)}")



