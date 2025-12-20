import requests
import json

try:
    response = requests.get('http://localhost:8000/reports')
    data = response.json()
    if data:
        print("Keys in first report:", data[0].keys())
        # Check specifically for '上長コメント' in the first few reports
        for i, report in enumerate(data[:5]):
            print(f"Report {i} - 上長コメント: {report.get('上長コメント')}")
            print(f"Report {i} - コメント返信欄: {report.get('コメント返信欄')}")
    else:
        print("No data returned")
except Exception as e:
    print(e)
