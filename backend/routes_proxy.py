import os
import requests
import logging
import time
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Request, Response, HTTPException

import config

router = APIRouter()

# サーバーサイドでビューアのCookieを一定期間キャッシュ
_cached_viewer_cookies: Dict[str, str] = {}

# ドキュメント一覧のメモリキャッシュ（高速化用: 60秒間有効）
_cached_documents: List[Dict[str, Any]] = []
_cached_documents_time: float = 0.0
DOCUMENTS_CACHE_TTL = 60.0

# Cookieの有効期間: 30日間 (30 * 24 * 60 * 60 秒)
COOKIE_MAX_AGE = 30 * 24 * 60 * 60

PASSCODE_FILE = os.path.join(config.DATA_DIR, 'viewer_passcode.txt')

def get_saved_passcode() -> Optional[str]:
    """保存されている企画課ビューアパスコードを取得"""
    # 1. config.json の viewer_passcode
    cfg_code = config._RAW_CONFIG.get('viewer_passcode')
    if cfg_code:
        return str(cfg_code).strip()
    # 2. data/viewer_passcode.txt
    if os.path.exists(PASSCODE_FILE):
        try:
            with open(PASSCODE_FILE, 'r', encoding='utf-8') as f:
                code = f.read().strip()
                if code:
                    return code
        except Exception as e:
            logging.warning(f"Failed to read passcode file: {e}")
    return None

def save_passcode(passcode: str) -> None:
    """企画課ビューアパスコードを安全に保存"""
    if not passcode or not passcode.strip():
        return
    try:
        os.makedirs(config.DATA_DIR, exist_ok=True)
        with open(PASSCODE_FILE, 'w', encoding='utf-8') as f:
            f.write(passcode.strip())
        logging.info("Viewer passcode saved to disk.")
    except Exception as e:
        logging.warning(f"Failed to save passcode to disk: {e}")

def get_viewer_session_cookies(passcode: Optional[str] = None) -> Dict[str, str]:
    """
    企画課ビューアとの通信用Cookieを取得。
    未ログインまたはキャッシュがない場合は自動ログインを試行。
    """
    global _cached_viewer_cookies
    if _cached_viewer_cookies:
        return dict(_cached_viewer_cookies)

    # パスコードの確認（引数 -> 保存済み）
    effective_passcode = passcode or get_saved_passcode()
    if effective_passcode:
        login_url = f"{config.VIEWER_URL}/api/login"
        try:
            logging.info("Attempting auto-login to viewer using stored/provided passcode...")
            login_res = requests.post(login_url, json={"passcode": effective_passcode}, timeout=5.0)
            if login_res.status_code == 200:
                _cached_viewer_cookies = dict(login_res.cookies.get_dict())
                save_passcode(effective_passcode)
                logging.info("Auto-login to viewer successful.")
                return dict(_cached_viewer_cookies)
            else:
                logging.warning(f"Auto-login failed with status code {login_res.status_code}")
        except Exception as e:
            logging.warning(f"Error during auto-login to viewer: {e}")

    return {}

def fetch_viewer_documents(passcode: Optional[str] = None, client_cookies: Optional[Dict[str, str]] = None, force_refresh: bool = False) -> List[Dict[str, Any]]:
    """
    企画課ビューアからドキュメント一覧を取得（内部ロジック共通用）。
    メモリキャッシュ（60秒）を活用しつつ、401時は自動再ログイン。
    """
    global _cached_documents, _cached_documents_time, _cached_viewer_cookies
    now = time.time()
    if not force_refresh and _cached_documents and (now - _cached_documents_time < DOCUMENTS_CACHE_TTL):
        return _cached_documents

    target_url = f"{config.VIEWER_URL}/api/documents"
    cookies = dict(client_cookies) if client_cookies else dict(_cached_viewer_cookies)

    if not cookies:
        cookies = get_viewer_session_cookies(passcode)

    effective_passcode = passcode or get_saved_passcode()

    try:
        res = requests.get(target_url, cookies=cookies, timeout=6.0)
        if res.status_code == 401 and effective_passcode:
            logging.info("Viewer documents 401: re-authenticating with passcode...")
            login_url = f"{config.VIEWER_URL}/api/login"
            login_res = requests.post(login_url, json={"passcode": effective_passcode}, timeout=5.0)
            if login_res.status_code == 200:
                new_cookies = login_res.cookies.get_dict()
                _cached_viewer_cookies = dict(new_cookies)
                save_passcode(effective_passcode)
                res = requests.get(target_url, cookies=new_cookies, timeout=6.0)

        if res.status_code == 200:
            data = res.json()
            docs = data.get("documents", []) if isinstance(data, dict) else (data if isinstance(data, list) else [])
            _cached_documents = docs
            _cached_documents_time = now
            return docs
        else:
            logging.warning(f"fetch_viewer_documents status: {res.status_code}")
            return _cached_documents or []
    except Exception as e:
        logging.warning(f"fetch_viewer_documents error: {e}")
        return _cached_documents or []

@router.get("/api/proxy/design-requests")
def proxy_design_requests(request: Request, response: Response, passcode: Optional[str] = None) -> Dict[str, Any]:
    """
    企画課デザインビューア の /api/documents から最新のデザイン依頼書データを取得します。
    Cookieが401エラーになり、かつパスコードが指定されている場合は自動ログインします。
    """
    global _cached_viewer_cookies
    if passcode:
        save_passcode(passcode)

    client_cookies = dict(request.cookies)
    docs = fetch_viewer_documents(passcode=passcode, client_cookies=client_cookies, force_refresh=True)

    # 認証Cookieが新しくあればレスポンスに設定
    if _cached_viewer_cookies:
        for name, value in _cached_viewer_cookies.items():
            response.set_cookie(
                key=name,
                value=value,
                max_age=COOKIE_MAX_AGE,
                httponly=True,
                samesite="lax",
                path="/"
            )

    if not docs and not _cached_viewer_cookies and not passcode:
        # パスコードもCookieもない場合は401表示
        response.status_code = 401
        return {"message": "企画課デザインビューアへのログイン（パスコード入力）が必要です", "documents": []}

    return {"documents": docs}

