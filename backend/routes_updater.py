from fastapi import APIRouter, HTTPException
import updater
from version import __version__, __build_date__

router = APIRouter(prefix="/api/version", tags=["version"])

@router.get("/current")
def get_current_version():
    """現在のローカルバージョン情報を取得"""
    return {
        "version": __version__,
        "build_date": __build_date__
    }

@router.get("/check")
def check_version():
    """共有サーバー上の最新バージョン情報を確認"""
    return updater.check_for_update()

@router.post("/apply")
def apply_update_endpoint():
    """最新EXEをダウンロードして差し替え＆再起動"""
    res = updater.apply_update()
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("message", "アップデートに失敗しました"))
    return res

@router.post("/rollback")
def rollback_update_endpoint():
    """旧バージョンへのロールバック"""
    res = updater.rollback_update()
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("message", "ロールバックに失敗しました"))
    return res

@router.post("/shutdown")
def shutdown_endpoint():
    """アプリ終了エンドポイント（アップデート適用後にユーザーの操作で終了）"""
    return updater.shutdown_server()

