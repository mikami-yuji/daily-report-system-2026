import sqlite3
import pandas as pd
import glob
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

db_path = 'backend/data/sales_cache.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute('SELECT COUNT(*) FROM as400_sales_orders')
total = cursor.fetchone()[0]

cursor.execute('SELECT COUNT(*) FROM as400_sales_orders WHERE order_date = delivery_date')
same_date = cursor.fetchone()[0]

cursor.execute('SELECT COUNT(*) FROM as400_sales_orders WHERE order_date != delivery_date')
diff_date = cursor.fetchone()[0]

cursor.execute("SELECT COUNT(*) FROM as400_sales_orders WHERE delivery_date IS NULL OR delivery_date = ''")
empty_delivery = cursor.fetchone()[0]

# 月が異なるケース（受注月 != 納期月）
cursor.execute("SELECT COUNT(*) FROM as400_sales_orders WHERE SUBSTR(order_date, 1, 7) != SUBSTR(delivery_date, 1, 7) AND delivery_date != ''")
diff_month = cursor.fetchone()[0]

print(f"Total records in cache: {total}")
print(f"Same date (受注日 == 納期日): {same_date} ({same_date/total*100:.1f}%)")
print(f"Different date (受注日 != 納期日): {diff_date} ({diff_date/total*100:.1f}%)")
print(f"Different month (受注月 != 納期月): {diff_month} ({diff_month/total*100:.1f}%)")

print("\n--- Samples where order month != delivery month ---")
cursor.execute("""
    SELECT order_date, delivery_date, product_name, shape_type, amount, sales_rep
    FROM as400_sales_orders
    WHERE SUBSTR(order_date, 1, 7) != SUBSTR(delivery_date, 1, 7) AND delivery_date != ''
    LIMIT 10
""")
for r in cursor.fetchall():
    print(r)

print("\n--- 2030年の納期日など異常値があるかチェック ---")
cursor.execute("""
    SELECT order_date, delivery_date, product_name, amount
    FROM as400_sales_orders
    WHERE delivery_date > '2027-01-01'
    LIMIT 10
""")
future_samples = cursor.fetchall()
print(f"Future delivery dates (> 2027-01-01) count:")
cursor.execute("SELECT COUNT(*) FROM as400_sales_orders WHERE delivery_date > '2027-01-01'")
print(cursor.fetchone()[0])
for r in future_samples:
    print(r)

