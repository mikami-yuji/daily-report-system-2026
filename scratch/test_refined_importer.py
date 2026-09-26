import os
import glob
import time
import sqlite3
import pandas as pd
from datetime import datetime

test_db = 'scratch/test_refined_sales.db'
if os.path.exists(test_db):
    os.remove(test_db)

latest_csv = glob.glob(r"\\192.168.1.200\qibm\ABS\USERDATA\054\MY_TJUCM_*.CSV")
csv_path = max(latest_csv, key=os.path.getmtime)
print(f"Reading CSV: {csv_path}")

t0 = time.time()

with open(csv_path, 'r', encoding='cp932', errors='replace') as f:
    df = pd.read_csv(f, low_memory=False)

df.columns = [str(c).strip() for c in df.columns]

# 1. 銘柄名マップ
brand_df = df[df['商品コード'].astype(str).str.strip() == '999999999']
brand_map = dict(zip(zip(brand_df['受注№'], brand_df['受注枝番']), brand_df['商品名称'].astype(str).str.strip()))

# 2. 受注行№の重複排除
df_unique = df.drop_duplicates(subset=['受注№', '受注枝番', '受注行№'], keep='first').copy()

# 3. 各行の有効数量と原価
df_unique['引当数_num'] = pd.to_numeric(df_unique['引当数'], errors='coerce').fillna(0)
df_unique['受注数_num'] = pd.to_numeric(df_unique['受注数'], errors='coerce').fillna(0)
df_unique['原単価_num'] = pd.to_numeric(df_unique['原単価（下代）'], errors='coerce').fillna(0)
df_unique['受注金額_num'] = pd.to_numeric(df_unique['受注金額'], errors='coerce').fillna(0)

df_unique['line_qty'] = df_unique['引当数_num'].where(df_unique['引当数_num'] > 0, df_unique['受注数_num'])
df_unique['line_cost'] = df_unique['line_qty'] * df_unique['原単価_num']

amount_map = df_unique.groupby(['受注№', '受注枝番'])['受注金額_num'].sum().to_dict()
cost_map = df_unique.groupby(['受注№', '受注枝番'])['line_cost'].sum().to_dict()

# 4. 主製品行の抽出
prod_mask = df['商品コード'].astype(str).str.strip().str.startswith(('0', '1', '2', '3', '4', '5', '6', '7', '8')) & \
            (~df['商品コード'].astype(str).str.strip().str.startswith(('90', '91', '99')))
main_df = df[prod_mask].drop_duplicates(subset=['受注№', '受注枝番'], keep='first')

all_groups_keys = set(zip(df['受注№'], df['受注枝番']))
main_keys = set(zip(main_df['受注№'], main_df['受注枝番']))
missing_keys = all_groups_keys - main_keys
if missing_keys:
    fallback_df = df.drop_duplicates(subset=['受注№', '受注枝番'], keep='first')
    fallback_missing = fallback_df[fallback_df.set_index(['受注№', '受注枝番']).index.isin(missing_keys)]
    main_df = pd.concat([main_df, fallback_missing], ignore_index=True)

# 5. レコード生成
current_mtime = os.path.getmtime(csv_path)

# 高速化のために必要なカラムを辞書リストに変換
records = []
for row in main_df.to_dict('records'):
    jno = row.get('受注№', 0)
    eda = row.get('受注枝番', 0)
    key = (jno, eda)

    raw_cust_code = str(row.get('得意先コード', '')).strip().split('.')[0]
    cust_code = raw_cust_code.lstrip('0') or raw_cust_code
    cust_name = str(row.get('得意先名称', '')).strip()
    cust_rank = str(row.get('得意先ランク', '')).strip() if pd.notna(row.get('得意先ランク')) else ''

    prod_code = str(row.get('商品コード', '')).strip()
    prod_name = str(row.get('商品名称', '')).strip()
    brand_name = brand_map.get(key, '')

    # 形状区分（T列 / 文字１.1）
    shape_type = str(row.get('文字１.1', '')).strip() if pd.notna(row.get('文字１.1')) else ''

    title = str(row.get('タイトル', '')).strip() if pd.notna(row.get('タイトル')) else ''
    is_roll = ('ロール' in shape_type) or ('ロール' in prod_name) or ('RZ' in prod_name) or ('RA' in prod_name) or ('RZ' in title) or ('RA' in title)
    unit = 'ｍ' if is_roll else '枚'

    order_qty = float(row.get('受注数', 0)) if pd.notna(row.get('受注数')) else 0.0
    hiki_qty = float(row.get('引当数', 0)) if pd.notna(row.get('引当数')) else 0.0
    # 売上数量: 引当数 > 0 なら引当数、それ以外は受注数
    qty = hiki_qty if hiki_qty > 0 else order_qty

    base_uprice = float(row.get('売上単価', 0)) if pd.notna(row.get('売上単価')) else 0.0
    base_cprice = float(row.get('原単価（下代）', 0)) if pd.notna(row.get('原単価（下代）')) else 0.0

    amount = float(amount_map.get(key, qty * base_uprice))
    total_cost = float(cost_map.get(key, qty * base_cprice))
    profit = amount - total_cost

    # 実効売上単価（印刷代・製版代合算）
    unit_price = round(amount / qty, 2) if qty > 0 else base_uprice
    cost_price = round(total_cost / qty, 2) if qty > 0 else base_cprice

    sales_rep = str(row.get('社員名', '')).strip() if pd.notna(row.get('社員名')) else ''
    
    order_date_raw = str(row.get('受注日', '')).strip().split('.')[0]
    order_date = f"{order_date_raw[:4]}-{order_date_raw[4:6]}-{order_date_raw[6:]}" if len(order_date_raw) == 8 and order_date_raw.isdigit() else order_date_raw

    delivery_date_raw = str(row.get('納期日', '')).strip().split('.')[0]
    delivery_date = f"{delivery_date_raw[:4]}-{delivery_date_raw[4:6]}-{delivery_date_raw[6:]}" if len(delivery_date_raw) == 8 and delivery_date_raw.isdigit() else delivery_date_raw

    # 売上計上日（納期日基準、異常値は受注日にフォールバック）
    if delivery_date and len(delivery_date) == 10 and '2020-01-01' <= delivery_date <= '2027-12-31':
        sales_date = delivery_date
    else:
        sales_date = order_date

    records.append((
        int(jno) if str(jno).isdigit() else 0,
        int(eda) if str(eda).isdigit() else 0,
        order_date,
        delivery_date,
        sales_date,
        cust_code,
        cust_name,
        cust_rank,
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
        current_mtime
    ))

# DB挿入
conn = sqlite3.connect(test_db)
cursor = conn.cursor()
cursor.execute("""
    CREATE TABLE as400_sales_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no INTEGER,
        branch_no INTEGER,
        order_date TEXT,
        delivery_date TEXT,
        sales_date TEXT,
        customer_code TEXT,
        customer_name TEXT,
        customer_rank TEXT,
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
        csv_mtime REAL
    )
""")
cursor.executemany("""
    INSERT INTO as400_sales_orders (
        order_no, branch_no, order_date, delivery_date, sales_date,
        customer_code, customer_name, customer_rank, product_code, product_name,
        brand_name, shape_type, unit, order_quantity, quantity,
        unit_price, cost_price, amount, profit, sales_rep, title, csv_mtime
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""", records)
conn.commit()

print(f"Total processing time: {time.time() - t0:.2f}s")
