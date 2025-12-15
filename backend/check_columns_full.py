import pandas as pd
import os

# Use dynamic default logic from main.py
EXCEL_DIR = r'\\Asahipack02\社内書類ｎｅｗ\01：部署別　営業部\02：営業日報\2025年度'
DEFAULT_EXCEL_FILE = "daily_report_template.xlsm"

if os.path.exists(EXCEL_DIR):
    files = [f for f in os.listdir(EXCEL_DIR) if f.endswith('.xlsm') and not f.startswith('~$')]
    if files:
        DEFAULT_EXCEL_FILE = files[0]

file_path = os.path.join(EXCEL_DIR, DEFAULT_EXCEL_FILE)

print(f"Reading: {file_path}")
try:
    df = pd.read_excel(file_path, sheet_name='営業日報', header=0)
    print("Columns:")
    for i, col in enumerate(df.columns):
        print(f"{i+1}: {col}") # 1-based index matching openpyxl
except Exception as e:
    print(f"Error: {e}")
