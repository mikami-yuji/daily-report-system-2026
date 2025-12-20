import pandas as pd
import openpyxl

excel_file = '../daily_report_template.xlsm'

# Read with openpyxl to see raw column names
wb = openpyxl.load_workbook(excel_file, keep_vba=True)
ws = wb['営業日報']

print("Raw column names from openpyxl:")
for col in range(1, 31):
    cell_value = ws.cell(row=1, column=col).value
    print(f"Column {col}: {repr(cell_value)}")

wb.close()

# Read with pandas
df = pd.read_excel(excel_file, sheet_name='営業日報', header=0)
print("\nColumn names from pandas (before cleaning):")
for i, col in enumerate(df.columns, 1):
    print(f"Column {i}: {repr(col)}")

# Clean up column names
df.columns = [str(col).replace('\n', '') for col in df.columns]
print("\nColumn names from pandas (after cleaning):")
for i, col in enumerate(df.columns, 1):
    print(f"Column {i}: {repr(col)}")
