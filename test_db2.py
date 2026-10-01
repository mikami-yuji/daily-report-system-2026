import sqlite3
import sys

db_path = r'C:\Users\ASAHI\Desktop\DailyReportSystem\data\sales_cache.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("SELECT name, type FROM sqlite_master")
items = cur.fetchall()
print('Items in DB:', items)

# as400_sales_orders のカラム名と日付範囲
cur.execute("PRAGMA table_info(as400_sales_orders)")
cols = [r[1] for r in cur.fetchall()]
print('Cols in as400_sales_orders:', cols)

cur.execute("SELECT MIN(sales_date), MAX(sales_date), MIN(order_date), MAX(order_date) FROM as400_sales_orders")
dates = cur.fetchone()
print('Dates in as400_sales_orders:', dates)

# 2026年以降のレコード数
cur.execute("SELECT COUNT(*) FROM as400_sales_orders WHERE sales_date >= '2026-02-01' OR order_date >= '2026-02-01'")
count_2026 = cur.fetchone()[0]
print('Records >= 2026-02-01:', count_2026)
