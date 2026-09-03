import os
import sys
import json
import time
import shutil
import hashlib
import logging
import threading
import subprocess
from typing import Dict, Any, Optional

import config
from version import __version__, __build_date__

logger = logging.getLogger(__name__)

def parse_version(ver_str: str) -> tuple:
    """バージョン文字列 ('2.4.1') を比較可能な数値タプル (2, 4, 1) に変換"""
    try:
        clean_str = ver_str.strip().lstrip('v').lstrip('V')
        parts = [int(p) for p in clean_str.split('.') if p.isdigit()]
        return tuple(parts)
    except Exception:
        return (0, 0, 0)

def get_update_dir() -> Optional[str]:
    """共有サーバー上の _app_update ディレクトリパスを特定"""
    # 1. config.json に明示的な指定があればそれを使用
    custom_update_dir = config._RAW_CONFIG.get('update_dir')
    if custom_update_dir and os.path.exists(custom_update_dir):
        return custom_update_dir

    # 2. Excel日報フォルダの同一階層または親階層の _app_update を検索
    try:
        excel_dir = config.resolve_excel_dir()
        candidate = os.path.join(excel_dir, "_app_update")
        if os.path.exists(candidate):
            return candidate
    except Exception as e:
        logger.debug(f"Failed to check excel_dir/_app_update: {e}")

    # 3. 既定のUNCパス
    default_unc = r"\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\02：営業日報\2026年度\_app_update"
    if os.path.exists(default_unc):
        return default_unc

    # 4. ローカル検証用（開発環境の _app_update）
    local_dev = os.path.join(config.BASE_DIR, "_app_update")
    if os.path.exists(local_dev):
        return local_dev

    return None

