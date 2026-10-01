"""
売上分析 3期比較（今期・前期・前々期）高速集計エンジン
- 基幹AS/400売上明細（as400_sales_orders）から 2024年度、2025年度、2026年度 の確定売上を集計
- 種別（classification） ＞ 材質別（material） ＞ 量目別（capacity / weight）の3階層ツリー集計
- 【ユーザー指定ルール1】シールは量目ブレイクダウンを行わず、材質階層で一括集計
- 【ユーザー指定ルール2】ロール製品（３Ｆロールフレキソ版等）も量目ブレイクダウンを行わず、ロール一括集計
- 【ユーザー指定ルール3】ソフクラはクラフトから完全に分離して独立中分類とする。クラフトはバックポリあり／なし、未晒／晒しを保持
- 【ユーザー指定ルール4】前期・前々期は「同期日（同期間実績）」と「その期の総量（通期実績）」の両方を併記集計
- 数量（ロールｍ数、袋・シール枚数）および売上金額を並列集計し、対前期比(%)、対前々期比(%)、差分、進捗率を自動算出
"""

import os
import sqlite3
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
    """材質グループ（中分類）の正規化（ソフクラ分離 & クラフトBP保持）"""
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
    
    # 【ソフクラ判定】クラフトから完全に分離
    if 'ソフクラ' in s or 'ソフクラ' in f:
        return 'ソフクラ'

    # 【クラフト判定】バックポリあり／なし、未晒／晒しを保持
    if 'ｸﾗﾌﾄ' in s or 'クラフト' in f:
        has_bp = ('ﾊﾞｯｸﾎﾟﾘあり' in f) or ('バックポリあり' in f) or ('BPあり' in f) or ('ﾊﾞｯｸﾎﾟﾘ' in f and 'なし' not in f)
        is_mizara = ('未晒' in f or '未晒' in s)
        is_sarashi = ('晒' in f or '晒' in s) and not is_mizara
        
        if is_mizara:
            return 'クラフト未晒（BPあり）' if has_bp else 'クラフト未晒（BPなし）'
        elif is_sarashi:
            return 'クラフト晒（BPあり）' if has_bp else 'クラフト晒（BPなし）'
        elif '真空' in f or '真空' in s:
            return '真空クラフト'
        elif '窓有り' in f or '窓有' in f:
            return 'クラフト（窓有り）'
        elif '窓無し' in f or '窓無' in f:
            return 'クラフト（窓無し）'
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
    """量目グループ（小分類）の正規化（※シールおよびロール製品は除外）"""
    if category in ('シール', '３Ｆロールフレキソ版'):
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
    compare_mode: Optional[str] = None,
    sales_rep: Optional[str] = None,
    customer_code: Optional[str] = None
) -> Dict[str, Any]:
    """
    3期比較データを集計してツリー構造で返却
    - 今期（2月〜最新売上日）
    - 前期【同期日（2月〜同月同日）】および【前期総量（通期12ヶ月）】
    - 前々期【同期日（2月〜同月同日）】および【前々期総量（通期12ヶ月）】
    """
    db_path = get_db_path()
    if not os.path.exists(db_path):
        return {
            "period_info": {},
            "summary": {},
            "categories": [],
            "sales_reps": []
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
    # 最新売上日の月日部分を取得 (例: '09-28' や '10-01')
    current_mmdd = latest_current_date[5:] if len(latest_current_date) >= 10 else '10-01'

    # 各期の期間定義
    current_start = '2026-02-01'
    current_end = latest_current_date

    prev_same_start = '2025-02-01'
    prev_same_end = f'2025-{current_mmdd}'
    prev_full_start = '2025-02-01'
    prev_full_end = '2026-01-31'

    two_same_start = '2024-02-01'
    two_same_end = f'2024-{current_mmdd}'
    two_full_start = '2024-02-01'
    two_full_end = '2025-01-31'

    period_info = {
        "latest_sales_date": latest_current_date,
        "current": {
            "name": "今期(2026年度)",
            "label": f"今期 (2/1〜{current_mmdd.replace('-', '/')})",
            "start": current_start,
            "end": current_end
        },
        "previous": {
            "name": "前期(2025年度)",
            "same_label": f"前期同期 (〜{current_mmdd.replace('-', '/')})",
            "full_label": "前期総量 (通期)",
            "same_start": prev_same_start,
            "same_end": prev_same_end,
            "full_start": prev_full_start,
            "full_end": prev_full_end
        },
        "two_years_ago": {
            "name": "前々期(2024年度)",
            "same_label": f"前々期同期 (〜{current_mmdd.replace('-', '/')})",
            "full_label": "前々期総量 (通期)",
            "same_start": two_same_start,
            "same_end": two_same_end,
            "full_start": two_full_start,
            "full_end": two_full_end
        }
    }

    # 2. データの抽出（2024年2月1日〜最新日までの全件）
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
        WHERE COALESCE(NULLIF(sales_date, ''), order_date) >= '2024-02-01'
          AND COALESCE(NULLIF(sales_date, ''), order_date) <= ?
        {filter_sql}
    """
    
    query_params = [current_end] + params

    df = pd.read_sql_query(query, conn, params=query_params)
    conn.close()

    if df.empty:
        empty_metric = {"meters": 0, "sheets": 0, "amount": 0}
        return {
            "period_info": period_info,
            "summary": {
                "current": empty_metric,
                "previous_same": empty_metric,
                "previous_full": empty_metric,
                "two_years_ago_same": empty_metric,
                "two_years_ago_full": empty_metric,
                "growth_rate_meters": None, "growth_rate_sheets": None, "growth_rate_amount": None,
                "two_years_growth_rate_meters": None, "two_years_growth_rate_sheets": None, "two_years_growth_rate_amount": None,
                "progress_rate_meters": None, "progress_rate_sheets": None, "progress_rate_amount": None,
                "diff_meters": 0, "diff_sheets": 0, "diff_amount": 0
            },
            "categories": [],
            "sales_reps": []
        }

    # 3. 前処理と分類列の付与
    df['category'] = df.apply(
        lambda r: standardize_category(r['classification'], r['product_name'], r['title']), 
        axis=1
    )
    df['material'] = df.apply(
        lambda r: standardize_material(r['material_short'], r['material_name'], r['category']), 
        axis=1
    )
    df['capacity'] = df.apply(
        lambda r: standardize_capacity(r['capacity_display'], r['weight'], r['product_name'], r['title'], r['category']), 
        axis=1
    )

    # 数量（ｍ数・枚数）の切り分け
    is_meter = (df['unit'] == 'ｍ') | (df['shape_type'].str.contains('ロール', na=False))
    df['meters'] = 0.0
    df.loc[is_meter, 'meters'] = df.loc[is_meter, 'quantity'].fillna(0.0)

    df['sheets'] = 0.0
    df.loc[~is_meter, 'sheets'] = df.loc[~is_meter, 'quantity'].fillna(0.0)

    df['amount'] = df['amount'].fillna(0.0)

    # 各期のフラグ列
    d = df['eff_date']
    df['is_cur'] = (d >= current_start) & (d <= current_end)
    df['is_prev_same'] = (d >= prev_same_start) & (d <= prev_same_end)
    df['is_prev_full'] = (d >= prev_full_start) & (d <= prev_full_end)
    df['is_two_same'] = (d >= two_same_start) & (d <= two_same_end)
    df['is_two_full'] = (d >= two_full_start) & (d <= two_full_end)

    # 営業担当者リストの抽出
    all_reps = sorted([r for r in df['sales_rep'].dropna().unique() if r and r != 'null'])

    # 4. 指標計算ヘルパー関数
    def extract_metrics(sub_df: pd.DataFrame) -> Dict[str, Any]:
        cur = sub_df[sub_df['is_cur']]
        prev_s = sub_df[sub_df['is_prev_same']]
        prev_f = sub_df[sub_df['is_prev_full']]
        two_s = sub_df[sub_df['is_two_same']]
        two_f = sub_df[sub_df['is_two_full']]

        c_m, c_s, c_a = cur['meters'].sum(), cur['sheets'].sum(), cur['amount'].sum()
        ps_m, ps_s, ps_a = prev_s['meters'].sum(), prev_s['sheets'].sum(), prev_s['amount'].sum()
        pf_m, pf_s, pf_a = prev_f['meters'].sum(), prev_f['sheets'].sum(), prev_f['amount'].sum()
        ts_m, ts_s, ts_a = two_s['meters'].sum(), two_s['sheets'].sum(), two_s['amount'].sum()
        tf_m, tf_s, tf_a = two_f['meters'].sum(), two_f['sheets'].sum(), two_f['amount'].sum()

        return {
            "current": {
                "meters": round(float(c_m), 1),
                "sheets": int(round(float(c_s))),
                "amount": int(round(float(c_a)))
            },
            "previous_same": {
                "meters": round(float(ps_m), 1),
                "sheets": int(round(float(ps_s))),
                "amount": int(round(float(ps_a)))
            },
            "previous_full": {
                "meters": round(float(pf_m), 1),
                "sheets": int(round(float(pf_s))),
                "amount": int(round(float(pf_a)))
            },
            "two_years_ago_same": {
                "meters": round(float(ts_m), 1),
                "sheets": int(round(float(ts_s))),
                "amount": int(round(float(ts_a)))
            },
            "two_years_ago_full": {
                "meters": round(float(tf_m), 1),
                "sheets": int(round(float(tf_s))),
                "amount": int(round(float(tf_a)))
            },
            # 対前期同期比 (%)
            "growth_rate_meters": calc_growth_rate(c_m, ps_m),
            "growth_rate_sheets": calc_growth_rate(c_s, ps_s),
            "growth_rate_amount": calc_growth_rate(c_a, ps_a),
            # 対前々期同期比 (%)
            "two_years_growth_rate_meters": calc_growth_rate(c_m, ts_m),
            "two_years_growth_rate_sheets": calc_growth_rate(c_s, ts_s),
            "two_years_growth_rate_amount": calc_growth_rate(c_a, ts_a),
            # 前期総量に対する進捗率 (%)
            "progress_rate_meters": calc_growth_rate(c_m, pf_m),
            "progress_rate_sheets": calc_growth_rate(c_s, pf_s),
            "progress_rate_amount": calc_growth_rate(c_a, pf_a),
            # 差分（対前期同期比）
            "diff_meters": round(float(c_m - ps_m), 1),
            "diff_sheets": int(round(float(c_s - ps_s))),
            "diff_amount": int(round(float(c_a - ps_a)))
        }

    # 全体サマリー
    overall_summary = extract_metrics(df)

    # 5. 3階層ツリー集計（種別 ＞ 材質 ＞ 量目）
    category_order = [
        '３Ｆロールフレキソ版', '既製品', 'ポリ別注', '別注（ポリ除く）', 'シール',
        'シルク版', '米袋以外', 'オクダ・ヌマタオフセット版', '楽天・ヤフー',
        'プレコレ・インクジェット', 'カット注文', 'その他'
    ]

    categories_list = []
    unique_cats = df['category'].unique()
    sorted_cats = sorted(unique_cats, key=lambda x: category_order.index(x) if x in category_order else 999)

    for cat_name in sorted_cats:
        cat_df = df[df['category'] == cat_name]
        is_seal = (cat_name == 'シール')
        is_roll = ('３Ｆロール' in cat_name or 'ロール' in cat_name)
        # 【ユーザー指定】シールおよびロール製品は量目ブレイクダウンを行わない
        is_no_capacity = (is_seal or is_roll)
        
        cat_metrics = extract_metrics(cat_df)

        materials_list = []
        unique_mats = sorted(cat_df['material'].unique())

        for mat_name in unique_mats:
            mat_df = cat_df[cat_df['material'] == mat_name]
            mat_metrics = extract_metrics(mat_df)

            capacities_list = []
            
            # 【ユーザー指定ルール】シールとロール製品は量目ブレイクダウンを行わない
            if not is_no_capacity:
                capacity_order = ['5kg', '10kg', '2kg', '1kg', '3kg', '小袋(1kg未満)', '大袋(15kg以上)', 'その他']
                unique_caps = sorted(mat_df['capacity'].unique(), key=lambda x: capacity_order.index(x) if x in capacity_order else 999)

                for cap_name in unique_caps:
                    cap_df = mat_df[mat_df['capacity'] == cap_name]
                    cap_metrics = extract_metrics(cap_df)

                    capacities_list.append({
                        "id": f"cap_{cat_name}_{mat_name}_{cap_name}",
                        "name": cap_name,
                        "level": "capacity",
                        "is_seal": False,
                        "is_roll": False,
                        **cap_metrics
                    })

            materials_list.append({
                "id": f"mat_{cat_name}_{mat_name}",
                "name": mat_name,
                "level": "material",
                "is_seal": is_seal,
                "is_roll": is_roll,
                **mat_metrics,
                "children": capacities_list
            })

        categories_list.append({
            "id": f"cat_{cat_name}",
            "name": cat_name,
            "level": "category",
            "is_seal": is_seal,
            "is_roll": is_roll,
            **cat_metrics,
            "children": materials_list
        })

    return {
        "period_info": period_info,
        "summary": overall_summary,
        "categories": categories_list,
        "sales_reps": all_reps
    }
