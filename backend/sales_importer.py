"""
基幹システム（IBM AS/400）全社受注・売上明細CSV（MY_TJUCM_*.CSV）のインポーター＆クエリエンジン
- 複数行（製品・原反・印刷代・備考銘柄）を1件の取引データに自動名寄せ
- SQLiteキャッシュ（shadow_cache.db）への高速インデックス格納
- 顧客別サマリー・直近受注履歴の超高速検索
"""

import os
import glob
import logging
import sqlite3
import pandas as pd
from typing import Optional, List, Dict, Any
from datetime import datetime

import config

logger = logging.getLogger(__name__)

# デフォルトの基幹CSV格納ディレクトリ
DEFAULT_AS400_CSV_DIR = config._RAW_CONFIG.get(
    'as400_sales_dir',
    r'\\192.168.1.200\qibm\ABS\USERDATA\054'
)

def find_latest_sales_csv(search_dir: Optional[str] = None) -> Optional[str]:
    """指定フォルダ（またはデフォルト）から最も新しい MY_TJUCM_*.CSV を特定する"""
    target_dir = search_dir or DEFAULT_AS400_CSV_DIR
    
    if not os.path.exists(target_dir):
        logger.debug(f"AS400 sales directory not accessible: {target_dir}")
        # ローカルdataフォルダ内のバックアップも確認
        local_dir = os.path.join(config.DATA_DIR, "sales_as400")
        if os.path.exists(local_dir):
            target_dir = local_dir
        else:
            return None

    try:
        csv_files = glob.glob(os.path.join(target_dir, "MY_TJUCM_*.CSV"))
        if not csv_files:
            csv_files = glob.glob(os.path.join(target_dir, "MY_TJUCM_*.csv"))
        
        if not csv_files:
            return None
        
        # 更新日時が最も新しいファイルを返す
        latest_file = max(csv_files, key=os.path.getmtime)
        return latest_file
    except Exception as e:
        logger.error(f"Error finding latest sales CSV in {target_dir}: {e}")
        return None


