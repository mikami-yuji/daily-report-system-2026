import os
import sqlite3
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query, HTTPException

import config
import sales_importer

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/catalog", tags=["catalog"])


def calculate_elapsed_months(date_str: Optional[str]) -> int:
    """日付文字列 (YYYY-MM-DD) から現在までの経過月数を計算"""
    if not date_str or len(date_str) < 10:
        return 999
    try:
        dt = datetime.strptime(date_str[:10], "%Y-%m-%d")
        now = datetime.now()
        months = (now.year - dt.year) * 12 + (now.month - dt.month)
        return max(0, months)
    except Exception:
        return 999


def extract_rep_from_filename(filename: Optional[str]) -> str:
    if not filename:
        return ""
    import re
    m = re.search(r'【(.+?)】', filename)
    if m:
        return m.group(1).strip()
    return ""


def is_rep_name_match(rep_candidate: str, target_rep: str) -> bool:
    if not rep_candidate or not target_rep:
        return False
    import re
    r_cand = rep_candidate.replace(' ', '').replace('　', '').strip()
    t_rep = target_rep.replace(' ', '').replace('　', '').strip()
    
    if t_rep in r_cand or r_cand in t_rep:
        return True
        
    t_clean = re.sub(r'[（\(].+?[）\)]', '', t_rep)
    r_clean = re.sub(r'[（\(].+?[）\)]', '', r_cand)
    
    if "木村" in t_clean and "木村" in r_clean:
        if ("寿" in t_rep or "寿" in t_clean) and ("寿" in r_cand or "寿" in r_clean):
            return True
        if ("拓" in t_rep or "拓" in t_clean) and ("拓" in r_cand or "拓" in r_clean):
            return True
        if not ("寿" in t_rep or "拓" in t_rep) and not ("寿" in r_cand or "拓" in r_cand):
            return True
        return False
        
    if "山下" in t_clean and "山下" in r_clean:
        if ("雄" in t_rep or "雄" in t_clean) and ("雄" in r_cand or "雄" in r_clean):
            return True
        if ("和" in t_rep or "和" in t_clean) and ("和" in r_cand or "和" in r_clean):
            return True
        if not ("雄" in t_rep or "和" in t_rep) and not ("雄" in r_cand or "和" in r_cand):
            return True
        return False
        
    if t_clean and len(t_clean) >= 2 and t_clean in r_cand:
        return True
    if r_clean and len(r_clean) >= 2 and r_clean in t_rep:
        return True
        
    return False


