"""
売上分析 3期比較（今期・前期・前々期）高速集計エンジン
- 基幹AS/400売上明細（as400_sales_orders）から 2024年度、2025年度、2026年度 の確定売上を集計
- 種別（classification） ＞ 材質別（material） ＞ 量目別（capacity / weight）の3階層ツリー集計
- 【重要】ユーザー指定ルール：シールは量目ブレイクダウンを行わず、材質階層で一括集計
- 数量（ロールｍ数、袋・シール枚数）および売上金額を並列集計し、対前期比(%)、対前々期比(%)、差分を自動算出
- 同期間比較（2月〜最新売上日）および通期比較の双方向サポート
"""

import os
import sqlite3
import re
from typing import Dict, Any, Optional, List
import pandas as pd
from datetime import datetime

import config

def get_db_path() -> str:
    return getattr(config, 'SALES_CACHE_DB', 'backend/data/sales_cache.db')

def standardize_category(raw_class: str, prod_name: str = '', title: str = '') -> str:
    """種別（大分類）の正規化"""
    c = str(raw_class or '').strip()
    p = str(prod_name or '').strip()
    t = str(title or '').strip()
    
    # シール判定
    if 'シール' in c or 'シール' in p or 'シール' in t:
        return 'シール'
    if '３Ｆロール' in c or '3Fロール' in c or 'ロールフレキソ' in c:
        return '３Ｆロールフレキソ版'
    if '既製品' in c:
        return '既製品'
    if 'ポリ別注' in c:
        return 'ポリ別注'
    if '別注' in c:
        return '別注（ポリ除く）'
    if 'シルク' in c:
        return 'シルク版'
    if '米袋以外' in c:
        return '米袋以外'
    if 'オクダ' in c or 'ヌマタ' in c or 'オフセット' in c:
        return 'オクダ・ヌマタオフセット版'
    if '楽天' in c or 'ヤフー' in c:
        return '楽天・ヤフー'
    if 'プレコレ' in c or 'インクジェット' in c:
        return 'プレコレ・インクジェット'
    if 'カット注文' in c:
        return 'カット注文'
    if not c:
        return 'その他'
    return c

def standardize_material(short_name: str, full_name: str, category: str = '') -> str:
    """材質グループ（中分類）の正規化"""
    s = str(short_name or '').strip()
    f = str(full_name or '').strip()
    cat = str(category or '').strip()
    
    # シール系の場合
    if cat == 'シール' or 'シール' in s or 'シール' in f:
        if 'ミラー' in s or 'ミラー' in f: return 'シール（ミラーコート）'
        if '上' in s or '上質' in f: return 'シール（上質）'
        if '和紙' in s or '和紙' in f or 'タック' in f: return 'シール（和紙タック）'
        if 'ユポ' in s or 'ユポ' in f: return 'シール（ユポ）'
        if 'ホイル' in s or '金' in s or '銀' in s: return 'シール（ホイル）'
        return 'シール（その他）'
        
    if 'ポリポリ' in s or 'ポリポリ' in f or 'ﾎﾟﾘﾎﾟﾘ' in s: return 'ポリポリ'
    if 'ＳＦM' in s or 'SFM' in s or 'ＳＦマット' in f or 'SFマット' in f: return 'ＳＦマットポリ'
    if 'ＳＦポリ' in s or 'ＳＦポリ' in f or 'SFﾎﾟﾘ' in s: return 'ＳＦポリ'
    if 'マットポリ' in s or 'マットポリ' in f or s == 'Mﾎﾟﾘ': return 'マットポリ'
    if 'PLポリ' in s or 'PLﾎﾟﾘ' in s or 'ＰＬポリ' in f: return 'PLポリ'
    if 'ラミ' in s or 'ラミ' in f:
        if 'スタンド' in s or 'スタンド' in f: return 'スタンドラミ'
        if '真空' in s or '真空' in f: return '真空ラミ'
        return 'ラミ'
    if '乳白' in s or '乳白' in f: return 'ポリ（乳白）'
    if '透明' in s or '透明' in f: return 'ポリ（透明）'
    if 'コン' in s or 'コン' in f: return 'ポリ（コンビ/着色）'
    if 'ブルー' in s or 'ブルー' in f: return 'ポリ（ブルー）'
    if 'ﾎﾟﾘ' in s or 'ポリ' in s or 'ポリ' in f: return 'ポリ（その他）'
    if 'ｸﾗﾌﾄ' in s or 'クラフト' in f or 'ソフクラ' in s or 'ソフクラ' in f:
        if '未晒' in f or '未晒' in s: return 'クラフト（未晒）'
        if '晒' in f or '晒' in s: return 'クラフト（晒）'
        if 'ソフクラ' in s or 'ソフクラ' in f: return 'ソフクラ'
        return 'クラフト（その他）'
    if '和紙' in s or '和紙' in f or '雲竜' in f or 'レーヨン' in f:
        if 'レーヨン' in f or 'レーヨン' in s: return '和紙レーヨン'
        if '雲竜' in f or '雲竜' in s: return '和紙雲竜'
        if '包み' in f or '包み' in s: return '和紙包み'
        return '和紙（その他）'
    if 'アルミ' in s or 'アルミ' in f: return 'アルミ'
    if 'ケース' in s or 'ケース' in f or '箱' in f: return 'ケース（段ボール）'
    if '機械' in s or '機械' in f: return '包装機械・器具'
    if '雑材' in s or '雑材' in f: return '雑材・販促品'
    return 'その他'