def init_sales_db(db_path: Optional[str] = None):
    """SQLiteに売上明細テーブルとインデックスを作成"""
    target_db = db_path or config.SQLITE_CACHE_DB
    os.makedirs(os.path.dirname(os.path.abspath(target_db)), exist_ok=True)
    
    with sqlite3.connect(target_db) as conn:
        cursor = conn.cursor()
        
        # 売上明細テーブル
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS as400_sales_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_no INTEGER,
                branch_no INTEGER,
                order_date TEXT,
                customer_code TEXT,
                customer_name TEXT,
                customer_rank TEXT,
                product_code TEXT,
                product_name TEXT,
                brand_name TEXT,
                quantity REAL,
                unit_price REAL,
                cost_price REAL,
                amount REAL,
                profit REAL,
                sales_rep TEXT,
                delivery_date TEXT,
                title TEXT,
                csv_mtime REAL
            )
        """)
        
        # インデックス
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_as400_cust_code ON as400_sales_orders (customer_code)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_as400_sales_rep ON as400_sales_orders (sales_rep)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_as400_order_date ON as400_sales_orders (order_date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_as400_order_no_branch ON as400_sales_orders (order_no, branch_no)")
        
        # メタ情報テーブル（最新取り込みCSVのタイムスタンプ管理）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS as400_sales_meta (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        conn.commit()


def import_as400_sales_csv(csv_path: Optional[str] = None, force: bool = False) -> bool:
    """
    AS/400のCSVを取り込んでSQLiteキャッシュに保存する。
    ファイルの更新日時が変わっていない場合はスキップ（force=Trueで強制再読込）。
    """
    target_path = csv_path or find_latest_sales_csv()
    if not target_path or not os.path.exists(target_path):
        logger.info("No AS/400 sales CSV file found.")
        return False

    current_mtime = os.path.getmtime(target_path)
    init_sales_db()

    with sqlite3.connect(config.SQLITE_CACHE_DB) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM as400_sales_meta WHERE key = 'last_mtime'")
        row = cursor.fetchone()
        if row and not force:
            try:
                last_mtime = float(row[0])
                if current_mtime <= last_mtime:
                    # 既に最新データ取り込み済み
                    logger.debug(f"AS400 sales cache is up to date: {target_path}")
                    return True
            except ValueError:
                pass

    logger.info(f"Starting AS/400 sales CSV import: {target_path} (mtime: {current_mtime})")

    try:
        # CP932で読み込み（IBM特有の外字や不正バイトはreplaceで安全にパース）
        with open(target_path, 'r', encoding='cp932', errors='replace') as f:
            df = pd.read_csv(f, low_memory=False)

        df.columns = [str(c).strip() for c in df.columns]

        # 複数行（製品・原反・印刷代・備考）を1案件（受注№＋枝番）ごとに集約
        grouped = df.groupby(['受注№', '受注枝番'], sort=False)
        
        records = []
        for (jno, eda), group in grouped:
            # 1. 売上行（製品）の特定
            # 商品コードが 99... や 90...（印刷代/備考/版代）以外を製品とする
            prod_mask = group['商品コード'].astype(str).str.strip().str.startswith(('0', '1', '2', '3', '4', '5', '6', '7', '8')) & \
                        (~group['商品コード'].astype(str).str.strip().str.startswith(('90', '91', '99')))
            main_rows = group[prod_mask]
            if main_rows.empty:
                main_row = group.iloc[0]
            else:
                main_row = main_rows.iloc[0]

            # 2. 備考・後刷り銘柄（商品コード 999999999 など）
            meigara_rows = group[group['商品コード'].astype(str).str.strip() == '999999999']
            brand_name = str(meigara_rows['商品名称'].values[0]).strip() if not meigara_rows.empty else ''

            # 各種フィールドのクリーンアップ
            raw_cust_code = str(main_row.get('得意先コード', '')).strip().split('.')[0]
            cust_code = raw_cust_code.lstrip('0') or raw_cust_code # 0043006 -> 43006
            cust_name = str(main_row.get('得意先名称', '')).strip()
            cust_rank = str(main_row.get('得意先ランク', '')).strip() if pd.notna(main_row.get('得意先ランク')) else ''
            
            prod_code = str(main_row.get('商品コード', '')).strip()
            prod_name = str(main_row.get('商品名称', '')).strip()
            
            qty = float(main_row.get('受注数', 0)) if pd.notna(main_row.get('受注数')) else 0.0
            uprice = float(main_row.get('売上単価', 0)) if pd.notna(main_row.get('売上単価')) else 0.0
            cprice = float(main_row.get('原単価（下代）', 0)) if pd.notna(main_row.get('原単価（下代）')) else 0.0
            
            # 金額はグループ合計（版代や付帯費用も含めた総受注額）または製品単体金額
            amount = float(group['受注金額'].sum()) if '受注金額' in group.columns else (qty * uprice)
            
            # 粗利
            profit = (uprice - cprice) * qty if uprice and cprice else 0.0

            sales_rep = str(main_row.get('社員名', '')).strip() if pd.notna(main_row.get('社員名')) else ''
            order_date_raw = str(main_row.get('受注日', '')).strip().split('.')[0]
            
            # 日付フォーマット正規化 (YYYYMMDD -> YYYY-MM-DD)
            if len(order_date_raw) == 8 and order_date_raw.isdigit():
                order_date = f"{order_date_raw[:4]}-{order_date_raw[4:6]}-{order_date_raw[6:]}"
            else:
                order_date = order_date_raw

            delivery_date_raw = str(main_row.get('納期日', '')).strip().split('.')[0]
            if len(delivery_date_raw) == 8 and delivery_date_raw.isdigit():
                delivery_date = f"{delivery_date_raw[:4]}-{delivery_date_raw[4:6]}-{delivery_date_raw[6:]}"
            else:
                delivery_date = delivery_date_raw

            title = str(main_row.get('タイトル', '')).strip() if pd.notna(main_row.get('タイトル')) else ''

            records.append((
                int(jno) if str(jno).isdigit() else 0,
                int(eda) if str(eda).isdigit() else 0,
                order_date,
                cust_code,
                cust_name,
                cust_rank,
                prod_code,
                prod_name,
                brand_name,
                qty,
                uprice,
                cprice,
                amount,
                profit,
                sales_rep,
                delivery_date,
                title,
                current_mtime
            ))

        # SQLiteへ一括書き込み
        with sqlite3.connect(config.SQLITE_CACHE_DB) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM as400_sales_orders") # 全件入替
            cursor.executemany("""
                INSERT INTO as400_sales_orders (
                    order_no, branch_no, order_date, customer_code, customer_name,
                    customer_rank, product_code, product_name, brand_name,
                    quantity, unit_price, cost_price, amount, profit,
                    sales_rep, delivery_date, title, csv_mtime
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, records)

            # メタ情報更新
            cursor.execute("INSERT OR REPLACE INTO as400_sales_meta (key, value) VALUES ('last_mtime', ?)", (str(current_mtime),))
            cursor.execute("INSERT OR REPLACE INTO as400_sales_meta (key, value) VALUES ('last_csv_path', ?)", (target_path,))
            cursor.execute("INSERT OR REPLACE INTO as400_sales_meta (key, value) VALUES ('last_import_time', ?)", (datetime.now().isoformat(),))
            cursor.execute("INSERT OR REPLACE INTO as400_sales_meta (key, value) VALUES ('record_count', ?)", (str(len(records)),))
            conn.commit()

        logger.info(f"AS/400 sales import completed: {len(records)} orders imported successfully.")
        return True

    except Exception as e:
        logger.error(f"Failed to import AS/400 sales CSV: {e}", exc_info=True)
        return False


