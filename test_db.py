import sqlite3

db_path = r'C:\Users\ASAHI\Desktop\DailyReportSystem\data\sales_cache.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]
print('Tables in desktop sales_cache.db:', tables)
for t in tables:
    cur.execute(f"SELECT COUNT(*) FROM {t}")
    print(f"Table {t}: {cur.fetchone()[0]} records")
