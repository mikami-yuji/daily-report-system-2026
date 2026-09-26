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

# サンプル伝票: 受注№ 1220457 (印刷代・製版代あり)
for jno in [1220457, 1179573, 1220401]:
    order_df = df[df['受注№'] == jno]
    for (no, eda), branch in order_df.groupby(['受注№', '受注枝番']):
        # 受注行№ごとの重複排除
        # 受注行№ごとに最初の行を採用して金額を合算
        unique_lines = branch.drop_duplicates(subset=['受注行№'], keep='first')
        
        # 主製品行（商品コードが 90/91/99 以外）
        prod_mask = ~unique_lines['商品コード'].astype(str).str.strip().str.startswith(('90', '91', '99'))
        main_prod = unique_lines[prod_mask]
        
        if len(main_prod) > 0:
            main_row = main_prod.iloc[0]
            main_name = main_row['商品名称'].strip()
            base_uprice = main_row['売上単価']
            base_cprice = main_row['原単価（下代）']
            qty = main_row['引当数'] if main_row['引当数'] > 0 else main_row['受注数']
            
            # 伝票全体の合計金額（印刷代・製版代含む）
            total_amount = unique_lines['受注金額'].sum()
            # 伝票全体の原価合計（各行の数量 * 原単価）
            total_cost = sum(r['引当数'] * r['原単価（下代）'] if r['引当数'] > 0 else r['受注数'] * r['原単価（下代）'] for _, r in unique_lines.iterrows())
            
            # 実効単価
            eff_uprice = round(total_amount / qty, 2) if qty > 0 else base_uprice
            eff_cprice = round(total_cost / qty, 2) if qty > 0 else base_cprice
            
            print(f"受注№ {no}-{eda}: {main_name[:20]}")
            print(f"  数量={qty}, 本体単価={base_uprice}円, 合計金額={total_amount:,}円 -> 実効売上単価={eff_uprice}円 (差額=+{eff_uprice-base_uprice:.2f}円)")
            print(f"  本体原価={base_cprice}円, 合計原価={total_cost:,.0f}円 -> 実効原単価={eff_cprice}円")
            print(f"  粗利額={total_amount - total_cost:,.0f}円")