@router.get("/customers")
def get_catalog_customers(
    file_name: Optional[str] = None,
    sales_rep: Optional[str] = None
) -> Dict[str, Any]:
    """商品カタログで選択可能な得意先一覧を取得（選択中エクセルファイルの担当顧客を最優先でソート）"""
    sales_importer.init_sales_db()
    
    target_rep = sales_rep.strip() if sales_rep else extract_rep_from_filename(file_name)
    
    file_customer_codes = set()
    file_customer_names = set()
    if file_name and os.path.exists(config.SQLITE_CACHE_DB):
        try:
            with sqlite3.connect(config.SQLITE_CACHE_DB) as s_conn:
                s_cur = s_conn.cursor()
                s_cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='reports'")
                if s_cur.fetchone():
                    s_cur.execute("SELECT DISTINCT 得意先CD, 訪問先名 FROM reports WHERE file_name = ?", (file_name,))
                    for c_cd, c_name in s_cur.fetchall():
                        if c_cd:
                            file_customer_codes.add(str(c_cd).lstrip('0'))
                        if c_name:
                            file_customer_names.add(str(c_name).strip())
        except Exception as e:
            logger.debug(f"Could not read reports from shadow_cache: {e}")

    with sales_importer.get_sales_db_conn() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                customer_code,
                customer_name,
                customer_rank,
                COUNT(*) as order_count,
                COUNT(DISTINCT product_code) as product_count,
                MAX(sales_date) as last_sales_date,
                SUM(amount) as total_sales,
                GROUP_CONCAT(DISTINCT sales_rep) as all_reps
            FROM as400_sales_orders
            WHERE customer_name IS NOT NULL AND customer_name != ''
            GROUP BY customer_code
            HAVING order_count > 0
            ORDER BY total_sales DESC
        """)
        
        customers = []
        rep_count = 0
        for row in cursor.fetchall():
            c_code = str(row["customer_code"]).lstrip('0') or str(row["customer_code"])
            c_name = str(row["customer_name"]).strip()
            all_reps_str = row["all_reps"] or ""
            reps_list = [r.strip() for r in all_reps_str.split(',') if r.strip()]
            primary_rep = reps_list[0] if reps_list else ""
            
            is_rep_cust = False
            if target_rep:
                for r in reps_list:
                    if is_rep_name_match(r, target_rep):
                        is_rep_cust = True
                        break
                if not is_rep_cust:
                    if c_code in file_customer_codes or c_name in file_customer_names:
                        is_rep_cust = True
            
            if is_rep_cust:
                rep_count += 1
                
            customers.append({
                "code": c_code,
                "name": c_name,
                "rank": row["customer_rank"] or "",
                "order_count": row["order_count"],
                "product_count": row["product_count"],
                "last_sales_date": row["last_sales_date"],
                "total_sales": row["total_sales"] or 0,
                "is_rep_customer": is_rep_cust,
                "primary_rep": primary_rep
            })
            
        if target_rep:
            customers.sort(key=lambda x: (1 if x["is_rep_customer"] else 0, x["total_sales"]), reverse=True)
        else:
            customers.sort(key=lambda x: x["total_sales"], reverse=True)
            
        return {
            "success": True,
            "total_customers": len(customers),
            "rep_name": target_rep,
            "rep_customers_count": rep_count,
            "customers": customers
        }


@router.get("/direct-dests")
def get_catalog_direct_dests(
    customer_code: Optional[str] = None,
    sales_rep: Optional[str] = None,
    query: Optional[str] = None,
    limit: int = 100
) -> Dict[str, Any]:
    """得意先（または担当者・キーワード）に紐づく直送先（納品先）一覧を取得"""
    sales_importer.init_sales_db()
    raw_code = str(customer_code).strip() if customer_code else None
    clean_code = raw_code.split('.')[0].lstrip('0') if raw_code else None

    with sales_importer.get_sales_db_conn() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        where_clauses = ["direct_customer_name IS NOT NULL AND direct_customer_name != ''"]
        params = []
        
        if raw_code and raw_code != 'all':
            if clean_code:
                where_clauses.append("(customer_code = ? OR customer_code = ? OR customer_code = ? OR customer_code = ? OR customer_code LIKE ?)")
                params.extend([raw_code, clean_code, f"0{clean_code}", f"00{clean_code}", f"%{clean_code}"])
            else:
                where_clauses.append("customer_code = ?")
                params.append(raw_code)
                
        if sales_rep and sales_rep not in ('all', '全員', '全体', ''):
            clean_r = sales_rep.strip('【】').strip()
            where_clauses.append("(sales_rep LIKE ? OR sales_rep = ?)")
            params.extend([f"%{clean_r}%", clean_r])

        if query and query.strip():
            q = f"%{query.strip()}%"
            where_clauses.append("(direct_customer_name LIKE ? OR direct_customer_code LIKE ?)")
            params.extend([q, q])
            
        where_str = f"WHERE {' AND '.join(where_clauses)}"
        cursor.execute(f"""
            SELECT DISTINCT direct_customer_name, direct_customer_code, MAX(customer_name) as sample_customer, COUNT(*) as order_count
            FROM as400_sales_orders
            {where_str}
            GROUP BY direct_customer_name
            ORDER BY order_count DESC, direct_customer_name ASC
            LIMIT ?
        """, params + [limit])
        
        dests = []
        for r in cursor.fetchall():
            dests.append({
                "name": r["direct_customer_name"],
                "code": r["direct_customer_code"] or "",
                "sample_customer": r["sample_customer"] or "",
                "order_count": r["order_count"]
            })
            
        return {
            "success": True,
            "direct_dests": dests,
            "count": len(dests)
        }


@router.get("/products")
def get_catalog_products(
    customer_code: Optional[str] = None,
    direct_dest: Optional[str] = None,
    keyword: Optional[str] = None,
    shape_type: Optional[str] = None,
    sales_rep: Optional[str] = None,
    sort_by: Optional[str] = "latest_date",
    alert_only: Optional[bool] = False
) -> Dict[str, Any]:
    """
    得意先（または全体）の取り扱い商品一覧をAmazonカタログスタイルで取得
    """
    sales_importer.init_sales_db()
    
    raw_code = str(customer_code).strip() if customer_code else None
    clean_code = raw_code.split('.')[0].lstrip('0') if raw_code else None
    
    with sales_importer.get_sales_db_conn() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # 1. 絞り込み条件の構築
        where_clauses = []
        params = []
        
        if raw_code:
            if clean_code:
                where_clauses.append("(customer_code = ? OR customer_code = ? OR customer_code = ? OR customer_code = ? OR customer_code LIKE ?)")
                params.extend([raw_code, clean_code, f"0{clean_code}", f"00{clean_code}", f"%{clean_code}"])
            else:
                where_clauses.append("customer_code = ?")
                params.append(raw_code)
            
        if direct_dest and direct_dest not in ('all', '全員', '全体', ''):
            d_clean = direct_dest.strip()
            where_clauses.append("(direct_customer_name LIKE ? OR direct_customer_code = ?)")
            params.extend([f"%{d_clean}%", d_clean])

        if keyword:
            kw = f"%{keyword.strip()}%"
            where_clauses.append("(product_name LIKE ? OR brand_name LIKE ? OR product_code LIKE ? OR title LIKE ?)")
            params.extend([kw, kw, kw, kw])
            
        if shape_type:
            where_clauses.append("shape_type LIKE ?")
            params.append(f"%{shape_type.strip()}%")
            
        if sales_rep:
            where_clauses.append("sales_rep LIKE ?")
            params.append(f"%{sales_rep.strip()}%")
            
        where_str = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        
        # 2. 商品ごとのグループ集計
        query = f"""
            SELECT 
                product_code,
                product_name,
                brand_name,
                shape_type,
                unit,
                MAX(sales_date) as latest_sales_date,
                MAX(order_date) as latest_order_date,
                COUNT(*) as orders_count,
                SUM(quantity) as total_quantity,
                SUM(amount) as total_amount,
                MAX(customer_name) as sample_customer_name,
                MAX(sales_rep) as sample_sales_rep
            FROM as400_sales_orders
            {where_str}
            GROUP BY product_code, product_name, brand_name, shape_type, unit
        """
        cursor.execute(query, params)
        grouped_rows = cursor.fetchall()
        
        # 3. 最新注文明細（最新単価・数量・受注No）のバッチ取得
        products = []
        
        for row in grouped_rows:
            p_code = row["product_code"]
            p_name = row["product_name"]
            b_name = row["brand_name"]
            s_type = row["shape_type"] or ""
            unit = row["unit"] or "枚"
            latest_s_date = row["latest_sales_date"] or row["latest_order_date"]
            
            # 最新の1件を取得して詳細スペックを補完
            detail_query = """
                SELECT order_no, branch_no, order_date, delivery_date, sales_date, unit_price, cost_price, quantity, order_quantity, sales_rep, title,
                       material_name, material_short, colors_front, colors_back, colors_total, color_display,
                       size_width, size_pitch, weight, capacity_display, finish_note, print_note,
                       direct_customer_name, direct_customer_code, classification
                FROM as400_sales_orders
                WHERE product_code = ? AND product_name = ?
            """
            detail_params = [p_code, p_name]
            if clean_code:
                detail_query += " AND (customer_code = ? OR customer_code = ?)"
                detail_params.extend([clean_code, f"00{clean_code}"])
            if direct_dest and direct_dest not in ('all', '全員', '全体', ''):
                detail_query += " AND (direct_customer_name LIKE ? OR direct_customer_code = ?)"
                detail_params.extend([f"%{direct_dest.strip()}%", direct_dest.strip()])
            detail_query += " ORDER BY sales_date DESC, order_date DESC LIMIT 1"
            
            cursor.execute(detail_query, detail_params)
            latest_detail = cursor.fetchone()
            
            order_no = latest_detail["order_no"] if latest_detail else 0
            branch_no = latest_detail["branch_no"] if latest_detail else 0
            unit_price = latest_detail["unit_price"] if latest_detail else 0.0
            cost_price = latest_detail["cost_price"] if latest_detail else 0.0
            last_qty = latest_detail["quantity"] if latest_detail else 0.0
            order_date = latest_detail["order_date"] if latest_detail else ""
            delivery_date = latest_detail["delivery_date"] if latest_detail else ""
            rep = latest_detail["sales_rep"] if latest_detail else (row["sample_sales_rep"] or "")
            title = latest_detail["title"] if latest_detail else ""
            direct_name = latest_detail["direct_customer_name"] if latest_detail and latest_detail["direct_customer_name"] else ""
            direct_code = latest_detail["direct_customer_code"] if latest_detail and latest_detail["direct_customer_code"] else ""
            classification = latest_detail["classification"] if latest_detail and latest_detail["classification"] else ""
            
            # スペック情報（材質、色数、量目、サイズ、備考）
            mat_name = latest_detail["material_name"] if latest_detail and latest_detail["material_name"] else ""
            mat_short = latest_detail["material_short"] if latest_detail and latest_detail["material_short"] else ""
            c_front = latest_detail["colors_front"] if latest_detail and latest_detail["colors_front"] is not None else 0
            c_back = latest_detail["colors_back"] if latest_detail and latest_detail["colors_back"] is not None else 0
            c_total = latest_detail["colors_total"] if latest_detail and latest_detail["colors_total"] is not None else 0
            c_display = latest_detail["color_display"] if latest_detail and latest_detail["color_display"] else ""
            s_width = latest_detail["size_width"] if latest_detail and latest_detail["size_width"] is not None else 0.0
            s_pitch = latest_detail["size_pitch"] if latest_detail and latest_detail["size_pitch"] is not None else 0.0
            w_val = latest_detail["weight"] if latest_detail and latest_detail["weight"] is not None else 0.0
            cap_display = latest_detail["capacity_display"] if latest_detail and latest_detail["capacity_display"] else ""
            
            if not cap_display and w_val > 0:
                cap_display = f"{int(w_val)}kg" if w_val.is_integer() else f"{w_val}kg"

            finish_n = latest_detail["finish_note"] if latest_detail and latest_detail["finish_note"] else ""
            print_n = latest_detail["print_note"] if latest_detail and latest_detail["print_note"] else ""

            # サイズ表示整形
            if s_width > 0 and s_pitch > 0:
                s_disp = f"{int(s_width) if s_width.is_integer() else s_width}×{int(s_pitch) if s_pitch.is_integer() else s_pitch}"
            elif s_width > 0:
                s_disp = f"巾{int(s_width) if s_width.is_integer() else s_width}"
            elif s_pitch > 0:
                s_disp = f"P{int(s_pitch) if s_pitch.is_integer() else s_pitch}"
            else:
                s_disp = ""
            
            # 経過月数計算
            elapsed_m = calculate_elapsed_months(latest_s_date)
            
            # アラートレベル: 24ヶ月以上は赤 (danger), 22ヶ月以上は黄 (warning), それ以外は none
            if elapsed_m >= 24:
                alert_level = "danger"
                alert_text = f"版落ち注意 ({elapsed_m}ヶ月経過)"
            elif elapsed_m >= 22:
                alert_level = "warning"
                alert_text = f"経過注意 ({elapsed_m}ヶ月経過)"
            else:
                alert_level = "none"
                alert_text = f"{elapsed_m}ヶ月前" if elapsed_m > 0 else "当月"
                
            if alert_only and alert_level == "none":
                continue
                
            # ロール判定
            is_roll = ('ロール' in s_type) or ('ロール' in p_name) or ('RZ' in p_name) or ('RA' in p_name)
            
            # 粗利率計算
            margin_rate = round(((unit_price - cost_price) / unit_price) * 100, 1) if unit_price > 0 and cost_price > 0 else None
            
            # 商品画像解決 (\\Asahipack01\\画像)
            import routes_images
            img_data = routes_images.resolve_product_image_data(p_code, p_name, order_no)
            
            products.append({
                "product_code": p_code,
                "product_name": p_name,
                "brand_name": b_name or "",
                "shape_type": s_type,
                "is_roll": is_roll,
                "unit": unit,
                "latest_order_no": order_no,
                "latest_branch_no": branch_no,
                "order_no_display": f"{order_no}-{branch_no:02d}" if order_no and branch_no else (str(order_no) if order_no else "-"),
                "latest_order_date": order_date,
                "latest_delivery_date": delivery_date,
                "latest_sales_date": latest_s_date,
                "latest_unit_price": unit_price,
                "latest_cost_price": cost_price,
                "margin_rate": margin_rate,
                "last_quantity": last_qty,
                "orders_count": row["orders_count"],
                "total_quantity": row["total_quantity"] or 0,
                "total_amount": row["total_amount"] or 0,
                "elapsed_months": elapsed_m,
                "alert_level": alert_level,
                "alert_text": alert_text,
                "sales_rep": rep,
                "title": title,
                "material_name": mat_name or mat_short,
                "material_short": mat_short,
                "colors_front": c_front,
                "colors_back": c_back,
                "colors_total": c_total,
                "color_display": c_display,
                "size_width": s_width,
                "size_pitch": s_pitch,
                "size_display": s_disp,
                "weight": w_val,
                "capacity_display": cap_display,
                "finish_note": finish_n,
                "print_note": print_n,
                "direct_customer_name": direct_name,
                "direct_customer_code": direct_code,
                "classification": classification,
                "image_url": img_data["image_url"],
                "image_name": img_data["image_name"],
                "image_variants": img_data["image_variants"]
            })
            
        # 4. ソート処理
        if sort_by == "price_desc":
            products.sort(key=lambda x: x["latest_unit_price"], reverse=True)
        elif sort_by == "price_asc":
            products.sort(key=lambda x: x["latest_unit_price"])
        elif sort_by == "orders_count":
            products.sort(key=lambda x: x["orders_count"], reverse=True)
        elif sort_by == "name":
            products.sort(key=lambda x: x["product_name"])
        elif sort_by == "elapsed_desc":
            products.sort(key=lambda x: x["elapsed_months"], reverse=True)
        else: # latest_date
            products.sort(key=lambda x: (x["latest_sales_date"] or "", x["latest_order_date"] or ""), reverse=True)
            
        # 5. ファセット集計（種別・アラート件数）
        shape_facets = {}
        alert_facets = {"warning": 0, "danger": 0, "active": 0}
        for p in products:
            st = p["shape_type"] or "未分類"
            shape_facets[st] = shape_facets.get(st, 0) + 1
            if p["alert_level"] == "danger":
                alert_facets["danger"] += 1
            elif p["alert_level"] == "warning":
                alert_facets["warning"] += 1
            else:
                alert_facets["active"] += 1
                
        return {
            "success": True,
            "total_count": len(products),
            "customer_code": clean_code,
            "facets": {
                "shape_types": shape_facets,
                "alerts": alert_facets
            },
            "products": products
        }
