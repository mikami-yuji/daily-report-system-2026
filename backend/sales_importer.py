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
    """SQLiteに売上明細テーブル、受注残テーブルとインデックスを作成"""
    with get_sales_db_conn(db_path) as conn:
        cursor = conn.cursor()
        
        # 1. 売上明細テーブル（確定売上・出荷分）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS as400_sales_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_no INTEGER,
                branch_no INTEGER,
                order_date TEXT,
                delivery_date TEXT,
                sales_date TEXT,
                customer_code TEXT,
                customer_name TEXT,
                customer_rank TEXT,
                direct_customer_code TEXT,
                direct_customer_name TEXT,
                classification TEXT,
                product_code TEXT,
                product_name TEXT,
                brand_name TEXT,
                shape_type TEXT,
                unit TEXT,
                order_quantity REAL,
                quantity REAL,
                unit_price REAL,
                cost_price REAL,
                amount REAL,
                profit REAL,
                sales_rep TEXT,
                title TEXT,
                material_name TEXT,
                material_short TEXT,
                colors_front INTEGER,
                colors_back INTEGER,
                colors_total INTEGER,
                color_display TEXT,
                size_width REAL,
                size_pitch REAL,
                weight REAL,
                capacity_display TEXT,
                finish_note TEXT,
                print_note TEXT,
                csv_mtime REAL
            )
        """)
        
        # 2. 受注残・納期管理テーブル（未出荷・進行中分）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS as400_backlog_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_no INTEGER,
                branch_no INTEGER,
                order_date TEXT,
                delivery_date TEXT,
                arrival_date TEXT,
                customer_code TEXT,
                customer_name TEXT,
                direct_customer_code TEXT,
                direct_customer_name TEXT,
                classification TEXT,
                product_code TEXT,
                product_name TEXT,
                brand_name TEXT,
                shape_type TEXT,
                unit TEXT,
                order_quantity REAL,
                allocated_quantity REAL,
                unit_price REAL,
                cost_price REAL,
                amount REAL,
                profit REAL,
                sales_rep TEXT,
                delivery_status TEXT,
                delivery_status_label TEXT,
                shipping_note TEXT,
                finish_note TEXT,
                print_note TEXT,
                special_note TEXT,
                material_name TEXT,
                material_short TEXT,
                colors_front INTEGER,
                colors_back INTEGER,
                colors_total INTEGER,
                color_display TEXT,
                size_width REAL,
                size_pitch REAL,
                weight REAL,
                capacity_display TEXT,
                is_complete_flag INTEGER,
                csv_mtime REAL
            )
        """)
        
        # 既存DBへのカラム追加互換（カラムが存在しない場合は追加）
        cursor.execute("PRAGMA table_info(as400_sales_orders)")
        existing_cols = {row[1] for row in cursor.fetchall()}
        for col, c_type in [
            ("sales_date", "TEXT"), ("order_quantity", "REAL"), ("cost_price", "REAL"),
            ("direct_customer_code", "TEXT"), ("direct_customer_name", "TEXT"),
            ("classification", "TEXT"),
            ("material_name", "TEXT"), ("material_short", "TEXT"),
            ("colors_front", "INTEGER"), ("colors_back", "INTEGER"), ("colors_total", "INTEGER"),
            ("color_display", "TEXT"), ("size_width", "REAL"), ("size_pitch", "REAL"),
            ("weight", "REAL"), ("capacity_display", "TEXT"),
            ("finish_note", "TEXT"), ("print_note", "TEXT")
        ]:
            if col not in existing_cols:
                try:
                    cursor.execute(f"ALTER TABLE as400_sales_orders ADD COLUMN {col} {c_type}")
                except Exception:
                    pass

        cursor.execute("PRAGMA table_info(as400_backlog_orders)")
        existing_b_cols = {row[1] for row in cursor.fetchall()}
        for col, c_type in [
            ("classification", "TEXT"),
            ("material_name", "TEXT"), ("material_short", "TEXT"),
            ("colors_front", "INTEGER"), ("colors_back", "INTEGER"), ("colors_total", "INTEGER"),
            ("color_display", "TEXT"), ("size_width", "REAL"), ("size_pitch", "REAL"),
            ("weight", "REAL"), ("capacity_display", "TEXT")
        ]:
            if col not in existing_b_cols:
                try:
                    cursor.execute(f"ALTER TABLE as400_backlog_orders ADD COLUMN {col} {c_type}")
                except Exception:
                    pass
        
        # 既存データで sales_date が NULL の場合の自動補完
        cursor.execute("""
            UPDATE as400_sales_orders 
            SET sales_date = CASE 
                WHEN delivery_date IS NOT NULL AND delivery_date != '' AND delivery_date >= '2020-01-01' THEN delivery_date 
                ELSE order_date 
            END 
            WHERE sales_date IS NULL OR sales_date = ''
        """)
        
        # インデックス
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_as400_cust_code ON as400_sales_orders (customer_code)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_as400_sales_rep ON as400_sales_orders (sales_rep)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_as400_order_date ON as400_sales_orders (order_date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_as400_delivery_date ON as400_sales_orders (delivery_date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_as400_sales_date ON as400_sales_orders (sales_date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_as400_order_no_branch ON as400_sales_orders (order_no, branch_no)")
        
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_as400_backlog_cust ON as400_backlog_orders (customer_code)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_as400_backlog_rep ON as400_backlog_orders (sales_rep)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_as400_backlog_deliv ON as400_backlog_orders (delivery_date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_as400_backlog_status ON as400_backlog_orders (delivery_status)")
        
        # メタ情報テーブル（最新取り込みCSVのタイムスタンプ管理）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS as400_sales_meta (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        conn.commit()


def classify_delivery_status(delivery_date_str: str, arrival_date_str: str, shipping_note: str, special_note: str) -> tuple:
    """
    納期日、入荷予定日、出荷備考等から納期ステータスを判定
    Returns: (status_code, status_label)
    - confirmed: 確定納期
    - asap: 早出可・仕上次第
    - provisional: 仮納期・預かり
    - delayed: 納期超過
    """
    today_str = datetime.now().strftime('%Y-%m-%d')
    deliv_clean = (delivery_date_str or '').replace('/', '-').strip()
    arrival_clean = (arrival_date_str or '').replace('/', '-').strip()
    ship_clean = (shipping_note or '').strip()
    spec_clean = (special_note or '').strip()

    # 1. 仮納期・未定・預かりの判定
    if deliv_clean >= '2030-01-01' or '20301010' in deliv_clean or '0/00' in ship_clean or '【預り】' in ship_clean or '預かり' in ship_clean or '別途出荷指示' in ship_clean or '未定' in ship_clean or '０円売上' in ship_clean:
        return 'provisional', '仮納期・預かり'

    # 2. 納期超過（今日より過去の納期で未出荷）
    if deliv_clean and deliv_clean < today_str and deliv_clean >= '2020-01-01':
        return 'delayed', '納期超過'

    # 3. 仕上次第・早出し歓迎
    asap_keywords = ['仕上がり次第', '仕上り次第', '出来次第', '早出', '早出し歓迎', '早出し大歓迎']
    if any(k in ship_clean for k in asap_keywords):
        return 'asap', '早出可・仕上次第'

    # 4. 確定納期（指定明記、運送便指示、入荷予定日あり、通常日付）
    if '【指定】' in ship_clean or '着明記' in ship_clean or '便' in ship_clean or (arrival_clean and arrival_clean >= '2020-01-01'):
        return 'confirmed', '確定納期'

    if deliv_clean and deliv_clean >= '2020-01-01':
        return 'confirmed', '確定納期'

    return 'provisional', '仮納期・未定'


def format_capacity(weight_val, prod_name: str = "") -> tuple:
    """
    重量（量目）値および品名から量目を抽出して (weight_float, capacity_display) を返す
    例: 5.0 -> (5.0, '5kg'), 10.0 -> (10.0, '10kg'), 0.3 -> (0.3, '300g'), 1.4 -> (1.4, '1.4kg')
    """
    w_float = 0.0
    try:
        if pd.notna(weight_val):
            w_str = str(weight_val).strip()
            if w_str and w_str.lower() not in ('nan', 'none', '.00'):
                w_float = float(w_str)
    except Exception:
        w_float = 0.0

    if w_float > 0:
        if w_float >= 1:
            disp = f"{int(w_float)}kg" if w_float.is_integer() else f"{w_float}kg"
        else:
            g = w_float * 1000
            disp = f"{int(round(g))}g" if abs(g - round(g)) < 0.01 else f"{w_float}kg"
        return w_float, disp

    # 補足: 重量列が0の場合、品名（例: ５Ｋﾀﾝﾎﾟﾘ, 10kg, 300g, 2合用）から抽出
    if prod_name:
        import re
        m = re.search(r'([0-9０-９]+(?:\.[0-9０-９]+)?)\s*([kKｋＫ]?[gGｇＧ]|合|升|[kKｋＫ])', str(prod_name))
        if m:
            val_str = m.group(1).translate(str.maketrans('０１２３４５６７８９', '0123456789'))
            unit_str = m.group(2).lower()
            try:
                v_num = float(val_str)
                if unit_str in ('k', 'kg', 'ｋ', 'ｋｇ'):
                    disp = f"{int(v_num)}kg" if v_num.is_integer() else f"{v_num}kg"
                    return v_num, disp
                elif unit_str in ('g', 'ｇ'):
                    disp = f"{int(v_num)}g" if v_num.is_integer() else f"{v_num}g"
                    return v_num / 1000.0, disp
                elif unit_str in ('合', '升'):
                    return 0.0, f"{int(v_num) if v_num.is_integer() else v_num}{unit_str}"
            except Exception:
                pass

    return 0.0, ""


def extract_material_and_colors(row: dict) -> tuple:
    """
    CSV行データから材質（名称・略称）、色数（表・裏・総・表示用文字列）、サイズ（巾・ピッチ）、量目（重量・表示用文字列）を抽出
    """
    # 1. 材質
    mat_name = str(row.get('材質名称', '')).strip() if pd.notna(row.get('材質名称')) else ''
    mat_short = str(row.get('材質略称', '')).strip() if pd.notna(row.get('材質略称')) else ''
    if mat_name.lower() in ('nan', 'none'):
        mat_name = ''
    if mat_short.lower() in ('nan', 'none'):
        mat_short = ''

    # 2. 色数
    def _to_int(v):
        try:
            if pd.isna(v):
                return 0
            val_str = str(v).strip()
            if not val_str or val_str.lower() in ('nan', 'none'):
                return 0
            return int(float(val_str))
        except Exception:
            return 0

    c_front = _to_int(row.get('表色数'))
    c_back = _to_int(row.get('裏色数'))
    c_tot = _to_int(row.get('総色数'))
    c_num = _to_int(row.get('色数'))

    colors_total = c_tot if c_tot > 0 else (c_front + c_back if (c_front > 0 or c_back > 0) else c_num)

    if c_front > 0 and c_back > 0:
        color_display = f"表{c_front}/裏{c_back} ({colors_total}色)"
    elif c_front > 0:
        color_display = f"表{c_front}色" if c_front != colors_total else f"{c_front}色"
    elif c_back > 0:
        color_display = f"裏{c_back}色"
    elif colors_total > 0:
        color_display = f"{colors_total}色"
    else:
        color_display = "無地" if (mat_name or mat_short) else ""

    # 3. サイズ
    def _to_float(v):
        try:
            if pd.isna(v):
                return 0.0
            val_str = str(v).strip()
            if not val_str or val_str.lower() in ('nan', 'none'):
                return 0.0
            return float(val_str)
        except Exception:
            return 0.0

    w = _to_float(row.get('サイズ巾'))
    p = _to_float(row.get('サイズピッチ'))

    # 4. 量目（重量）
    prod_name = str(row.get('商品名称', '')).strip() if pd.notna(row.get('商品名称')) else ''
    weight_num, cap_disp = format_capacity(row.get('重量'), prod_name)

    return mat_name, mat_short, c_front, c_back, colors_total, color_display, w, p, weight_num, cap_disp


def import_as400_sales_csv(csv_path: Optional[str] = None, force: bool = False) -> bool:
    """
    AS/400のCSVを取り込んで専用SQLiteキャッシュ（sales_cache.db）に保存する。
    - 確定売上（売上回数 > 0）: as400_sales_orders
    - 受注残・未出荷（売上回数 == 0）: as400_backlog_orders
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

        # 削除フラグの除外
        if '削除ＦＬＧ' in df.columns:
            df = df[df['削除ＦＬＧ'].astype(str).str.strip() != '1'].copy()

        if '売上回数' in df.columns:
            df['売上回数_num'] = pd.to_numeric(df['売上回数'], errors='coerce').fillna(0)
        else:
            df['売上回数_num'] = 1

        # 1. 銘柄行（コード 999999999）のマッピングを一瞬で作成
        brand_df = df[df['商品コード'].astype(str).str.strip() == '999999999']
        brand_map = dict(zip(zip(brand_df['受注№'], brand_df['受注枝番']), brand_df['商品名称'].astype(str).str.strip()))

        # 2. 受注行№の重複排除
        df_unique = df.drop_duplicates(subset=['受注№', '受注枝番', '受注行№'], keep='first').copy()

        # 3. 各行の有効数量と原価の計算
        df_unique['引当数_num'] = pd.to_numeric(df_unique['引当数'], errors='coerce').fillna(0)
        df_unique['受注数_num'] = pd.to_numeric(df_unique['受注数'], errors='coerce').fillna(0)
        df_unique['原単価_num'] = pd.to_numeric(df_unique['原単価（下代）'], errors='coerce').fillna(0)
        df_unique['受注金額_num'] = pd.to_numeric(df_unique['受注金額'], errors='coerce').fillna(0)

        df_unique['line_qty'] = df_unique['引当数_num'].where(df_unique['引当数_num'] > 0, df_unique['受注数_num'])
        df_unique['line_cost'] = df_unique['line_qty'] * df_unique['原単価_num']

        amount_map = df_unique.groupby(['受注№', '受注枝番'])['受注金額_num'].sum().to_dict()
        cost_map = df_unique.groupby(['受注№', '受注枝番'])['line_cost'].sum().to_dict()

        # ----------------------------------------------------
        # A. 確定売上（売上回数 > 0）のレコード作成
        # ----------------------------------------------------
        sales_df_all = df[df['売上回数_num'] > 0].copy()
        prod_mask = sales_df_all['商品コード'].astype(str).str.strip().str.startswith(('0', '1', '2', '3', '4', '5', '6', '7', '8')) & \
                    (~sales_df_all['商品コード'].astype(str).str.strip().str.startswith(('90', '91', '99')))
        main_sales_df = sales_df_all[prod_mask].drop_duplicates(subset=['受注№', '受注枝番'], keep='first')
        
        all_sales_keys = set(zip(sales_df_all['受注№'], sales_df_all['受注枝番']))
        main_sales_keys = set(zip(main_sales_df['受注№'], main_sales_df['受注枝番']))
        missing_sales_keys = all_sales_keys - main_sales_keys
        if missing_sales_keys:
            fallback_df = sales_df_all.drop_duplicates(subset=['受注№', '受注枝番'], keep='first')
            fallback_missing = fallback_df[fallback_df.set_index(['受注№', '受注枝番']).index.isin(missing_sales_keys)]
            main_sales_df = pd.concat([main_sales_df, fallback_missing], ignore_index=True)

        sales_records = []
        for row in main_sales_df.to_dict('records'):
            jno = row.get('受注№', 0)
            eda = row.get('受注枝番', 0)
            key = (jno, eda)

            raw_cust_code = str(row.get('得意先コード', '')).strip().split('.')[0]
            cust_code = raw_cust_code.lstrip('0') or raw_cust_code
            cust_name = str(row.get('得意先名称', '')).strip()
            cust_rank = str(row.get('得意先ランク', '')).strip() if pd.notna(row.get('得意先ランク')) else ''

            direct_code = str(row.get('直送先コード', '')).strip().split('.')[0] if pd.notna(row.get('直送先コード')) else ''
            direct_name = str(row.get('直送先名称', '')).strip() if pd.notna(row.get('直送先名称')) else ''
            classification = str(row.get('文字１', '')).replace('\t', '').strip() if pd.notna(row.get('文字１')) else ''

            prod_code = str(row.get('商品コード', '')).strip()
            prod_name = str(row.get('商品名称', '')).strip()
            brand_name = brand_map.get(key, '')

            shape_type = str(row.get('文字１.1', '')).strip() if pd.notna(row.get('文字１.1')) else ''
            title = str(row.get('タイトル', '')).strip() if pd.notna(row.get('タイトル')) else ''
            is_roll = ('ロール' in shape_type) or ('ロール' in prod_name) or ('RZ' in prod_name) or ('RA' in prod_name) or ('RZ' in title) or ('RA' in title)
            unit = 'ｍ' if is_roll else '枚'

            order_qty = float(row.get('受注数', 0)) if pd.notna(row.get('受注数')) else 0.0
            hiki_qty = float(row.get('引当数', 0)) if pd.notna(row.get('引当数')) else 0.0
            qty = hiki_qty if hiki_qty > 0 else order_qty

            base_uprice = float(row.get('売上単価', 0)) if pd.notna(row.get('売上単価')) else 0.0
            base_cprice = float(row.get('原単価（下代）', 0)) if pd.notna(row.get('原単価（下代）')) else 0.0

            amount = float(amount_map.get(key, qty * base_uprice))
            total_cost = float(cost_map.get(key, qty * base_cprice))
            profit = amount - total_cost

            unit_price = round(amount / qty, 2) if qty > 0 else base_uprice
            cost_price = round(total_cost / qty, 2) if qty > 0 else base_cprice

            sales_rep = str(row.get('社員名', '')).strip() if pd.notna(row.get('社員名')) else ''
            
            order_date_raw = str(row.get('受注日', '')).strip().split('.')[0]
            order_date = f"{order_date_raw[:4]}-{order_date_raw[4:6]}-{order_date_raw[6:]}" if len(order_date_raw) == 8 and order_date_raw.isdigit() else order_date_raw

            delivery_date_raw = str(row.get('納期日', '')).strip().split('.')[0]
            delivery_date = f"{delivery_date_raw[:4]}-{delivery_date_raw[4:6]}-{delivery_date_raw[6:]}" if len(delivery_date_raw) == 8 and delivery_date_raw.isdigit() else delivery_date_raw

            if delivery_date and len(delivery_date) == 10 and '2020-01-01' <= delivery_date <= '2027-12-31':
                sales_date = delivery_date
            else:
                sales_date = order_date

            mat_name, mat_short, c_front, c_back, c_total, c_disp, s_w, s_p, w_val, cap_disp = extract_material_and_colors(row)
            finish_note = str(row.get('仕上備考', '')).strip() if pd.notna(row.get('仕上備考')) else ''
            print_note = str(row.get('印刷備考', '')).strip() if pd.notna(row.get('印刷備考')) else ''

            sales_records.append((
                int(jno) if str(jno).isdigit() else 0,
                int(eda) if str(eda).isdigit() else 0,
                order_date,
                delivery_date,
                sales_date,
                cust_code,
                cust_name,
                cust_rank,
                direct_code,
                direct_name,
                classification,
                prod_code,
                prod_name,
                brand_name,
                shape_type,
                unit,
                order_qty,
                qty,
                unit_price,
                cost_price,
                amount,
                profit,
                sales_rep,
                title,
                mat_name,
                mat_short,
                c_front,
                c_back,
                c_total,
                c_disp,
                s_w,
                s_p,
                w_val,
                cap_disp,
                finish_note,
                print_note,
                current_mtime
            ))

        # ----------------------------------------------------
        # B. 受注残・納期管理（売上回数 == 0）のレコード作成
        # ----------------------------------------------------
        backlog_df_all = df[df['売上回数_num'] == 0].copy()
        prod_mask_b = backlog_df_all['商品コード'].astype(str).str.strip().str.startswith(('0', '1', '2', '3', '4', '5', '6', '7', '8')) & \
                      (~backlog_df_all['商品コード'].astype(str).str.strip().str.startswith(('90', '91', '99')))
        main_backlog_df = backlog_df_all[prod_mask_b].drop_duplicates(subset=['受注№', '受注枝番'], keep='first')
        
        all_backlog_keys = set(zip(backlog_df_all['受注№'], backlog_df_all['受注枝番']))
        main_backlog_keys = set(zip(main_backlog_df['受注№'], main_backlog_df['受注枝番']))
        missing_backlog_keys = all_backlog_keys - main_backlog_keys
        if missing_backlog_keys:
            fallback_df = backlog_df_all.drop_duplicates(subset=['受注№', '受注枝番'], keep='first')
            fallback_missing = fallback_df[fallback_df.set_index(['受注№', '受注枝番']).index.isin(missing_backlog_keys)]
            main_backlog_df = pd.concat([main_backlog_df, fallback_missing], ignore_index=True)

        backlog_records = []
        for row in main_backlog_df.to_dict('records'):
            jno = row.get('受注№', 0)
            eda = row.get('受注枝番', 0)
            key = (jno, eda)

            raw_cust_code = str(row.get('得意先コード', '')).strip().split('.')[0]
            cust_code = raw_cust_code.lstrip('0') or raw_cust_code
            cust_name = str(row.get('得意先名称', '')).strip()

            direct_code = str(row.get('直送先コード', '')).strip().split('.')[0] if pd.notna(row.get('直送先コード')) else ''
            direct_name = str(row.get('直送先名称', '')).strip() if pd.notna(row.get('直送先名称')) else ''
            classification = str(row.get('文字１', '')).replace('\t', '').strip() if pd.notna(row.get('文字１')) else ''

            prod_code = str(row.get('商品コード', '')).strip()
            prod_name = str(row.get('商品名称', '')).strip()
            brand_name = brand_map.get(key, '')

            shape_type = str(row.get('文字１.1', '')).strip() if pd.notna(row.get('文字１.1')) else ''
            title = str(row.get('タイトル', '')).strip() if pd.notna(row.get('タイトル')) else ''
            is_roll = ('ロール' in shape_type) or ('ロール' in prod_name) or ('RZ' in prod_name) or ('RA' in prod_name) or ('RZ' in title) or ('RA' in title)
            unit = 'ｍ' if is_roll else '枚'

            order_qty = float(row.get('受注数', 0)) if pd.notna(row.get('受注数')) else 0.0
            hiki_qty = float(row.get('引当数', 0)) if pd.notna(row.get('引当数')) else 0.0

            base_uprice = float(row.get('売上単価', 0)) if pd.notna(row.get('売上単価')) else 0.0
            base_cprice = float(row.get('原単価（下代）', 0)) if pd.notna(row.get('原単価（下代）')) else 0.0

            calc_qty = hiki_qty if hiki_qty > 0 else order_qty
            amount = float(amount_map.get(key, calc_qty * base_uprice))
            total_cost = float(cost_map.get(key, calc_qty * base_cprice))
            profit = amount - total_cost

            unit_price = round(amount / calc_qty, 2) if calc_qty > 0 else base_uprice
            cost_price = round(total_cost / calc_qty, 2) if calc_qty > 0 else base_cprice

            sales_rep = str(row.get('社員名', '')).strip() if pd.notna(row.get('社員名')) else ''
            
            order_date_raw = str(row.get('受注日', '')).strip().split('.')[0]
            order_date = f"{order_date_raw[:4]}-{order_date_raw[4:6]}-{order_date_raw[6:]}" if len(order_date_raw) == 8 and order_date_raw.isdigit() else order_date_raw

            delivery_date_raw = str(row.get('納期日', '')).strip().split('.')[0]
            delivery_date = f"{delivery_date_raw[:4]}-{delivery_date_raw[4:6]}-{delivery_date_raw[6:]}" if len(delivery_date_raw) == 8 and delivery_date_raw.isdigit() else delivery_date_raw

            arrival_date_raw = str(row.get('入荷予定日', '')).strip().split('.')[0] if pd.notna(row.get('入荷予定日')) else ''
            arrival_date = f"{arrival_date_raw[:4]}-{arrival_date_raw[4:6]}-{arrival_date_raw[6:]}" if len(arrival_date_raw) == 8 and arrival_date_raw.isdigit() and arrival_date_raw != '00000000' and int(arrival_date_raw) > 0 else ''

            shipping_note = str(row.get('出荷備考', '')).strip() if pd.notna(row.get('出荷備考')) else ''
            finish_note = str(row.get('仕上備考', '')).strip() if pd.notna(row.get('仕上備考')) else ''
            print_note = str(row.get('印刷備考', '')).strip() if pd.notna(row.get('印刷備考')) else ''
            special_note = str(row.get('備考特約', '')).strip() if pd.notna(row.get('備考特約')) else ''
            
            is_complete = int(row.get('完納ＦＬＧ', 0)) if str(row.get('完納ＦＬＧ', '')).strip().isdigit() else 0

            status_code, status_label = classify_delivery_status(delivery_date, arrival_date, shipping_note, special_note)
            mat_name, mat_short, c_front, c_back, c_total, c_disp, s_w, s_p, w_val, cap_disp = extract_material_and_colors(row)

            backlog_records.append((
                int(jno) if str(jno).isdigit() else 0,
                int(eda) if str(eda).isdigit() else 0,
                order_date,
                delivery_date,
                arrival_date,
                cust_code,
                cust_name,
                direct_code,
                direct_name,
                classification,
                prod_code,
                prod_name,
                brand_name,
                shape_type,
                unit,
                order_qty,
                hiki_qty,
                unit_price,
                cost_price,
                amount,
                profit,
                sales_rep,
                status_code,
                status_label,
                shipping_note,
                finish_note,
                print_note,
                special_note,
                mat_name,
                mat_short,
                c_front,
                c_back,
                c_total,
                c_disp,
                s_w,
                s_p,
                w_val,
                cap_disp,
                is_complete,
                current_mtime
            ))

        # ----------------------------------------------------
        # C. 専用SQLiteへ一括保存
        # ----------------------------------------------------
        with get_sales_db_conn() as conn:
            cursor = conn.cursor()
            
            # 売上データ更新
            cursor.execute("DELETE FROM as400_sales_orders")
            cursor.executemany("""
                INSERT INTO as400_sales_orders (
                    order_no, branch_no, order_date, delivery_date, sales_date,
                    customer_code, customer_name, customer_rank, direct_customer_code, direct_customer_name,
                    classification,
                    product_code, product_name, brand_name, shape_type, unit, order_quantity, quantity,
                    unit_price, cost_price, amount, profit, sales_rep, title,
                    material_name, material_short, colors_front, colors_back, colors_total, color_display,
                    size_width, size_pitch, weight, capacity_display, finish_note, print_note, csv_mtime
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, sales_records)

            # 受注残データ更新
            cursor.execute("DELETE FROM as400_backlog_orders")
            cursor.executemany("""
                INSERT INTO as400_backlog_orders (
                    order_no, branch_no, order_date, delivery_date, arrival_date,
                    customer_code, customer_name, direct_customer_code, direct_customer_name,
                    classification,
                    product_code, product_name, brand_name, shape_type, unit,
                    order_quantity, allocated_quantity, unit_price, cost_price, amount, profit,
                    sales_rep, delivery_status, delivery_status_label,
                    shipping_note, finish_note, print_note, special_note,
                    material_name, material_short, colors_front, colors_back, colors_total, color_display,
                    size_width, size_pitch, weight, capacity_display, is_complete_flag, csv_mtime
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, backlog_records)

            cursor.execute("INSERT OR REPLACE INTO as400_sales_meta (key, value) VALUES ('last_mtime', ?)", (str(current_mtime),))
            cursor.execute("INSERT OR REPLACE INTO as400_sales_meta (key, value) VALUES ('last_csv_path', ?)", (target_path,))
            cursor.execute("INSERT OR REPLACE INTO as400_sales_meta (key, value) VALUES ('last_import_time', ?)", (datetime.now().isoformat(),))
            cursor.execute("INSERT OR REPLACE INTO as400_sales_meta (key, value) VALUES ('record_count', ?)", (str(len(sales_records)),))
            cursor.execute("INSERT OR REPLACE INTO as400_sales_meta (key, value) VALUES ('backlog_count', ?)", (str(len(backlog_records)),))
            conn.commit()

        logger.info(f"Fast AS/400 sales import completed: {len(sales_records)} sales & {len(backlog_records)} backlog orders saved into sales_cache.db")
        return True

    except Exception as e:
        logger.error(f"Failed to import AS/400 sales CSV: {e}", exc_info=True)
        return False


def get_customer_sales_summary(customer_code: str) -> Dict[str, Any]:
    """特定の得意先コードの売上サマリーと直近購入履歴を取得（sales_date = 納期・売上日基準で集計）"""
    clean_code = str(customer_code).strip().split('.')[0].lstrip('0')
    init_sales_db()

    with get_sales_db_conn() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # 直近10件の売上明細履歴（売上計上日順）
        cursor.execute("""
            SELECT order_no, branch_no, order_date, delivery_date, sales_date, product_name, brand_name, shape_type, unit, order_quantity, quantity, unit_price, cost_price, amount, profit, sales_rep,
                   material_name, material_short, colors_front, colors_back, colors_total, color_display, size_width, size_pitch, weight, capacity_display, finish_note, print_note
            FROM as400_sales_orders
            WHERE customer_code = ? OR customer_code = ?
            ORDER BY sales_date DESC, order_date DESC
            LIMIT 10
        """, (clean_code, f"00{clean_code}"))
        
        history = []
        for r in cursor.fetchall():
            s_width = r["size_width"] if "size_width" in r.keys() and r["size_width"] is not None else 0.0
            s_pitch = r["size_pitch"] if "size_pitch" in r.keys() and r["size_pitch"] is not None else 0.0
            if s_width > 0 and s_pitch > 0:
                s_disp = f"{int(s_width) if s_width.is_integer() else s_width}×{int(s_pitch) if s_pitch.is_integer() else s_pitch}"
            elif s_width > 0:
                s_disp = f"巾{int(s_width) if s_width.is_integer() else s_width}"
            elif s_pitch > 0:
                s_disp = f"P{int(s_pitch) if s_pitch.is_integer() else s_pitch}"
            else:
                s_disp = ""

            cap_disp = r["capacity_display"] if "capacity_display" in r.keys() and r["capacity_display"] else ""

            history.append({
                "order_no": r["order_no"] if "order_no" in r.keys() else 0,
                "branch_no": r["branch_no"] if "branch_no" in r.keys() else 0,
                "order_date": r["order_date"],
                "delivery_date": r["delivery_date"],
                "sales_date": r["sales_date"] or r["delivery_date"] or r["order_date"],
                "product_name": r["product_name"],
                "brand_name": r["brand_name"],
                "shape_type": r["shape_type"] or "",
                "material_name": r["material_name"] if "material_name" in r.keys() and r["material_name"] else (r["material_short"] if "material_short" in r.keys() and r["material_short"] else ""),
                "material_short": r["material_short"] if "material_short" in r.keys() and r["material_short"] else "",
                "color_display": r["color_display"] if "color_display" in r.keys() and r["color_display"] else "",
                "size_display": s_disp,
                "weight": r["weight"] if "weight" in r.keys() else 0.0,
                "capacity_display": cap_disp,
                "finish_note": r["finish_note"] if "finish_note" in r.keys() and r["finish_note"] else "",
                "print_note": r["print_note"] if "print_note" in r.keys() and r["print_note"] else "",
                "unit": r["unit"] or "枚",
                "order_quantity": r["order_quantity"] if "order_quantity" in r.keys() else r["quantity"],
                "quantity": r["quantity"],
                "unit_price": r["unit_price"],
                "cost_price": r["cost_price"] if "cost_price" in r.keys() else 0.0,
                "amount": r["amount"],
                "profit": r["profit"] if "profit" in r.keys() else 0.0,
                "sales_rep": r["sales_rep"]
            })

        # 会計年度（事業年度：2月始まり〜翌年1月決算）
        today = datetime.now()
        current_fy = today.year if today.month >= 2 else today.year - 1
        last_fy = current_fy - 1
        two_years_ago_fy = current_fy - 2

        # 期間定義
        # 当期 (例: 2026年度 -> 2026-02-01 〜 2027-01-31)
        fy_curr_start = f"{current_fy:04d}-02-01"
        fy_curr_end = f"{current_fy + 1:04d}-01-31"

        # 前期通期 (例: 2025年度 -> 2025-02-01 〜 2026-01-31)
        fy_last_start = f"{last_fy:04d}-02-01"
        fy_last_end = f"{current_fy:04d}-01-31"

        # 前々期通期 (例: 2024年度 -> 2024-02-01 〜 2025-01-31)
        fy_2y_start = f"{two_years_ago_fy:04d}-02-01"
        fy_2y_end = f"{last_fy:04d}-01-31"

        # 当期実績集計 (sales_date 納期・売上基準)
        cursor.execute("""
            SELECT 
                COUNT(*) as order_count,
                SUM(amount) as total_amount,
                SUM(profit) as total_profit,
                MAX(customer_rank) as rank_class,
                MAX(customer_name) as cust_name
            FROM as400_sales_orders
            WHERE (customer_code = ? OR customer_code = ?)
              AND sales_date >= ? AND sales_date <= ?
        """, (clean_code, f"00{clean_code}", fy_curr_start, fy_curr_end))
        curr_stat = cursor.fetchone()

        # 前期実績集計 (2025年度通期)
        cursor.execute("""
            SELECT 
                SUM(amount) as total_amount,
                SUM(profit) as total_profit
            FROM as400_sales_orders
            WHERE (customer_code = ? OR customer_code = ?)
              AND sales_date >= ? AND sales_date <= ?
        """, (clean_code, f"00{clean_code}", fy_last_start, fy_last_end))
        last_stat = cursor.fetchone()

        # 前々期実績集計 (2024年度通期)
        cursor.execute("""
            SELECT 
                SUM(amount) as total_amount,
                SUM(profit) as total_profit
            FROM as400_sales_orders
            WHERE (customer_code = ? OR customer_code = ?)
              AND sales_date >= ? AND sales_date <= ?
        """, (clean_code, f"00{clean_code}", fy_2y_start, fy_2y_end))
        two_ago_stat = cursor.fetchone()

        sales_amount = (curr_stat["total_amount"] if curr_stat else None) or 0
        profit_amount = (curr_stat["total_profit"] if curr_stat else None) or 0
        last_sales = (last_stat["total_amount"] if last_stat else None) or 0
        last_profit = (last_stat["total_profit"] if last_stat else None) or 0
        two_ago_sales = (two_ago_stat["total_amount"] if two_ago_stat else None) or 0
        two_ago_profit = (two_ago_stat["total_profit"] if two_ago_stat else None) or 0

        yoy = round((sales_amount / last_sales) * 100, 1) if last_sales > 0 else None

        # 最終売上日
        cursor.execute("""
            SELECT MAX(sales_date) as last_sales_date, MAX(order_date) as last_order_date
            FROM as400_sales_orders
            WHERE customer_code = ? OR customer_code = ?
        """, (clean_code, f"00{clean_code}"))
        last_order = cursor.fetchone()
        last_order_date = last_order["last_sales_date"] if last_order and last_order["last_sales_date"] else (last_order["last_order_date"] if last_order else None)

        # 月別売上集計（直近12ヶ月 + 前年同月実績比較、売上日 sales_date 基準）
        cursor.execute("""
            SELECT SUBSTR(sales_date, 1, 7) as ym, SUM(amount) as sales, SUM(profit) as profit, COUNT(*) as orders
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
            "fiscal_year": f"{current_fy}年度 (2月〜1月)",
            "customer_code": clean_code,
            "customer_name": curr_stat["cust_name"] if curr_stat and curr_stat["cust_name"] else "",
            "rank_class": curr_stat["rank_class"] if curr_stat and curr_stat["rank_class"] else "",
            "sales_amount": sales_amount,
            "gross_profit": profit_amount,
            "sales_last_year": last_sales,
            "profit_last_year": last_profit,
            "sales_2y_ago": two_ago_sales,
            "profit_2y_ago": two_ago_profit,
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

    is_up_to_date = False
    if csv_info and meta.get("last_mtime"):
        try:
            current_mtime = os.path.getmtime(latest_csv)
            last_mtime = float(meta["last_mtime"])
            is_up_to_date = (current_mtime <= last_mtime)
        except Exception:
            pass

    return {
        "is_syncing": _is_syncing,
        "total_orders": total_orders,
        "last_import_time": last_import,
        "last_csv_path": meta.get("last_csv_path"),
        "latest_csv": csv_info,
        "configured_dir": DEFAULT_AS400_CSV_DIR,
        "auto_sync_enabled": True,
        "is_up_to_date": is_up_to_date
    }


def auto_check_and_import() -> bool:
    """
    共有フォルダ内の最新CSVを検知し、未取り込み（更新日時が新しい）であれば自動で取り込む。
    既に最新の場合は数ミリ秒でスキップするため常時監視に適している。
    """
    global _is_syncing
    if not _sync_lock.acquire(blocking=False):
        logger.debug("auto_check_and_import: Sync already in progress, skipping.")
        return False
    
    try:
        latest_csv = find_latest_sales_csv()
        if not latest_csv or not os.path.exists(latest_csv):
            return False

        current_mtime = os.path.getmtime(latest_csv)
        init_sales_db()
        
        needs_import = False
        with get_sales_db_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM as400_sales_meta WHERE key = 'last_mtime'")
            row = cursor.fetchone()
            if not row:
                needs_import = True
            else:
                try:
                    last_mtime = float(row[0])
                    if current_mtime > last_mtime:
                        needs_import = True
                except ValueError:
                    needs_import = True

        if needs_import:
            logger.info(f"Auto-sync detected new AS/400 sales CSV: {latest_csv} (mtime: {current_mtime}). Starting auto import...")
            _is_syncing = True
            try:
                # 内部でDB更新とlast_mtimeの保存を行う
                return import_as400_sales_csv(csv_path=latest_csv, force=True)
            finally:
                _is_syncing = False
        else:
            logger.debug(f"Auto-sync: AS/400 sales CSV is already up-to-date ({latest_csv}).")
            return False
    except Exception as e:
        logger.error(f"Error during auto_check_and_import: {e}", exc_info=True)
        return False
    finally:
        _sync_lock.release()


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


def query_as400_backlog_orders(
    sales_rep: Optional[str] = None,
    customer_code: Optional[str] = None,
    direct_dest: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    keyword: Optional[str] = None,
    limit: int = 500,
    offset: int = 0
) -> Dict[str, Any]:
    """
    AS/400の受注残・未出荷データ（as400_backlog_orders）を検索・集計する。
    - 納期ステータス: confirmed(確定), asap(早出可), provisional(仮納期・預かり), delayed(納期超過)
    """
    init_sales_db()
    with get_sales_db_conn() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        conditions = ["1=1"]
        params = []

        if sales_rep and sales_rep not in ('all', '全員', '全体', ''):
            clean_rep = sales_rep.strip('【】').strip()
            conditions.append("(sales_rep LIKE ? OR sales_rep = ?)")
            params.extend([f"%{clean_rep}%", clean_rep])

        if customer_code and customer_code != 'all':
            clean_c = customer_code.lstrip('0') or customer_code
            conditions.append("(customer_code = ? OR customer_code = ?)")
            params.extend([clean_c, clean_c.zfill(5)])

        if direct_dest and direct_dest not in ('all', '全員', '全体', ''):
            d_clean = direct_dest.strip()
            conditions.append("(direct_customer_name LIKE ? OR direct_customer_code = ?)")
            params.extend([f"%{d_clean}%", d_clean])

        if status and status not in ('all', ''):
            conditions.append("delivery_status = ?")
            params.append(status)

        if start_date:
            conditions.append("delivery_date >= ?")
            params.append(start_date)

        if end_date:
            conditions.append("delivery_date <= ?")
            params.append(end_date)

        if keyword:
            kw = f"%{keyword.strip()}%"
            conditions.append("(product_name LIKE ? OR brand_name LIKE ? OR customer_name LIKE ? OR CAST(order_no AS TEXT) LIKE ? OR direct_customer_name LIKE ? OR shipping_note LIKE ?)")
            params.extend([kw, kw, kw, kw, kw, kw])

        where_clause = " AND ".join(conditions)

        # サマリー統計用条件（ステータス以外のフィルターを適用）
        summary_conditions = ["1=1"]
        summary_params = []
        if sales_rep and sales_rep not in ('all', '全員', '全体', ''):
            clean_rep = sales_rep.strip('【】').strip()
            summary_conditions.append("(sales_rep LIKE ? OR sales_rep = ?)")
            summary_params.extend([f"%{clean_rep}%", clean_rep])
        if customer_code and customer_code != 'all':
            clean_c = customer_code.lstrip('0') or customer_code
            summary_conditions.append("(customer_code = ? OR customer_code = ?)")
            summary_params.extend([clean_c, clean_c.zfill(5)])
        if direct_dest and direct_dest not in ('all', '全員', '全体', ''):
            d_clean = direct_dest.strip()
            summary_conditions.append("(direct_customer_name LIKE ? OR direct_customer_code = ?)")
            summary_params.extend([f"%{d_clean}%", d_clean])
        if start_date:
            summary_conditions.append("delivery_date >= ?")
            summary_params.append(start_date)
        if end_date:
            summary_conditions.append("delivery_date <= ?")
            summary_params.append(end_date)
        if keyword:
            kw = f"%{keyword.strip()}%"
            summary_conditions.append("(product_name LIKE ? OR brand_name LIKE ? OR customer_name LIKE ? OR CAST(order_no AS TEXT) LIKE ? OR direct_customer_name LIKE ? OR shipping_note LIKE ?)")
            summary_params.extend([kw, kw, kw, kw, kw, kw])

        summary_where = " AND ".join(summary_conditions)

        cursor.execute(f"""
            SELECT 
                COUNT(*) as total_count,
                COALESCE(SUM(CASE WHEN delivery_status = 'confirmed' THEN 1 ELSE 0 END), 0) as confirmed_count,
                COALESCE(SUM(CASE WHEN delivery_status = 'asap' THEN 1 ELSE 0 END), 0) as asap_count,
                COALESCE(SUM(CASE WHEN delivery_status = 'provisional' THEN 1 ELSE 0 END), 0) as provisional_count,
                COALESCE(SUM(CASE WHEN delivery_status = 'delayed' THEN 1 ELSE 0 END), 0) as delayed_count,
                COALESCE(SUM(amount), 0) as total_amount
            FROM as400_backlog_orders
            WHERE {summary_where}
        """, summary_params)
        summary_row = cursor.fetchone()
        summary = dict(summary_row) if summary_row else {
            "total_count": 0, "confirmed_count": 0, "asap_count": 0,
            "provisional_count": 0, "delayed_count": 0, "total_amount": 0
        }

        # 明細取得（納期日順、納期超過・確定・早出・仮納期の順にソート）
        cursor.execute(f"""
            SELECT 
                id, order_no, branch_no, order_date, delivery_date, arrival_date,
                customer_code, customer_name, direct_customer_code, direct_customer_name,
                product_code, product_name, brand_name, shape_type, unit,
                order_quantity, allocated_quantity, unit_price, cost_price, amount, profit,
                sales_rep, delivery_status, delivery_status_label,
                shipping_note, finish_note, print_note, special_note,
                material_name, material_short, colors_front, colors_back, colors_total, color_display,
                size_width, size_pitch, weight, capacity_display, is_complete_flag
            FROM as400_backlog_orders
            WHERE {where_clause}
            ORDER BY 
                CASE WHEN delivery_status = 'delayed' THEN 1
                     WHEN delivery_status = 'confirmed' THEN 2
                     WHEN delivery_status = 'asap' THEN 3
                     ELSE 4 END ASC,
                delivery_date ASC, order_no ASC
            LIMIT ? OFFSET ?
        """, params + [limit, offset])

        rows = cursor.fetchall()
        orders = []
        for r in rows:
            d = dict(r)
            d['order_no_display'] = f"{d['order_no']}-{str(d['branch_no']).zfill(2)}" if d['order_no'] else '-'
            # サイズ整形
            s_w = d.get('size_width') or 0.0
            s_p = d.get('size_pitch') or 0.0
            if s_w > 0 and s_p > 0:
                d['size_display'] = f"{int(s_w) if float(s_w).is_integer() else s_w}×{int(s_p) if float(s_p).is_integer() else s_p}"
            elif s_w > 0:
                d['size_display'] = f"巾{int(s_w) if float(s_w).is_integer() else s_w}"
            elif s_p > 0:
                d['size_display'] = f"P{int(s_p) if float(s_p).is_integer() else s_p}"
            else:
                d['size_display'] = ""
            
            d['capacity_display'] = d.get('capacity_display') or ""
            orders.append(d)

        # 担当者リスト（絞り込み用）
        cursor.execute("SELECT DISTINCT sales_rep FROM as400_backlog_orders WHERE sales_rep IS NOT NULL AND sales_rep != '' ORDER BY sales_rep")
        reps = [r[0] for r in cursor.fetchall()]

        # 直送先リスト（絞り込み用: 選択中担当者や全体で存在する直送先）
        dest_conds = ["direct_customer_name IS NOT NULL AND direct_customer_name != ''"]
        dest_params = []
        if sales_rep and sales_rep not in ('all', '全員', '全体', ''):
            dest_conds.append("(sales_rep LIKE ? OR sales_rep = ?)")
            dest_params.extend([f"%{clean_rep}%", clean_rep])
        cursor.execute(f"""
            SELECT DISTINCT direct_customer_name 
            FROM as400_backlog_orders 
            WHERE {' AND '.join(dest_conds)}
            ORDER BY direct_customer_name
        """, dest_params)
        direct_dests = [r[0] for r in cursor.fetchall()]

        return {
            "summary": summary,
            "orders": orders,
            "count": len(orders),
            "reps": reps,
            "direct_dests": direct_dests,
            "limit": limit,
            "offset": offset
        }


