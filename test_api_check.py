import urllib.request
import json
import time

for _ in range(10):
    try:
        with urllib.request.urlopen('http://127.0.0.1:8001/api/version') as res:
            v_data = json.loads(res.read().decode())
            print('Running Version:', v_data.get('version'))
            break
    except Exception:
        time.sleep(1)

with urllib.request.urlopen('http://127.0.0.1:8001/api/sales/period-category-comparison') as res:
    data = json.loads(res.read().decode('utf-8'))
    print('Comparison success! Categories count:', len(data.get('categories', [])))
    print('Summary current meters:', data.get('summary', {}).get('current', {}).get('meters'))
    print('Summary current sheets:', data.get('summary', {}).get('current', {}).get('sheets'))
    print('Summary current amount:', data.get('summary', {}).get('current', {}).get('amount'))
    print('Period info current label:', data.get('period_info', {}).get('current', {}).get('label'))
    for cat in data.get('categories', [])[:4]:
        name = cat['name']
        m = cat['current']['meters']
        s = cat['current']['sheets']
        gr = cat.get('growth_rate_meters')
        print(f"  - {name}: meters={m}, sheets={s}, growth={gr}%")
