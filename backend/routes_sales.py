from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Request
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
import os
import shutil
import json
import logging
import asyncio
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




def sanitize_json_obj(obj):
    if isinstance(obj, dict):
        return {k: sanitize_json_obj(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [sanitize_json_obj(v) for v in obj]
    elif pd.isna(obj):
        return None
    elif hasattr(obj, 'item'):
        return obj.item()
    return obj

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
            
        return sanitize_json_obj(records)

    except Exception as e:
        logging.error(f"Error retrieving all sales data: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving data: {str(e)}")




import sales_importer

@router.get("/api/sales/sync-status")
async def get_sales_sync_status():
    """現在のAS/400基幹売上データの手動同期ステータスを取得"""
    try:
        status = sales_importer.get_as400_sync_status()
        return sanitize_json_obj(status)
    except Exception as e:
        logging.error(f"Error getting sales sync status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/sales/sync")
async def trigger_sales_sync():
    """基幹売上データの手動同期を実行（非同期スレッド実行）"""
    try:
        result = await asyncio.to_thread(sales_importer.run_manual_sync, True)
        return sanitize_json_obj(result)
    except Exception as e:
        logging.error(f"Error triggering sales sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/sales/backlog")
async def get_sales_backlog(
    sales_rep: Optional[str] = None,
    customer_code: Optional[str] = None,
    direct_dest: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    keyword: Optional[str] = None,
    limit: int = 500,
    offset: int = 0
):
    """
    AS/400の受注残・納期管理データを取得（納期ステータス別判定・サマリー集計付き）
    """
    try:
        res = sales_importer.query_as400_backlog_orders(
            sales_rep=sales_rep,
            customer_code=customer_code,
            direct_dest=direct_dest,
            status=status,
            start_date=start_date,
            end_date=end_date,
            keyword=keyword,
            limit=limit,
            offset=offset
        )
        return sanitize_json_obj(res)
    except Exception as e:
        logging.error(f"Error querying sales backlog: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/sales/{customer_code}")
async def get_sales_data(customer_code: str):
    """
    得意先コードの売上サマリーおよび直近購入履歴を取得。
    AS/400キャッシュを優先参照し、フォールバックで従来のグローバル売上データも参照可能。
    """
    target_code = str(customer_code).split('.')[0].strip().lstrip('0')
    
    # 1. AS/400の最新売上明細キャッシュ（SQLite）から取得を試みる
    try:
        as400_summary = sales_importer.get_customer_sales_summary(target_code)
        if as400_summary.get("found"):
            # 従来の sales_df に順位等があればマージ
            if config.global_sales_df is not None:
                matched_row = config.global_sales_df[config.global_sales_df['得意先コード'] == target_code]
                if not matched_row.empty:
                    row = matched_row.iloc[0]
                    rank_val = row.get('順位')
                    if pd.notna(rank_val):
                        try:
                            as400_summary["rank"] = int(rank_val)
                        except Exception:
                            as400_summary["rank"] = str(rank_val)
                    rank_cls = row.get('ランク')
                    if not as400_summary.get("rank_class") and pd.notna(rank_cls):
                        as400_summary["rank_class"] = str(rank_cls)
            return sanitize_json_obj(as400_summary)
    except Exception as e:
        logging.error(f"Error querying AS400 sales cache for {target_code}: {e}")

    # 2. フォールバック: 従来のグローバル売上データ
    if config.global_sales_df is None:
        return {"found": False, "message": "Sales data not yet uploaded."}
    
    try:
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
            "recent_orders": [],
            "updated_at": datetime.now().isoformat()
        }
        return sanitize_json_obj(data)

    except Exception as e:
        logging.error(f"Error retrieving sales data: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving data: {str(e)}")






