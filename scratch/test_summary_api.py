import sys
sys.path.insert(0, 'backend')
import sales_importer
sys.stdout.reconfigure(encoding='utf-8')

# サンプル顧客（70232）
res = sales_importer.get_customer_sales_summary('70232')
print('Customer Summary for 70232:')
print('  Customer Name:', res['customer_name'])
print('  Sales Amount (This Year):', f"{res['sales_amount']:,} 円")
print('  Profit (This Year):', f"{res['gross_profit']:,} 円")
print('  Last Sales Date:', res['last_order_date'])
print('  Recent Orders Count:', len(res['recent_orders']))
if res['recent_orders']:
    print('  Sample Order 1:', res['recent_orders'][0])
print('  Monthly Sales sample:')
for m in res['monthly_sales'][-4:]:
    print('   ', m)
