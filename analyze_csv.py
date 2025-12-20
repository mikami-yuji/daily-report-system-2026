import pandas as pd
import sys

csv_path = r'C:\Users\asahi\Desktop\#WPTKU00_20251220155301078142 - コピー.CSV'

try:
    # Try cp932 (Shift-JIS extension) as it's common for Japanese CSVs
    df = pd.read_csv(csv_path, encoding='cp932', nrows=5)
    print("--- COLUMNS ---")
    print(df.columns.tolist())
    print("\n--- SAMPLE DATA ---")
    print(df.head())
except Exception as e:
    print(f"Error: {e}")
