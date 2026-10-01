"""
泥臭く営業するための3大実用指標（行動直結型セールスインサイト）API
1. 失注阻止・発注ストップ（Churn Risk）: 定期購入があるのに発注サイクルを超過している顧客
2. 版落ち2年寸前（Plate Expiry Risk）: 20〜23ヶ月経過の別注品（今なら版代無料の最強受注トリガー）
3. 適正利益乖離（Profit Deviation Risk）: 粗利率が極端に低い（赤字リスク）または極端に高い（他社コンペ・奪取リスク）品目
"""

import sqlite3
import logging
import os
import threading
from typing import Optional, Dict, Any, List, Tuple
from fastapi import APIRouter, Query

import sales_importer

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/sales-insights", tags=["sales-insights"])

_INSIGHTS_CACHE: Dict[Tuple[Optional[str], Optional[str], int], Dict[str, Any]] = {}
_INSIGHTS_CACHE_MTIME: float = 0.0
_INSIGHTS_CACHE_LOCK = threading.Lock()

def clean_customer_code(raw: Any) -> str:
    if not raw:
        return ""
    s = str(raw).strip()
    return s.split('.')[0].lstrip('0') or s


@router.get("/actionable")
@router.get("/actionable-insights")
def get_actionable_insights(
    sales_rep: Optional[str] = None,
    margin_type: Optional[str] = "all",
    limit: int = 100
) -> Dict[str, Any]:
    global _INSIGHTS_CACHE, _INSIGHTS_CACHE_MTIME

    rep_filter = sales_rep.strip() if (isinstance(sales_rep, str) and sales_rep.strip() and sales_rep not in ('all', '全員', '全体', '')) else None
    cache_key = (rep_filter, margin_type, limit)

    db_path = sales_importer.get_sales_db_path()
    if os.path.exists(db_path):
        db_mtime = os.path.getmtime(db_path)
        with _INSIGHTS_CACHE_LOCK:
            if db_mtime > _INSIGHTS_CACHE_MTIME:
                _INSIGHTS_CACHE.clear()
                _INSIGHTS_CACHE_MTIME = db_mtime
            elif cache_key in _INSIGHTS_CACHE:
                return _INSIGHTS_CACHE[cache_key]

    sales_importer.init_sales_db()

    with sales_importer.get_sales_db_conn() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # 担当営業一覧を取得（フィルター選択用）
        cursor.execute("""
            SELECT DISTINCT sales_rep 
            FROM as400_all_orders 
            WHERE sales_rep IS NOT NULL AND sales_rep != ''
            ORDER BY sales_rep ASC
        """)
        all_reps = [r["sales_rep"] for r in cursor.fetchall() if r["sales_rep"]]

        rep_clause = ""
        rep_params: List[Any] = []
        if rep_filter:
            rep_clause = " AND (sales_rep LIKE ? OR sales_rep = ?) "
            rep_params = [f"%{rep_filter}%", rep_filter]

        # -------------------------------------------------------------------------
        # 指標1: 失注阻止・発注ストップ (Churn Risk)
        # 過去3年で3回以上発注があり、平均サイクル×1.35倍以上経過している顧客
        # -------------------------------------------------------------------------
        churn_sql = f"""
            WITH order_dates AS (
                SELECT DISTINCT customer_code, customer_name, sales_rep, COALESCE(order_date, sales_date) as odate
                FROM as400_all_orders
                WHERE COALESCE(order_date, sales_date) >= date('now', '-3 year')
                  AND customer_name IS NOT NULL AND customer_name != ''
                  {rep_clause}
                ORDER BY customer_code, odate ASC
            ),
            customer_cycles AS (
                SELECT 
                    customer_code,
                    customer_name,
                    sales_rep,
                    COUNT(*) as order_count,
                    MIN(odate) as first_date,
                    MAX(odate) as last_date,
                    ROUND((julianday('now') - julianday(MIN(odate))) / NULLIF(COUNT(*), 0), 1) as avg_cycle_days,
                    CAST(julianday('now') - julianday(MAX(odate)) AS INT) as days_since_last
                FROM order_dates
                GROUP BY customer_code
                HAVING order_count >= 3 
                   AND avg_cycle_days >= 10 
                   AND avg_cycle_days <= 180
            )
            SELECT 
                c.customer_code,
                c.customer_name,
                c.sales_rep,
                c.order_count,
                c.last_date,
                c.avg_cycle_days,
                c.days_since_last,
                ROUND(c.days_since_last * 1.0 / NULLIF(c.avg_cycle_days, 0), 1) as delay_ratio,
                SUM(o.amount) as total_sales,
                MAX(o.product_name) as sample_product
            FROM customer_cycles c
            JOIN as400_all_orders o ON c.customer_code = o.customer_code
            WHERE c.days_since_last > (c.avg_cycle_days * 1.35)
              AND c.days_since_last BETWEEN 35 AND 400
            GROUP BY c.customer_code
            HAVING total_sales >= 100000
            ORDER BY total_sales DESC
            LIMIT ?
        """
        cursor.execute(churn_sql, rep_params + [limit])
        churn_rows = []
        for r in cursor.fetchall():
            churn_rows.append({
                "customer_code": clean_customer_code(r["customer_code"]),
                "customer_name": r["customer_name"],
                "sales_rep": r["sales_rep"] or "未設定",
                "order_count": r["order_count"],
                "last_order_date": r["last_date"],
                "avg_cycle_days": r["avg_cycle_days"],
                "days_since_last": r["days_since_last"],
                "delay_ratio": r["delay_ratio"],
                "total_sales": int(r["total_sales"] or 0),
                "sample_product": r["sample_product"] or "",
                "alert_level": "danger" if r["delay_ratio"] >= 2.5 else "warning",
                "action_suggestion": f"平均{r['avg_cycle_days']}日周期に対し{r['days_since_last']}日未注文（{r['delay_ratio']}倍）。在庫確認・フォローを推奨。"
            })

        # -------------------------------------------------------------------------
        # 指標2: 版落ち寸前 (Plate Expiry Risk)
        # 別注品で最終受注から20〜23ヶ月経過（落版前のラストチャンス）
        # -------------------------------------------------------------------------
        plate_sql = f"""
            SELECT 
                customer_code,
                customer_name,
                product_code,
                product_name,
                brand_name,
                classification,
                order_no,
                sales_rep,
                MAX(COALESCE(order_date, sales_date)) as last_date,
                unit_price,
                cost_price,
                MAX(quantity) as last_quantity,
                unit,
                CAST((julianday('now') - julianday(MAX(COALESCE(order_date, sales_date)))) / 30.44 AS INT) as elapsed_months,
                CAST(julianday('now') - julianday(MAX(COALESCE(order_date, sales_date))) AS INT) as elapsed_days
            FROM as400_all_orders
            WHERE (classification IN ('別注', 'シルク') OR product_code LIKE '70%')
              AND COALESCE(order_date, sales_date) IS NOT NULL
              {rep_clause}
            GROUP BY customer_code, product_code, product_name
            HAVING elapsed_months BETWEEN 20 AND 23
            ORDER BY elapsed_months DESC, last_quantity DESC
            LIMIT ?
        """
        cursor.execute(plate_sql, rep_params + [limit])
        plate_rows = []
        for r in cursor.fetchall():
            m = r["elapsed_months"]
            rem_months = max(1, 24 - m)
            plate_rows.append({
                "customer_code": clean_customer_code(r["customer_code"]),
                "customer_name": r["customer_name"],
                "product_code": r["product_code"],
                "product_name": r["product_name"],
                "brand_name": r["brand_name"] or "",
                "classification": r["classification"] or "別注",
                "order_no": r["order_no"] or "-",
                "sales_rep": r["sales_rep"] or "未設定",
                "last_order_date": r["last_date"],
                "unit_price": r["unit_price"] or 0,
                "cost_price": r["cost_price"] or 0,
                "last_quantity": int(r["last_quantity"] or 0),
                "unit": r["unit"] or "枚",
                "elapsed_months": m,
                "elapsed_days": r["elapsed_days"],
                "remaining_months": rem_months,
                "action_suggestion": f"版保管期限まであと約{rem_months}ヶ月。再版代不要の案内によるリピート促進。"
            })

        # -------------------------------------------------------------------------
        # 指標3: 適正利益乖離（極端に低い: <12%、極端に高い: >35%）
        # 直近1年以内の取引がある商品で適正レンジ（15%〜30%）から大きく乖離
        # -------------------------------------------------------------------------
        margin_filter_clause = ""
        if margin_type == "low":
            margin_filter_clause = " AND margin_rate < 12.0 "
        elif margin_type == "high":
            margin_filter_clause = " AND margin_rate > 35.0 "
        else:
            # all: 極端に低い (<12%) または 極端に高い (>35%)
            margin_filter_clause = " AND (margin_rate < 12.0 OR margin_rate > 35.0) "

        margin_sql = f"""
            SELECT 
                customer_code,
                customer_name,
                product_code,
                product_name,
                sales_rep,
                SUM(amount) as total_amount,
                SUM(profit) as total_profit,
                ROUND(SUM(profit) * 100.0 / NULLIF(SUM(amount), 0), 1) as margin_rate,
                MAX(COALESCE(order_date, sales_date)) as last_date,
                MAX(unit_price) as latest_unit_price,
                MAX(cost_price) as latest_cost_price,
                SUM(quantity) as total_quantity,
                MAX(unit) as unit
            FROM as400_all_orders
            WHERE COALESCE(order_date, sales_date) >= date('now', '-1 year')
              AND amount > 0
              AND cost_price > 0
              {rep_clause}
            GROUP BY customer_code, product_code, product_name
            HAVING total_amount >= 30000 {margin_filter_clause}
            ORDER BY total_amount DESC
            LIMIT ?
        """
        cursor.execute(margin_sql, rep_params + [limit])
        margin_rows = []
        for r in cursor.fetchall():
            amt = float(r["total_amount"] or 0)
            prof = float(r["total_profit"] or 0)
            rate = float(r["margin_rate"] or 0)
            is_low = rate < 12.0
            
            if is_low:
                status_label = "薄利警戒 (<12%)"
                suggestion = f"粗利率{rate}%（利益: ¥{int(prof):,}）。単価改定・仕入交渉の検討を推奨。"
            else:
                status_label = "高利警戒 (>35%)"
                suggestion = f"粗利率{rate}%（利益: ¥{int(prof):,}）。他社競合への流出防止・適正価格見直しの検討。"

            margin_rows.append({
                "customer_code": clean_customer_code(r["customer_code"]),
                "customer_name": r["customer_name"],
                "product_code": r["product_code"],
                "product_name": r["product_name"],
                "sales_rep": r["sales_rep"] or "未設定",
                "total_sales": int(amt),
                "total_profit": int(prof),
                "margin_rate": rate,
                "deviation_type": "low" if is_low else "high",
                "status_label": status_label,
                "last_order_date": r["last_date"],
                "latest_unit_price": r["latest_unit_price"] or 0,
                "latest_cost_price": r["latest_cost_price"] or 0,
                "total_quantity": int(r["total_quantity"] or 0),
                "unit": r["unit"] or "枚",
                "action_suggestion": suggestion
            })

        low_count = sum(1 for m in margin_rows if m["deviation_type"] == "low")
        high_count = sum(1 for m in margin_rows if m["deviation_type"] == "high")

        # -------------------------------------------------------------------------
        # 指標3-B: 適正利益乖離（会社ごと / 得意先単位）
        # 得意先全体の総合粗利率が極端に低い (<12%) または 高い (>35%)
        # -------------------------------------------------------------------------
        cust_margin_sql = f"""
            WITH prod_agg AS (
                SELECT 
                    customer_code,
                    product_code,
                    product_name,
                    SUM(amount) as p_amount,
                    SUM(profit) as p_profit,
                    ROUND(SUM(profit) * 100.0 / NULLIF(SUM(amount), 0), 1) as p_margin_rate,
                    ROW_NUMBER() OVER (PARTITION BY customer_code ORDER BY SUM(amount) DESC) as rn
                FROM as400_all_orders
                WHERE COALESCE(order_date, sales_date) >= date('now', '-1 year')
                  AND amount > 0 AND cost_price > 0
                  {rep_clause}
                GROUP BY customer_code, product_code, product_name
            ),
            cust_main_prod AS (
                SELECT customer_code, product_name as top_product_name
                FROM prod_agg
                WHERE rn = 1
            ),
            cust_prod_stats AS (
                SELECT 
                    customer_code,
                    SUM(CASE WHEN p_margin_rate < 12.0 THEN 1 ELSE 0 END) as low_margin_prod_count,
                    SUM(CASE WHEN p_margin_rate > 35.0 THEN 1 ELSE 0 END) as high_margin_prod_count
                FROM prod_agg
                GROUP BY customer_code
            )
            SELECT 
                c.customer_code,
                c.customer_name,
                c.sales_rep,
                SUM(c.amount) as total_amount,
                SUM(c.profit) as total_profit,
                ROUND(SUM(c.profit) * 100.0 / NULLIF(SUM(c.amount), 0), 1) as margin_rate,
                COUNT(DISTINCT c.product_code) as product_count,
                COUNT(*) as order_count,
                MAX(COALESCE(c.order_date, c.sales_date)) as last_date,
                COALESCE(mp.top_product_name, '') as top_product_name,
                COALESCE(ps.low_margin_prod_count, 0) as low_margin_prod_count,
                COALESCE(ps.high_margin_prod_count, 0) as high_margin_prod_count
            FROM as400_all_orders c
            LEFT JOIN cust_main_prod mp ON c.customer_code = mp.customer_code
            LEFT JOIN cust_prod_stats ps ON c.customer_code = ps.customer_code
            WHERE COALESCE(c.order_date, c.sales_date) >= date('now', '-1 year')
              AND c.amount > 0
              AND c.cost_price > 0
              {rep_clause.replace('sales_rep', 'c.sales_rep')}
            GROUP BY c.customer_code
            HAVING total_amount >= 30000 {margin_filter_clause}
            ORDER BY total_amount DESC
            LIMIT ?
        """
        cursor.execute(cust_margin_sql, rep_params + rep_params + [limit])
        cust_margin_rows = []
        for r in cursor.fetchall():
            amt = float(r["total_amount"] or 0)
            prof = float(r["total_profit"] or 0)
            rate = float(r["margin_rate"] or 0)
            is_low = rate < 12.0
            prod_cnt = int(r["product_count"] or 0)
            low_prod_cnt = int(r["low_margin_prod_count"] or 0)
            high_prod_cnt = int(r["high_margin_prod_count"] or 0)
            top_prod = r["top_product_name"] or ""

            if is_low:
                status_label = "薄利警戒 (<12%)"
                suggestion = (
                    f"会社全体粗利率{rate}%（売上: ¥{int(amt):,} / 粗利: ¥{int(prof):,}）。"
                    f"薄利品目{low_prod_cnt}品/全{prod_cnt}品。全社的な単価改定・仕入運賃見直しを推奨。"
                )
            else:
                status_label = "高利警戒 (>35%)"
                suggestion = (
                    f"会社全体粗利率{rate}%（売上: ¥{int(amt):,} / 粗利: ¥{int(prof):,}）。"
                    f"高利品目{high_prod_cnt}品/全{prod_cnt}品。他社コンペ・流出防止へのフォローと適正価格見直しを推奨。"
                )

            cust_margin_rows.append({
                "customer_code": clean_customer_code(r["customer_code"]),
                "customer_name": r["customer_name"],
                "sales_rep": r["sales_rep"] or "未設定",
                "total_sales": int(amt),
                "total_profit": int(prof),
                "margin_rate": rate,
                "deviation_type": "low" if is_low else "high",
                "status_label": status_label,
                "last_order_date": r["last_date"],
                "product_count": prod_cnt,
                "order_count": int(r["order_count"] or 0),
                "low_margin_prod_count": low_prod_cnt,
                "high_margin_prod_count": high_prod_cnt,
                "top_product_name": top_prod,
                "action_suggestion": suggestion
            })

        cust_low_count = sum(1 for m in cust_margin_rows if m["deviation_type"] == "low")
        cust_high_count = sum(1 for m in cust_margin_rows if m["deviation_type"] == "high")

        result = {
            "success": True,
            "sales_reps": all_reps,
            "selected_rep": rep_filter or "all",
            "summary": {
                "churn_risk_count": len(churn_rows),
                "plate_expiry_count": len(plate_rows),
                "margin_deviation_count": len(margin_rows),
                "low_margin_count": low_count,
                "high_margin_count": high_count,
                "customer_margin_deviation_count": len(cust_margin_rows),
                "customer_low_margin_count": cust_low_count,
                "customer_high_margin_count": cust_high_count
            },
            "churn_risks": churn_rows,
            "plate_expiries": plate_rows,
            "margin_deviations": margin_rows,
            "customer_margin_deviations": cust_margin_rows
        }

        with _INSIGHTS_CACHE_LOCK:
            _INSIGHTS_CACHE[cache_key] = result

        return result
