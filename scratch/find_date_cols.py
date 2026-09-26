import pandas as pd
import glob
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

latest_csv = glob.glob(r"\\192.168.1.200\qibm\ABS\USERDATA\054\MY_TJUCM_*.CSV")
if not latest_csv:
    print("CSV not found")
    sys.exit(1)

csv_path = max(latest_csv, key=os.path.getmtime)
print(f"Reading CSV: {csv_path}")

df = pd.read_csv(csv_path, encoding='cp932', nrows=10000, low_memory=False)
df.columns = [str(c).strip() for c in df.columns]

# カラム名と、その中に「8桁の数字（日付っぽいもの）」が含まれているカラムを探す
print("\n--- Columns with 8-digit date-like numbers ---")
for col in df.columns:
    sample_vals = df[col].dropna().astype(str).str.strip().tolist()
    # 20240101〜20261231 の範囲の8桁数字があるか
    date_matches = [v for v in sample_vals if len(v) == 8 and v.isdigit() and v.startswith(('2023', '2024', '2025', '2026'))]
    if len(date_matches) > 100:
        print(f"Column '{col}' has date-like values: sample={date_matches[:5]} (matches: {len(date_matches)}/{len(sample_vals)})")

# 「売上回数」が 0 や 1, 2 の違いは何を表しているか？
print("\n--- '売上回数' breakdown ---")
print(df['売上回数'].value_counts(dropna=False))

# 売上回数 == 0 の明細とは？
zero_sales = df[df['売上回数'] == 0]
print(f"Count of 売上回数 == 0: {len(zero_sales)}")
if len(zero_sales) > 0:
    print(zero_sales[['受注日', '納期日', '完納ＦＬＧ', '売上回数', '商品名称', '受注金額']].head(5))

# 完納FLGの内訳
print("\n--- '完納ＦＬＧ' breakdown ---")
print(df['完納ＦＬＧ'].value_counts(dropna=False))

