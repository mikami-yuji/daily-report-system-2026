import os
import sys
import time
import sqlite3
import hashlib
import pytest
import pandas as pd

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import config
import cache
import sync_queue
import routes_reports
import models

def test_is_network_path_accessible_unreachable_speed():
    """存在しないUNCホストへのアクセス確認が0.6秒以内に高速にFalseを返すこと"""
    t0 = time.time()
    res = config.is_network_path_accessible(r'\\UnreachableHost99999\fake_share', timeout=0.4)
    elapsed = time.time() - t0
    assert res is False
    assert elapsed < 0.65, f"Network probe took too long: {elapsed}s"

def test_cache_offline_fallback(tmp_path):
    """Excel原本が存在しない場合でも、SQLiteシャドウキャッシュから正常にDataFrameを復元できること"""
    test_db = str(tmp_path / "test_shadow_cache.db")
    orig_db = config.SQLITE_CACHE_DB
    config.SQLITE_CACHE_DB = test_db

    try:
        # テスト用ダミーテーブルとメタデータをSQLiteに直接作成
        fake_filename = "支店999_【テスト】_2026年度用日報.xlsm"
        sheet_name = "営業日報"
        cache_id = hashlib.md5(f"{fake_filename}_{sheet_name}".encode('utf-8')).hexdigest()
        table_name = f"sheet_{cache_id}"

        dummy_df = pd.DataFrame([
            {"管理番号": 1, "日付": "2026-09-11", "訪問先名": "テスト株式会社", "商談内容": "オフラインテスト商談"},
            {"管理番号": 2, "日付": "2026-09-10", "訪問先名": "サンプル商事", "商談内容": "サンプル商談"}
        ])

        with sqlite3.connect(test_db) as conn:
            dummy_df.to_sql(table_name, conn, if_exists='replace', index=False)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS _cache_meta (
                    cache_id TEXT PRIMARY KEY,
                    filename TEXT,
                    sheet_name TEXT,
                    mtime REAL,
                    updated_at TEXT
                )
            """)
            conn.execute("""
                INSERT OR REPLACE INTO _cache_meta VALUES (?, ?, ?, ?, ?)
            """, (cache_id, fake_filename, sheet_name, 123456789.0, "2026-09-11T12:00:00"))
            conn.commit()

        # 原本ファイルが存在しないパスを設定
        orig_excel_dir = config.EXCEL_DIR
        config.EXCEL_DIR = str(tmp_path / "non_existent_folder")

        # get_cached_dataframe を呼び出し
        df = cache.get_cached_dataframe(fake_filename, sheet_name)
        assert df is not None
        assert len(df) == 2
        assert df.iloc[0]["訪問先名"] == "テスト株式会社"
        assert df.iloc[1]["商談内容"] == "サンプル商談"

    finally:
        config.SQLITE_CACHE_DB = orig_db
        config.EXCEL_DIR = orig_excel_dir

def test_api_files_offline_fallback(tmp_path):
    """EXCEL_DIRがオフライン/空の場合、list_excel_files がSQLiteキャッシュの全ファイルを復元して返すこと"""
    test_db = str(tmp_path / "test_shadow_cache_files.db")
    orig_db = config.SQLITE_CACHE_DB
    config.SQLITE_CACHE_DB = test_db

    orig_excel_dir = config.EXCEL_DIR
    config.EXCEL_DIR = str(tmp_path / "offline_folder_empty")
    os.makedirs(config.EXCEL_DIR, exist_ok=True)

    try:
        with sqlite3.connect(test_db) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS _cache_meta (
                    cache_id TEXT PRIMARY KEY,
                    filename TEXT,
                    sheet_name TEXT,
                    mtime REAL,
                    updated_at TEXT
                )
            """)
            conn.execute("INSERT INTO _cache_meta VALUES ('c1', '本社007_【三上】_2026年度用日報.xlsm', '営業日報', 100.0, '2026-09-11T10:00:00')")
            conn.execute("INSERT INTO _cache_meta VALUES ('c2', '支店001_【山田】_2026年度用日報.xlsm', '営業日報', 100.0, '2026-09-11T10:00:00')")
            conn.commit()

        data = routes_reports.list_excel_files()
        assert "files" in data
        filenames = [f["name"] for f in data["files"]]
        assert "本社007_【三上】_2026年度用日報.xlsm" in filenames
        assert "支店001_【山田】_2026年度用日報.xlsm" in filenames
        # キャッシュから復元されたファイルには is_cached: True が付与される
        for f in data["files"]:
            assert f.get("is_cached") is True

    finally:
        config.SQLITE_CACHE_DB = orig_db
        config.EXCEL_DIR = orig_excel_dir

