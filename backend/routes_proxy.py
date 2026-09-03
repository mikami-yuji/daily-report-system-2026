from fastapi import APIRouter, Request, Response, HTTPException
import requests
import logging
from typing import Dict, Any, Optional

import config

router = APIRouter()

# サーバーサイドでビューアのCookieを一定期間キャッシュ
_cached_viewer_cookies: Dict[str, str] = {}

# Cookieの有効期間: 30日間 (30 * 24 * 60 * 60 秒)
COOKIE_MAX_AGE = 30 * 24 * 60 * 60

@router.get("/api/proxy/design-requests")
def proxy_design_requests(request: Request, response: Response, passcode: Optional[str] = None) -> Dict[str, Any]:
    """
    企画課デザインビューア の /api/documents から最新のデザイン依頼書データを取得します。
    Cookieが401エラー（セッション切れ）になり、かつパスコードが指定されている場合は、自動でビューアのログインAPIを叩いてセッションを回復します。
    また、Cookieには30日間の有効期限を設定し、再起動後も維持されるようにします。
    """
    global _cached_viewer_cookies
    target_url = f"{config.VIEWER_URL}/api/documents"
    login_url = f"{config.VIEWER_URL}/api/login"
    
    # 1. クライアントからのCookieを取得、なければサーバーキャッシュを使用
    cookies = dict(request.cookies)
    if not cookies and _cached_viewer_cookies:
        cookies = dict(_cached_viewer_cookies)
    
    try:
        # 2. ビューアに一度リクエストを送信
        viewer_response = requests.get(target_url, cookies=cookies, timeout=5.0)
        
        # 3. 401（未ログイン）かつパスコードが指定されている場合は自動ログインを試行
        if viewer_response.status_code == 401 and passcode:
            logging.info("Unauthorized. Attempting auto-login to viewer using passcode...")
            login_res = requests.post(login_url, json={"passcode": passcode}, timeout=5.0)
            
            if login_res.status_code == 200:
                logging.info("Auto-login successful. Retrying documents API request...")
                new_cookies = login_res.cookies.get_dict()
                _cached_viewer_cookies = dict(new_cookies)
                
                # 新しいセッションCookieを使用してドキュメントを再取得
                viewer_response = requests.get(target_url, cookies=new_cookies, timeout=5.0)
                
                # 取得に成功した場合、この新しいCookieを日報システムのCookieとしてブラウザに30日間保存させる
                if viewer_response.status_code == 200:
                    for name, value in new_cookies.items():
                        response.set_cookie(
                            key=name,
                            value=value,
                            max_age=COOKIE_MAX_AGE,
                            httponly=True,
                            samesite="lax",
                            path="/"
                        )
            else:
                logging.warning("Auto-login failed: incorrect passcode")
        elif viewer_response.status_code == 200 and cookies:
            # 正常に取得できた場合もサーバーキャッシュを更新＆レスポンスCookieの期限を更新
            _cached_viewer_cookies = dict(cookies)
            for name, value in cookies.items():
                response.set_cookie(
                    key=name,
                    value=value,
                    max_age=COOKIE_MAX_AGE,
                    httponly=True,
                    samesite="lax",
                    path="/"
                )
        
        # 認証エラーの最終判定
        if viewer_response.status_code == 401:
            logging.warning("Viewer API returned 401 Unauthorized")
            response.status_code = 401
            return {"message": "企画課デザインビューアへのログイン（パスコード入力）が必要です", "documents": []}
            
        if viewer_response.status_code != 200:
            logging.error(f"Viewer API returned status code {viewer_response.status_code}")
            raise HTTPException(
                status_code=viewer_response.status_code, 
                detail=f"企画課ビューア側でエラーが発生しました (ステータス: {viewer_response.status_code})"
            )
            
        return viewer_response.json()
        
    except requests.exceptions.Timeout:
        logging.error("Timeout connecting to Viewer API")
        raise HTTPException(status_code=504, detail="企画課ビューアサーバーへの接続がタイムアウトしました")
    except requests.exceptions.ConnectionError as e:
        logging.error(f"Connection error to Viewer API: {e}")
        raise HTTPException(status_code=502, detail="企画課ビューアサーバーに接続できません (ネットワーク未接続またはサーバー停止中)")
    except Exception as e:
        logging.exception("Unexpected error in proxy_design_requests")
        raise HTTPException(status_code=500, detail=f"内部サーバーエラー: {str(e)}")
