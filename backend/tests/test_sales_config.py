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

import pytest
import sqlite3
import routes_sales

@pytest.mark.anyio
async def test_get_all_sales_data_from_dataframe(tmp_path):
    """DataFrameが存在する場合、そのデータが正しく返されること"""
    csv_file = tmp_path / "test_sales_all.csv"
    csv_content = "得意先コード,順位,ランク,売上金額,粗利金額,担当者\n3001,1,S,150000,30000,佐藤\n"
    csv_file.write_text(csv_content, encoding="cp932")
    config.load_sales_data(str(csv_file))

    res = await routes_sales.get_all_sales_data()
    assert len(res) == 1
    assert res[0]["customer_code"] == "3001"
    assert res[0]["sales_amount"] == 150000
    assert res[0]["sales_rep"] == "佐藤"

@pytest.mark.anyio
async def test_get_all_sales_data_fallback_to_as400(tmp_path):
    """DataFrameがNoneの場合、AS/400のSQLiteキャッシュから自動フォールバック集計されること"""
    # グローバルDataFrameをクリア
    config.global_sales_df = None

    db_path = tmp_path / "test_sales_cache.db"
    conn = sqlite3.connect(str(db_path))
    c = conn.cursor()
    c.execute("""
        CREATE TABLE as400_sales_orders (
            id INTEGER PRIMARY KEY,
            customer_code TEXT,
            customer_name TEXT,
            customer_rank TEXT,
            sales_rep TEXT,
            amount REAL,
            profit REAL
        )
    """)
    c.execute("""
        INSERT INTO as400_sales_orders (customer_code, customer_name, customer_rank, sales_rep, amount, profit)
        VALUES ('99001', 'テスト顧客A', 'A', '山田', 200000, 40000),
               ('99001', 'テスト顧客A', 'A', '山田', 100000, 20000)
    """)
    conn.commit()
    conn.close()

    with patch('config.load_sales_data', lambda: None):
        with patch('config.SALES_CACHE_DB', str(db_path)):
            with patch('sales_importer.get_sales_db_conn', lambda: sqlite3.connect(str(db_path))):
                with patch('sales_importer.init_sales_db', lambda: None):
                    res = await routes_sales.get_all_sales_data()
                    assert len(res) == 1
                    assert res[0]["customer_code"] == "99001"
                    assert res[0]["customer_name"] == "テスト顧客A"
                    assert res[0]["sales_amount"] == 300000
                    assert res[0]["gross_profit"] == 60000
                    assert res[0]["rank"] == 1
                    assert res[0]["sales_rep"] == "山田"

