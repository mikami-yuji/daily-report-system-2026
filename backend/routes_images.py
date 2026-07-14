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

# Memory cache for design image lists to prevent network scan timeouts
IMAGE_LIST_CACHE = {}
CACHE_EXPIRY_MINUTES = 15

@router.get("/api/images/list")
def get_design_images(filename: str) -> dict:
    """
    Get list of images from the matching folder in Design Data directory.
    Target directory: \\Asahipack02\\社内書類ｎｅｗ\\01：部署別　営業部\\03：デザインデータ
    Logic: Extract name from filename '...【Name】.xlsm' -> Search folder containing 'Name'
    """
    filename = os.path.basename(filename)
    
    # Check memory cache first to prevent repeated heavy network scans
    cache_key = filename
    if cache_key in IMAGE_LIST_CACHE:
        cached_data = IMAGE_LIST_CACHE[cache_key]
        if datetime.now() - cached_data['timestamp'] < timedelta(minutes=CACHE_EXPIRY_MINUTES):
            logging.info(f"Returning cached design image list for {filename}")
            return {"images": cached_data['images'], "folder": cached_data['folder']}

    DESIGN_DIR = r"\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\03：デザインデータ"
    
    logging.info(f"--- get_design_images called with filename: {filename} ---")
    
    # 0. 手動マッピングチェック
    # 特定のファイル名を特定のフォルダ名または検索語句にマッピング
    FOLDER_MAPPING = {
        # 正確なファイル名 -> 正確なターゲットフォルダ名（または検索する部分文字列）
        "本社006　2025年度用日報【木村（拓）MGR】.xlsm": "大阪本社　05：木村（拓）",
    }
    
    matched_dir = None

    if filename in FOLDER_MAPPING:
        mapped_target = FOLDER_MAPPING[filename]
        logging.info(f"Manual mapping found for {filename}: {mapped_target}")
        
        # マッピングされたディレクトリが存在するか確認
        path_check = os.path.join(DESIGN_DIR, mapped_target)
        if os.path.isdir(path_check):
            matched_dir = mapped_target
            logging.info(f"Mapped directory verified: {matched_dir}")
        else:
             logging.warning(f"Mapped directory not found: {path_check}")
             # 通常の検索にフォールバックするか失敗させるか？ここではフォールバックします。
    
    if not matched_dir:
        try:
            # Extract name from filename (e.g., 本社009　2025年度用日報【沖本】.xlsm -> 沖本)
            import re
            # Helper for normalization
            def normalize_text(text):
                # Convert full-width parens and space to half-width
                text = text.replace('（', '(').replace('）', ')').replace('　', ' ')
                # Strip whitespace
                return text.strip()

            match = re.search(r'【(.*?)】', filename)
            if not match:
                logging.warning("Regex match failed for filename")
                # Fallback extraction?
                target_name = os.path.splitext(os.path.basename(filename))[0]
                logging.info(f"Fallback extracted name: {target_name}")
            else:
                target_name = match.group(1)
                logging.info(f"Regex extracted name: {target_name}")

            normalized_target = normalize_text(target_name)
            logging.info(f"Normalized target: {normalized_target}")
            
            # 接尾辞を削除
            # MGR/Mgr をリストに追加
            stripped_target = re.sub(r'(MGR|Mgr|次長|課長|部長|係長|主任|担当|顧問|専務|常務|社長)$', '', normalized_target, flags=re.IGNORECASE)
            logging.info(f"Stripped target: {stripped_target}")

            logging.debug(f"Searching for folder containing '{target_name}' (Norm: {normalized_target}) in {DESIGN_DIR}")
            
            if not os.path.exists(DESIGN_DIR):
                 logging.error(f"Design directory not found: {DESIGN_DIR}")
                 return {"message": "Design directory not found", "images": []}

            # Find matching directory
            
            try:
                dir_list = os.listdir(DESIGN_DIR)
                # logging.debug(f"Directory listing (first 5): {dir_list[:5]}")
            except Exception as e:
                logging.error(f"Failed to list directory: {e}")
                return {"message": f"Failed to access design dir: {e}", "images": []}

            # 1. Try exact match (normalized)
            for item in dir_list:
                if not os.path.isdir(os.path.join(DESIGN_DIR, item)):
                    continue
                    
                norm_item = normalize_text(item)
                if normalized_target in norm_item:
                    matched_dir = item
                    logging.info(f"Match found (Normalized): {item}")
                    break
            
            # 2. If no match, try suffix stripping (e.g. 山下(和)次長 -> 山下(和))
            if not matched_dir:
                if stripped_target != normalized_target:
                     logging.info("Retrying with stripped name...")
                     for item in dir_list:
                        if not os.path.isdir(os.path.join(DESIGN_DIR, item)):
                            continue
                        norm_item = normalize_text(item)
                        if stripped_target in norm_item:
                            matched_dir = item
                            logging.info(f"Match found (Stripped): {item}")
                            break
            
            if not matched_dir:
                logging.warning(f"No folder found for target: {normalized_target} / {stripped_target}")
                return {"message": f"No folder found for '{target_name}'", "images": []}
                
        except Exception as e:
             logging.error(f"Error during folder search logic: {e}")
             raise HTTPException(status_code=500, detail=str(e))
            
    try:
        target_path = os.path.join(DESIGN_DIR, matched_dir)
        logging.info(f"Target path: {target_path}")
        
        # 画像ファイルの抽出 (再帰的に探索)
        # 拡張子のフィルタ
        valid_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.pdf')
        
        image_files = []
        max_depth = 2
        
        # スタックを用いた高速な反復走査 (ディレクトリパスと探索深度を管理)
        stack = [(target_path, 0)]
        
        while stack:
            current_dir, depth = stack.pop()
            if depth > max_depth:
                continue
                
            try:
                with os.scandir(current_dir) as it:
                    for entry in it:
                        try:
                            if entry.is_file(follow_symlinks=False):
                                if entry.name.lower().endswith(valid_extensions):
                                    rel_path = os.path.relpath(entry.path, DESIGN_DIR)
                                    try:
                                        # Windowsのscandirではentry.stat()がキャッシュから返るため高速
                                        stat_res = entry.stat(follow_symlinks=False)
                                        mtime = stat_res.st_mtime
                                    except Exception:
                                        mtime = 0
                                    
                                    image_files.append({
                                        "name": entry.name,
                                        "path": rel_path,
                                        "folder": matched_dir,
                                        "mtime": mtime
                                    })
                            elif entry.is_dir(follow_symlinks=False):
                                if depth < max_depth:
                                    # ドットで始まる隠しフォルダはスキップ
                                    if not entry.name.startswith('.'):
                                        stack.append((entry.path, depth + 1))
                        except Exception as entry_err:
                            logging.warning(f"Error accessing entry in {current_dir}: {entry_err}")
                            continue
            except Exception as dir_err:
                logging.error(f"Error scanning directory {current_dir}: {dir_err}")
                continue
        
        # 更新日時順にソート (新しい画像が先頭)
        image_files.sort(key=lambda x: x['mtime'], reverse=True)
        
        result_images = image_files[:500]
        
        # Save to memory cache to prevent network timeout on subsequent loads
        IMAGE_LIST_CACHE[cache_key] = {
            "images": result_images,
            "folder": matched_dir,
            "timestamp": datetime.now()
        }
        
        return {"images": result_images, "folder": matched_dir}

    except Exception as e:
        logging.exception("Error in get_design_images")
        logging.error(f"Error listing images: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/api/images/content")