def check_for_update() -> Dict[str, Any]:
    """
    最新バージョンが存在するか確認します。
    ネットワーク未接続時はフリーズを避けるため高速にスキップします。
    """
    current_ver = __version__
    result = {
        "current_version": current_ver,
        "build_date": __build_date__,
        "update_available": False,
        "latest_version": current_ver,
        "release_notes": [],
        "release_date": "",
        "file_size": 0,
        "force_update": False,
        "checked_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }

    update_dir = get_update_dir()
    if not update_dir:
        result["reason"] = "update_dir_not_found"
        return result

    version_file = os.path.join(update_dir, "version.json")
    if not os.path.exists(version_file):
        result["reason"] = "version_json_not_found"
        return result

    try:
        with open(version_file, "r", encoding="utf-8-sig") as f:
            v_data = json.load(f)

        latest_ver = v_data.get("version", current_ver)
        if parse_version(latest_ver) > parse_version(current_ver):
            result["update_available"] = True
            result["latest_version"] = latest_ver
            result["release_notes"] = v_data.get("releaseNotes", [])
            result["release_date"] = v_data.get("releaseDate", "")
            result["file_size"] = v_data.get("fileSize", 0)
            result["force_update"] = v_data.get("forceUpdate", False)
            result["file_name"] = v_data.get("fileName", "DailyReportServer.exe")
        else:
            result["update_available"] = False
            result["reason"] = "already_up_to_date"
    except Exception as e:
        logger.warning(f"Failed to check update: {e}")
        result["reason"] = f"error: {str(e)}"

    return result

def calculate_sha256(file_path: str) -> str:
    """ファイルのSHA256ハッシュ値を計算"""
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            sha256.update(chunk)
    return sha256.hexdigest().lower()

def apply_update() -> Dict[str, Any]:
    """
    共有フォルダから最新EXEを取得し、NTFS安全リネーム方式で差し替え・再起動します。
    """
    if not getattr(sys, 'frozen', False):
        return {
            "success": False,
            "message": "開発環境（Pythonスクリプト実行時）は自動アップデートの対象外です（EXE実行時のみ有効です）。"
        }

    current_exe = sys.executable
    app_dir = os.path.dirname(current_exe)

    # 1. 自ディレクトリへの書き込み権限テスト
    test_file = os.path.join(app_dir, "perm_test.tmp")
    try:
        with open(test_file, "w") as f:
            f.write("test")
        os.remove(test_file)
    except Exception as e:
        return {
            "success": False,
            "message": f"アプリフォルダへの書き込み権限がありません（UAC等の権限エラー）: {e}"
        }

    update_dir = get_update_dir()
    if not update_dir:
        return {"success": False, "message": "アップデート共有フォルダが見つかりません。"}

    version_file = os.path.join(update_dir, "version.json")
    if not os.path.exists(version_file):
        return {"success": False, "message": "共有フォルダに version.json が存在しません。"}

    try:
        with open(version_file, "r", encoding="utf-8-sig") as f:
            v_data = json.load(f)
    except Exception as e:
        return {"success": False, "message": f"version.json の読み込みに失敗しました: {e}"}

    target_exe_name = v_data.get("fileName", "DailyReportServer.exe")
    source_exe = os.path.join(update_dir, target_exe_name)
    if not os.path.exists(source_exe):
        # fileName で見つからない場合、単一の DailyReportServer.exe を探索
        fallback_exe = os.path.join(update_dir, "DailyReportServer.exe")
        if os.path.exists(fallback_exe):
            source_exe = fallback_exe
        else:
            return {"success": False, "message": f"最新のEXEファイルが見つかりません: {source_exe}"}

    temp_exe = os.path.join(app_dir, "DailyReportServer.tmp")
    old_exe = os.path.join(app_dir, "DailyReportServer.exe.old")

    try:
        # 2. 一時ファイルとしてコピー（破損防止）
        logger.info(f"Copying update from {source_exe} to {temp_exe}...")
        shutil.copy2(source_exe, temp_exe)

        # 3. ファイルサイズおよびSHA256ハッシュ検証
        expected_size = v_data.get("fileSize")
        actual_size = os.path.getsize(temp_exe)
        if expected_size and expected_size > 0:
            if actual_size != expected_size:
                os.remove(temp_exe)
                return {
                    "success": False,
                    "message": f"ダウンロードしたファイルサイズが不一致です（取得: {actual_size} bytes, 期待: {expected_size} bytes）"
                }

        expected_hash = v_data.get("sha256", "").strip().lower()
        if expected_hash:
            actual_hash = calculate_sha256(temp_exe)
            if actual_hash != expected_hash:
                os.remove(temp_exe)
                return {
                    "success": False,
                    "message": f"SHA256ハッシュ検証に失敗しました（ファイル破損の可能性があるため中止しました）"
                }

        # 4. 既存の .old ファイルがあれば削除
        if os.path.exists(old_exe):
            try:
                os.remove(old_exe)
            except Exception as e:
                logger.warning(f"Could not remove old backup: {e}")

        # 5. Windows NTFS安全リネーム実行
        # 実行中の current_exe を .old にリネーム（Windowsはオープン中のリネームを許可）
        logger.info("Renaming current running EXE to .old...")
        os.rename(current_exe, old_exe)

        # 6. 新しい temp_exe を本来の EXE 名にリネーム
        logger.info(f"Renaming temp EXE to {current_exe}...")
        os.rename(temp_exe, current_exe)

        logger.info("Update applied successfully! Scheduling restart...")

        # 7. 新しいEXEを別プロセスとして起動し、自身を終了するタイマースレッド
        def restart_worker():
            # レスポンスがフロントエンドへ確実に届くよう1秒待機
            time.sleep(1.0)
            try:
                # Windowsで最も信頼性の高いGUIバックグラウンド起動（黒画面なし、ポート解放待機、自己削除）
                vbs_path = os.path.join(app_dir, "_restart_server.vbs")
                vbs_content = (
                    'WScript.Sleep 2000\r\n'
                    'Set WshShell = CreateObject("WScript.Shell")\r\n'
                    f'WshShell.CurrentDirectory = "{app_dir}"\r\n'
                    f'WshShell.Run """{current_exe}""", 1, False\r\n'
                    'Set fso = CreateObject("Scripting.FileSystemObject")\r\n'
                    'On Error Resume Next\r\n'
                    'fso.DeleteFile WScript.ScriptFullName\r\n'
                )
                with open(vbs_path, "w", encoding="cp932") as f:
                    f.write(vbs_content)

                DETACHED_PROCESS = 0x00000008
                CREATE_NEW_PROCESS_GROUP = 0x00000200
                subprocess.Popen(
                    ["wscript.exe", vbs_path],
                    cwd=app_dir,
                    creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP,
                    close_fds=True
                )
                logger.info("Restart VBScript spawned. Exiting current process...")
            except Exception as ex:
                logger.error(f"Failed to spawn restart command: {ex}")
            finally:
                time.sleep(0.3)
                # 自プロセス（旧バージョン）を即座に終了してポート8001を完全解放
                os._exit(0)

        threading.Thread(target=restart_worker, daemon=True).start()

        return {
            "success": True,
            "message": "アップデートを適用しました。約5秒後に新しいバージョンで自動起動します。",
            "latest_version": v_data.get("version")
        }

    except Exception as e:
        logger.exception("Failed during apply_update")
        # 失敗時のクリーンアップ
        if os.path.exists(temp_exe):
            try:
                os.remove(temp_exe)
            except Exception:
                pass
        return {"success": False, "message": f"アップデート適用中にエラーが発生しました: {str(e)}"}

def rollback_update() -> Dict[str, Any]:
    """万一の際に直前の .old バージョンに復元"""
    if not getattr(sys, 'frozen', False):
        return {"success": False, "message": "EXE実行環境でのみ利用可能です。"}

    current_exe = sys.executable
    app_dir = os.path.dirname(current_exe)
    old_exe = os.path.join(app_dir, "DailyReportServer.exe.old")

    if not os.path.exists(old_exe):
        return {"success": False, "message": "復元用の旧バージョン（.old）が存在しません。"}

    try:
        broken_exe = os.path.join(app_dir, "DailyReportServer.broken")
        if os.path.exists(broken_exe):
            os.remove(broken_exe)

        os.rename(current_exe, broken_exe)
        os.rename(old_exe, current_exe)

        return {"success": True, "message": "旧バージョンを復元しました。再起動してください。"}
    except Exception as e:
        return {"success": False, "message": f"ロールバックに失敗しました: {e}"}
