import os
import sys
import time
import pytest
import shutil
from datetime import datetime, timedelta

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import cache

def test_create_backup(tmp_path):
    # Create a dummy file to back up
    d = tmp_path / "sub"
    d.mkdir()
    dummy_file = d / "test_report.xlsm"
    dummy_file.write_text("dummy excel content")
    
    # Run backup function
    cache.create_backup(str(dummy_file))
    
    # Check if backup directory exists
    backup_dir = d / "backup"
    assert backup_dir.exists()
    assert backup_dir.is_dir()
    
    # Verify backup file got created
    backup_files = os.listdir(str(backup_dir))
    assert len(backup_files) == 1
    assert backup_files[0].startswith("test_report_")
    assert backup_files[0].endswith(".xlsm")


def test_cleanup_old_backups_by_count(tmp_path):
    """最大保持件数（max_keep）を超えたバックアップの削除テスト"""
    backup_dir = tmp_path / "backup"
    backup_dir.mkdir()
    
    # 10個のバックアップファイルを作成（タイムスタンプをずらす）
    created_files = []
    base_time = time.time() - 1000
    for i in range(10):
        f = backup_dir / f"report_20260101_1200{i:02d}.xlsm"
        f.write_text(f"backup {i}")
        os.utime(str(f), (base_time + i * 10, base_time + i * 10))
        created_files.append(f)
        
    assert len(os.listdir(str(backup_dir))) == 10
    
    # max_keep=5 でクリーンアップ
    deleted = cache.cleanup_old_backups(str(backup_dir), prefix="report_", max_keep=5, max_age_days=365, min_keep=2)
    assert deleted == 5
    
    remaining = os.listdir(str(backup_dir))
    assert len(remaining) == 5
    # 新しい5件（i=5..9）が残っていることを確認
    assert "report_20260101_120009.xlsm" in remaining
    assert "report_20260101_120005.xlsm" in remaining
    assert "report_20260101_120000.xlsm" not in remaining


def test_cleanup_old_backups_by_age_with_min_keep(tmp_path):
    """30日以上経過したファイルの削除およびmin_keep保護のテスト"""
    backup_dir = tmp_path / "backup"
    backup_dir.mkdir()
    
    # 60日前のファイル8件を作成
    old_time = time.time() - (60 * 86400)
    for i in range(8):
        f = backup_dir / f"report_old_20251201_1200{i:02d}.xlsm"
        f.write_text(f"old backup {i}")
        os.utime(str(f), (old_time + i * 10, old_time + i * 10))
        
    # max_age_days=30, min_keep=3 でクリーンアップ
    deleted = cache.cleanup_old_backups(str(backup_dir), prefix="report_old_", max_keep=50, max_age_days=30, min_keep=3)
    assert deleted == 5  # 8件中5件削除、3件がmin_keep保護で維持
    
    remaining = os.listdir(str(backup_dir))
    assert len(remaining) == 3


def test_cleanup_old_backups_exact_matching(tmp_path):
    """base_nameとextによる厳密一致判定（似た名前の別ファイルを巻き込まない）テスト"""
    backup_dir = tmp_path / "backup"
    backup_dir.mkdir()
    
    base_time = time.time() - (60 * 86400)
    
    # 1. "report" の古いバックアップ 10件
    for i in range(10):
        f = backup_dir / f"report_202601{i+1:02d}_120000.xlsm"
        f.write_text("report backup")
        os.utime(str(f), (base_time + i * 10, base_time + i * 10))
        
    # 2. 似た名前の "report_extra" の古いバックアップ 5件
    for i in range(5):
        f = backup_dir / f"report_extra_202601{i+1:02d}_120000.xlsm"
        f.write_text("report_extra backup")
        os.utime(str(f), (base_time + i * 10, base_time + i * 10))
        
    assert len(os.listdir(str(backup_dir))) == 15
    
    # "report" (.xlsm) のみを対象に max_keep=5 でクリーンアップ
    deleted = cache.cleanup_old_backups(
        str(backup_dir), 
        base_name="report", 
        ext=".xlsm", 
        max_keep=5, 
        max_age_days=365, 
        min_keep=2
    )
    assert deleted == 5
    
    remaining = os.listdir(str(backup_dir))
    assert len(remaining) == 10  # reportが5件残 + report_extraが5件すべて無傷で残
    
    # report_extra のファイルが一切削除されていないことを確認
    extra_files = [f for f in remaining if f.startswith("report_extra")]
    assert len(extra_files) == 5


def test_cleanup_never_deletes_original_or_non_backup_dir(tmp_path):
    """原本ファイルや原本ディレクトリが絶対に削除されない安全ガードのテスト"""
    # 1. 原本が存在するメインフォルダ（backup 以外の名前のフォルダ）
    main_data_dir = tmp_path / "data"
    main_data_dir.mkdir()
    original_excel = main_data_dir / "2026年度用日報.xlsm"
    original_excel.write_text("絶対に消してはならない原本データ")
    
    # 誤ってメインフォルダを cleanup に指定しても、削除は即座に拒否（0件）される
    deleted = cache.cleanup_old_backups(str(main_data_dir), base_name="2026年度用日報", ext=".xlsm", max_keep=0)
    assert deleted == 0
    assert original_excel.exists()
    assert original_excel.read_text() == "絶対に消してはならない原本データ"
    
    # 2. backup フォルダ内にタイムスタンプの無い原本同名ファイルが置かれていた場合でも保護
    backup_dir = tmp_path / "backup"
    backup_dir.mkdir()
    unnamed_file = backup_dir / "2026年度用日報.xlsm"
    unnamed_file.write_text("原本形式ファイル")
    
    # タイムスタンプサフィックスのないファイルは削除対象から完全除外
    deleted = cache.cleanup_old_backups(str(backup_dir), base_name="2026年度用日報", ext=".xlsm", max_keep=0)
    assert deleted == 0
    assert unnamed_file.exists()
