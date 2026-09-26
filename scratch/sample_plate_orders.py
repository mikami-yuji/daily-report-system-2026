import pandas as pd
import glob
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

latest_csv = glob.glob(r"\\192.168.1.200\qibm\ABS\USERDATA\054\MY_TJUCM_*.CSV")
csv_path = max(latest_csv, key=os.path.getmtime)

cols = ['受注日', '受注№', '受注枝番', '受注行№', '商品コード', '商品名称', '受注金額', '納期日', '完納ＦＬＧ', '売上回数', '文字１', '受注数', '引当数', '売上単価', '原単価（下代）']
with open(csv_path, 'r', encoding='cp932', errors='replace') as f:
    df = pd.read_csv(f, usecols=lambda c: c.strip() in cols, low_memory=False)

df.columns = [str(c).strip() for c in df.columns]

# 「製版代」が含まれる伝票
plate_orders = df[df['商品名称'].astype(str).str.contains('製版|版代')]['受注№'].unique()
print(f"製版代を含む伝票番号数: {len(plate_orders)}")

for jno in plate_orders[:5]:
    print(f"\n==================== 受注№ {jno} ====================")
    order_df = df[df['受注№'] == jno]
    for (jno, eda), branch_df in order_df.groupby(['受注№', '受注枝番']):
        print(f"--- 枝番 {eda} ---")
        print(branch_df[['受注行№', '商品コード', '商品名称', '受注数', '引当数', '売上単価', '原単価（下代）', '受注金額']])

