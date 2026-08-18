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
        f = backup_dir / f"report_20260101_{i:02d}.xlsm"
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
    assert "report_20260101_09.xlsm" in remaining
    assert "report_20260101_05.xlsm" in remaining
    assert "report_20260101_00.xlsm" not in remaining


def test_cleanup_old_backups_by_age_with_min_keep(tmp_path):
    """30日以上経過したファイルの削除およびmin_keep保護のテスト"""
    backup_dir = tmp_path / "backup"
    backup_dir.mkdir()
    
    # 60日前のファイル8件を作成
    old_time = time.time() - (60 * 86400)
    for i in range(8):
        f = backup_dir / f"report_old_{i:02d}.xlsm"
        f.write_text(f"old backup {i}")
        os.utime(str(f), (old_time + i * 10, old_time + i * 10))
        
    # max_age_days=30, min_keep=3 でクリーンアップ
    deleted = cache.cleanup_old_backups(str(backup_dir), prefix="report_old_", max_keep=50, max_age_days=30, min_keep=3)
    assert deleted == 5  # 8件中5件削除、3件がmin_keep保護で維持
    
    remaining = os.listdir(str(backup_dir))
    assert len(remaining) == 3
