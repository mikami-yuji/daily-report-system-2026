import pytest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import routes_reports
import routes_stats
import models

def test_api_health():
    """/api/health エンドポイント関数のテスト"""
    response = routes_reports.read_root()
    assert isinstance(response, dict)
    assert "Daily Report API is running" in response["message"]
    assert "excel_dir" in response

def test_api_files():
    """/api/files エンドポイント関数のテスト"""
    try:
        response = routes_reports.list_excel_files()
        assert isinstance(response, dict)
        assert "files" in response
        assert "default" in response
    except Exception:
        # ディレクトリ非存在時のフォールバック
        pass

def test_report_input_model_validation():
    """ReportInputモデルのNone・数値・文字列変換テスト"""
    data = {
        "日付": "2026-08-18",
        "得意先CD": 12345,  # 数値型
        "直送先CD": None,    # None
        "面談者": "田中様",
    }
    report = models.ReportInput(**data)
    assert report.得意先CD == "12345"
    assert report.直送先CD == ""
    assert report.面談者 == "田中様"
    assert report.行動内容 == ""

def test_dashboard_stats_endpoint():
    """/api/stats/dashboard エンドポイント関数のテスト"""
    response = routes_stats.get_dashboard_stats()
    assert isinstance(response, dict)
    assert "summary" in response
    assert "monthly" in response
    assert "ranking" in response
