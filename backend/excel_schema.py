"""Excel schema definitions and mapping configurations for Daily Report System 2026."""

from typing import Dict, Any, List, Optional
import models

# --- Sheet Names ---
SHEET_DAILY_REPORT = "営業日報"
SHEET_CUSTOMERS = "得意先_List"
SHEET_SALES = "売上推移データ"
SHEET_SETTINGS = "設定"

# --- Column Names ---
class ColumnNames:
    MANAGEMENT_NUMBER = "管理番号"
    DATE = "日付"
    ACTION_CONTENT = "行動内容"
    AREA = "エリア"
    CUSTOMER_CD = "得意先CD"
    DIRECT_DELIVERY_CD = "直送先CD"
    CUSTOMER_NAME = "訪問先名"
    DIRECT_DELIVERY_NAME = "直送先名"
    PRIORITY_CUSTOMER = "重点顧客"
    RANK = "ランク"
    CUSTOMER_TARGET = "得意先目標"
    INTERVIEWEE = "面談者"
    STAY_TIME = "滞在時間"
    DESIGN_PROPOSAL = "デザイン提案有無"
    DESIGN_TYPE = "デザイン種別"
    DESIGN_NAME = "デザイン名"
    DESIGN_STATUS = "デザイン進捗状況"
    DESIGN_REQUEST_NO = "デザイン依頼No."
    BUSINESS_CONTENT = "商談内容"
    PROPOSAL_ITEM = "提案物"
    NEXT_PLAN = "次回プラン"
    COMPETITOR_INFO = "競合他社情報"
    BOSS_COMMENT = "上長コメント"
    COMMENT_REPLY = "コメント返信欄"
    APPROVAL_BOSS = "上長"
    APPROVAL_YAMAZUMI = "山澄常務"
    APPROVAL_OKAMOTO = "岡本常務"
    APPROVAL_NAKANO = "中野次長"
    READ_CHECK = "既読チェック"


def clean_column_names(df) -> Any:
    """DataFrameのカラム名から改行や前後の余分な空白を除去します。また、営業日報シートで日付列名が誤入力されている場合の自動補正も行います。"""
    if df is not None and hasattr(df, 'columns'):
        df.columns = [str(col).replace('\n', '').strip() for col in df.columns]
        cols = list(df.columns)
        # 管理番号があり、日付列が存在しない場合、2列目（B列）を「日付」として補正
        if len(cols) > 1 and '日付' not in cols:
            if '管理番号' in cols or cols[0] == '管理番号':
                old_col = cols[1]
                df.rename(columns={old_col: '日付'}, inplace=True)
                df.columns = [str(col).replace('\n', '').strip() for col in df.columns]
    return df

# --- Column Indices for "営業日報" (1-indexed for openpyxl) ---
class DailyReportColumns:
    MANAGEMENT_NUMBER = 1      # A: 管理番号
    DATE = 2                   # B: 日付
    ACTION_CONTENT = 3         # C: 行動内容
    AREA = 4                   # D: エリア
    CUSTOMER_CD = 5            # E: 得意先CD.
    DIRECT_DELIVERY_CD = 6     # F: 直送先CD.
    CUSTOMER_NAME = 7          # G: 訪問先名/得意先名
    DIRECT_DELIVERY_NAME = 8   # H: 直送先名
    PRIORITY_CUSTOMER = 9      # I: 重点顧客
    RANK = 10                  # J: ランク
    CUSTOMER_TARGET = 11       # K: 得意先目標
    INTERVIEWEE = 12           # L: 面談者
    STAY_TIME = 13             # M: 滞在時間
    DESIGN_PROPOSAL = 14       # N: デザイン提案有無
    DESIGN_TYPE = 15           # O: デザイン種別
    DESIGN_NAME = 16           # P: デザイン名
    DESIGN_STATUS = 17         # Q: デザイン進捗状況
    DESIGN_REQUEST_NO = 18     # R: デザイン依頼No.
    BUSINESS_CONTENT = 19      # S: 商談内容
    PROPOSAL_ITEM = 20         # T: 提案物
    NEXT_PLAN = 21             # U: 次回プラン
    COMPETITOR_INFO = 22       # V: 競合他社情報
    BOSS_COMMENT = 23          # W: 上長コメント
    COMMENT_REPLY = 24         # X: コメント返信欄
    APPROVAL_BOSS = 25         # Y: 上長
    APPROVAL_YAMAZUMI = 26     # Z: 山澄常務
    APPROVAL_OKAMOTO = 27      # AA: 岡本常務
    APPROVAL_NAKANO = 28       # AB: 中野次長
    READ_CHECK = 29            # AC: 既読チェック


# --- Column Indices for "得意先_List" (1-indexed for openpyxl) ---
class CustomerListColumns:
    CUSTOMER_CD = 1            # A: 得意先CD.
    DIRECT_DELIVERY_CD = 2     # B: 直送先CD.
    CUSTOMER_NAME = 3          # C: 得意先名
    DIRECT_DELIVERY_NAME = 4   # D: 直送先名
    AREA = 6                   # F: 都道府県
    PRIORITY_CUSTOMER = 8      # H: 重点顧客
    SALES_PERSON = 9           # I: 担当者
    CURRENT_TARGET = 10        # J: 現目標


