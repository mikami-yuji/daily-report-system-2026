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

# 商品コード 90... (印刷代等) と 91... (製版代等) の特徴
p90 = df[df['商品コード'].astype(str).str.strip().str.startswith('90')]
p91 = df[df['商品コード'].astype(str).str.strip().str.startswith('91')]

print(f"90系（印刷代・加工代等）の件数: {len(p90)}")
print(f"  受注数 sample: {p90['受注数'].head(5).tolist()}")
print(f"  売上単価 sample: {p90['売上単価'].head(5).tolist()}")
print(f"  商品名称 sample: {p90['商品名称'].str.strip().head(5).tolist()}")

print(f"\n91系（製版代等）の件数: {len(p91)}")
print(f"  受注数 sample: {p91['受注数'].head(5).tolist()}")
print(f"  売上単価 sample: {p91['売上単価'].head(5).tolist()}")
print(f"  商品名称 sample: {p91['商品名称'].str.strip().head(5).tolist()}")

# 他に 92系や9...系があるか？
p9_other = df[
    df['商品コード'].astype(str).str.strip().str.startswith('9') &
    (~df['商品コード'].astype(str).str.strip().str.startswith(('90', '91', '99')))
]
print(f"\nその他9系（92-98）の件数: {len(p9_other)}")
if len(p9_other) > 0:
    print(p9_other[['商品コード', '商品名称', '受注数', '売上単価', '受注金額']].head(5))

