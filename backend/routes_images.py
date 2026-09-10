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
import requests
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

    DESIGN_DIR = config.DESIGN_DIR
    
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
    DESIGN_DIR = config.DESIGN_DIR
    
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



@router.get("/api/images/viewer-content")
def serve_viewer_image(url: str, request: Request):
    r"""
    Serve image/file content from 企画課デザインビューア via backend proxy.
    Attaches authenticated session cookies and streams content back to the client.
    """
    import urllib.parse
    target_path = urllib.parse.unquote(url)
    if not target_path.startswith('/'):
        target_path = '/' + target_path

    full_url = f"{config.VIEWER_URL}{target_path}"

    import routes_proxy
    client_cookies = dict(request.cookies)
    cookies = client_cookies if client_cookies else routes_proxy.get_viewer_session_cookies()

    try:
        r = requests.get(full_url, cookies=cookies, timeout=12.0, stream=True)
        if r.status_code == 401:
            # 認証切れの場合、自動再ログインして再試行
            fresh_cookies = routes_proxy.get_viewer_session_cookies()
            if fresh_cookies:
                r = requests.get(full_url, cookies=fresh_cookies, timeout=12.0, stream=True)

        if r.status_code == 200:
            content_type = r.headers.get("Content-Type", "image/jpeg")
            return StreamingResponse(
                r.raw,
                media_type=content_type,
                headers={
                    "Cache-Control": "public, max-age=86400",
                    "Content-Disposition": r.headers.get("Content-Disposition", "inline")
                }
            )
        else:
            logging.warning(f"Viewer image fetch failed with status {r.status_code} for {full_url}")
            raise HTTPException(status_code=r.status_code, detail=f"Viewer image fetch failed (status: {r.status_code})")
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error serving viewer image {url}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def extract_branch_no(filename: str) -> int:
    """ファイル名から枝番を抽出 (例: 120427-2-851-5kg.jpg -> 2, 120427_3.jpg -> 3)"""
    m = re.search(r'\d{4,}[-_](\d+)', filename)
    if m:
        try:
            return int(m.group(1))
        except ValueError:
            pass
    return 0