# --- Approval Columns Mapping ---
APPROVAL_COLUMN_MAPPING: Dict[str, int] = {
    '上長': DailyReportColumns.APPROVAL_BOSS,
    '山澄常務': DailyReportColumns.APPROVAL_YAMAZUMI,
    '岡本常務': DailyReportColumns.APPROVAL_OKAMOTO,
    '中野次長': DailyReportColumns.APPROVAL_NAKANO,
    '既読チェック': DailyReportColumns.READ_CHECK,
}

# --- Comment Columns Mapping ---
COMMENT_COLUMN_MAPPING: Dict[str, int] = {
    '上長コメント': DailyReportColumns.BOSS_COMMENT,
    'コメント返信欄': DailyReportColumns.COMMENT_REPLY,
}


def get_new_report_column_data(report: models.ReportInput, new_mgmt_num: int, current_target: str = "") -> Dict[int, Any]:
    """新規日報登録時の書き込みカラムと値のマッピングを返します"""
    write_customer_cd = report.得意先CD
    if not write_customer_cd and report.訪問先名:
        write_customer_cd = "999999"

    return {
        DailyReportColumns.MANAGEMENT_NUMBER: new_mgmt_num,
        DailyReportColumns.DATE: report.日付,
        DailyReportColumns.ACTION_CONTENT: report.行動内容,
        DailyReportColumns.AREA: report.エリア,
        DailyReportColumns.CUSTOMER_CD: write_customer_cd,
        DailyReportColumns.DIRECT_DELIVERY_CD: report.直送先CD,
        DailyReportColumns.CUSTOMER_NAME: report.訪問先名,
        DailyReportColumns.DIRECT_DELIVERY_NAME: report.直送先名,
        DailyReportColumns.PRIORITY_CUSTOMER: report.重点顧客,
        DailyReportColumns.RANK: report.ランク,
        DailyReportColumns.CUSTOMER_TARGET: current_target,
        DailyReportColumns.INTERVIEWEE: report.面談者,
        DailyReportColumns.STAY_TIME: report.滞在時間,
        DailyReportColumns.DESIGN_PROPOSAL: report.デザイン提案有無,
        DailyReportColumns.DESIGN_TYPE: report.デザイン種別,
        DailyReportColumns.DESIGN_NAME: report.デザイン名,
        DailyReportColumns.DESIGN_STATUS: report.デザイン進捗状況,
        DailyReportColumns.DESIGN_REQUEST_NO: report.デザイン依頼No,
        DailyReportColumns.BUSINESS_CONTENT: report.商談内容,
        DailyReportColumns.PROPOSAL_ITEM: report.提案物,
        DailyReportColumns.NEXT_PLAN: report.次回プラン,
        DailyReportColumns.COMPETITOR_INFO: report.競合他社情報,
        DailyReportColumns.BOSS_COMMENT: report.上長コメント,
        DailyReportColumns.COMMENT_REPLY: report.コメント返信欄,
    }


def get_update_report_column_data(report: models.ReportInput) -> Dict[int, Any]:
    """既存日報更新時の書き込みカラムと値のマッピングを返します（得意先目標は除外）"""
    return {
        DailyReportColumns.DATE: report.日付,
        DailyReportColumns.ACTION_CONTENT: report.行動内容,
        DailyReportColumns.AREA: report.エリア,
        DailyReportColumns.CUSTOMER_CD: report.得意先CD,
        DailyReportColumns.DIRECT_DELIVERY_CD: report.直送先CD,
        DailyReportColumns.CUSTOMER_NAME: report.訪問先名,
        DailyReportColumns.DIRECT_DELIVERY_NAME: report.直送先名,
        DailyReportColumns.PRIORITY_CUSTOMER: report.重点顧客,
        DailyReportColumns.RANK: report.ランク,
        DailyReportColumns.INTERVIEWEE: report.面談者,
        DailyReportColumns.STAY_TIME: report.滞在時間,
        DailyReportColumns.DESIGN_PROPOSAL: report.デザイン提案有無,
        DailyReportColumns.DESIGN_TYPE: report.デザイン種別,
        DailyReportColumns.DESIGN_NAME: report.デザイン名,
        DailyReportColumns.DESIGN_STATUS: report.デザイン進捗状況,
        DailyReportColumns.DESIGN_REQUEST_NO: report.デザイン依頼No,
        DailyReportColumns.BUSINESS_CONTENT: report.商談内容,
        DailyReportColumns.PROPOSAL_ITEM: report.提案物,
        DailyReportColumns.NEXT_PLAN: report.次回プラン,
        DailyReportColumns.COMPETITOR_INFO: report.競合他社情報,
        DailyReportColumns.BOSS_COMMENT: report.上長コメント,
        DailyReportColumns.COMMENT_REPLY: report.コメント返信欄,
    }
