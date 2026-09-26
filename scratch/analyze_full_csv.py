import pandas as pd
import glob
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

latest_csv = glob.glob(r"\\192.168.1.200\qibm\ABS\USERDATA\054\MY_TJUCM_*.CSV")
csv_path = max(latest_csv, key=os.path.getmtime)
print(f"Reading full CSV: {csv_path}")

cols = ['受注日', '受注№', '受注枝番', '商品コード', '商品名称', '受注金額', '納期日', '完納ＦＬＧ', '売上回数', '文字１']
with open(csv_path, 'r', encoding='cp932', errors='replace') as f:
    df = pd.read_csv(f, usecols=lambda c: c.strip() in cols, low_memory=False)

df.columns = [str(c).strip() for c in df.columns]

print(f"Total rows: {len(df)}")
print("\n売上回数 distribution in entire CSV:")
print(df['売上回数'].value_counts(dropna=False))

# 売上回数 == 0 の明細について商品コードや金額を確認
print("\n売上回数 == 0 の商品コード上位:")
print(df[df['売上回数'] == 0]['商品コード'].value_counts().head(10))

# 「文字１」（既製品、別注品など）の分布
print("\n文字１ distribution:")
print(df['文字１'].astype(str).str.strip().value_counts().head(10))

# 文字１ごとに、受注日 == 納期日 の割合を見る
df['is_same_date'] = df['受注日'] == df['納期日']
print("\n文字１別の 受注日 == 納期日 の割合:")
for val, group in df.groupby(df['文字１'].astype(str).str.strip()):
    if len(group) > 500:
        same_pct = (group['is_same_date'].sum() / len(group)) * 100
        print(f"  {val}: total={len(group)}, 同日={same_pct:.1f}%")

