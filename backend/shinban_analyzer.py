"""
新版商品およびリピート受注（受注数量ベース・単袋ピッチ換算ｍベース・金額ベース）の高速集計エンジン
- 基幹AS/400データ（as400_all_orders）から当期の新版（別注・3Fロール印刷）と今期内リピート受注を抽出・紐付け
- 受注数量（order_quantity）を基準とし、ロール品はそのままｍ数、単袋品はピッチ掛け算（枚数×ピッチmm/1000）で正確にｍ数を割り出す
- 営業担当別、月別×材質別、材質別累計、個別明細ドリルダウンを高速集約
"""

import sqlite3
import pandas as pd
from typing import Dict, Any, Optional, Tuple
import config

def get_db_path() -> str:
    return getattr(config, 'SALES_CACHE_DB', 'backend/data/sales_cache.db')

def calc_order_meter(order_qty: float, unit: str, size_pitch: float, prod_name: str, title: str) -> float:
    """受注数量・単位・ピッチからメートル（ｍ）数を計算（単袋は枚数×ピッチ/1000）"""
    if not order_qty or order_qty <= 0:
        return 0.0
    if unit == 'ｍ':
        return float(order_qty)
    
    # 単袋（枚）の場合: ピッチ(mm)を掛け算してmを割り出す
    pitch = float(size_pitch) if size_pitch and size_pitch > 0 else 0.0
    if pitch <= 0:
        name = f"{prod_name} {title}"
        if '10K' in name or '１０Ｋ' in name or '10kg' in name:
            pitch = 570.0
        elif '2K' in name or '２Ｋ' in name or '3K' in name or '３Ｋ' in name:
            pitch = 350.0
        elif '1K' in name or '１Ｋ' in name:
            pitch = 280.0
        elif '30K' in name or '３０Ｋ' in name:
            pitch = 850.0
        else:
            pitch = 470.0  # 標準5kgピッチ
            
    return float(order_qty) * pitch / 1000.0

def standardize_material(short_name: str, full_name: str) -> str:
    """米袋業界の標準材質グループに分類"""
    s = str(short_name or '')
    f = str(full_name or '')
    if 'ポリポリ' in s or 'ポリポリ' in f or 'ﾎﾟﾘﾎﾟﾘ' in s: return 'ポリポリ'
    if 'ＳＦM' in s or 'ＳＦマットポリ' in f or 'SFマットポリ' in f or 'SFM' in s: return 'SFマットポリ'
    if 'ＳＦポリ' in s or 'ＳＦポリ' in f or 'SFﾎﾟﾘ' in s: return 'SFポリ'
    if 'マットポリ' in s or 'マットポリ' in f or s == 'Mﾎﾟﾘ': return 'マットポリ'
    if 'ラミ' in s or 'ラミ' in f: return 'ラミ'
    if '透明' in s or '透明' in f: return 'ポリ（透明）'
    if '乳白' in s or '乳白' in f: return 'ポリ（乳白）'
    if 'コン' in s or 'コン' in f: return 'ポリ（着色/コン）'
    if 'ｸﾗﾌﾄ' in s or 'クラフト' in f: return 'クラフト'
    if '和紙' in s or '和紙' in f: return '和紙'
    return 'その他'

import os
import threading

_SHINBAN_CACHE: Dict[Tuple[str, str, str, Optional[str]], Dict[str, Any]] = {}
_SHINBAN_CACHE_MTIME: float = 0.0
_SHINBAN_CACHE_LOCK = threading.Lock()

