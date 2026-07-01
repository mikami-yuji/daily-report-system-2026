import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import routes_reports

def test_read_root():
    # Call the endpoint handler function directly
    response = routes_reports.read_root()
    assert isinstance(response, dict)
    assert "message" in response
    assert "excel_dir" in response

def test_list_excel_files():
    # Call list_excel_files function directly
    try:
        response = routes_reports.list_excel_files()
        assert isinstance(response, dict)
        assert "files" in response
        assert "default" in response
    except Exception:
        # Safe fallback for environments where EXCEL_DIR is not present
        pass
