import pytest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from routes_reports import _deduplicate_report_records

def test_deduplicate_report_records():
    # 1. 管理番号が重複するレコード
    dup_mgmt_records = [
        {"管理番号": 1001, "日付": "26/09/24", "訪問先名": "得意先A", "商談内容": "商談1"},
        {"管理番号": 1001, "日付": "26/09/24", "訪問先名": "得意先A", "商談内容": "商談1"},  # 重複
        {"管理番号": 1002, "日付": "26/09/24", "訪問先名": "得意先B", "商談内容": "商談2"},
        {"管理番号": 1002, "日付": "26/09/24", "訪問先名": "得意先B", "商談内容": "商談2"},  # 重複
    ]
    res = _deduplicate_report_records(dup_mgmt_records)
    assert len(res) == 2
    assert [r["管理番号"] for r in res] == [1001, 1002]

def test_deduplicate_negative_and_none_mgmt():
    # 2. 仮管理番号（負数）または管理番号無しの同一内容レコード
    records = [
        {"管理番号": -1, "日付": "26/09/25", "得意先CD": "123", "訪問先名": "テスト社", "商談内容": "商談内容A"},
        {"管理番号": -2, "日付": "26/09/25", "得意先CD": "123", "訪問先名": "テスト社", "商談内容": "商談内容A"},  # 内容が同一
        {"管理番号": -3, "日付": "26/09/25", "得意先CD": "999", "訪問先名": "別会社", "商談内容": "別商談"},
    ]
    res = _deduplicate_report_records(records)
    assert len(res) == 2
    assert res[0]["管理番号"] == -1
    assert res[1]["管理番号"] == -3