def serve_design_image(path: str):
    r"""
    Serve the image file content.
    path: Relative path from DESIGN_DIR (e.g., "大阪本社　09：沖本\image.jpg")
    """
    DESIGN_DIR = r"\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\03：デザインデータ"
    
    try:
        # Security check: Prevent directory traversal
        safe_path = os.path.normpath(os.path.join(DESIGN_DIR, path))
        
        try:
            # Verify the resolved path is strictly under DESIGN_DIR
            common = os.path.commonpath([os.path.abspath(DESIGN_DIR), os.path.abspath(safe_path)])
            if common != os.path.abspath(DESIGN_DIR):
                raise HTTPException(status_code=403, detail="Access denied")
        except ValueError:
            raise HTTPException(status_code=403, detail="Access denied")
            
        if not os.path.exists(safe_path):
            raise HTTPException(status_code=404, detail="Image not found")
            
        from fastapi.responses import FileResponse
        return FileResponse(safe_path)
    except HTTPException:
        raise
    except Exception as e:
         logging.error(f"Error in serve_design_image: {e}", exc_info=True)
         raise HTTPException(status_code=500, detail="Internal server error")



@router.get("/api/images/search")
def search_design_images(query: str, filename: Optional[str] = None):
    """
    Search for images matching the query (Design No) in the Design Data directory.
    If filename is provided (e.g. '見上.xlsm'), it tries to find a matching user folder first (e.g. '08：見上').
    Recursively searches subfolders.
    """
    if filename:
        filename = os.path.basename(filename)
    DESIGN_DIR = r"\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\03：デザインデータ"
    
    logging.info(f"--- search_design_images called. Query: {query}, Filename: {filename} ---")

    if not query or len(query.strip()) < 2:
        return {"message": "Query too short", "images": []}
        
    # Helper for normalization
    def normalize_text(text):
        # Convert full-width parens and space to half-width
        text = text.replace('（', '(').replace('）', ')').replace('　', ' ')
        # Strip whitespace
        return text.strip()

    try:
        if not os.path.exists(DESIGN_DIR):
             return {"message": "Design directory not found", "images": []}

        search_roots = [DESIGN_DIR]
        
        # Optimize: Try to find specific user folder based on filename
        found_folder = None
        if filename:
            try:
                # Extract name part
                # 1. Try to extract from 【】
                import re
                match = re.search(r'【(.*?)】', filename)
                if match:
                    name_part = match.group(1)
                else:
                    # 拡張子削除にフォールバック
                    name_part = os.path.splitext(os.path.basename(filename))[0]
                
                # 名前部分を正規化
                normalized_name = normalize_text(name_part)
                # 接尾辞（サフィックス）を削除したバージョンも用意
                stripped_name = re.sub(r'(MGR|Mgr|次長|課長|部長|係長|主任|担当|顧問|専務|常務|社長)$', '', normalized_name, flags=re.IGNORECASE)
                
                logging.info(f"Search optimization - Extracted: {name_part}, Norm: {normalized_name}, Stripped: {stripped_name}")

                # Use scandir for better performance on network drive for top-level listing
                with os.scandir(DESIGN_DIR) as it:
                    for entry in it:
                        if entry.is_dir():
                            norm_entry_name = normalize_text(entry.name)
                            # 抽出された名前（正規化済み）がフォルダ名（正規化済み）に含まれているか確認
                            if normalized_name in norm_entry_name:
                                found_folder = entry.path
                                logging.info(f"Optimization - Found folder (Norm): {entry.name}")
                                break
                            # 見つからない場合、接尾辞なしの名前を試す
                            if stripped_name != normalized_name and stripped_name in norm_entry_name:
                                found_folder = entry.path
                                logging.info(f"Optimization - Found folder (Stripped): {entry.name}")
                                break

                if found_folder:
                    logging.debug(f"Search target set to: {found_folder}")
                    search_roots = [found_folder]
            except Exception as e:
                logging.error(f"Failed to optimize search folder: {e}")
                logging.warning(f"Failed to optimize search folder: {e}")
                
        
        if found_folder:
            search_roots = [found_folder]
        else:
            if filename:
                 # print(f"WARN: Could not find user folder for {filename}. Aborting full scan to prevent timeout.")
                 logging.info("User folder not found from filename")
                 return {"message": "User folder not found from filename", "images": []}
            
            # If no filename provided, we search everything? That's dangerous too.
            search_roots = [DESIGN_DIR]

        image_files = []
        valid_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.pdf') 
        
        count = 0
        MAX_RESULTS = 50
        
        # Helper for safer walking on finicky network drives
        def safe_walk(directory, query_lower, extensions, max_depth=3, current_depth=0, parent_matches_query=False):
            results = []
            try:
                # Use listdir instead of scandir/walk to avoid hanging
                items = os.listdir(directory)
            except Exception as e:
                logging.warning(f"Failed to listdir {directory}: {e}")
                return results

            dirs_to_visit = []

            for name in items:
                full_path = os.path.join(directory, name)
                name_lower = name.lower()
                
                # Check file match
                # IF parent folder matched, we take ALL images.
                # IF not, we only take images matching query.
                is_file_match = False
                if parent_matches_query and name_lower.endswith(extensions):
                    is_file_match = True
                elif query_lower in name_lower and name_lower.endswith(extensions):
                    is_file_match = True
                
                if is_file_match:
                    try:
                        if os.path.isfile(full_path):
                            try:
                                rel_path = os.path.relpath(full_path, DESIGN_DIR)
                                folder_name = os.path.basename(directory)
                                try:
                                    mtime = os.path.getmtime(full_path)
                                except:
                                    mtime = 0
                                results.append({
                                    "name": name,
                                    "path": rel_path,
                                    "folder": folder_name,
                                    "mtime": mtime
                                })
                            except ValueError:
                                pass
                    except Exception:
                        pass
                
                # Identify directories for recursion
                if current_depth < max_depth:
                    next_parent_matches = parent_matches_query
                    
                    # Logic:
                    # 1. If parent already matched, we continue down (inheriting True).
                    # 2. If parent didn't match, verify if THIS folder matches.
                    if not next_parent_matches:
                        if query_lower in name_lower:
                            next_parent_matches = True
                    
                    # Recursion Filter:
                    # If we are NOT in a matching tree yet, we MUST skip unrelated folders 
                    # to avoid massive scan (timeout).
                    if not next_parent_matches:
                         # Skip unrelated folders
                         # BUT we must handle "Generic" folders like "Data", "Images", "Design", etc.
                         # AND we must skip "Specific" folders that don't match (e.g. "12345-1").
                         
                         # Heuristic:
                         # 1. If folder name looks like a Design ID (5+ digits, maybe hyphens), assume it's Specific.
                         #    If query is NOT in it, SKIP.
                         # 2. Otherwise, assume it's Generic (e.g. "Data", "2025", "01_Sales").
                         #    ENTER.
                         
                         is_specific_id = False
                         # Simple regex for design ID: typically 5-8 digits, optionally followed by hyphens/more digits
                         # e.g. 117675, 117675-1, 101219-106074-3
                         # But NOT "2025" (Year) or "01" (Section).
                         # Let's say "Specific" if it has 5 or more consecutive digits.
                         import re
                         if re.search(r'\d{5,}', name):
                             is_specific_id = True
                         
                         # Refinement: What if the query is SMALL? e.g. "555"?
                         # The query is usually a Design No (5-6 digits).
                         # If query is matches regex, it's specific.
                         
                         if is_specific_id and query_lower not in name_lower:
                             # It looks like a DIFFERENT specific ID. Skip.
                             continue
                         
                         # If it is generic (not super long digits) OR it matched query, we enter.
                         pass

                    if '.' in name and not name.startswith('.'):
                        continue 
                        
                    try:
                        if os.path.isdir(full_path):
                            dirs_to_visit.append((full_path, next_parent_matches))
                    except Exception:
                        pass
            
            # Recurse
            for subdir_path, matches_status in dirs_to_visit:
                 sub_results = safe_walk(subdir_path, query_lower, extensions, max_depth, current_depth + 1, matches_status)
                 results.extend(sub_results)
                 if len(results) >= 50: 
                     break
            
            return results

        # Main search loop
        try:
            for search_root in search_roots:
                logging.debug(f"Searching root: {search_root}")
                # Use custom walker
                # Initial parent_matches logic:
                # If the search_root ITSELF matches query (e.g. we targeted a specific user folder matched by filename, but query is DesignNo),
                # expected behavior: search for DesignNo INSIDE user folder.
                # So initial parent_matches = False usually.
                found_images = safe_walk(search_root, query.lower(), valid_extensions)
                image_files.extend(found_images)
                if len(image_files) >= MAX_RESULTS:
                    image_files = image_files[:MAX_RESULTS]
                    break
        except Exception as e:
            logging.error(f"Search loop failed: {e}")
            # Return whatever we found so far instead of 500
            pass
            
        # Sort by mtime descending (newest first)
        image_files.sort(key=lambda x: x['mtime'], reverse=True)

        return {"images": image_files, "query": query}

    except Exception as e:
        # print(f"Error searching images: {e}")
        # Log to file safely if needed, or just return detailed 500
        # Ensure 'e' conversion to string doesn't fail
        error_msg = "Unknown error"
        try:
            error_msg = str(e)
        except:
            pass
        raise HTTPException(status_code=500, detail=error_msg)


# --- Sales Data Integration ---
# --- Sales Data Integration (Global) ---