def test_api_reports_offline_get_and_post(tmp_path):
    """原本不在時でも日報一覧取得(get_reports)が取得でき、新規作成(add_report)がsync_queueに安全退避されること"""
    test_db = str(tmp_path / "test_shadow_cache_api.db")
    orig_db = config.SQLITE_CACHE_DB
    config.SQLITE_CACHE_DB = test_db

    orig_excel_dir = config.EXCEL_DIR
    config.EXCEL_DIR = str(tmp_path / "offline_excel_dir")

    fake_file = "支店001_【山田】_2026年度用日報.xlsm"
    sheet_name = "営業日報"
    cache_id = hashlib.md5(f"{fake_file}_{sheet_name}".encode('utf-8')).hexdigest()
    table_name = f"sheet_{cache_id}"

    try:
        dummy_df = pd.DataFrame([
            {
                "管理番号": 101,
                "日付": "2026-09-11",
                "得意先CD": "12345",
                "訪問先名": "株式会社テスト",
                "商談内容": "提案内容の説明",
                "上長コメント": ""
            }
        ])

        with sqlite3.connect(test_db) as conn:
            dummy_df.to_sql(table_name, conn, if_exists='replace', index=False)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS _cache_meta (
                    cache_id TEXT PRIMARY KEY,
                    filename TEXT,
                    sheet_name TEXT,
                    mtime REAL,
                    updated_at TEXT
                )
            """)
            conn.execute("INSERT OR REPLACE INTO _cache_meta VALUES (?, ?, ?, ?, ?)",
                         (cache_id, fake_file, sheet_name, 100.0, "2026-09-11T10:00:00"))
            conn.commit()

        # 1. get_reports が正常にキャッシュから返ること
        reports = routes_reports.get_reports(fake_file)
        assert len(reports) == 1
        assert reports[0]["訪問先名"] == "株式会社テスト"

        # 2. add_report が原本不在を検知して sync_queue に退避されること
        from fastapi import BackgroundTasks
        new_report_payload = models.ReportInput(
            日付="2026-09-11",
            得意先CD="99999",
            訪問先名="オフライン先企業",
            面談者="田中様",
            商談内容="オフライン新規日報テスト",
            行動内容="訪問"
        )
        post_data = routes_reports.add_report(
            report=new_report_payload, 
            background_tasks=BackgroundTasks(), 
            filename=fake_file
        )
        assert post_data.get("status") == "queued"
        assert post_data.get("offline") is True
        assert sync_queue.get_pending_task_count() > 0

    finally:
        config.SQLITE_CACHE_DB = orig_db
        config.EXCEL_DIR = orig_excel_dir

def test_invalidate_cache_preserves_sqlite_when_offline(tmp_path):
    """オフライン環境（Excel原本アクセス不可）では、invalidate_cacheがSQLiteテーブルを破棄しないこと"""
    test_db = str(tmp_path / "test_offline_protect.db")
    orig_db = config.SQLITE_CACHE_DB
    orig_dir = config.EXCEL_DIR
    config.SQLITE_CACHE_DB = test_db
    config.EXCEL_DIR = str(tmp_path / "empty_nonexistent_dir")

    try:
        fake_file = "オフライン保護テスト.xlsm"
        sheet_name = "営業日報"
        cache_id = hashlib.md5(f"{fake_file}_{sheet_name}".encode('utf-8')).hexdigest()
        table_name = f"sheet_{cache_id}"

        dummy_df = pd.DataFrame([{"管理番号": 1, "訪問先名": "保護テスト"}])
        with sqlite3.connect(test_db) as conn:
            dummy_df.to_sql(table_name, conn, if_exists='replace', index=False)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS _cache_meta (
                    cache_id TEXT PRIMARY KEY,
                    filename TEXT,
                    sheet_name TEXT,
                    mtime REAL,
                    updated_at TEXT
                )
            """)
            conn.execute("INSERT OR REPLACE INTO _cache_meta VALUES (?, ?, ?, ?, ?)",
                         (cache_id, fake_file, sheet_name, 1.0, "2026-09-11T12:00:00"))
            conn.commit()

        # インメモリに載せる
        cache.CACHE[(fake_file, sheet_name)] = {'mtime': 1.0, 'df': dummy_df}

        # 通常の invalidate_cache を実行（clear_sqlite 未指定）
        cache.invalidate_cache(fake_file, sheet_name)

        # インメモリは消去されていること
        assert (fake_file, sheet_name) not in cache.CACHE

        # オフライン時はSQLiteテーブルおよび_cache_metaが保護され残っていること！
        with sqlite3.connect(test_db) as conn:
            cur = conn.execute("SELECT COUNT(*) FROM _cache_meta WHERE cache_id = ?", (cache_id,))
            assert cur.fetchone()[0] == 1
            cur = conn.execute(f"SELECT COUNT(*) FROM [{table_name}]")
            assert cur.fetchone()[0] == 1

        # その後 get_cached_dataframe を呼ぶと、SQLiteから安全に復元されること
        restored_df = cache.get_cached_dataframe(fake_file, sheet_name)
        assert len(restored_df) == 1
        assert restored_df.iloc[0]["訪問先名"] == "保護テスト"

    finally:
        config.SQLITE_CACHE_DB = orig_db
        config.EXCEL_DIR = orig_dir