def extract_viewer_images_for_query(query: str, passcode: Optional[str] = None, client_cookies: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
    """
    企画課ビューアの全ドキュメントから query (デザインNo) に合致するカンプ画像・別紙を抽出
    """
    import routes_proxy
    import urllib.parse
    
    clean_query = query.strip().lower()
    docs = routes_proxy.fetch_viewer_documents(passcode=passcode, client_cookies=client_cookies)
    
    viewer_images = []
    
    # 4桁以上の数字部分（例: 120427）
    query_digits_match = re.search(r'\d{4,}', clean_query)
    query_digits = query_digits_match.group(0) if query_digits_match else clean_query

    for doc in docs:
        req_id = str(doc.get("requestId") or "").strip()
        sub_id = str(doc.get("subId") or "").strip()
        full_id = f"{req_id}-{sub_id}" if sub_id and sub_id != '0' else req_id
        submission_id = str(doc.get("submissionId") or "").strip()
        
        # 照合: requestId または full_id または submissionId に query が含まれるか
        is_match = False
        if clean_query in req_id.lower() or clean_query in full_id.lower():
            is_match = True
        elif query_digits and (query_digits in req_id or query_digits in submission_id):
            is_match = True
            
        if not is_match:
            continue
            
        # ドキュメントの日時（completedAt, requestedAt, deliveryDate等）
        mtime = 0.0
        date_str = doc.get("completedAt") or doc.get("requestedAt") or doc.get("deliveryDate") or doc.get("requestDate")
        if date_str:
            try:
                # ISO日時パース
                dt_str = str(date_str).replace('Z', '+00:00')
                if 'T' in dt_str:
                    dt = datetime.fromisoformat(dt_str)
                    mtime = dt.timestamp()
                else:
                    clean_d = re.sub(r'[^\d]', '', dt_str)[:8]
                    if len(clean_d) == 8:
                        dt = datetime.strptime(clean_d, "%Y%m%d")
                        mtime = dt.timestamp()
            except Exception:
                mtime = 0.0

        # 枝番を数値化（ソート用）
        branch_no = 0
        try:
            branch_no = int(sub_id) if sub_id else 0
        except ValueError:
            branch_no = 0
            
        planner_name = doc.get("planner") or "企画課"
        folder_label = f"企画課Web ({planner_name})"
        
        # 1. カンプ画像 (compImages)
        comp_images = doc.get("compImages") or []
        for idx, c_img in enumerate(comp_images):
            img_url = c_img.get("url")
            if not img_url:
                continue
            encoded_url = urllib.parse.quote(img_url)
            proxy_path = f"/api/images/viewer-content?url={encoded_url}"
            file_name = c_img.get("fileName") or f"{full_id} カンプ{f'({idx+1})' if len(comp_images) > 1 else ''}.jpg"
            
            viewer_images.append({
                "name": file_name,
                "path": proxy_path,
                "folder": folder_label,
                "mtime": mtime,
                "source": "viewer",
                "branch_no": branch_no,
                "requestId": req_id,
                "subId": sub_id,
                "docId": doc.get("id"),
                "status": doc.get("status"),
                "isViewerImage": True
            })
            
        # 2. 別紙 (attachments: 画像のみ)
        attachments = doc.get("attachments") or []
        for att in attachments:
            file_type = att.get("fileType")
            att_url = att.get("url")
            att_name = att.get("fileName") or ""
            is_img = file_type == "image" or any(att_name.lower().endswith(ext) for ext in ('.jpg', '.jpeg', '.png', '.webp'))
            if is_img and att_url:
                encoded_url = urllib.parse.quote(att_url)
                proxy_path = f"/api/images/viewer-content?url={encoded_url}"
                viewer_images.append({
                    "name": f"[別紙] {att_name}",
                    "path": proxy_path,
                    "folder": folder_label,
                    "mtime": mtime,
                    "source": "viewer",
                    "branch_no": branch_no,
                    "requestId": req_id,
                    "subId": sub_id,
                    "docId": doc.get("id"),
                    "isAttachment": True,
                    "isViewerImage": True
                })

    return viewer_images


def safe_walk(directory: str, query_lower: str, extensions: tuple, max_depth: int = 3, current_depth: int = 0, parent_matches_query: bool = False, max_results: int = 50) -> List[Dict[str, Any]]:
    """Recursively search for design images matching query in directory."""
    results = []
    DESIGN_DIR = config.DESIGN_DIR
    try:
        items = os.listdir(directory)
    except Exception as e:
        logging.warning(f"Failed to listdir {directory}: {e}")
        return results

    dirs_to_visit = []
    for name in items:
        full_path = os.path.join(directory, name)
        name_lower = name.lower()
        is_file_match = False
        if parent_matches_query and name_lower.endswith(extensions):
            is_file_match = True
        elif query_lower in name_lower and name_lower.endswith(extensions):
            is_file_match = True

        if is_file_match:
            try:
                if os.path.isfile(full_path):
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
            except Exception:
                pass

        if current_depth < max_depth:
            next_parent_matches = parent_matches_query
            if not next_parent_matches and query_lower in name_lower:
                next_parent_matches = True

            if not next_parent_matches:
                if re.search(r'\d{5,}', name) and query_lower not in name_lower:
                    continue

            if '.' in name and not name.startswith('.'):
                continue

            try:
                if os.path.isdir(full_path):
                    dirs_to_visit.append((full_path, next_parent_matches))
            except Exception:
                pass

    for subdir_path, matches_status in dirs_to_visit:
        sub_results = safe_walk(subdir_path, query_lower, extensions, max_depth, current_depth + 1, matches_status, max_results)
        results.extend(sub_results)
        if len(results) >= max_results:
            break
    return results


@router.get("/api/images/search")
def search_design_images(query: str, filename: Optional[str] = None, passcode: Optional[str] = None, request: Request = None):
    """
    Search for images matching the query (Design No) in both:
    1. 企画課デザインビューア (Webデータベース) - 最新成果物
    2. 営業部デザインデータディレクトリ (ファイルサーバー) - 過去の成果物
    Merges both sets, prioritizing latest branch numbers and newest timestamps.
    """
    if filename:
        filename = os.path.basename(filename)
    DESIGN_DIR = config.DESIGN_DIR
    
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
        # 1. 企画課Webデータベースから画像を抽出
        viewer_images = []
        try:
            client_cookies = dict(request.cookies) if request else None
            viewer_images = extract_viewer_images_for_query(query, passcode=passcode, client_cookies=client_cookies)
            logging.info(f"Viewer images found for query '{query}': {len(viewer_images)}")
        except Exception as ve:
            logging.warning(f"Failed to fetch viewer images for query '{query}': {ve}")

        # 2. ファイルサーバー (Asahipack02) の検索
        image_files = []
        valid_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.pdf') 
        MAX_RESULTS = 50

        if os.path.exists(DESIGN_DIR):
            search_roots = [DESIGN_DIR]
            found_folder = None
            if filename:
                try:
                    match = re.search(r'【(.*?)】', filename)
                    name_part = match.group(1) if match else os.path.splitext(os.path.basename(filename))[0]
                    normalized_name = normalize_text(name_part)
                    stripped_name = re.sub(r'(MGR|Mgr|次長|課長|部長|係長|主任|担当|顧問|専務|常務|社長)$', '', normalized_name, flags=re.IGNORECASE)

                    with os.scandir(DESIGN_DIR) as it:
                        for entry in it:
                            if entry.is_dir():
                                norm_entry_name = normalize_text(entry.name)
                                if normalized_name in norm_entry_name:
                                    found_folder = entry.path
                                    break
                                if stripped_name != normalized_name and stripped_name in norm_entry_name:
                                    found_folder = entry.path
                                    break
                    if found_folder:
                        search_roots = [found_folder]
                except Exception as e:
                    logging.warning(f"Failed to optimize search folder: {e}")

            try:
                for search_root in search_roots:
                    found_images = safe_walk(search_root, query.lower(), valid_extensions)
                    image_files.extend(found_images)
                    if len(image_files) >= MAX_RESULTS:
                        image_files = image_files[:MAX_RESULTS]
                        break
            except Exception as e:
                logging.error(f"Search loop failed: {e}")

        # 3. ファイルサーバー側の画像に枝番と属性を付与
        for f_img in image_files:
            f_img["branch_no"] = extract_branch_no(f_img.get("name", ""))
            f_img["source"] = "file_server"

        # 4. マージ & ソート (同一枝番・同名の重複排除)
        all_merged = list(viewer_images)
        
        # 企画課Web側に画像が存在する枝番のセット (例: {1, 2, 3, 4})
        viewer_branches = {
            v.get("branch_no") for v in viewer_images 
            if v.get("branch_no") is not None and v.get("branch_no") > 0
        }
        viewer_names = {v.get("name", "").lower() for v in viewer_images}

        for f_img in image_files:
            f_branch = f_img.get("branch_no", 0) or 0
            f_name = f_img.get("name", "").lower()
            
            # 1. 完全に同一ファイル名が企画課Web側にある場合はスキップ
            if f_name in viewer_names:
                continue
                
            # 2. 同一の枝番(branch_no > 0)が既に企画課Web側に存在する場合はスキップ（企画課Web側を優先して被りを防止）
            if f_branch > 0 and f_branch in viewer_branches:
                continue
                
            # 企画課Web側に存在しない枝番や、過去の画像のみを追加
            all_merged.append(f_img)

        # 3. パスやURLによる重複排除
        seen_paths = set()
        unique_merged = []
        for img in all_merged:
            p = img.get("path")
            if p and p in seen_paths:
                continue
            if p:
                seen_paths.add(p)
            unique_merged.append(img)

        # ソート基準: 枝番(branch_no)降順 -> 企画課Web優先 -> mtime降順
        def sort_key(img):
            b_no = img.get("branch_no", 0) or 0
            mt = img.get("mtime", 0.0) or 0.0
            is_viewer = 1 if img.get("source") == "viewer" else 0
            return (b_no, is_viewer, mt)

        unique_merged.sort(key=sort_key, reverse=True)

        return {
            "images": unique_merged[:MAX_RESULTS],
            "query": query,
            "viewer_count": len(viewer_images),
            "file_server_count": len(image_files)
        }

    except Exception as e:
        error_msg = "Unknown error"
        try:
            error_msg = str(e)
        except:
            pass
        logging.exception(f"Error searching images: {e}")
        raise HTTPException(status_code=500, detail=error_msg)


# --- Sales Data Integration ---
# --- Sales Data Integration (Global) ---


