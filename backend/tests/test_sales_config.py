import os
import pytest
import pandas as pd
from unittest.mock import patch

import config

def test_resolve_sales_csv_path_default():
    """設定に sales_csv_path がない場合、デフォルトの data/sales_data.csv を返す"""
    with patch.dict(config._RAW_CONFIG, {}, clear=True):
        resolved = config.resolve_sales_csv_path()
        expected = os.path.join(config.DATA_DIR, 'sales_data.csv')
        assert os.path.normpath(resolved) == os.path.normpath(expected)

def test_resolve_sales_csv_path_custom_existing(tmp_path):
    """設定されたカスタムCSVが存在しアクセス可能な場合、そのパスを返す"""
    custom_csv = tmp_path / "custom_sales.csv"
    custom_csv.write_text("得意先コード,売上金額\n1001,50000\n", encoding="cp932")

    with patch.dict(config._RAW_CONFIG, {'sales_csv_path': str(custom_csv)}):
        with patch('config.is_network_path_accessible', return_value=True):
            resolved = config.resolve_sales_csv_path()
            assert os.path.normpath(resolved) == os.path.normpath(str(custom_csv))

def test_resolve_sales_csv_path_unreachable_fallback(tmp_path):
    """設定されたUNCパスがネットワーク未接続（オフライン）の場合、ローカルに安全フォールバックする"""
    unreachable_path = r"\\Asahipack02\Unreachable\sales.csv"

    with patch.dict(config._RAW_CONFIG, {'sales_csv_path': unreachable_path}):
        with patch('config.is_network_path_accessible', return_value=False):
            resolved = config.resolve_sales_csv_path()
            expected = os.path.join(config.DATA_DIR, 'sales_data.csv')
            assert os.path.normpath(resolved) == os.path.normpath(expected)

def test_load_sales_data_graceful_on_missing(tmp_path):
    """ファイルが存在しない場合でもエラーを出さずに None のままスキップする"""
    non_existent = tmp_path / "non_existent.csv"
    config.load_sales_data(str(non_existent))
    # 例外がスローされず正常終了することを確認

def test_load_sales_data_loads_custom_csv(tmp_path):
    """カスタムCSVが指定された場合に正しくグローバルDataFrameに読み込まれる"""
    csv_file = tmp_path / "test_sales.csv"
    csv_content = "得意先コード,順位,ランク,売上金額\n2001.0,1,A,100000\n2002,2,B,50000\n"
    csv_file.write_text(csv_content, encoding="cp932")

    config.load_sales_data(str(csv_file))
    assert config.global_sales_df is not None
    assert len(config.global_sales_df) == 2
    # コード末尾の .0 が除去されていること
    codes = list(config.global_sales_df['得意先コード'])
    assert '2001' in codes
    assert '2002' in codes
