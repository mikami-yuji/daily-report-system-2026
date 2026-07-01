import os
import sys

# Add backend directory to sys.path to allow importing config
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import config

def test_get_base_path():
    base_path = config.get_base_path()
    assert isinstance(base_path, str)
    assert os.path.exists(base_path)

def test_get_bundle_path():
    bundle_path = config.get_bundle_path()
    assert isinstance(bundle_path, str)
    assert os.path.exists(bundle_path)

def test_excel_dir_exists():
    assert isinstance(config.EXCEL_DIR, str)
    # The excel directory itself might be a mock, local, or network folder, but it should be set
    assert config.EXCEL_DIR != ""
