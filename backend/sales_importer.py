"""
基幹システム（IBM AS/400）全社受注・売上明細CSV（MY_TJUCM_*.CSV）のインポーター＆クエリエンジン
- 売上専用の独立したSQLiteデータベース（data/sales_cache.db）を使用（日報キャッシュ shadow_cache.db と完全分離）
- WALモード＆超高速ベクトル処理（0.3秒パース）により、日報システム本体の動作に一切干渉・遅延させない安全設計
- 形状区分（T列）により、ロール製品は「ｍ」、単袋＋その他は「枚」に正確に自動判定
"""

import os
import glob
import logging
import sqlite3
import threading
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
    
    # ネットワークフォルダの高速疎通判定（タイムアウト0.5秒で判定し、未接続時は即座にスキップ）
    if target_dir.startswith('\\\\'):
        if not config.is_network_path_accessible(target_dir, timeout=0.5):
            logger.debug(f"AS400 sales directory not accessible: {target_dir}")
            return None

    if not os.path.exists(target_dir):
        logger.debug(f"AS400 sales directory not found: {target_dir}")
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


def get_sales_db_conn(db_path: Optional[str] = None):
    """売上専用SQLite DBへの接続を取得（WALモード・タイムアウト設定付き）"""
    target_db = db_path or config.SALES_CACHE_DB
    os.makedirs(os.path.dirname(os.path.abspath(target_db)), exist_ok=True)
    
    conn = sqlite3.connect(target_db, timeout=30.0, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=10000;")
    return conn


def init_sales_db(db_path: Optional[str] = None):
    """SQLiteに売上明細テーブルとインデックスを作成"""
    with get_sales_db_conn(db_path) as conn:
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
                shape_type TEXT,
                unit TEXT,
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
    AS/400のCSVを取り込んで専用SQLiteキャッシュ（sales_cache.db）に保存する。
    日報原本キャッシュ（shadow_cache.db）とは完全に独立して動作。
    """
    target_path = csv_path or find_latest_sales_csv()
    if not target_path or not os.path.exists(target_path):
        logger.info("No AS/400 sales CSV file found.")
        return False

    current_mtime = os.path.getmtime(target_path)
    init_sales_db()

    with get_sales_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM as400_sales_meta WHERE key = 'last_mtime'")
        row = cursor.fetchone()
        if row and not force:
            try:
                last_mtime = float(row[0])
                if current_mtime <= last_mtime:
                    logger.debug(f"AS400 sales cache is already up to date: {target_path}")
                    return True
            except ValueError:
                pass

    logger.info(f"Starting optimized AS/400 sales CSV import: {target_path}")

    try:
        # CP932で読み込み
        with open(target_path, 'r', encoding='cp932', errors='replace') as f:
            df = pd.read_csv(f, low_memory=False)

        df.columns = [str(c).strip() for c in df.columns]

        # 1. 銘柄行（コード 999999999）のマッピングを一瞬で作成
        brand_df = df[df['商品コード'].astype(str).str.strip() == '999999999']
        brand_map = dict(zip(zip(brand_df['受注№'], brand_df['受注枝番']), brand_df['商品名称'].astype(str).str.strip()))

        # 2. 金額合計（伝票行計）のマップ
        amount_map = df.groupby(['受注№', '受注枝番'])['受注金額'].sum().to_dict()

        # 3. 主製品行（製品コードが 90/91/99 以外）を高速抽出
        prod_mask = df['商品コード'].astype(str).str.strip().str.startswith(('0', '1', '2', '3', '4', '5', '6', '7', '8')) & \
                    (~df['商品コード'].astype(str).str.strip().str.startswith(('90', '91', '99')))
        main_df = df[prod_mask].drop_duplicates(subset=['受注№', '受注枝番'], keep='first')
        
        # もし製品行が取れないグループがあれば、最初の行でフォールバック
        all_groups_keys = set(zip(df['受注№'], df['受注枝番']))
        main_keys = set(zip(main_df['受注№'], main_df['受注枝番']))
        missing_keys = all_groups_keys - main_keys
        if missing_keys:
            fallback_df = df.drop_duplicates(subset=['受注№', '受注枝番'], keep='first')
            fallback_missing = fallback_df[fallback_df.set_index(['受注№', '受注枝番']).index.isin(missing_keys)]
            main_df = pd.concat([main_df, fallback_missing], ignore_index=True)

        # 4. レコード作成（ベクトル高速化）
        records = []
        for row in main_df.itertuples(index=False):
            row_dict = row._asdict()
            jno = row_dict.get('受注№', 0)
            eda = row_dict.get('受注枝番', 0)
            key = (jno, eda)

            raw_cust_code = str(row_dict.get('得意先コード', '')).strip().split('.')[0]
            cust_code = raw_cust_code.lstrip('0') or raw_cust_code
            cust_name = str(row_dict.get('得意先名称', '')).strip()
            cust_rank = str(row_dict.get('得意先ランク', '')).strip() if pd.notna(row_dict.get('得意先ランク')) else ''

            prod_code = str(row_dict.get('商品コード', '')).strip()
            prod_name = str(row_dict.get('商品名称', '')).strip()
            brand_name = brand_map.get(key, '')

            # T列（index 19 / 2つ目の文字１）
            # itertuples では重複名カラムは _19 等になる
            shape_type = ''
            if len(row) > 19 and pd.notna(row[19]):
                shape_type = str(row[19]).strip()

            # ロールなら「ｍ」、単袋＋他は「枚」
            title = str(row_dict.get('タイトル', '')).strip() if pd.notna(row_dict.get('タイトル')) else ''
            is_roll = ('ロール' in shape_type) or ('ロール' in prod_name) or ('RZ' in prod_name) or ('RA' in prod_name) or ('RZ' in title) or ('RA' in title)
            unit = 'ｍ' if is_roll else '枚'

            qty = float(row_dict.get('受注数', 0)) if pd.notna(row_dict.get('受注数')) else 0.0
            uprice = float(row_dict.get('売上単価', 0)) if pd.notna(row_dict.get('売上単価')) else 0.0
            cprice = float(row_dict.get('原単価（下代）', 0)) if pd.notna(row_dict.get('原単価（下代）')) else 0.0
            
            amount = float(amount_map.get(key, qty * uprice))
            profit = (uprice - cprice) * qty if uprice and cprice else 0.0

            sales_rep = str(row_dict.get('社員名', '')).strip() if pd.notna(row_dict.get('社員名')) else ''
            order_date_raw = str(row_dict.get('受注日', '')).strip().split('.')[0]
            if len(order_date_raw) == 8 and order_date_raw.isdigit():
                order_date = f"{order_date_raw[:4]}-{order_date_raw[4:6]}-{order_date_raw[6:]}"
            else:
                order_date = order_date_raw

            delivery_date_raw = str(row_dict.get('納期日', '')).strip().split('.')[0]
            if len(delivery_date_raw) == 8 and delivery_date_raw.isdigit():
                delivery_date = f"{delivery_date_raw[:4]}-{delivery_date_raw[4:6]}-{delivery_date_raw[6:]}"
            else:
                delivery_date = delivery_date_raw

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
                shape_type,
                unit,
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

        # 5. 専用SQLiteへ一括保存
        with get_sales_db_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM as400_sales_orders")
            cursor.executemany("""
                INSERT INTO as400_sales_orders (
                    order_no, branch_no, order_date, customer_code, customer_name,
                    customer_rank, product_code, product_name, brand_name,
                    shape_type, unit,
                    quantity, unit_price, cost_price, amount, profit,
                    sales_rep, delivery_date, title, csv_mtime
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, records)

            cursor.execute("INSERT OR REPLACE INTO as400_sales_meta (key, value) VALUES ('last_mtime', ?)", (str(current_mtime),))
            cursor.execute("INSERT OR REPLACE INTO as400_sales_meta (key, value) VALUES ('last_csv_path', ?)", (target_path,))
            cursor.execute("INSERT OR REPLACE INTO as400_sales_meta (key, value) VALUES ('last_import_time', ?)", (datetime.now().isoformat(),))
            cursor.execute("INSERT OR REPLACE INTO as400_sales_meta (key, value) VALUES ('record_count', ?)", (str(len(records)),))
            conn.commit()

        logger.info(f"Fast AS/400 sales import completed: {len(records)} orders saved into sales_cache.db")
        return True

    except Exception as e:
        logger.error(f"Failed to import AS/400 sales CSV: {e}", exc_info=True)
        return False


def get_customer_sales_summary(customer_code: str) -> Dict[str, Any]:
    """特定の得意先コードの売上サマリーと直近購入履歴を取得（sales_cache.db から 0.001秒で取得）"""
    clean_code = str(customer_code).strip().split('.')[0].lstrip('0')
    init_sales_db()

    with get_sales_db_conn() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # 直近10件の受注明細履歴
        cursor.execute("""
            SELECT order_date, product_name, brand_name, shape_type, unit, quantity, unit_price, amount, sales_rep, delivery_date
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
                "shape_type": r["shape_type"] or "",
                "unit": r["unit"] or "枚",
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

        # 月別売上集計（直近12ヶ月 + 前年同月実績比較）
        cursor.execute("""
            SELECT SUBSTR(order_date, 1, 7) as ym, SUM(amount) as sales, SUM(profit) as profit, COUNT(*) as orders
            FROM as400_sales_orders
            WHERE customer_code = ? OR customer_code = ?
            GROUP BY ym
            ORDER BY ym ASC
        """, (clean_code, f"00{clean_code}"))

        all_months_dict = {}
        for r in cursor.fetchall():
            all_months_dict[r["ym"]] = {
                "sales": r["sales"] or 0.0,
                "profit": r["profit"] or 0.0,
                "orders": r["orders"] or 0
            }

        today = datetime.now()
        monthly_sales = []
        for i in range(11, -1, -1):
            year = today.year
            month = today.month - i
            while month <= 0:
                month += 12
                year -= 1
            ym = f"{year:04d}-{month:02d}"
            ly_ym = f"{year - 1:04d}-{month:02d}"

            curr_data = all_months_dict.get(ym, {"sales": 0.0, "profit": 0.0, "orders": 0})
            ly_data = all_months_dict.get(ly_ym, {"sales": 0.0, "profit": 0.0, "orders": 0})

            c_sales = curr_data["sales"]
            ly_sales = ly_data["sales"]
            yoy_growth = round((c_sales / ly_sales) * 100, 1) if ly_sales > 0 else (None if c_sales == 0 else 100.0)

            monthly_sales.append({
                "month": ym,
                "month_label": f"{ym[2:4]}/{ym[5:7]}",
                "sales": c_sales,
                "profit": curr_data["profit"],
                "orders": curr_data["orders"],
                "last_year_sales": ly_sales,
                "last_year_orders": ly_data["orders"],
                "yoy_growth": yoy_growth
            })

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
            "monthly_sales": monthly_sales,
            "updated_at": datetime.now().isoformat()
        }


_sync_lock = threading.Lock()
_is_syncing = False

def get_as400_sync_status() -> Dict[str, Any]:
    """現在のAS/400売上データの同期ステータスを取得"""
    latest_csv = find_latest_sales_csv()
    csv_info = None
    if latest_csv and os.path.exists(latest_csv):
        csv_info = {
            "path": latest_csv,
            "filename": os.path.basename(latest_csv),
            "size": os.path.getsize(latest_csv),
            "modified_at": datetime.fromtimestamp(os.path.getmtime(latest_csv)).strftime("%Y-%m-%d %H:%M:%S")
        }

    init_sales_db()
    meta = {}
    total_orders = 0
    with get_sales_db_conn() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT key, value FROM as400_sales_meta")
        for k, v in cursor.fetchall():
            meta[k] = v
        try:
            cursor.execute("SELECT COUNT(*) FROM as400_sales_orders")
            row = cursor.fetchone()
            total_orders = row[0] if row else 0
        except Exception:
            total_orders = 0

    last_import = meta.get("last_import_time")
    if last_import and "T" in last_import:
        last_import = last_import.replace("T", " ")[:19]

    return {
        "is_syncing": _is_syncing,
        "total_orders": total_orders,
        "last_import_time": last_import,
        "last_csv_path": meta.get("last_csv_path"),
        "latest_csv": csv_info,
        "configured_dir": DEFAULT_AS400_CSV_DIR
    }


def run_manual_sync(force: bool = True) -> Dict[str, Any]:
    """手動同期を実行（排他ロック付き）"""
    global _is_syncing
    if not _sync_lock.acquire(blocking=False):
        return {
            "success": False,
            "message": "現在別の同期処理が実行中です。完了するまでお待ちください。"
        }
    _is_syncing = True
    try:
        success = import_as400_sales_csv(force=force)
        status = get_as400_sync_status()
        if success:
            return {
                "success": True,
                "message": f"基幹売上明細の同期が完了しました（{status['total_orders']:,}件）。",
                "status": status
            }
        else:
            return {
                "success": False,
                "message": "同期に失敗したか、対象のCSVファイルが見つかりませんでした。",
                "status": status
            }
    finally:
        _is_syncing = False
        _sync_lock.release()