def standardize_capacity(capacity_display: str, weight: float, prod_name: str, title: str, category: str = '') -> str:
    """量目グループ（小分類）の正規化（※シールは呼び出し元で除外）"""
    if category == 'シール':
        return '区分なし'
        
    cap = str(capacity_display or '').strip().lower()
    w = float(weight or 0.0)
    name = f"{prod_name} {title}".lower()
    
    # 5kg
    if cap in ('5kg', '5.6kg') or (4.8 <= w <= 5.8) or ('5k' in name) or ('５ｋ' in name) or ('5kg' in name):
        return '5kg'
    # 10kg
    if cap == '10kg' or (9.5 <= w <= 10.5) or ('10k' in name) or ('１０ｋ' in name) or ('10kg' in name):
        return '10kg'
    # 2kg
    if cap == '2kg' or (1.9 <= w <= 2.2) or ('2k' in name) or ('２ｋ' in name) or ('2kg' in name):
        return '2kg'
    # 1kg
    if cap in ('1kg', '1.5kg', '1.4kg', '1.2kg', '1.8kg') or (0.95 <= w <= 1.85) or ('1k' in name) or ('１ｋ' in name) or ('1kg' in name):
        return '1kg'
    # 3kg
    if cap in ('3kg', '2.5kg', '2.8kg') or (2.4 <= w <= 3.5) or ('3k' in name) or ('３ｋ' in name) or ('3kg' in name):
        return '3kg'
    # 小袋 (300g, 150g, 450g, 500g, 750g, 900g, 2合等)
    if (0 < w < 0.95) or cap.endswith('g') or '合' in cap or any(x in name for x in ('300g', '150g', '450g', '500g', '2合', '3合')):
        return '小袋(1kg未満)'
    # 大袋 (15kg, 20kg, 30kg)
    if w >= 14.0 or cap in ('15kg', '20kg', '30kg') or any(x in name for x in ('30k', '３０ｋ', '30kg', '20k', '20kg')):
        return '大袋(15kg以上)'
        
    return 'その他'

def calc_growth_rate(cur: float, base: float) -> Optional[float]:
    """前年比(%)の安全計算"""
    if base is None or base <= 0:
        return None
    return round((cur / base) * 100.0, 1)