def get_customer_sales_summary(customer_code: str) -> Dict[str, Any]:
    """特定の得意先コードの売上サマリーと直近購入履歴を取得"""
    clean_code = str(customer_code).strip().split('.')[0].lstrip('0')
    init_sales_db()

    with sqlite3.connect(config.SQLITE_CACHE_DB) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # 直近10件の受注明細履歴
        cursor.execute("""
            SELECT order_date, product_name, brand_name, quantity, unit_price, amount, sales_rep, delivery_date
            FROM as400_sales_orders
            WHERE customer_code = ? OR customer_code = ?
            ORDER BY order_date DESC
            LIMIT 10
        """, (clean_code, f"00{clean_code}"))
        
        history = []
        for r in cursor.fetchall():
            history.append({
                "order_date": r["order_date"],
                "product_name": r["product_name"],
                "brand_name": r["brand_name"],
                "quantity": r["quantity"],
                "unit_price": r["unit_price"],
                "amount": r["amount"],
                "sales_rep": r["sales_rep"],
                "delivery_date": r["delivery_date"]
            })

        # 年間・累計集計（直近1年、前年同期など）
        current_year = datetime.now().strftime("%Y")
        last_year = str(int(current_year) - 1)

        cursor.execute("""
            SELECT 
                COUNT(*) as order_count,
                SUM(amount) as total_amount,
                SUM(profit) as total_profit,
                MAX(customer_rank) as rank_class,
                MAX(customer_name) as cust_name
            FROM as400_sales_orders
            WHERE (customer_code = ? OR customer_code = ?)
              AND order_date LIKE ?
        """, (clean_code, f"00{clean_code}", f"{current_year}%"))
        curr_stat = cursor.fetchone()

        # 前年のデータ
        cursor.execute("""
            SELECT 
                SUM(amount) as total_amount,
                SUM(profit) as total_profit
            FROM as400_sales_orders
            WHERE (customer_code = ? OR customer_code = ?)
              AND order_date LIKE ?
        """, (clean_code, f"00{clean_code}", f"{last_year}%"))
        last_stat = cursor.fetchone()

        sales_amount = (curr_stat["total_amount"] if curr_stat else None) or 0
        profit_amount = (curr_stat["total_profit"] if curr_stat else None) or 0
        last_sales = (last_stat["total_amount"] if last_stat else None) or 0
        last_profit = (last_stat["total_profit"] if last_stat else None) or 0

        yoy = round((sales_amount / last_sales) * 100, 1) if last_sales > 0 else None

        # 最終受注日
        cursor.execute("""
            SELECT MAX(order_date) as last_order_date
            FROM as400_sales_orders
            WHERE customer_code = ? OR customer_code = ?
        """, (clean_code, f"00{clean_code}"))
        last_order = cursor.fetchone()
        last_order_date = last_order["last_order_date"] if last_order else None

        return {
            "found": len(history) > 0 or (sales_amount > 0),
            "customer_code": clean_code,
            "customer_name": curr_stat["cust_name"] if curr_stat and curr_stat["cust_name"] else "",
            "rank_class": curr_stat["rank_class"] if curr_stat and curr_stat["rank_class"] else "",
            "sales_amount": sales_amount,
            "gross_profit": profit_amount,
            "sales_last_year": last_sales,
            "profit_last_year": last_profit,
            "sales_yoy": yoy,
            "last_order_date": last_order_date,
            "recent_orders": history,
            "updated_at": datetime.now().isoformat()
        }