def analyze_shinban_and_repeats(
    start_date: str = '2026-02-01',
    end_date: str = '2027-01-31',
    category_filter: str = 'all',  # 'all', 'roll', 'custom'
    sales_rep_filter: Optional[str] = None
) -> Dict[str, Any]:
    """
    新版商品およびリピート受注を多角的に分析し、JSON直列化可能な辞書で返却（インメモリキャッシュ対応）
    """
    global _SHINBAN_CACHE, _SHINBAN_CACHE_MTIME

    db_path = get_db_path()
    if not os.path.exists(db_path):
        return {}

    db_mtime = os.path.getmtime(db_path)
    cache_key = (start_date, end_date, category_filter, sales_rep_filter)

    with _SHINBAN_CACHE_LOCK:
        if db_mtime > _SHINBAN_CACHE_MTIME:
            _SHINBAN_CACHE.clear()
            _SHINBAN_CACHE_MTIME = db_mtime
        elif cache_key in _SHINBAN_CACHE:
            return _SHINBAN_CACHE[cache_key]

    conn = sqlite3.connect(db_path)
    
    # 区分条件
    cat_sql = "(classification = '３Ｆロールフレキソ版' OR classification LIKE '%別注%')"
    if category_filter == 'roll':
        cat_sql = "(classification = '３Ｆロールフレキソ版')"
    elif category_filter == 'custom':
        cat_sql = "(classification LIKE '%別注%')"
        
    rep_sql = ""
    params = [start_date, end_date]
    if sales_rep_filter and sales_rep_filter != 'all':
        rep_sql = " AND sales_rep = ?"
        params.append(sales_rep_filter)

    query = f"""
    WITH shinban AS (
        SELECT 
            order_no, branch_no, order_date, customer_code, customer_name, sales_rep, classification,
            product_code, product_name, title, material_short, material_name, shape_type, unit, 
            order_quantity, quantity, size_pitch, amount, profit
        FROM as400_all_orders
        WHERE order_date >= ? AND order_date <= ?
          AND {cat_sql}
          AND (title LIKE '%新版%' OR print_note LIKE '%新版%')
          {rep_sql}
    ),
    repeats AS (
        SELECT 
            s.order_no as shin_order_no,
            s.branch_no as shin_branch_no,
            r.order_no as rep_order_no,
            r.branch_no as rep_branch_no,
            r.order_date as rep_order_date,
            r.order_quantity as rep_order_quantity,
            r.quantity as rep_quantity,
            r.unit as rep_unit,
            r.shape_type as rep_shape_type,
            r.size_pitch as rep_size_pitch,
            r.product_name as rep_product_name,
            r.title as rep_title,
            r.amount as rep_amount,
            r.profit as rep_profit,
            r.sales_rep as rep_sales_rep
        FROM shinban s
        JOIN as400_all_orders r
          ON (
              -- パターン1: 同じ受注番号で枝番が後ろ
              (s.order_no = r.order_no AND r.branch_no > s.branch_no)
              OR
              -- パターン2: 別受注番号だが得意先コードと商品コードが同一（汎用コード等を除く）
              (s.customer_code = r.customer_code 
               AND s.product_code = r.product_code 
               AND s.product_code NOT IN ('999999999', '', '0', '9090502', '9090501', '9210501')
               AND (r.order_no != s.order_no)
               AND r.order_date >= s.order_date)
          )
        WHERE r.order_date >= ? AND r.order_date <= ?
    )
    SELECT 
        s.*,
        rep.rep_order_no, rep.rep_branch_no, rep.rep_order_date, rep.rep_order_quantity,
        rep.rep_quantity, rep.rep_unit, rep.rep_shape_type, rep.rep_size_pitch, 
        rep.rep_product_name, rep.rep_title, rep.rep_amount, rep.rep_profit
    FROM shinban s
    LEFT JOIN repeats rep ON s.order_no = rep.shin_order_no AND s.branch_no = rep.shin_branch_no
    """
    
    all_params = params + [start_date, end_date]
    df = pd.read_sql_query(query, conn, params=all_params)
    conn.close()

    if df.empty:
        return {
            "summary": {
                "shinban_count": 0, "shinban_meters": 0, "shinban_amount": 0,
                "repeat_count": 0, "repeat_meters": 0, "repeat_amount": 0,
                "total_meters": 0, "total_amount": 0,
                "repeat_rate_meters": 0.0, "repeat_rate_amount": 0.0
            },
            "sales_rep_ranking": [],
            "sales_rep_matrix": {"months": [], "rows": [], "monthly_totals": {}, "overall_total": {}},
            "monthly_materials": [],
            "material_summary": [],
            "detail_orders": []
        }

    # 1. 新版単独レコード（受注数量 order_quantity ベースで計算）
    shinban_df = df.drop_duplicates(subset=['order_no', 'branch_no']).copy()
    shinban_df['meters'] = shinban_df.apply(
        lambda r: calc_order_meter(r['order_quantity'], r['unit'], r['size_pitch'], r['product_name'], r['title']), 
        axis=1
    )
    shinban_df['material_group'] = shinban_df.apply(
        lambda r: standardize_material(r['material_short'], r['material_name']),
        axis=1
    )
    shinban_df['order_month'] = shinban_df['order_date'].str.slice(0, 7)

    # 2. リピート単独レコード（受注数量 rep_order_quantity ベースで計算）
    repeat_df = df[df['rep_order_no'].notna()].drop_duplicates(subset=['rep_order_no', 'rep_branch_no']).copy()
    if not repeat_df.empty:
        repeat_df['meters'] = repeat_df.apply(
            lambda r: calc_order_meter(r['rep_order_quantity'], r['rep_unit'], r['rep_size_pitch'], r['rep_product_name'], r['rep_title']),
            axis=1
        )
    else:
        repeat_df['meters'] = 0.0

    # ----------------------------------------------------
    # サマリー計算
    # ----------------------------------------------------
    shin_cnt = len(shinban_df)
    shin_m = round(float(shinban_df['meters'].sum()), 0)
    shin_amt = round(float(shinban_df['amount'].sum()), 0)

    rep_cnt = len(repeat_df)
    rep_m = round(float(repeat_df['meters'].sum()), 0) if not repeat_df.empty else 0.0
    rep_amt = round(float(repeat_df['rep_amount'].sum()), 0) if not repeat_df.empty else 0.0

    tot_m = round(shin_m + rep_m, 0)
    tot_amt = round(shin_amt + rep_amt, 0)
    rep_rate_m = round((rep_m / tot_m * 100), 1) if tot_m > 0 else 0.0
    rep_rate_amt = round((rep_amt / tot_amt * 100), 1) if tot_amt > 0 else 0.0

    summary = {
        "shinban_count": shin_cnt,
        "shinban_meters": shin_m,
        "shinban_amount": shin_amt,
        "repeat_count": rep_cnt,
        "repeat_meters": rep_m,
        "repeat_amount": rep_amt,
        "total_meters": tot_m,
        "total_amount": tot_amt,
        "repeat_rate_meters": rep_rate_m,
        "repeat_rate_amount": rep_rate_amt
    }

    # ----------------------------------------------------
    # 営業担当別ランキング
    # ----------------------------------------------------
    rep_shin_cnt = shinban_df.groupby('sales_rep')['order_no'].count()
    rep_shin_m = shinban_df.groupby('sales_rep')['meters'].sum()
    rep_shin_amt = shinban_df.groupby('sales_rep')['amount'].sum()

    if not repeat_df.empty:
        rep_rep_cnt = repeat_df.groupby('sales_rep')['rep_order_no'].count()
        rep_rep_m = repeat_df.groupby('sales_rep')['meters'].sum()
        rep_rep_amt = repeat_df.groupby('sales_rep')['rep_amount'].sum()
    else:
        rep_rep_cnt = pd.Series(dtype=int)
        rep_rep_m = pd.Series(dtype=float)
        rep_rep_amt = pd.Series(dtype=float)

    # ----------------------------------------------------
    # 営業担当別 × 月別集計（新版・リピート・合計）
    # ----------------------------------------------------
    if not repeat_df.empty:
        repeat_df['rep_order_month'] = repeat_df['rep_order_date'].str.slice(0, 7)
    else:
        repeat_df['rep_order_month'] = pd.Series(dtype=str)

    # 当期月リスト（実績のある月をソート）
    months_in_shin = set(shinban_df['order_month'].dropna().unique())
    months_in_rep = set(repeat_df['rep_order_month'].dropna().unique()) if not repeat_df.empty else set()
    all_months = sorted(list(months_in_shin.union(months_in_rep)))
    # もし空なら当期デフォルト
    if not all_months:
        all_months = [f"2026/{str(m).zfill(2)}" for m in range(2, 13)] + ["2027/01"]

    all_reps = sorted(list(set(shinban_df['sales_rep'].dropna().tolist())))
    sales_rep_ranking = []

    # ピボットテーブルによる高速集計
    pivot_s_m = shinban_df.pivot_table(index='sales_rep', columns='order_month', values='meters', aggfunc='sum', fill_value=0)
    pivot_s_a = shinban_df.pivot_table(index='sales_rep', columns='order_month', values='amount', aggfunc='sum', fill_value=0)

    if not repeat_df.empty:
        pivot_r_m = repeat_df.pivot_table(index='sales_rep', columns='rep_order_month', values='meters', aggfunc='sum', fill_value=0)
        pivot_r_a = repeat_df.pivot_table(index='sales_rep', columns='rep_order_month', values='rep_amount', aggfunc='sum', fill_value=0)
    else:
        pivot_r_m = pd.DataFrame()
        pivot_r_a = pd.DataFrame()

    matrix_rows = []
    matrix_totals = {m: {"shinban_meters": 0.0, "shinban_amount": 0.0, "repeat_meters": 0.0, "repeat_amount": 0.0, "total_meters": 0.0, "total_amount": 0.0} for m in all_months}
    overall_total = {"shinban_meters": 0.0, "shinban_amount": 0.0, "repeat_meters": 0.0, "repeat_amount": 0.0, "total_meters": 0.0, "total_amount": 0.0}

    for rep in all_reps:
        s_c = int(rep_shin_cnt.get(rep, 0))
        s_m = round(float(rep_shin_m.get(rep, 0.0)), 0)
        s_a = round(float(rep_shin_amt.get(rep, 0.0)), 0)

        r_c = int(rep_rep_cnt.get(rep, 0))
        r_m = round(float(rep_rep_m.get(rep, 0.0)), 0)
        r_a = round(float(rep_rep_amt.get(rep, 0.0)), 0)

        t_m = round(s_m + r_m, 0)
        t_a = round(s_a + r_a, 0)
        rate_m = round((r_m / t_m * 100), 1) if t_m > 0 else 0.0
        rate_a = round((r_a / t_a * 100), 1) if t_a > 0 else 0.0

        # 月別内訳の作成
        rep_monthly = {}
        for m in all_months:
            sm = round(float(pivot_s_m.loc[rep, m]) if rep in pivot_s_m.index and m in pivot_s_m.columns else 0.0, 0)
            sa = round(float(pivot_s_a.loc[rep, m]) if rep in pivot_s_a.index and m in pivot_s_a.columns else 0.0, 0)
            rm = round(float(pivot_r_m.loc[rep, m]) if rep in pivot_r_m.index and m in pivot_r_m.columns else 0.0, 0)
            ra = round(float(pivot_r_a.loc[rep, m]) if rep in pivot_r_a.index and m in pivot_r_a.columns else 0.0, 0)
            tm = round(sm + rm, 0)
            ta = round(sa + ra, 0)

            rep_monthly[m] = {
                "shinban_meters": sm,
                "shinban_amount": sa,
                "repeat_meters": rm,
                "repeat_amount": ra,
                "total_meters": tm,
                "total_amount": ta
            }

            # 全体計への加算
            matrix_totals[m]["shinban_meters"] += sm
            matrix_totals[m]["shinban_amount"] += sa
            matrix_totals[m]["repeat_meters"] += rm
            matrix_totals[m]["repeat_amount"] += ra
            matrix_totals[m]["total_meters"] += tm
            matrix_totals[m]["total_amount"] += ta

        sales_rep_ranking.append({
            "sales_rep": rep,
            "shinban_count": s_c,
            "shinban_meters": s_m,
            "shinban_amount": s_a,
            "repeat_count": r_c,
            "repeat_meters": r_m,
            "repeat_amount": r_a,
            "total_meters": t_m,
            "total_amount": t_a,
            "repeat_rate_meters": rate_m,
            "repeat_rate_amount": rate_a,
            "monthly": rep_monthly
        })

        matrix_rows.append({
            "sales_rep": rep,
            "monthly": rep_monthly,
            "total": {
                "shinban_meters": s_m,
                "shinban_amount": s_a,
                "repeat_meters": r_m,
                "repeat_amount": r_a,
                "total_meters": t_m,
                "total_amount": t_a,
                "repeat_rate_meters": rate_m,
                "repeat_rate_amount": rate_a
            }
        })

    # 合計ｍ数降順ソート
    sales_rep_ranking.sort(key=lambda x: x['total_meters'], reverse=True)
    matrix_rows.sort(key=lambda x: x['total']['total_meters'], reverse=True)

    # 全体計の整形
    for m in all_months:
        matrix_totals[m]["shinban_meters"] = round(matrix_totals[m]["shinban_meters"], 0)
        matrix_totals[m]["shinban_amount"] = round(matrix_totals[m]["shinban_amount"], 0)
        matrix_totals[m]["repeat_meters"] = round(matrix_totals[m]["repeat_meters"], 0)
        matrix_totals[m]["repeat_amount"] = round(matrix_totals[m]["repeat_amount"], 0)
        matrix_totals[m]["total_meters"] = round(matrix_totals[m]["total_meters"], 0)
        matrix_totals[m]["total_amount"] = round(matrix_totals[m]["total_amount"], 0)

        overall_total["shinban_meters"] += matrix_totals[m]["shinban_meters"]
        overall_total["shinban_amount"] += matrix_totals[m]["shinban_amount"]
        overall_total["repeat_meters"] += matrix_totals[m]["repeat_meters"]
        overall_total["repeat_amount"] += matrix_totals[m]["repeat_amount"]
        overall_total["total_meters"] += matrix_totals[m]["total_meters"]
        overall_total["total_amount"] += matrix_totals[m]["total_amount"]

    for k in overall_total:
        overall_total[k] = round(overall_total[k], 0)

    sales_rep_matrix = {
        "months": all_months,
        "rows": matrix_rows,
        "monthly_totals": matrix_totals,
        "overall_total": overall_total
    }


    # ----------------------------------------------------
    # 月別×主要材質別推移
    # ----------------------------------------------------
    monthly_pivot_m = shinban_df.pivot_table(
        index='order_month', columns='material_group', values='meters', aggfunc='sum', fill_value=0
    )
    monthly_pivot_amt = shinban_df.pivot_table(
        index='order_month', columns='material_group', values='amount', aggfunc='sum', fill_value=0
    )

    monthly_materials = []
    all_months = sorted(shinban_df['order_month'].dropna().unique().tolist())
    mat_cols = sorted(shinban_df['material_group'].dropna().unique().tolist())

    for m in all_months:
        row_data = {"month": m, "meters": {}, "amount": {}, "total_meters": 0.0, "total_amount": 0.0}
        tot_m_month = 0.0
        tot_amt_month = 0.0
        for mat in mat_cols:
            m_val = round(float(monthly_pivot_m.loc[m, mat]) if mat in monthly_pivot_m.columns and m in monthly_pivot_m.index else 0.0, 0)
            amt_val = round(float(monthly_pivot_amt.loc[m, mat]) if mat in monthly_pivot_amt.columns and m in monthly_pivot_amt.index else 0.0, 0)
            row_data["meters"][mat] = m_val
            row_data["amount"][mat] = amt_val
            tot_m_month += m_val
            tot_amt_month += amt_val
        row_data["total_meters"] = round(tot_m_month, 0)
        row_data["total_amount"] = round(tot_amt_month, 0)
        monthly_materials.append(row_data)

    # ----------------------------------------------------
    # 材質別累計
    # ----------------------------------------------------
    mat_summary = []
    mat_grouped = shinban_df.groupby('material_group').agg(
        count=('order_no', 'count'),
        meters=('meters', 'sum'),
        amount=('amount', 'sum')
    ).reset_index()

    for _, row in mat_grouped.iterrows():
        m_val = round(float(row['meters']), 0)
        amt_val = round(float(row['amount']), 0)
        share_m = round((m_val / tot_m * 100), 1) if tot_m > 0 else 0.0
        share_amt = round((amt_val / tot_amt * 100), 1) if tot_amt > 0 else 0.0
        mat_summary.append({
            "material_group": row['material_group'],
            "count": int(row['count']),
            "meters": m_val,
            "amount": amt_val,
            "share_meters": share_m,
            "share_amount": share_amt
        })
    mat_summary.sort(key=lambda x: x['meters'], reverse=True)

    # ----------------------------------------------------
    # 個別新版案件と紐づくリピートの構造化（ドリルダウン用）
    # ----------------------------------------------------
    detail_orders = []
    shinban_sorted = shinban_df.sort_values(by=['order_date', 'order_no'], ascending=[False, False])
    
    repeats_by_shinban = {}
    if not repeat_df.empty:
        for _, r in repeat_df.iterrows():
            key = (int(r['order_no']), int(r['branch_no']))
            if key not in repeats_by_shinban:
                repeats_by_shinban[key] = []
            repeats_by_shinban[key].append({
                "order_no": int(r['rep_order_no']),
                "branch_no": int(r['rep_branch_no']),
                "order_date": r['rep_order_date'],
                "product_name": r['rep_product_name'],
                "title": r['rep_title'],
                "unit": r['rep_unit'],
                "quantity": float(r['rep_order_quantity'] or 0),
                "meters": round(float(r['meters']), 0),
                "amount": round(float(r['rep_amount'] or 0), 0)
            })

    for _, s in shinban_sorted.iterrows():
        key = (int(s['order_no']), int(s['branch_no']))
        reps = repeats_by_shinban.get(key, [])
        reps.sort(key=lambda x: x['order_date'])
        
        rep_m_sum = round(sum(item['meters'] for item in reps), 0)
        rep_amt_sum = round(sum(item['amount'] for item in reps), 0)

        detail_orders.append({
            "order_no": int(s['order_no']),
            "branch_no": int(s['branch_no']),
            "order_date": s['order_date'],
            "customer_code": s['customer_code'],
            "customer_name": s['customer_name'],
            "sales_rep": s['sales_rep'],
            "classification": s['classification'],
            "product_code": s['product_code'],
            "product_name": s['product_name'],
            "title": s['title'],
            "material_group": s['material_group'],
            "unit": s['unit'],
            "quantity": float(s['order_quantity'] or 0),
            "size_pitch": float(s['size_pitch'] or 0),
            "meters": round(float(s['meters']), 0),
            "amount": round(float(s['amount'] or 0), 0),
            "repeat_count": len(reps),
            "repeat_meters": rep_m_sum,
            "repeat_amount": rep_amt_sum,
            "repeats": reps
        })

    result = {
        "summary": summary,
        "sales_rep_ranking": sales_rep_ranking,
        "sales_rep_matrix": sales_rep_matrix,
        "monthly_materials": monthly_materials,
        "material_summary": mat_summary,
        "detail_orders": detail_orders
    }

    with _SHINBAN_CACHE_LOCK:
        _SHINBAN_CACHE[cache_key] = result

    return result
