import pandas as pd
import glob
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

latest_csv = glob.glob(r"\\192.168.1.200\qibm\ABS\USERDATA\054\MY_TJUCM_*.CSV")
csv_path = max(latest_csv, key=os.path.getmtime)

cols = ['受注日', '受注№', '受注枝番', '商品コード', '受注金額', '納期日', '完納ＦＬＧ', '売上回数', '文字１', '受注数', '引当数', '売上単価']
with open(csv_path, 'r', encoding='cp932', errors='replace') as f:
    df = pd.read_csv(f, usecols=lambda c: c.strip() in cols, low_memory=False)

df.columns = [str(c).strip() for c in df.columns]

# 金額比較
total_order_amt = df['受注金額'].sum()
# 引当数 * 売上単価
df['hiki_amt'] = df['引当数'] * df['売上単価']
total_hiki_amt = df['hiki_amt'].sum()

print(f"全社 受注金額合計: {total_order_amt:,.0f} 円")
print(f"全社 引当金額合計 (引当数×売上単価): {total_hiki_amt:,.0f} 円")
print(f"差額: {total_hiki_amt - total_order_amt:,.0f} 円 ({(total_hiki_amt - total_order_amt)/total_order_amt*100:.2f}%)")

# 受注数 != 引当数 の明細における差額
diff = df[df['受注数'] != df['引当数']]
print(f"\n差異が発生している明細のみ:")
print(f"  対象件数: {len(diff):,} 件")
print(f"  受注金額: {diff['受注金額'].sum():,.0f} 円")
print(f"  引当金額: {diff['hiki_amt'].sum():,.0f} 円")
print(f"  差異額: {diff['hiki_amt'].sum() - diff['受注金額'].sum():,.0f} 円")

# 完納FLG == 1 と 売上回数 >= 1 の条件で絞った場合
settled = df[(df['完納ＦＬＧ'] == 1) & (df['売上回数'] >= 1)]
print(f"\n完納かつ売上回数>=1の明細 (計 {len(settled):,} 件):")
print(f"  受注数 != 引当数 の件数: {len(settled[settled['受注数'] != settled['引当数']]):,} 件")

