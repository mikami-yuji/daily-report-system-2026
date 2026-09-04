"""
管理者用：最新EXEのアップデートパッケージ作成＆配信スクリプト
使い方:
    python create_update_package.py [バージョン] [リリースノート(カンマ区切り)]
例:
    python create_update_package.py 2.4.1 "企画課ビューワ全PDF閲覧対応,全メンバー分析の文字重なり修正"
"""

import os
import sys
import json
import shutil
import hashlib
import time


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = BASE_DIR
DIST_EXE = os.path.join(BASE_DIR, "dist", "DailyReportServer.exe")

def calculate_sha256(file_path: str) -> str:
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            sha256.update(chunk)
    return sha256.hexdigest().lower()

def main():
    if not os.path.exists(DIST_EXE):
        print(f"[ERROR] {DIST_EXE} が見つかりません。先に pyinstaller でビルドしてください。")
        sys.exit(1)

    # バージョン取得
    if len(sys.argv) > 1:
        version = sys.argv[1].strip()
    else:
        version = input("リリースバージョンを入力してください (例: 2.4.1): ").strip()
    if not version:
        print("[ERROR] バージョンが指定されていません。")
        sys.exit(1)

    # version.py の整合性チェック
    version_py_path = os.path.join(PROJECT_ROOT, "backend", "version.py")
    if os.path.exists(version_py_path):
        with open(version_py_path, "r", encoding="utf-8") as vf:
            v_content = vf.read()
        if f'__version__ = "{version}"' not in v_content:
            print(f"\n[WARNING] 警告: backend/version.py のバージョン定義が '{version}' と一致していません！")
            print(f"          ビルドされたEXEが自身を古いバージョンと認識する恐れがあります。")
            print(f"          リリース前には必ず version.py を更新して再ビルドしてください。\n")

    # リリースノート取得
    if len(sys.argv) > 2:
        notes_input = sys.argv[2]
        notes = [n.strip() for n in notes_input.split(",") if n.strip()]
    else:
        notes_input = input("リリースノート（カンマ区切り、空欄なら既定値）: ").strip()
        if notes_input:
            notes = [n.strip() for n in notes_input.split(",") if n.strip()]
        else:
            notes = ["機能改善および安定性の向上"]

    file_size = os.path.getsize(DIST_EXE)
    sha256_hash = calculate_sha256(DIST_EXE)

    print(f"\n--- パッケージ情報 ---")
    print(f"バージョン: v{version}")
    print(f"ファイルサイズ: {file_size:,} bytes")
    print(f"SHA256ハッシュ: {sha256_hash}")
    print(f"リリースノート: {notes}\n")

    # 配信先ディレクトリの決定
    default_unc = r"\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\02：営業日報\2026年度\_app_update"
    target_dirs = []
    
    # ローカルの _app_update ディレクトリ
    local_target = os.path.join(BASE_DIR, "_app_update")
    os.makedirs(local_target, exist_ok=True)
    target_dirs.append(local_target)

    # 共有ネットワークフォルダが接続可能なら追加
    if os.path.exists(os.path.dirname(default_unc)):
        try:
            os.makedirs(default_unc, exist_ok=True)
            target_dirs.append(default_unc)
            print(f"[INFO] 共有ネットワーク配信先を検出: {default_unc}")
        except Exception as e:
            print(f"[WARN] 共有ネットワークフォルダへの書き込みに失敗: {e}")

    release_date = time.strftime("%Y-%m-%d")
    version_data = {
        "version": version,
        "releaseDate": release_date,
        "fileName": f"DailyReportServer_v{version}.exe",
        "fileSize": file_size,
        "sha256": sha256_hash,
        "forceUpdate": False,
        "releaseNotes": notes
    }

    for t_dir in target_dirs:
        print(f"\n[{t_dir}] へ配置中...")
        # 1. バージョン付きEXEと標準EXEの両方をコピー（version.jsonより先！）
        dest_ver_exe = os.path.join(t_dir, f"DailyReportServer_v{version}.exe")
        dest_std_exe = os.path.join(t_dir, "DailyReportServer.exe")
        
        print(f" -> コピー中: {dest_ver_exe}")
        shutil.copy2(DIST_EXE, dest_ver_exe)
        shutil.copy2(DIST_EXE, dest_std_exe)

        # 2. 最後に version.json を配置（不完全ダウンロードの防止）
        dest_json = os.path.join(t_dir, "version.json")
        print(f" -> version.json 作成: {dest_json}")
        with open(dest_json, "w", encoding="utf-8") as f:
            json.dump(version_data, f, ensure_ascii=False, indent=2)

    print("\n[SUCCESS] アップデートパッケージの作成・配置が完了しました！")

if __name__ == "__main__":
    main()
