import pandas as pd
import glob
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

latest_csv = glob.glob(r"\\192.168.1.200\qibm\ABS\USERDATA\054\MY_TJUCM_*.CSV")
csv_path = max(latest_csv, key=os.path.getmtime)

cols = ['受注日', '受注№', '受注枝番', '商品コード', '商品名称', '受注金額', '納期日', '完納ＦＬＧ', '売上回数', '文字１']
with open(csv_path, 'r', encoding='cp932', errors='replace') as f:
    df = pd.read_csv(f, usecols=lambda c: c.strip() in cols, low_memory=False)

df.columns = [str(c).strip() for c in df.columns]

# 文字１が製造系（ロールフレキソ、シルク版、別注）のサンプル
mfg = df[df['文字１'].astype(str).str.contains('フレキソ|シルク|別注|シール', regex=True)].head(20)
print("--- 製造系製品のサンプル（受注日 vs 納期日 vs 売上回数） ---")
print(mfg[['受注日', '納期日', '売上回数', '完納ＦＬＧ', '文字１', '商品名称', '受注金額']])

# 受注日と納期日の日数差（2030年などの異常値を除く）
mfg_valid = df[
    (df['文字１'].astype(str).str.contains('フレキソ|シルク|別注', regex=True)) &
    (df['納期日'] < 20261231) &
    (df['納期日'] >= df['受注日'])
].copy()

mfg_valid['order_dt'] = pd.to_datetime(mfg_valid['受注日'].astype(str), format='%Y%m%d', errors='coerce')
mfg_valid['deliv_dt'] = pd.to_datetime(mfg_valid['納期日'].astype(str), format='%Y%m%d', errors='coerce')
mfg_valid['days_diff'] = (mfg_valid['deliv_dt'] - mfg_valid['order_dt']).dt.days

print("\n--- 製造系製品（フレキソ・シルク・別注）の受注から納期までの日数分布 ---")
print(mfg_valid['days_diff'].describe())

print("\n日数差の区間:")
print(pd.cut(mfg_valid['days_diff'], bins=[-1, 0, 7, 14, 21, 30, 60, 180, 1000]).value_counts().sort_index())

