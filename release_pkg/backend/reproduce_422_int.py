import requests
import json

url = "http://127.0.0.1:8000/reports?filename=daily_report_template.xlsm"

data = {
    "日付": "25/01/15",
    "行動内容": "test int conversion",
    "エリア": "",
    "得意先CD": 43006,  # Sending as int
    "訪問先名": "test",
    "面談者": "",
    "滞在時間": "",
    "商談内容": "",
    "提案物": "",
    "次回プラン": "",
    "重点顧客": "",
    "ランク": "",
    "デザイン提案有無": "",
    "デザイン種別": "",
    "デザイン名": "",
    "デザイン進捗状況": "",
    "デザイン依頼No.": "",
}

try:
    response = requests.post(url, json=data)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
