import pandas as pd
import glob
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

latest_csv = glob.glob(r"\\192.168.1.200\qibm\ABS\USERDATA\054\MY_TJUCM_*.CSV")
csv_path = max(latest_csv, key=os.path.getmtime)
print(f"Reading full CSV: {csv_path}")

with open(csv_path, 'r', encoding='cp932', errors='replace') as f:
    df = pd.read_csv(f, nrows=10000, low_memory=False)

df.columns = [str(c).strip() for c in df.columns]

# カラム名に「数」「量」「売」「額」が含まれるものを抽出
target_cols = [c for c in df.columns if any(k in c for k in ['数', '量', '売', '出荷', '納', '額', '残'])]
print("Target columns:", target_cols)

for c in target_cols:
    sample = df[c].dropna().head(5).tolist()
    print(f"  {c}: sample={sample}")

# 受注数 != 引当数 のケースがあるか？
if '引当数' in df.columns and '受注数' in df.columns:
    diff_hikiatari = df[df['受注数'] != df['引当数']]
    print(f"\n受注数 != 引当数 の件数 (10000行中): {len(diff_hikiatari)}")
    if len(diff_hikiatari) > 0:
        print(diff_hikiatari[['受注日', '納期日', '商品名称', '受注数', '引当数', '売上単価', '受注金額']].head(10))

# 「受注金額」と「受注数 * 売上単価」の乖離をチェック
df['calc_amt'] = df['受注数'] * df['売上単価']
diff_amt = df[abs(df['受注金額'] - df['calc_amt']) > 1]
print(f"\n受注金額 != 受注数 * 売上単価 の件数 (10000行中): {len(diff_amt)}")
if len(diff_amt) > 0:
    print(diff_amt[['商品コード', '商品名称', '受注数', '売上単価', '受注金額', 'calc_amt']].head(10))