def get_period_comparison_data(
    compare_mode: str = 'same_period',  # 'same_period' (同期間) | 'full_year' (通期)
    sales_rep: Optional[str] = None,
    customer_code: Optional[str] = None
) -> Dict[str, Any]:
    """
    3期比較データを集計してツリー構造で返却
    """
    db_path = get_db_path()
    if not os.path.exists(db_path):
        return {
            "period_info": {},
            "summary": {},
            "categories": []
        }

    conn = sqlite3.connect(db_path)
    
    # 1. 今期の最新売上日を特定（未来日付を除外するため本日日付を上限とする）
    today_str = datetime.now().strftime('%Y-%m-%d')
    max_date_res = conn.execute("""
        SELECT MAX(COALESCE(NULLIF(sales_date, ''), order_date))
        FROM as400_sales_orders
        WHERE COALESCE(NULLIF(sales_date, ''), order_date) >= '2026-02-01'
          AND COALESCE(NULLIF(sales_date, ''), order_date) <= ?
    """, (today_str,)).fetchone()
    
    latest_current_date = max_date_res[0] if max_date_res and max_date_res[0] else today_str
    # 最新売上日の月日部分を取得 (例: '09-28' や '09-30')
    current_mmdd = latest_current_date[5:] if len(latest_current_date) >= 10 else '09-30'
    
    # 2. 各期の期間設定
    if compare_mode == 'same_period':
        current_start = '2026-02-01'
        current_end = latest_current_date
        
        previous_start = '2025-02-01'
        previous_end = f'2025-{current_mmdd}'
        
        two_years_ago_start = '2024-02-01'
        two_years_ago_end = f'2024-{current_mmdd}'
    else:  # 'full_year' (通期)
        current_start = '2026-02-01'
        current_end = '2027-01-31'
        
        previous_start = '2025-02-01'
        previous_end = '2026-01-31'
        
        two_years_ago_start = '2024-02-01'
        two_years_ago_end = '2025-01-31'

    period_info = {
        "compare_mode": compare_mode,
        "latest_sales_date": latest_current_date,
        "current_period": {"name": "今期(2026年度)", "start": current_start, "end": current_end},
        "previous_period": {"name": "前期(2025年度)", "start": previous_start, "end": previous_end},
        "two_years_ago_period": {"name": "前々期(2024年度)", "start": two_years_ago_start, "end": two_years_ago_end}
    }

    # 3. データの抽出（3期間分）
    filters = []
    params = []
    
    if sales_rep and sales_rep != 'all':
        filters.append("sales_rep = ?")
        params.append(sales_rep)
    if customer_code and customer_code != 'all':
        filters.append("customer_code = ?")
        params.append(customer_code)
        
    filter_sql = (" AND " + " AND ".join(filters)) if filters else ""

    query = f"""
        SELECT 
            COALESCE(NULLIF(sales_date, ''), order_date) as eff_date,
            classification,
            material_short,
            material_name,
            capacity_display,
            weight,
            product_name,
            title,
            shape_type,
            unit,
            quantity,
            amount,
            profit,
            sales_rep
        FROM as400_sales_orders
        WHERE (
            (COALESCE(NULLIF(sales_date, ''), order_date) >= ? AND COALESCE(NULLIF(sales_date, ''), order_date) <= ?) OR
            (COALESCE(NULLIF(sales_date, ''), order_date) >= ? AND COALESCE(NULLIF(sales_date, ''), order_date) <= ?) OR
            (COALESCE(NULLIF(sales_date, ''), order_date) >= ? AND COALESCE(NULLIF(sales_date, ''), order_date) <= ?)
        )
        {filter_sql}
    """
    
    query_params = [
        current_start, current_end,
        previous_start, previous_end,
        two_years_ago_start, two_years_ago_end
    ] + params

    df = pd.read_sql_query(query, conn, params=query_params)
    conn.close()

    if df.empty:
        return {
            "period_info": period_info,
            "summary": {
                "current": {"meters": 0, "sheets": 0, "amount": 0},
                "previous": {"meters": 0, "sheets": 0, "amount": 0},
                "two_years_ago": {"meters": 0, "sheets": 0, "amount": 0},
                "growth_rate_meters": None, "growth_rate_sheets": None, "growth_rate_amount": None,
                "diff_meters": 0, "diff_sheets": 0, "diff_amount": 0
            },
            "categories": [],
            "sales_reps": []
        }

    # 4. 前処理と分類列の付与
    def get_period_label(d: str) -> str:
        if not d: return 'other'
        if current_start <= d <= current_end: return 'current'
        if previous_start <= d <= previous_end: return 'previous'
        if two_years_ago_start <= d <= two_years_ago_end: return 'two_years_ago'
        return 'other'

    df['period'] = df['eff_date'].apply(get_period_label)
    df = df[df['period'] != 'other'].copy()

    # 種別の正規化
    df['category'] = df.apply(
        lambda r: standardize_category(r['classification'], r['product_name'], r['title']), 
        axis=1
    )
    
    # 材質の正規化
    df['material'] = df.apply(
        lambda r: standardize_material(r['material_short'], r['material_name'], r['category']), 
        axis=1
    )
    
    # 量目の正規化（※シールは区分なし）
    df['capacity'] = df.apply(
        lambda r: standardize_capacity(r['capacity_display'], r['weight'], r['product_name'], r['title'], r['category']), 
        axis=1
    )

    # 数量（ｍ数・枚数）の切り分け
    # ロール製品（unit == 'ｍ' または shape_type LIKE 'ロール%'）
    is_meter = (df['unit'] == 'ｍ') | (df['shape_type'].str.contains('ロール', na=False))
    df['meters'] = 0.0
    df.loc[is_meter, 'meters'] = df.loc[is_meter, 'quantity'].fillna(0.0)

    # 枚数製品（単袋、シール、販促品等）
    df['sheets'] = 0.0
    df.loc[~is_meter, 'sheets'] = df.loc[~is_meter, 'quantity'].fillna(0.0)

    df['amount'] = df['amount'].fillna(0.0)

    # 営業担当者リストの抽出
    all_reps = sorted([r for r in df['sales_rep'].dropna().unique() if r and r != 'null'])

    # 5. ピボット集計用のヘルパー関数
    def make_metric_dict(meters_cur, sheets_cur, amount_cur,
                         meters_prev, sheets_prev, amount_prev,
                         meters_two, sheets_two, amount_two) -> Dict[str, Any]:
        return {
            "current": {
                "meters": round(float(meters_cur), 1),
                "sheets": int(round(float(sheets_cur))),
                "amount": int(round(float(amount_cur)))
            },
            "previous": {
                "meters": round(float(meters_prev), 1),
                "sheets": int(round(float(sheets_prev))),
                "amount": int(round(float(amount_prev)))
            },
            "two_years_ago": {
                "meters": round(float(meters_two), 1),
                "sheets": int(round(float(sheets_two))),
                "amount": int(round(float(amount_two)))
            },
            "growth_rate_meters": calc_growth_rate(meters_cur, meters_prev),
            "growth_rate_sheets": calc_growth_rate(sheets_cur, sheets_prev),
            "growth_rate_amount": calc_growth_rate(amount_cur, amount_prev),
            "two_years_growth_rate_meters": calc_growth_rate(meters_cur, meters_two),
            "two_years_growth_rate_sheets": calc_growth_rate(sheets_cur, sheets_two),
            "two_years_growth_rate_amount": calc_growth_rate(amount_cur, amount_two),
            "diff_meters": round(float(meters_cur - meters_prev), 1),
            "diff_sheets": int(round(float(sheets_cur - sheets_prev))),
            "diff_amount": int(round(float(amount_cur - amount_prev)))
        }

    # 全体サマリーの算出
    period_sums = df.groupby('period')[['meters', 'sheets', 'amount']].sum()
    cur_sum = period_sums.loc['current'] if 'current' in period_sums.index else pd.Series({'meters':0, 'sheets':0, 'amount':0})
    prev_sum = period_sums.loc['previous'] if 'previous' in period_sums.index else pd.Series({'meters':0, 'sheets':0, 'amount':0})
    two_sum = period_sums.loc['two_years_ago'] if 'two_years_ago' in period_sums.index else pd.Series({'meters':0, 'sheets':0, 'amount':0})

    overall_summary = make_metric_dict(
        cur_sum['meters'], cur_sum['sheets'], cur_sum['amount'],
        prev_sum['meters'], prev_sum['sheets'], prev_sum['amount'],
        two_sum['meters'], two_sum['sheets'], two_sum['amount']
    )

    # 6. 3階層ツリー集計（種別 ＞ 材質 ＞ 量目）
    # グループ集計テーブル
    grouped = df.groupby(['category', 'material', 'capacity', 'period'])[['meters', 'sheets', 'amount']].sum().reset_index()

    # カテゴリの優先順ソート用
    category_order = [
        '３Ｆロールフレキソ版', '既製品', 'ポリ別注', '別注（ポリ除く）', 'シール',
        'シルク版', '米袋以外', 'オクダ・ヌマタオフセット版', '楽天・ヤフー',
        'プレコレ・インクジェット', 'カット注文', 'その他'
    ]

    categories_list = []
    
    unique_cats = grouped['category'].unique()
    # ソート（優先順位リスト順、残りはアルファベット順）
    sorted_cats = sorted(unique_cats, key=lambda x: category_order.index(x) if x in category_order else 999)

    for cat_name in sorted_cats:
        cat_df = grouped[grouped['category'] == cat_name]
        is_seal = (cat_name == 'シール')

        # カテゴリの期別合算
        cat_p = cat_df.groupby('period')[['meters', 'sheets', 'amount']].sum()
        c_cur = cat_p.loc['current'] if 'current' in cat_p.index else pd.Series({'meters':0, 'sheets':0, 'amount':0})
        c_prev = cat_p.loc['previous'] if 'previous' in cat_p.index else pd.Series({'meters':0, 'sheets':0, 'amount':0})
        c_two = cat_p.loc['two_years_ago'] if 'two_years_ago' in cat_p.index else pd.Series({'meters':0, 'sheets':0, 'amount':0})

        cat_metrics = make_metric_dict(
            c_cur['meters'], c_cur['sheets'], c_cur['amount'],
            c_prev['meters'], c_prev['sheets'], c_prev['amount'],
            c_two['meters'], c_two['sheets'], c_two['amount']
        )

        materials_list = []
        unique_mats = sorted(cat_df['material'].unique())

        for mat_name in unique_mats:
            mat_df = cat_df[cat_df['material'] == mat_name]
            mat_p = mat_df.groupby('period')[['meters', 'sheets', 'amount']].sum()
            m_cur = mat_p.loc['current'] if 'current' in mat_p.index else pd.Series({'meters':0, 'sheets':0, 'amount':0})
            m_prev = mat_p.loc['previous'] if 'previous' in mat_p.index else pd.Series({'meters':0, 'sheets':0, 'amount':0})
            m_two = mat_p.loc['two_years_ago'] if 'two_years_ago' in mat_p.index else pd.Series({'meters':0, 'sheets':0, 'amount':0})

            mat_metrics = make_metric_dict(
                m_cur['meters'], m_cur['sheets'], m_cur['amount'],
                m_prev['meters'], m_prev['sheets'], m_prev['amount'],
                m_two['meters'], m_two['sheets'], m_two['amount']
            )

            capacities_list = []
            
            # 【重要】シールは量目ブレイクダウンを行わない（ユーザー指定）
            if not is_seal:
                # 量目順（5kg, 10kg, 2kg, 1kg, 3kg, 小袋, 大袋, その他）
                capacity_order = ['5kg', '10kg', '2kg', '1kg', '3kg', '小袋(1kg未満)', '大袋(15kg以上)', 'その他']
                unique_caps = sorted(mat_df['capacity'].unique(), key=lambda x: capacity_order.index(x) if x in capacity_order else 999)

                for cap_name in unique_caps:
                    cap_df = mat_df[mat_df['capacity'] == cap_name]
                    cap_p = cap_df.groupby('period')[['meters', 'sheets', 'amount']].sum()
                    k_cur = cap_p.loc['current'] if 'current' in cap_p.index else pd.Series({'meters':0, 'sheets':0, 'amount':0})
                    k_prev = cap_p.loc['previous'] if 'previous' in cap_p.index else pd.Series({'meters':0, 'sheets':0, 'amount':0})
                    k_two = cap_p.loc['two_years_ago'] if 'two_years_ago' in cap_p.index else pd.Series({'meters':0, 'sheets':0, 'amount':0})

                    cap_metrics = make_metric_dict(
                        k_cur['meters'], k_cur['sheets'], k_cur['amount'],
                        k_prev['meters'], k_prev['sheets'], k_prev['amount'],
                        k_two['meters'], k_two['sheets'], k_two['amount']
                    )

                    capacities_list.append({
                        "id": f"cap_{cat_name}_{mat_name}_{cap_name}",
                        "name": cap_name,
                        "level": "capacity",
                        "is_seal": False,
                        **cap_metrics
                    })

            materials_list.append({
                "id": f"mat_{cat_name}_{mat_name}",
                "name": mat_name,
                "level": "material",
                "is_seal": is_seal,
                **mat_metrics,
                "children": capacities_list
            })

        categories_list.append({
            "id": f"cat_{cat_name}",
            "name": cat_name,
            "level": "category",
            "is_seal": is_seal,
            **cat_metrics,
            "children": materials_list
        })

    return {
        "period_info": period_info,
        "summary": overall_summary,
        "categories": categories_list,
        "sales_reps": all_reps
    }
