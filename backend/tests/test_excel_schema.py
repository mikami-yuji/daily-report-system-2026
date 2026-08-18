import pytest
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import excel_schema
import models

def test_daily_report_columns_unique():
    """営業日報シートの列インデックスに重複がないか確認"""
    cols = [
        excel_schema.DailyReportColumns.MANAGEMENT_NUMBER,
        excel_schema.DailyReportColumns.DATE,
        excel_schema.DailyReportColumns.ACTION_CONTENT,
        excel_schema.DailyReportColumns.AREA,
        excel_schema.DailyReportColumns.CUSTOMER_CD,
        excel_schema.DailyReportColumns.DIRECT_DELIVERY_CD,
        excel_schema.DailyReportColumns.CUSTOMER_NAME,
        excel_schema.DailyReportColumns.DIRECT_DELIVERY_NAME,
        excel_schema.DailyReportColumns.PRIORITY_CUSTOMER,
        excel_schema.DailyReportColumns.RANK,
        excel_schema.DailyReportColumns.CUSTOMER_TARGET,
        excel_schema.DailyReportColumns.INTERVIEWEE,
        excel_schema.DailyReportColumns.STAY_TIME,
        excel_schema.DailyReportColumns.DESIGN_PROPOSAL,
        excel_schema.DailyReportColumns.DESIGN_TYPE,
        excel_schema.DailyReportColumns.DESIGN_NAME,
        excel_schema.DailyReportColumns.DESIGN_STATUS,
        excel_schema.DailyReportColumns.DESIGN_REQUEST_NO,
        excel_schema.DailyReportColumns.BUSINESS_CONTENT,
        excel_schema.DailyReportColumns.PROPOSAL_ITEM,
        excel_schema.DailyReportColumns.NEXT_PLAN,
        excel_schema.DailyReportColumns.COMPETITOR_INFO,
        excel_schema.DailyReportColumns.BOSS_COMMENT,
        excel_schema.DailyReportColumns.COMMENT_REPLY,
        excel_schema.DailyReportColumns.APPROVAL_BOSS,
        excel_schema.DailyReportColumns.APPROVAL_YAMAZUMI,
        excel_schema.DailyReportColumns.APPROVAL_OKAMOTO,
        excel_schema.DailyReportColumns.APPROVAL_NAKANO,
        excel_schema.DailyReportColumns.READ_CHECK,
    ]
    assert len(cols) == len(set(cols)), "DailyReportColumns contains duplicate column indices"
    assert min(cols) == 1
    assert max(cols) == 29

def test_approval_and_comment_column_mappings():
    """承認とコメントのマッピング整合性テスト"""
    assert excel_schema.APPROVAL_COLUMN_MAPPING['上長'] == 25
    assert excel_schema.APPROVAL_COLUMN_MAPPING['山澄常務'] == 26
    assert excel_schema.APPROVAL_COLUMN_MAPPING['岡本常務'] == 27
    assert excel_schema.APPROVAL_COLUMN_MAPPING['中野次長'] == 28
    assert excel_schema.APPROVAL_COLUMN_MAPPING['既読チェック'] == 29

    assert excel_schema.COMMENT_COLUMN_MAPPING['上長コメント'] == 23
    assert excel_schema.COMMENT_COLUMN_MAPPING['コメント返信欄'] == 24

def test_get_new_report_column_data():
    """新規日報登録データのカラムマッピングテスト"""
    report = models.ReportInput(
        日付="2026-08-18",
        行動内容="商談",
        エリア="東京",
        得意先CD="12345",
        直送先CD="67890",
        訪問先名="テスト顧客",
        直送先名="テスト直送先",
        重点顧客="重点",
        ランク="A",
        面談者="山田様",
        滞在時間="60分",
        デザイン提案有無="有",
        デザイン種別="新柄",
        デザイン名="テストデザイン",
        デザイン進捗状況="進行中",
        デザイン依頼No="D-100",
        商談内容="新商品の提案",
        提案物="カタログ",
        次回プラン="見積提出",
        競合他社情報="特になし",
        上長コメント="良好",
        コメント返信欄="了解です",
    )

    data = excel_schema.get_new_report_column_data(report, new_mgmt_num=42, current_target="売上目標達成")
    assert data[excel_schema.DailyReportColumns.MANAGEMENT_NUMBER] == 42
    assert data[excel_schema.DailyReportColumns.DATE] == "2026-08-18"
    assert data[excel_schema.DailyReportColumns.CUSTOMER_CD] == "12345"
    assert data[excel_schema.DailyReportColumns.CUSTOMER_TARGET] == "売上目標達成"
    assert data[excel_schema.DailyReportColumns.BOSS_COMMENT] == "良好"
    assert data[excel_schema.DailyReportColumns.COMMENT_REPLY] == "了解です"

def test_fallback_customer_cd_for_free_input():
    """得意先CDが空で訪問先名がある場合のダミーCD（999999）付与テスト"""
    report = models.ReportInput(
        得意先CD="",
        訪問先名="新規見込顧客",
    )
    data = excel_schema.get_new_report_column_data(report, new_mgmt_num=1)
    assert data[excel_schema.DailyReportColumns.CUSTOMER_CD] == "999999"
