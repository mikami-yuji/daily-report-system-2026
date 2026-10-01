import sys
sys.path.insert(0, 'backend')
import sqlite3
import pandas as pd
import period_comparison_analyzer as pca

# 直接 pca.get_period_comparison_data を呼び出してみる
# まず db_path をデスクトップの DB に向けてみる
db_path = r'C:\Users\ASAHI\Desktop\DailyReportSystem\data\sales_cache.db'
print("Using DB:", db_path)

pca.get_db_path = lambda: db_path
res = pca.get_period_comparison_data()
print("Categories count:", len(res.get('categories', [])))
print("Summary:", res.get('summary'))
print("Period info:", res.get('period_info'))
if res.get('categories'):
    for c in res['categories'][:3]:
        print("Category:", c['name'], "current sheets:", c['current']['sheets'], "meters:", c['current']['meters'])
