import os
import sys
import pytest
import shutil

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
