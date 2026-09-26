import pandas as pd
import glob
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

latest_csv = glob.glob(r"\\192.168.1.200\qibm\ABS\USERDATA\054\MY_TJUCM_*.CSV")
csv_path = max(latest_csv, key=os.path.getmtime)

cols = ['受注日', '受注№', '受注枝番', '商品コード', '商品名称', '受注金額', '納期日', '完納ＦＬＧ', '売上回数', '文字１', '受注数', '引当数', '売上単価', '原単価（下代）']
with open(csv_path, 'r', encoding='cp932', errors='replace') as f:
    df = pd.read_csv(f, usecols=lambda c: c.strip() in cols, low_memory=False)

df.columns = [str(c).strip() for c in df.columns]

# 受注数 != 引当数 のデータ
diff_df = df[df['受注数'] != df['引当数']].copy()
print(f"受注数 != 引当数 のレコード数: {len(diff_df)} / {len(df)} ({len(diff_df)/len(df)*100:.1f}%)")

# 引当数 > 受注数 （多めに出来て納品？）
over = diff_df[diff_df['引当数'] > diff_df['受注数']]
# 引当数 < 受注数 （ロスで減った？）
under = diff_df[diff_df['引当数'] < diff_df['受注数']]
# 引当数 == 0
zero_hiki = diff_df[diff_df['引当数'] == 0]

print(f"引当数 < 受注数 (減少・ロス等): {len(under)}")
print(f"引当数 > 受注数 (増加・過剰等): {len(over)}")
print(f"引当数 == 0 (未引当・欠品等): {len(zero_hiki)}")

print("\n--- 引当数 < 受注数 のサンプル ---")
for idx, r in under.head(10).iterrows():
    print(f"受注No={r['受注№']}-{r['受注枝番']}, 商品={r['商品名称'].strip()[:20]}, 受注数={r['受注数']}, 引当数={r['引当数']}, 単価={r['売上単価']}, 受注金額={r['受注金額']}, 引当金額(引当*単価)={r['引当数']*r['売上単価']}")

# 他に「売上数」や「出荷数」のような列がないか、CSV全カラムの型とユニーク値を再検査
with open(csv_path, 'r', encoding='cp932', errors='replace') as f:
    sample_df = pd.read_csv(f, nrows=100)
sample_df.columns = [str(c).strip() for c in sample_df.columns]

print("\n--- 全数値カラム一覧 ---")
for c in sample_df.columns:
    col_data = sample_df[c].dropna()
    if len(col_data) > 0 and pd.to_numeric(col_data, errors='coerce').notnull().all():
        print(f"  {c}: min={col_data.min()}, max={col_data.max()}, sample={col_data.head(3).tolist()}")

